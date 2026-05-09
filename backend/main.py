import os, time, csv, io, jwt, httpx
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="WR Gestionale")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def fix_coop(request, call_next):
    response = await call_next(request)
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin-allow-popups"
    return response

# DB & Config
MONGO_URL = os.getenv("MONGO_URL")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret")
SHEET_CSV_URL = os.getenv("SHEET_CSV_URL", "")
client = AsyncIOMotorClient(MONGO_URL)
db = client.get_default_database()
users_col = db.users

# Auth
security = HTTPBearer()
class GoogleAuth(BaseModel):
    token: str

@app.post("/auth/google")
async def google_auth(req: GoogleAuth):
    async with httpx.AsyncClient() as c:
        r = await c.get("https://www.googleapis.com/oauth2/v3/userinfo", 
                        headers={"Authorization": f"Bearer {req.token}"})
    if r.status_code != 200:
        raise HTTPException(401, "Token Google non valido")
    info = r.json()
    email = info.get("email")
    if not email:
        raise HTTPException(401, "Email non trovata")

    user = await users_col.find_one({"email": email})
    if not user:
        await users_col.insert_one({
            "email": email, "name": info.get("name", email),
            "picture": info.get("picture", ""), "role": "pending", "sub_code": None
        })
        user = await users_col.find_one({"email": email})

    if user["role"] == "pending":
        raise HTTPException(403, "Accesso in attesa di approvazione")

    payload = {"sub": email, "role": user["role"], "exp": datetime.utcnow() + timedelta(days=7)}
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")
    return {"token": token, "role": user["role"], "name": user.get("name", email)}

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=["HS256"])
        return payload
    except:
        raise HTTPException(401, "Token non valido")

# Sheet Cache & Parser
_sheet_cache = {"data": [], "ts": 0}
CACHE_TTL = 300  # 5 min

def fix_coord(val):
    if not val: return None
    v = str(val).replace(",", ".")
    try: return float(v)
    except: return None

async def get_sheet_data():
    global _sheet_cache
    if time.time() - _sheet_cache["ts"] < CACHE_TTL and _sheet_cache["data"]:
        return _sheet_cache["data"]

    async with httpx.AsyncClient() as c:
        r = await c.get(SHEET_CSV_URL, follow_redirects=True, timeout=15)
    
    f = io.StringIO(r.text)
    reader = csv.DictReader(f)
    rows = []
    for row in reader:
        wr = row.get("WR", "").strip()
        if not wr or wr == "": continue
        row["Lat"] = fix_coord(row.get("Latitudine"))
        row["Lon"] = fix_coord(row.get("Longitudine"))
        rows.append(row)
        
    _sheet_cache = {"data": rows, "ts": time.time()}
    return rows

# API
@app.get("/api/wr")
async def get_wr(user=Depends(get_current_user), page: int = 1, limit: int = 100, squadra: str = None, stato: str = None):
    data = await get_sheet_data()
    if squadra:
        data = [r for r in data if r.get("Sq", "").strip() == squadra.strip()]
    if stato:
        data = [r for r in data if r.get("StatoWR", "").strip().upper() == stato.strip().upper()]
        
    start = (page - 1) * limit
    end = start + limit
    return {"total": len(data), "page": page, "data": data[start:end]}

@app.get("/api/wr/map")
async def get_wr_map(user=Depends(get_current_user), squadra: str = None):
    data = await get_sheet_data()
    if squadra:
        data = [r for r in data if r.get("Sq", "").strip() == squadra.strip()]
    markers = []
    for r in data:
        if r["Lat"] and r["Lon"]:
            markers.append({
                "wr": r.get("WR", ""),
                "lat": r["Lat"], "lon": r["Lon"],
                "squadra": r.get("Sq", ""), "stato": r.get("StatoWR", ""),
                "indirizzo": f"{r.get('Indirizzo', '')}, {r.get('Localita', '')}",
                "datadispaccio": r.get("Datadispaccio", ""),
                "pali": r.get("Pali", ""), "note": r.get("Note", "")
            })
    return markers

@app.get("/api/stats")
async def get_stats(user=Depends(get_current_user)):
    data = await get_sheet_data()
    now = datetime.now()
    old_90 = 0
    subs = set()
    for r in data:
        subs.add(r.get("Sq", ""))
        d = r.get("Datadispaccio")
        if d:
            try:
                dt = datetime.strptime(d, "%d/%m/%Y")
                if (now - dt).days > 90: old_90 += 1
            except: pass
    return {"total_wr": len(data), "old_90": old_90, "active_subs": len(subs)}

@app.get("/")
async def root():
    return {"status": "ok", "app": "WR Gestionale"}