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

export default function Pratiche() {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroSq, setFiltroSq] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtro90, setFiltro90] = useState(false);
  const [sortCol, setSortCol] = useState('Datadispaccio');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const PER_PAGE = 100;

  useEffect(() => {
    axios.get(`${API}/wr`)
      .then(r => setWr(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    const p = d.split('/');
    if (p.length !== 3) return false;
    return (oggi - new Date(p[2], p[1] - 1, p[0])) / (1000 * 60 * 60 * 24) > 90;
  };

  // Valori unici per i filtri
  const squadre = [...new Set(wr.map(w => w.Sq).filter(Boolean))].sort();
  const stati = [...new Set(wr.map(w => w.StatoWR).filter(Boolean))].sort();
  const centrali = [...new Set(wr.map(w => w.Centrale).filter(Boolean))].sort();

  // Filtra
  const filtered = wr.filter(w => {
    if (filtroSq && w.Sq !== filtroSq) return false;
    if (filtroStato && w.StatoWR !== filtroStato) return false;
    if (filtroCentrale && w.Centrale !== filtroCentrale) return false;
    if (filtro90 && !isOld(w.Datadispaccio)) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        w.WR?.toString().includes(q) ||
        w.Indirizzo?.toLowerCase().includes(q) ||
        w.Localita?.toLowerCase().includes(q) ||
        w.Assistente?.toLowerCase().includes(q) ||
        w.Note?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Ordina
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
    setFiltroCentrale(''); setFiltro90(false); setPage(1);
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div>;

  const selectStyle = {
    background: 'var(--panel)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12, outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '12px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="Cerca WR, indirizzo, assistente..."
          style={{ ...selectStyle, width: 240 }}
        />
        <select value={filtroSq} onChange={e => { setFiltroSq(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Tutte le squadre</option>
          {squadre.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroStato} onChange={e => { setFiltroStato(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Tutti gli stati</option>
          {stati.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filtroCentrale} onChange={e => { setFiltroCentrale(e.target.value); setPage(1); }} style={selectStyle}>
          <option value="">Tutte le centrali</option>
          {centrali.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button
          onClick={() => { setFiltro90(!filtro90); setPage(1); }}
          style={{ background: filtro90 ? 'rgba(239,68,68,0.3)' : 'var(--bg)', border: `1px solid ${filtro90 ? 'var(--red)' : 'var(--border)'}`, color: filtro90 ? 'var(--red)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}
        >
          ⚠ +90gg
        </button>
        <button onClick={resetFiltri} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
          Reset
        </button>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}>
          <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> / {wr.length} WR
        </span>
      </div>

      {/* Tabella */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr style={{ background: 'var(--panel2, #1e2330)' }}>
              {COLONNE.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: sortCol === col.key ? 'var(--accent)' : 'var(--muted)', fontWeight: 500, cursor: 'pointer', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', userSelect: 'none' }}
                >
                  {col.label} {sortCol === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((w, i) => {
              const old = isOld(w.Datadispaccio);
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)', background: old ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                  {COLONNE.map(col => (
                    <td key={col.key} style={{ padding: '7px 12px', color: col.mono ? 'var(--accent)' : col.key === 'StatoWR' ? (old ? 'var(--red)' : 'var(--green)') : 'var(--text)', fontFamily: col.mono ? 'var(--mono)' : 'inherit', whiteSpace: col.key === 'Note' || col.key === 'Indirizzo' ? 'normal' : 'nowrap', maxWidth: col.key === 'Note' ? 200 : col.key === 'JobType' ? 150 : 'none', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {w[col.key] || '—'}
                    </td>
                  ))}
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
