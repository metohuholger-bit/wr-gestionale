import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const COLORI = ['#f59e0b','#22c55e','#ec4899','#8b5cf6','#14b8a6','#f97316','#06b6d4','#3b82f6'];
const EMOJI_LIST = ['🔧','🪝','🔌','⚙','✅','⚠','📡','🔴','🟡','🟢'];

export default function Impostazioni() {
  const { API } = useAuth();
  const [parole, setParole] = useState([]);
  const [nuovaParola, setNuovaParola] = useState('');
  const [categorie, setCategorie] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nuovaCat, setNuovaCat] = useState({ nome:'', emoji:'🔧', pattern:'', colore:'#f59e0b' });
  const [editIdx, setEditIdx] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/impostazioni`),
      axios.get(`${API}/categorie-discriminante`)
    ]).then(([imp, cat]) => {
      setParole(imp.data.discriminante_nascondi || []);
      setCategorie(cat.data.categorie || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [API]);

  const salvaParole = async (nuovaLista) => {
    try {
      await axios.post(`${API}/impostazioni`, { discriminante_nascondi: nuovaLista });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
  };

  const salvaCategorie = async (nuovaLista) => {
    try {
      await axios.post(`${API}/categorie-discriminante`, { categorie: nuovaLista });
      setSaved(true); setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
  };

  const aggiungiParola = () => {
    const p = nuovaParola.trim().toLowerCase();
    if (!p || parole.includes(p)) return;
    const nuova = [...parole, p];
    setParole(nuova); setNuovaParola(''); salvaParole(nuova);
  };

  const rimuoviParola = (p) => { const n = parole.filter(x => x !== p); setParole(n); salvaParole(n); };

  const aggiungiCategoria = () => {
    if (!nuovaCat.nome || !nuovaCat.pattern) return;
    const nuova = [...categorie, { ...nuovaCat }];
    setCategorie(nuova); setNuovaCat({ nome:'', emoji:'🔧', pattern:'', colore:'#f59e0b' }); salvaCategorie(nuova);
  };

  const rimuoviCategoria = (i) => { const n = categorie.filter((_, idx) => idx !== i); setCategorie(n); salvaCategorie(n); };

  const inputStyle = { background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'7px 10px', borderRadius:6, fontSize:12, outline:'none' };
  const cardStyle = { background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden', marginBottom:20 };

  if (loading) return <div style={{ padding:40, color:'var(--muted)', textAlign:'center' }}>Caricamento...</div>;

  return (
    <div style={{ padding:24, maxWidth:700, overflow:'auto', height:'calc(100vh - 48px)' }}>
      <div style={{ fontSize:18, fontWeight:500, marginBottom:4 }}>Impostazioni</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>Configura il comportamento del gestionale</div>
      {saved && <div style={{ marginBottom:12, fontSize:12, color:'var(--green)' }}>✓ Salvato</div>}

      {/* Sezione 1: Categorie Discriminante */}
      <div style={cardStyle}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>🏷 Categorie Discriminante</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>
            Badge cliccabili nelle pratiche e nella vista sub per filtrare le WR per tipo di problema.
          </div>
        </div>
        <div style={{ padding:'14px 18px' }}>
          {/* Lista categorie */}
          {categorie.map((cat, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8, padding:'8px 12px', background:'var(--bg)', borderRadius:8, border:`1px solid ${cat.colore}33` }}>
              <span style={{ fontSize:18 }}>{cat.emoji}</span>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:600, color:cat.colore }}>{cat.nome}</div>
                <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'monospace' }}>{cat.pattern}</div>
              </div>
              <div style={{ width:16, height:16, borderRadius:'50%', background:cat.colore, flexShrink:0 }} />
              <button onClick={() => rimuoviCategoria(i)} style={{ background:'transparent', border:'none', color:'var(--red)', fontSize:16, cursor:'pointer' }}>×</button>
            </div>
          ))}

          {/* Aggiungi categoria */}
          <div style={{ marginTop:12, padding:12, background:'var(--bg)', borderRadius:8, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--muted)', marginBottom:8, fontFamily:'monospace', letterSpacing:2 }}>NUOVA CATEGORIA</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <select value={nuovaCat.emoji} onChange={e => setNuovaCat(p => ({...p, emoji:e.target.value}))} style={{ ...inputStyle, width:60 }}>
                {EMOJI_LIST.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
              <input value={nuovaCat.nome} onChange={e => setNuovaCat(p => ({...p, nome:e.target.value}))} placeholder="Nome categoria..." style={{ ...inputStyle, flex:1, minWidth:120 }} />
              <input value={nuovaCat.pattern} onChange={e => setNuovaCat(p => ({...p, pattern:e.target.value}))} placeholder="Parole chiave (es. manca cavo|manca sist)..." style={{ ...inputStyle, flex:2, minWidth:180 }} />
              <select value={nuovaCat.colore} onChange={e => setNuovaCat(p => ({...p, colore:e.target.value}))} style={{ ...inputStyle, width:50 }}>
                {COLORI.map(c => <option key={c} value={c} style={{ background:c }}>■</option>)}
              </select>
              <button onClick={aggiungiCategoria} disabled={!nuovaCat.nome || !nuovaCat.pattern}
                style={{ background:'rgba(59,130,246,0.2)', border:'1px solid var(--accent)', color:'var(--accent)', padding:'7px 14px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
                + Aggiungi
              </button>
            </div>
            <div style={{ marginTop:8, fontSize:11, color:'var(--muted)' }}>
              Le parole chiave supportano il carattere | per separare varianti (es. <span style={{ fontFamily:'monospace' }}>manca cavo|manca cavetto|manca ong</span>)
            </div>
          </div>
        </div>
      </div>

      {/* Sezione 2: Nascondi WR ai sub */}
      <div style={cardStyle}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:4 }}>🚫 Nascondi WR ai sub per Discriminante</div>
          <div style={{ fontSize:12, color:'var(--muted)' }}>
            Le WR il cui Discriminante contiene una di queste parole non saranno visibili ai sub.
          </div>
        </div>
        <div style={{ padding:'14px 18px' }}>
          {parole.length === 0 ? (
            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:12, fontStyle:'italic' }}>Nessuna parola configurata</div>
          ) : (
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
              {parole.map((p, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:6, padding:'4px 10px' }}>
                  <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--red)' }}>{p}</span>
                  <button onClick={() => rimuoviParola(p)} style={{ background:'transparent', border:'none', color:'var(--red)', fontSize:14, cursor:'pointer', padding:0 }}>×</button>
                </div>
              ))}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <input value={nuovaParola} onChange={e => setNuovaParola(e.target.value)} onKeyDown={e => e.key === 'Enter' && aggiungiParola()}
              placeholder="es. fatto, completato, chiuso..." style={{ ...inputStyle, flex:1 }} />
            <button onClick={aggiungiParola} disabled={!nuovaParola.trim()}
              style={{ background:'rgba(59,130,246,0.2)', border:'1px solid var(--accent)', color:'var(--accent)', padding:'7px 16px', borderRadius:6, fontSize:12, cursor:'pointer' }}>
              + Aggiungi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
