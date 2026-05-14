from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx, os, jwt, time, re, secrets
from datetime import datetime, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List

load_dotenv()

app = FastAPI(title="WR Gestionale API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

MONGO_URL = os.getenv("MONGO_URL", "")
SECRET_KEY = os.getenv("SECRET_KEY", "secret")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
SHEET_CSV_URL = os.getenv("SHEET_CSV_URL", "")

client = AsyncIOMotorClient(MONGO_URL)
db = client.wr_gestionale
bearer = HTTPBearer()

def create_token(data: dict):
    payload = {**data, "exp": datetime.utcnow() + timedelta(days=7)}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token: str):
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])

async def get_current_user(creds: HTTPAuthorizationCredentials = Depends(bearer)):
    try:
        payload = decode_token(creds.credentials)
        user = await db.users.find_one({"email": payload["email"]})
        if not user:
            raise HTTPException(status_code=401)
        await db.users.update_one({"email": payload["email"]}, {"$set": {"last_seen": datetime.utcnow()}})
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido")

@app.post("/auth/google")
async def auth_google(data: dict):
    token = data.get("token")
    try:
        async with httpx.AsyncClient() as c:
            r = await c.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
        info = r.json()
        if "error" in info:
            raise HTTPException(status_code=401, detail=info.get("error_description", "Token non valido"))
        email = info.get("email", "")
        name = info.get("name", "")
        picture = info.get("picture", "")
        if not email:
            raise HTTPException(status_code=401, detail="Email non trovata nel token")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

    user = await db.users.find_one({"email": email})
    if not user:
        auto_role = "admin" if email.endswith("@mdsimpianti.com") else "pending"
        user_data = {"email": email, "name": name, "picture": picture, "role": auto_role, "sub_code": None, "created_at": datetime.utcnow()}
        await db.users.insert_one(user_data)
        user = user_data

    if user.get("role") == "pending":
        raise HTTPException(status_code=403, detail="Accesso in attesa di approvazione")

    tok = create_token({"email": email, "role": user["role"], "sub_code": user.get("sub_code")})
    return {"token": tok, "user": {"email": email, "name": name, "picture": picture, "role": user["role"], "sub_code": user.get("sub_code")}}

@app.get("/me")
async def get_me(user=Depends(get_current_user)):
    return {"email": user["email"], "name": user.get("name", ""), "picture": user.get("picture", ""), "role": user["role"], "sub_code": user.get("sub_code")}

_sheet_cache = {"data": [], "ts": 0}
CACHE_TTL = 300

async def get_sheet_data():
    global _sheet_cache
    if time.time() - _sheet_cache["ts"] < CACHE_TTL and _sheet_cache["data"]:
        return _sheet_cache["data"]
    async with httpx.AsyncClient() as c:
        r = await c.get(SHEET_CSV_URL, follow_redirects=True, timeout=15)
    import csv, io
    reader = csv.DictReader(io.StringIO(r.text), quoting=csv.QUOTE_MINIMAL)
    rows = []
    for row in reader:
        if not row:
            continue
        wr_val = str(row.get("WR", "") or "").strip()
        if not wr_val or not wr_val.isdigit():
            continue
        clean = {}
        for k, v in row.items():
            if k is None:
                continue
            clean[k.strip()] = (v or "").strip()
        for col in ["Latitudine", "Longitudine"]:
            val = clean.get(col, "")
            if val and re.match(r'^\d+,\d+$', val):
                clean[col] = val.replace(",", ".")
        rows.append(clean)
    _sheet_cache = {"data": rows, "ts": time.time()}
    return rows

@app.get("/wr")
async def get_wr(user=Depends(get_current_user)):
    if not SHEET_CSV_URL:
        return []
    rows = await get_sheet_data()

    if user["role"] == "sub":
        rows = [r for r in rows if r.get("Sq") == user.get("sub_code")]

    coord_corrette_cursor = db.coordinate_corrette.find({}, {"_id": 0})
    coord_corrette_list = await coord_corrette_cursor.to_list(length=5000)
    coord_corrette = {c["wr"]: c for c in coord_corrette_list}

    comune_coords = {}
    centrale_coords = {}
    for r in rows:
        lat = r.get("Latitudine", "")
        lon = r.get("Longitudine", "")
        try:
            flat = float(str(lat).replace(",", "."))
            flon = float(str(lon).replace(",", "."))
            if flat and flon and 35 < flat < 48 and 6 < flon < 19:
                comune = r.get("Localita", "")
                centrale = r.get("Centrale", "")
                if comune:
                    if comune not in comune_coords:
                        comune_coords[comune] = []
                    comune_coords[comune].append((flat, flon))
                if centrale:
                    if centrale not in centrale_coords:
                        centrale_coords[centrale] = []
                    centrale_coords[centrale].append((flat, flon))
        except:
            pass

    comune_ref = {k: (sum(v[0] for v in vs)/len(vs), sum(v[1] for v in vs)/len(vs)) for k, vs in comune_coords.items()}
    centrale_ref = {k: (sum(v[0] for v in vs)/len(vs), sum(v[1] for v in vs)/len(vs)) for k, vs in centrale_coords.items()}

    for r in rows:
        wr_key = str(r.get("WR", "")).strip()
        if wr_key in coord_corrette:
            r["Latitudine"] = str(coord_corrette[wr_key]["lat"])
            r["Longitudine"] = str(coord_corrette[wr_key]["lon"])
            r["CoordCorretta"] = True
            r["CoordInferita"] = False
        else:
            lat = r.get("Latitudine", "")
            lon = r.get("Longitudine", "")
            try:
                flat = float(str(lat).replace(",", "."))
                flon = float(str(lon).replace(",", "."))
                has_coord = flat and flon and 35 < flat < 48 and 6 < flon < 19
            except:
                has_coord = False
            if not has_coord:
                comune = r.get("Localita", "")
                centrale = r.get("Centrale", "")
                ref = comune_ref.get(comune) or centrale_ref.get(centrale)
                if ref:
                    r["LatInferita"] = round(ref[0], 6)
                    r["LonInferita"] = round(ref[1], 6)
                    r["CoordInferita"] = True

    if user["role"] == "sub":
        impostazioni = await db.impostazioni.find_one({}, {"_id": 0})
        parole_nascoste = [p.lower().strip() for p in (impostazioni or {}).get("discriminante_nascondi", []) if p.strip()]
        if parole_nascoste:
            rows = [r for r in rows if not any(p in (r.get("Discriminante") or "").lower() for p in parole_nascoste)]
        wr_nascoste_doc = await db.wr_nascoste.find_one({}, {"_id": 0})
        wr_nascoste_lista = (wr_nascoste_doc or {}).get("lista", [])
        if wr_nascoste_lista:
            rows = [r for r in rows if str(r.get("WR", "")).strip() not in wr_nascoste_lista]

    return rows

class MiniSquadra(BaseModel):
    nome: str
    sub_code: Optional[str] = None
    wr_list: List[str] = []

@app.get("/mini-squadre")
async def get_mini_squadre(user=Depends(get_current_user), sub_code: str = None):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    if user["role"] == "admin":
        filter_q = {"sub_code": sub_code} if sub_code else {}
    else:
        filter_q = {"sub_code": user["sub_code"]}
    cursor = db.mini_squadre.find(filter_q, {"_id": 0})
    return await cursor.to_list(length=100)

@app.post("/mini-squadre")
async def create_mini_squadra(sq: MiniSquadra, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    token = secrets.token_urlsafe(8)
    sub_code = user["sub_code"] if user["role"] == "sub" else sq.sub_code
    doc = {"nome": sq.nome, "sub_code": sub_code, "wr_list": sq.wr_list, "link_token": token, "created_at": datetime.utcnow()}
    await db.mini_squadre.insert_one(doc)
    return {"token": token, "link": f"/view/{token}"}

@app.put("/mini-squadre/{token}/wr")
async def update_mini_squadra_wr(token: str, wr_list: List[str], user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    await db.mini_squadre.update_one({"link_token": token}, {"$set": {"wr_list": wr_list}})
    return {"ok": True}

@app.delete("/mini-squadre/{token}")
async def delete_mini_squadra(token: str, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    await db.mini_squadre.delete_one({"link_token": token})
    return {"ok": True}

class Sollecito(BaseModel):
    wr: str
    sub_code: str
    messaggio: Optional[str] = ""

@app.get("/solleciti")
async def get_solleciti(user=Depends(get_current_user)):
    if user["role"] == "sub":
        cursor = db.solleciti.find({"sub_code": user["sub_code"]}, {"_id": 0})
    else:
        cursor = db.solleciti.find({}, {"_id": 0})
    return await cursor.to_list(length=500)

@app.post("/solleciti")
async def crea_sollecito(s: Sollecito, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    nuovo = {"messaggio": s.messaggio, "data": datetime.utcnow(), "da": user["email"]}
    await db.solleciti.update_one(
        {"wr": s.wr, "sub_code": s.sub_code},
        {"$push": {"storico": nuovo}, "$set": {"wr": s.wr, "sub_code": s.sub_code, "ultima_data": datetime.utcnow()}},
        upsert=True
    )
    return {"ok": True}

@app.delete("/solleciti/{wr}")
async def elimina_sollecito(wr: str, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.solleciti.delete_one({"wr": wr})
    return {"ok": True}

class StoricoUpdate(BaseModel):
    storico: List[dict] = []

@app.post("/solleciti/{wr}/storico")
async def aggiorna_storico(wr: str, body: StoricoUpdate, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    if not body.storico:
        await db.solleciti.delete_one({"wr": wr})
    else:
        await db.solleciti.update_one({"wr": wr}, {"$set": {"storico": body.storico}})
    return {"ok": True}

class Lavorazione(BaseModel):
    token: str
    wr: str
    nota: Optional[str] = ""

@app.get("/lavorazioni/{token}")
async def get_lavorazioni(token: str):
    cursor = db.lavorazioni.find({"token": token}, {"_id": 0})
    return await cursor.to_list(length=500)

@app.post("/lavorazioni")
async def set_lavorazione(data: Lavorazione):
    existing = await db.lavorazioni.find_one({"token": data.token, "wr": data.wr})
    if existing:
        await db.lavorazioni.delete_one({"token": data.token, "wr": data.wr})
        return {"ok": True, "action": "removed"}
    else:
        await db.lavorazioni.insert_one({"token": data.token, "wr": data.wr, "nota": data.nota, "data": datetime.utcnow()})
        return {"ok": True, "action": "added"}

@app.put("/lavorazioni/{token}/{wr}/nota")
async def update_nota(token: str, wr: str, data: dict):
    await db.lavorazioni.update_one({"token": token, "wr": wr}, {"$set": {"nota": data.get("nota", "")}})
    return {"ok": True}

@app.get("/view/{token}")
async def public_view(token: str):
    sq = await db.mini_squadre.find_one({"link_token": token}, {"_id": 0})
    if not sq:
        raise HTTPException(status_code=404, detail="Link non valido")
    rows = await get_sheet_data()
    wr_list = [str(w).strip() for w in sq.get("wr_list", [])]
    result = [r for r in rows if str(r.get("WR", "")).strip() in wr_list]
    return {"squadra": sq["nome"], "sub_code": sq["sub_code"], "wr": result}

@app.get("/admin/users")
async def get_users(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    cursor = db.users.find({}, {"_id": 0})
    return await cursor.to_list(length=200)

@app.put("/admin/users/{email}")
async def update_user(email: str, role: str, sub_code: Optional[str] = None, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.users.update_one({"email": email}, {"$set": {"role": role, "sub_code": sub_code}})
    return {"ok": True}

@app.get("/admin/online")
async def get_online(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    cutoff = datetime.utcnow() - timedelta(minutes=5)
    cursor = db.users.find({"last_seen": {"$gte": cutoff}}, {"_id": 0, "email": 1, "name": 1, "picture": 1, "role": 1, "sub_code": 1})
    return await cursor.to_list(length=100)

@app.post("/admin/migra-solleciti")
async def migra_solleciti(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    cursor = db.solleciti.find({})
    docs = await cursor.to_list(length=500)
    migrati = 0
    for doc in docs:
        if "storico" not in doc:
            storico = [{"messaggio": doc.get("messaggio", ""), "data": doc.get("data"), "da": doc.get("da", "")}]
            await db.solleciti.update_one({"_id": doc["_id"]}, {"$set": {"storico": storico}, "$unset": {"messaggio": "", "data": "", "da": ""}})
            migrati += 1
    return {"migrati": migrati}

class CoordinataCorretta(BaseModel):
    wr: str
    lat: float
    lon: float

@app.get("/coordinate-corrette")
async def get_coordinate_corrette(user=Depends(get_current_user)):
    cursor = db.coordinate_corrette.find({}, {"_id": 0})
    return await cursor.to_list(length=5000)

@app.post("/coordinate-corrette")
async def salva_coordinata(data: CoordinataCorretta, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.coordinate_corrette.update_one(
        {"wr": data.wr},
        {"$set": {"wr": data.wr, "lat": data.lat, "lon": data.lon, "updated_at": datetime.utcnow(), "updated_by": user["email"]}},
        upsert=True
    )
    return {"ok": True}

@app.delete("/coordinate-corrette/{wr}")
async def elimina_coordinata(wr: str, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.coordinate_corrette.delete_one({"wr": wr})
    return {"ok": True}

@app.get("/wr-nascoste")
async def get_wr_nascoste(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    doc = await db.wr_nascoste.find_one({}, {"_id": 0})
    return doc or {"lista": []}

@app.post("/wr-nascoste/{wr}")
async def nascondi_wr(wr: str, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.wr_nascoste.update_one({}, {"$addToSet": {"lista": wr}}, upsert=True)
    return {"ok": True}

@app.delete("/wr-nascoste/{wr}")
async def mostra_wr(wr: str, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.wr_nascoste.update_one({}, {"$pull": {"lista": wr}})
    return {"ok": True}

@app.get("/impostazioni")
async def get_impostazioni(user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    doc = await db.impostazioni.find_one({}, {"_id": 0})
    return doc or {"discriminante_nascondi": []}

@app.post("/impostazioni")
async def save_impostazioni(data: dict, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.impostazioni.update_one({}, {"$set": data}, upsert=True)
    return {"ok": True}

DEFAULT_CATEGORIE = [
    {"nome": "Fatto parziale", "emoji": "🔧", "pattern": "fatto.*su", "colore": "#f59e0b"},
    {"nome": "Manca XPole", "emoji": "🪝", "pattern": "manca xp|xpole", "colore": "#8b5cf6"},
    {"nome": "Manca cavetto/ONT", "emoji": "🔌", "pattern": "manca cavetto|manca ong|manca ongoing", "colore": "#14b8a6"},
    {"nome": "Manca sistemazione", "emoji": "⚙", "pattern": "manca sist|manca cavo", "colore": "#f97316"},
    {"nome": "Fatto", "emoji": "✅", "pattern": "^fatto$|fatto note|fatto pali", "colore": "#22c55e"},
]

@app.get("/categorie-discriminante")
async def get_categorie(user=Depends(get_current_user)):
    doc = await db.categorie_discriminante.find_one({}, {"_id": 0})
    return doc or {"categorie": DEFAULT_CATEGORIE}

@app.post("/categorie-discriminante")
async def save_categorie(data: dict, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403)
    await db.categorie_discriminante.update_one({}, {"$set": data}, upsert=True)
    return {"ok": True}
