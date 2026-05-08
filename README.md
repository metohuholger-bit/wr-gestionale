# WR Gestionale

Gestionale interventi TIM — sistema multi-livello (Admin → Sub → Mini-squadre)

## Struttura

```
wr-gestionale/
  frontend/    # React app
  backend/     # FastAPI
```

## Setup locale

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # configura le variabili
uvicorn main:app --reload
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env  # configura le variabili
npm start
```

## Deploy su Render

### Backend (Web Service)
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- Variabili d'ambiente: vedi `.env.example`

### Frontend (Static Site)
- Build command: `npm install && npm run build`
- Publish directory: `build`
- Variabili d'ambiente: vedi `.env.example`

## Variabili d'ambiente necessarie

### Backend
- `MONGO_URL` — stringa connessione MongoDB Atlas
- `SECRET_KEY` — chiave JWT (stringa casuale lunga)
- `GOOGLE_CLIENT_ID` — ID client Google OAuth
- `SHEET_CSV_URL` — URL CSV pubblico Google Sheet

### Frontend
- `REACT_APP_API_URL` — URL backend su Render
- `REACT_APP_GOOGLE_CLIENT_ID` — stesso ID client Google

## Primo accesso

1. Accedi con il tuo account Google
2. Il sistema ti crea come utente "pending"
3. Connettiti al MongoDB Atlas e imposta manualmente il tuo ruolo:
   ```
   db.users.updateOne({email: "tua@email.com"}, {$set: {role: "admin"}})
   ```
4. Da admin puoi approvare e assegnare ruoli agli altri utenti

## Ruoli
- `admin` — accesso totale (MDS Impianti)
- `sub` — accesso alle proprie pratiche + gestione mini-squadre
- `pending` — in attesa di approvazione
