import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function Impostazioni() {
  const { API } = useAuth();
  const [parole, setParole] = useState([]);
  const [nuovaParola, setNuovaParola] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`${API}/impostazioni`)
      .then(r => setParole(r.data.discriminante_nascondi || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  const salva = async (nuovaLista) => {
    try {
      await axios.post(`${API}/impostazioni`, { discriminante_nascondi: nuovaLista });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch(e) { console.error(e); }
  };

  const aggiungi = () => {
    const p = nuovaParola.trim().toLowerCase();
    if (!p || parole.includes(p)) return;
    const nuova = [...parole, p];
    setParole(nuova);
    setNuovaParola('');
    salva(nuova);
  };

  const rimuovi = (p) => {
    const nuova = parole.filter(x => x !== p);
    setParole(nuova);
    salva(nuova);
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 600 }}>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Impostazioni</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Configura il comportamento del gestionale</div>

      {/* Sezione discriminante */}
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>🚫 Nascondi WR ai sub per Discriminante</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>
            Le WR il cui campo <b>Discriminante</b> contiene una di queste parole non saranno visibili ai sub.
            Tu come admin le vedi sempre.
          </div>
        </div>

        <div style={{ padding: '14px 18px' }}>
          {/* Lista parole configurate */}
          {parole.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12, fontStyle: 'italic' }}>
              Nessuna parola configurata — tutte le WR sono visibili ai sub
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {parole.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '4px 10px' }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--red)' }}>{p}</span>
                  <button onClick={() => rimuovi(p)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 14, cursor: 'pointer', padding: 0, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {/* Aggiungi parola */}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={nuovaParola}
              onChange={e => setNuovaParola(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && aggiungi()}
              placeholder="es. fatto, completato, chiuso..."
              style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '7px 10px', borderRadius: 6, fontSize: 13, outline: 'none' }}
            />
            <button onClick={aggiungi} disabled={!nuovaParola.trim()}
              style={{ background: nuovaParola.trim() ? 'rgba(59,130,246,0.2)' : 'var(--bg)', border: `1px solid ${nuovaParola.trim() ? 'var(--accent)' : 'var(--border)'}`, color: nuovaParola.trim() ? 'var(--accent)' : 'var(--muted)', padding: '7px 16px', borderRadius: 6, fontSize: 13, cursor: nuovaParola.trim() ? 'pointer' : 'not-allowed' }}>
              + Aggiungi
            </button>
          </div>

          {saved && <div style={{ marginTop: 10, fontSize: 12, color: 'var(--green)' }}>✓ Salvato</div>}

          <div style={{ marginTop: 14, padding: '10px 12px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 6, fontSize: 12, color: 'var(--accent2)' }}>
            ⚠ Esempio: se aggiungi <b>fatto</b>, tutte le WR con Discriminante contenente "fatto" (es. "FATTO NOTE S", "fatto da squadra") saranno nascoste ai sub ma visibili a te.
          </div>
        </div>
      </div>
    </div>
  );
}
