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
        # Aggiorna last_seen
        await db.users.update_one({"email": payload["email"]}, {"$set": {"last_seen": datetime.utcnow()}})
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
        # Auto-admin per email @mdsimpianti.com, pending per tutti gli altri
        auto_role = "admin" if email.endswith("@mdsimpianti.com") else "pending"
        user_data = {
            "email": email,
            "name": info.get("name", ""),
            "picture": info.get("picture", ""),
            "role": auto_role,
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
    import re

    import csv, io
    # Usa DictReader con supporto per campi quotati
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
        # Converti coordinate con virgola decimale in punto
        for col in ["Latitudine", "Longitudine"]:
            val = clean.get(col, "")
            if val and re.match(r'^\d+,\d+$', val):
                clean[col] = val.replace(",", ".")
