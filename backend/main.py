from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx, os, jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from typing import Optional, List
import secrets

load_dotenv()

app = FastAPI(title="WR Gestionale API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── DATABASE ──
MONGO_URL = os.getenv("MONGO_URL", "mongodb://localhost:27017")
client = AsyncIOMotorClient(MONGO_URL)
db = client.wr_gestionale

# ── AUTH ──
SECRET_KEY = os.getenv("SECRET_KEY", "changeme")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
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
            raise HTTPException(status_code=401, detail="Utente non trovato")
        return user
    except Exception:
        raise HTTPException(status_code=401, detail="Token non valido")

# ── MODELS ──
class GoogleAuthRequest(BaseModel):
    token: str

class MiniSquadra(BaseModel):
    nome: str
    sub_code: str
    wr_list: List[str] = []

# ── ROUTES ──

@app.get("/")
def root():
    return {"status": "ok", "app": "WR Gestionale"}

@app.post("/auth/google")
async def google_auth(req: GoogleAuthRequest):
    async with httpx.AsyncClient() as client_http:
        r = await client_http.get(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {req.token}"}
        )
        if r.status_code != 200:
            raise HTTPException(status_code=401, detail="Token Google non valido")
        info = r.json()

    email = info.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Email non trovata")

    user = await db.users.find_one({"email": email})
    if not user:
        # Primo accesso — crea utente come "pending" (admin deve approvare)
        # oppure auto-assegna ruolo in base a logica custom
        user_data = {
            "email": email,
            "name": info.get("name", ""),
            "picture": info.get("picture", ""),
            "role": "pending",
            "sub_code": None,
            "created_at": datetime.utcnow()
        }
        await db.users.insert_one(user_data)
        user = user_data

    if user.get("role") == "pending":
        raise HTTPException(status_code=403, detail="Accesso in attesa di approvazione")

    token = create_token({"email": email, "role": user["role"], "sub_code": user.get("sub_code")})
    return {
        "token": token,
        "user": {
            "email": email,
            "name": user.get("name"),
            "picture": user.get("picture"),
            "role": user["role"],
            "sub_code": user.get("sub_code")
        }
    }

@app.get("/me")
async def get_me(user=Depends(get_current_user)):
    return {
        "email": user["email"],
        "name": user.get("name"),
        "picture": user.get("picture"),
        "role": user["role"],
        "sub_code": user.get("sub_code")
    }

# ── WR DATA (legge da Google Sheet CSV) ──
SHEET_CSV_URL = os.getenv("SHEET_CSV_URL", "")

import time
_sheet_cache = {"data": [], "ts": 0}
CACHE_TTL = 300  # 5 minuti

async def get_sheet_data():
    global _sheet_cache
    if time.time() - _sheet_cache["ts"] < CACHE_TTL and _sheet_cache["data"]:
        return _sheet_cache["data"]
    async with httpx.AsyncClient() as c:
        r = await c.get(SHEET_CSV_URL, follow_redirects=True)
    import csv, io, re
    reader = csv.DictReader(io.StringIO(r.text))
    rows = []
    for row in reader:
        if not row.get("WR", "").strip():
            continue
        clean = {k.strip(): v.strip() for k, v in row.items()}
        # Converti coordinate con virgola decimale in punto
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

    # Filtra per ruolo usando colonna "Sq"
    if user["role"] == "sub":
        rows = [r for r in rows if r.get("Sq") == user.get("sub_code")]
    elif user["role"] == "squad":
        sq = await db.mini_squadre.find_one({"link_token": user.get("squad_token")})
        if sq:
            rows = [r for r in rows if r.get("WR") in sq.get("wr_list", [])]
        else:
            rows = []

    return rows

# ── MINI-SQUADRE ──
@app.get("/mini-squadre")
async def get_mini_squadre(user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    filter_q = {} if user["role"] == "admin" else {"sub_code": user["sub_code"]}
    cursor = db.mini_squadre.find(filter_q, {"_id": 0})
    return await cursor.to_list(length=100)

@app.post("/mini-squadre")
async def create_mini_squadra(sq: MiniSquadra, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    token = secrets.token_urlsafe(8)
    doc = {
        "nome": sq.nome,
        "sub_code": user["sub_code"] if user["role"] == "sub" else sq.sub_code,
        "wr_list": sq.wr_list,
        "link_token": token,
        "created_at": datetime.utcnow()
    }
    await db.mini_squadre.insert_one(doc)
    return {"token": token, "link": f"/view/{token}"}

@app.put("/mini-squadre/{token}/wr")
async def update_mini_squadra_wr(token: str, wr_list: List[str], user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    await db.mini_squadre.update_one(
        {"link_token": token},
        {"$set": {"wr_list": wr_list}}
    )
    return {"ok": True}

@app.delete("/mini-squadre/{token}")
async def delete_mini_squadra(token: str, user=Depends(get_current_user)):
    if user["role"] not in ["admin", "sub"]:
        raise HTTPException(status_code=403)
    await db.mini_squadre.delete_one({"link_token": token})
    return {"ok": True}

# ── VIEW PUBBLICA (no auth) ──
@app.get("/view/{token}")
async def public_view(token: str):
    sq = await db.mini_squadre.find_one({"link_token": token}, {"_id": 0})
    if not sq:
        raise HTTPException(status_code=404, detail="Link non trovato")
    if not SHEET_CSV_URL:
        return {"squadra": sq["nome"], "wr": []}
    async with httpx.AsyncClient() as c:
        r = await c.get(SHEET_CSV_URL, follow_redirects=True)
    lines = r.text.strip().split("\n")
    headers = [h.strip() for h in lines[0].split(",")]
    rows = []
    for line in lines[1:]:
        vals = line.split(",")
        row = {headers[i]: vals[i].strip() if i < len(vals) else "" for i in range(len(headers))}
        if row.get("WR") in sq.get("wr_list", []):
            rows.append(row)
    return {"squadra": sq["nome"], "sub_code": sq["sub_code"], "wr": rows}

# ── ADMIN: gestione utenti ──
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
    await db.users.update_one(
        {"email": email},
        {"$set": {"role": role, "sub_code": sub_code}}
    )
    return {"ok": True}
