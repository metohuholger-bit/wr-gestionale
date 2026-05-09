import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function PublicView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get(`${API}/view/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError('Link non valido o scaduto'));
  }, [token]);

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 32 }}>⚠</div>
      <div style={{ color: 'var(--red)', fontSize: 14 }}>{error}</div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Caricamento...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: 2 }}>
          MDS<span style={{ color: 'var(--muted)' }}>/</span>WR
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {data.squadra} — {data.wr.length} pratiche assegnate
        </span>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Lista WR */}
        <div style={{ width: 300, background: 'var(--panel)', borderRight: '1px solid var(--border)', overflow: 'auto', flexShrink: 0 }}>
          {data.wr.map((w, i) => (
            <div key={i}
              onClick={() => setSelected(w)}
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                background: selected?.WR === w.WR ? 'rgba(59,130,246,0.1)' : 'transparent',
                borderLeft: selected?.WR === w.WR ? '3px solid var(--accent)' : '3px solid transparent'
              }}
            >
              <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', marginBottom: 2 }}>WR {w.WR}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {w.Indirizzo}, {w.Localita}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 10, padding: '2px 5px', background: 'rgba(34,197,94,0.15)', color: 'var(--green)', borderRadius: 3 }}>{w.StatoWR || 'N/D'}</span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{w.Datadispaccio}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Dettaglio */}
        {selected ? (
          <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--accent)', marginBottom: 4 }}>WR {selected.WR}</div>
            <div style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 500, marginBottom: 16 }}>
              DISPACCIO {selected.Datadispaccio}
            </div>

            {[
              ['Tipo', selected.JobType],
              ['Indirizzo', `${selected.Indirizzo}, ${selected.Localita}`],
              ['Assistente', selected.Assistente],
              ['Recapito', selected.Recapito],
              ['N° Pali', selected.Pali],
              ['Centrale', selected.Desc_Centrale],
              ['Stato', selected.StatoWR],
              ['Note', selected.Note],
            ].filter(([, v]) => v).map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{val}</span>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              {selected.Latitudine && selected.Longitudine && (
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selected.Latitudine},${selected.Longitudine}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: 'rgba(34,197,94,0.15)',
                    border: '1px solid rgba(34,197,94,0.3)',
                    color: 'var(--green)',
                    padding: '10px 16px',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8
                  }}
                >
                  ◎ Indicazioni stradali
                </a>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)', fontSize: 14 }}>
            Seleziona una pratica dalla lista
          </div>
        )}
      </div>
    </div>
  );
}
