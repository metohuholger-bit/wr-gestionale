import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const COLONNE = [
  { key: 'WR', label: 'WR', mono: true },
  { key: 'Sq', label: 'Squadra' },
  { key: 'StatoWR', label: 'Stato' },
  { key: 'Datadispaccio', label: 'Data' },
  { key: 'Centrale', label: 'Centrale' },
  { key: 'Indirizzo', label: 'Indirizzo' },
  { key: 'Localita', label: 'Località' },
  { key: 'Pali', label: 'Pali' },
  { key: 'JobType', label: 'Tipo' },
  { key: 'Assistente', label: 'Assistente' },
  { key: 'Note', label: 'Note' },
];



// ── CONFRONTA WR ──
function ConfrontaWR({ wrA, wrB, onClose }) {
  const CAMPI = [
    ['WR','WR'],['Stato','StatoWR'],['Data','Datadispaccio'],
    ['Squadra','Sq'],['Desc. Squadra','Descrizione_Sq'],
    ['Tipo','JobType'],['Centrale','Centrale'],['Desc. Centrale','Desc_Centrale'],
    ['Località','Localita'],['Indirizzo','Indirizzo'],
    ['Operatore','Operatore'],['Recapito','Recapito'],
    ['Assistente','Assistente'],['Pali','Pali'],
    ['Note','Note'],['Lat','Latitudine'],['Lon','Longitudine'],
  ];

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--panel)', border:'1px solid var(--border)', borderRadius:14, width:'85vw', maxWidth:900, maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:16 }}>⚖</span>
          <div style={{ fontSize:9, fontFamily:'var(--mono)', letterSpacing:3, color:'var(--muted)' }}>CONFRONTO WR</div>
          <div style={{ marginLeft:'auto', display:'flex', gap:16, alignItems:'center' }}>
            <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'var(--accent)', fontWeight:700 }}>WR {wrA.WR}</span>
            <span style={{ color:'var(--muted)' }}>vs</span>
            <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'#f59e0b', fontWeight:700 }}>WR {wrB.WR}</span>
            <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', marginLeft:8 }}>×</button>
          </div>
        </div>

        {/* Tabella confronto */}
        <div style={{ overflow:'auto', flex:1 }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead style={{ position:'sticky', top:0, zIndex:5 }}>
              <tr style={{ background:'#1a1f2e' }}>
                <th style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', width:120 }}>Campo</th>
                <th style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:'var(--accent)', fontWeight:500, borderBottom:'1px solid var(--border)' }}>WR {wrA.WR}</th>
                <th style={{ padding:'8px 14px', textAlign:'left', fontSize:10, color:'#f59e0b', fontWeight:500, borderBottom:'1px solid var(--border)' }}>WR {wrB.WR}</th>
                <th style={{ padding:'8px 14px', textAlign:'center', fontSize:10, color:'var(--muted)', fontWeight:500, borderBottom:'1px solid var(--border)', width:60 }}>Uguale</th>
              </tr>
            </thead>
            <tbody>
              {CAMPI.map(([label, key], i) => {
                const valA = (wrA[key] || '').trim();
                const valB = (wrB[key] || '').trim();
                const uguale = valA === valB;
                const entrambiVuoti = !valA && !valB;
                if (entrambiVuoti) return null;
                return (
                  <tr key={key} style={{ borderBottom:'1px solid var(--border)', background: uguale ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
                    <td style={{ padding:'7px 14px', color:'var(--muted)', fontSize:11, whiteSpace:'nowrap' }}>{label}</td>
                    <td style={{ padding:'7px 14px', color: uguale ? 'var(--text)' : 'var(--accent)', fontWeight: uguale ? 400 : 500, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{valA || '—'}</td>
                    <td style={{ padding:'7px 14px', color: uguale ? 'var(--text)' : '#f59e0b', fontWeight: uguale ? 400 : 500, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{valB || '—'}</td>
                    <td style={{ padding:'7px 14px', textAlign:'center' }}>
                      {uguale ? <span style={{ color:'#22c55e', fontSize:14 }}>✓</span> : <span style={{ color:'#ef4444', fontSize:14 }}>✗</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer stats */}
        <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:12 }}>
          <span style={{ color:'#22c55e' }}>✓ {CAMPI.filter(([,k]) => (wrA[k]||'').trim() === (wrB[k]||'').trim() && ((wrA[k]||'') || (wrB[k]||''))).length} campi uguali</span>
          <span style={{ color:'#ef4444' }}>✗ {CAMPI.filter(([,k]) => (wrA[k]||'').trim() !== (wrB[k]||'').trim()).length} campi diversi</span>
        </div>
      </div>
    </div>
  );
}

function SollecitaPraticaPopup({ wr, API, onClose, onSollecitato }) {
  const [messaggio, setMessaggio] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salva = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/solleciti`, { wr: String(wr.WR), sub_code: wr.Sq, messaggio });
      onSollecitato(String(wr.WR));
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--panel)', border:'1px solid rgba(236,72,153,0.3)', borderRadius:12, width:420, overflow:'hidden' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚡</span>
          <div>
            <div style={{ fontSize:10, color:'var(--muted)', fontFamily:'var(--mono)', letterSpacing:2 }}>SOLLECITA PRATICA</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#ec4899' }}>WR {wr.WR} — {wr.Sq}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'16px 20px' }}>
          <div style={{ fontSize:12, color:'var(--muted)', marginBottom:12 }}>{wr.Indirizzo}, {wr.Localita}</div>
          <textarea value={messaggio} onChange={e => setMessaggio(e.target.value)}
            placeholder="Messaggio per il sub (opzionale)..."
            rows={3}
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 10px', borderRadius:6, fontSize:12, outline:'none', resize:'vertical', boxSizing:'border-box' }} />
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
          <button onClick={salva} disabled={saving}
            style={{ flex:1, background:'rgba(236,72,153,0.15)', border:'1px solid rgba(236,72,153,0.3)', color:'#ec4899', padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {saving ? '...' : '⚡ Invia sollecito'}
          </button>
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', padding:'10px 16px', borderRadius:8, fontSize:13, cursor:'pointer' }}>Annulla</button>
        </div>
      </div>
    </div>
  );
}

function PopupWR({ w, onClose }) {
  const lat = parseFloat(w.Latitudine);
  const lon = parseFloat(w.Longitudine);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, width: 480, maxHeight: '85vh', overflow: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>WR {w.WR}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{w.Datadispaccio}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px' }}>
          {[
            ['Squadra', w.Sq + (w.Descrizione_Sq ? ` — ${w.Descrizione_Sq}` : '')],
            ['Stato', w.StatoWR],
            ['Tipo intervento', w.JobType],
            ['Centrale', w.Desc_Centrale || w.Centrale],
            ['Indirizzo', `${w.Indirizzo || ''}${w.Localita ? ', ' + w.Localita : ''}`],
            ['Assistente', w.Assistente],
            ['Recapito', w.Recapito],
            ['N° Pali', w.Pali],
            ['Operatore', w.Operatore],
            ['Note', w.Note],
          ].filter(([, v]) => v && v.trim() && v !== '—').map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', minWidth: 120, fontSize: 12, flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--text)', wordBreak: 'break-word' }}>{val}</span>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {lat && lon && !isNaN(lat) && !isNaN(lon) && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noreferrer"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '8px 14px', borderRadius: 7, fontSize: 13, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
              📍 Indicazioni
            </a>
          )}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '8px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Pratiche() {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solleciti, setSolleciti] = useState([]);
  const [sollecitaWR, setSollecitaWR] = useState(null);
  const [showConfronta, setShowConfronta] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroSq, setFiltroSq] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtro90, setFiltro90] = useState(false);
  const [sortCol, setSortCol] = useState('Datadispaccio');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const PER_PAGE = 100;

  useEffect(() => {
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/solleciti`)])
      .then(([wrR, solR]) => { setWr(wrR.data); setSolleciti(solR.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    // Supporta sia YYYY-MM-DD che DD/MM/YYYY
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) {
      date = new Date(d); // YYYY-MM-DD
    } else if (d.includes('/')) {
      const p = d.split('/');
      date = new Date(p[2], p[1] - 1, p[0]); // DD/MM/YYYY
    } else return false;
    return (oggi - date) / (1000 * 60 * 60 * 24) > 90;
  };

  const [filtroDescCentrale, setFiltroDescCentrale] = useState('');

  const squadre = [...new Set(wr.map(w => w.Sq).filter(Boolean))].sort();
  const stati = [...new Set(wr.map(w => w.StatoWR).filter(Boolean))].sort();
  const centrali = [...new Set(wr.map(w => w.Centrale).filter(Boolean))].sort();
  const descCentrali = [...new Set(wr.map(w => w.Desc_Centrale).filter(Boolean))].sort();

  const filtered = wr.filter(w => {
    if (filtroSq && w.Sq !== filtroSq) return false;
    if (filtroStato && w.StatoWR !== filtroStato) return false;
    if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) return false;
    if (filtroDescCentrale && !w.Desc_Centrale?.toLowerCase().includes(filtroDescCentrale.toLowerCase())) return false;
    if (filtro90 && !isOld(w.Datadispaccio)) return false;
    if (search) {
      const q = search.toLowerCase();
      return Object.values(w).some(v => v && String(v).toLowerCase().includes(q));
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortCol] || '';
    const vb = b[sortCol] || '';
    return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const totalPages = Math.ceil(sorted.length / PER_PAGE);
  const paginated = sorted.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
    setPage(1);
  };

  const resetFiltri = () => {
    setSearch(''); setFiltroSq(''); setFiltroStato('');
    setFiltroCentrale(''); setFiltroDescCentrale(''); setFiltro90(false); setPage(1);
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div>;

  const selectStyle = {
    background: 'var(--panel)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12, outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {selected && <PopupWR w={selected} onClose={() => setSelected(null)} />}
      {showConfronta && checkedRows.size === 2 && (() => { const [a,b] = [...checkedRows]; const wrA = wr.find(w=>String(w.WR)===a); const wrB = wr.find(w=>String(w.WR)===b); return wrA && wrB ? <ConfrontaWR wrA={wrA} wrB={wrB} onClose={() => setShowConfronta(false)} /> : null; })()}
      {sollecitaWR && <SollecitaPraticaPopup wr={sollecitaWR} API={API} onClose={() => setSollecitaWR(null)} onSollecitato={wrNum => setSolleciti(prev => [...prev.filter(s => s.wr !== wrNum), { wr: wrNum, sub_code: sollecitaWR.Sq }])} />}

      {/* Toolbar */}
      <div style={{ padding: '12px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Cerca WR, indirizzo, assistente..."
          style={{ ...selectStyle, width: 240 }} />
        <select value={filtroSq} onChange={e => { setFiltroSq(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Tutte le squadre</option>
          {squadre.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroStato} onChange={e => { setFiltroStato(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Tutti gli stati</option>
          {stati.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input value={filtroCentrale} onChange={e => { setFiltroCentrale(e.target.value); setPage(1); }}
          placeholder="Cerca centrale (es. 575)..."
          style={{ ...selectStyle, width: 180 }} />
        <input value={filtroDescCentrale} onChange={e => { setFiltroDescCentrale(e.target.value); setPage(1); }}
          placeholder="Cerca desc. centrale..."
          style={{ ...selectStyle, width: 180 }} />
        <button onClick={() => { setFiltro90(!filtro90); setPage(1); }}
          style={{ background: filtro90 ? 'rgba(239,68,68,0.2)' : 'var(--bg)', border: `1px solid ${filtro90 ? 'var(--red)' : 'var(--border)'}`, color: filtro90 ? 'var(--red)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          ⚠ +90gg {filtro90 && `(${filtered.length})`}
        </button>
        <button onClick={resetFiltri} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Reset</button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> / {wr.length} WR
        </span>
      </div>

      {/* Tabella */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: '#1a1f2e' }}>
              {COLONNE.map(col => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: sortCol === col.key ? 'var(--accent)' : 'var(--muted)', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none' }}>
                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th style={{ padding: '9px 8px', borderBottom: '1px solid var(--border)', fontSize:11, color:'#ec4899' }}>⚡</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map((w, i) => {
              const old = isOld(w.Datadispaccio);
              return (
                <tr key={i} onClick={() => setSelected(w)}
                  style={{ borderBottom: '1px solid var(--border)', background: old ? 'rgba(239,68,68,0.04)' : 'transparent', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={e => e.currentTarget.style.background = old ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.06)'}
                  onMouseLeave={e => e.currentTarget.style.background = old ? 'rgba(239,68,68,0.04)' : 'transparent'}
                >
                  {COLONNE.map(col => (
                    <td key={col.key} style={{
                      padding: '7px 12px',
                      color: col.mono ? (solleciti.some(s => s.wr === String(w.WR)) ? '#ec4899' : 'var(--accent)') : col.key === 'StatoWR' ? (old ? 'var(--red)' : 'var(--green)') : 'var(--text)',
                      fontFamily: col.mono ? 'var(--mono)' : 'inherit',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      maxWidth: col.key === 'Note' || col.key === 'JobType' ? 180 : col.key === 'Indirizzo' ? 200 : 'none'
                    }}>
                      {w[col.key] || '—'}{col.key === 'WR' && solleciti.some(s => s.wr === String(w.WR)) && <span style={{ marginLeft:4, fontSize:9 }}>⚡</span>}
                    </td>
                  ))}
                  <td style={{ padding:'4px 8px' }}>
                    <button onClick={e => { e.stopPropagation(); setSollecitaWR(w); }}
                      style={{ background: solleciti.some(s => s.wr === String(w.WR)) ? 'rgba(236,72,153,0.2)' : 'transparent', border:'1px solid rgba(236,72,153,0.2)', color:'#ec4899', padding:'3px 7px', borderRadius:4, fontSize:10, cursor:'pointer', whiteSpace:'nowrap' }}>
                      ⚡
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Paginazione */}
      {totalPages > 1 && (
        <div style={{ padding: '10px 20px', background: 'var(--panel)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...selectStyle, cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>«</button>
          <button onClick={() => setPage(p => p - 1)} disabled={page === 1} style={{ ...selectStyle, cursor: 'pointer', opacity: page === 1 ? 0.4 : 1 }}>‹</button>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pagina <span style={{ color: 'var(--text)' }}>{page}</span> di {totalPages}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page === totalPages} style={{ ...selectStyle, cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>›</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...selectStyle, cursor: 'pointer', opacity: page === totalPages ? 0.4 : 1 }}>»</button>
        </div>
      )}
    </div>
  );
}

