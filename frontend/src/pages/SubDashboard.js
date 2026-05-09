import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATI_ESCLUSI = ['NUOVA'];

function PopupWR({ w, onClose }) {
  const lat = parseFloat(w.Latitudine);
  const lon = parseFloat(w.Longitudine);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, width: 440, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>WR {w.WR}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{w.Datadispaccio}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {[
            ['Stato', w.StatoWR], ['Tipo', w.JobType],
            ['Centrale', w.Desc_Centrale || w.Centrale],
            ['Indirizzo', `${w.Indirizzo || ''}${w.Localita ? ', '+w.Localita : ''}`],
            ['Assistente', w.Assistente], ['Recapito', w.Recapito],
            ['N° Pali', w.Pali], ['Note', w.Note],
          ].filter(([,v]) => v && v.trim()).map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12 }}>{label}</span>
              <span style={{ color: 'var(--text)' }}>{val}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
          {lat && lon && !isNaN(lat) && !isNaN(lon) && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noreferrer"
              style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '8px 14px', borderRadius: 7, fontSize: 13, textDecoration: 'none' }}>
              📍 Indicazioni
            </a>
          )}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '8px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}

function MappaSub({ wr, onClose, API, user, subCode, onSquadraCreata, miniSquadre }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [selected, setSelected] = useState(new Set());
  const [nomeSquadra, setNomeSquadra] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchWR, setSearchWR] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtroComune, setFiltroComune] = useState('');
  const [filtroSquadra, setFiltroSquadra] = useState(null); // null = tutte

  const COLORI = ['#f59e0b', '#22c55e', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#a855f7'];

  const centrali = [...new Set(wr.map(w => w.Centrale).filter(Boolean))].sort();
  const comuni = [...new Set(wr.map(w => w.Localita).filter(Boolean))].sort();

  // Mappa WR -> mini-squadra
  const wrToSquadra = {};
  miniSquadre.forEach((sq, idx) => {
    sq.wr_list?.forEach(wrNum => {
      wrToSquadra[String(wrNum)] = { nome: sq.nome, color: COLORI[idx % COLORI.length], token: sq.link_token };
    });
  });

  const getColor = (wrNum) => {
    if (selected.has(String(wrNum))) return '#f59e0b';
    return wrToSquadra[String(wrNum)]?.color || '#3b82f6';
  };

  const wrFiltrati = wr.filter(w => {
    if (filtroCentrale && w.Centrale !== filtroCentrale) return false;
    if (filtroComune && w.Localita !== filtroComune) return false;
    if (filtroSquadra) {
      const sq = wrToSquadra[String(w.WR)];
      if (!sq || sq.token !== filtroSquadra) return false;
    }
    if (searchWR) {
      const q = searchWR.toLowerCase();
      return w.WR?.toString().includes(q) || w.Indirizzo?.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (wrNum) => {
    // Blocca WR già assegnate a una mini-squadra
    if (wrToSquadra[wrNum]) return;
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(wrNum)) s.delete(wrNum);
      else s.add(wrNum);
      const m = markersRef.current[wrNum];
      if (m) m.setStyle({ fillColor: s.has(wrNum) ? '#f59e0b' : '#3b82f6' });
      return s;
    });
  };

  // Aggiorna visibilità marker quando cambia filtro squadra
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    Object.entries(markersRef.current).forEach(([wrNum, marker]) => {
      if (!filtroSquadra) {
        marker.setStyle({ opacity: 1, fillOpacity: 0.9 });
      } else {
        const sq = wrToSquadra[wrNum];
        const visible = sq && sq.token === filtroSquadra;
        marker.setStyle({ opacity: visible ? 1 : 0.1, fillOpacity: visible ? 0.9 : 0.1 });
      }
    });
  }, [filtroSquadra]);

  const cercaSuMappa = (w) => {
    const lat = parseFloat(w.Latitudine);
    const lon = parseFloat(w.Longitudine);
    if (lat && lon && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 15, { animate: true });
      markersRef.current[String(w.WR)]?.openPopup();
    }
  };

  const creaSquadra = async () => {
    if (!nomeSquadra || selected.size === 0) return;
    try {
      const r = await axios.post(`${API}/mini-squadre`, {
        nome: nomeSquadra, sub_code: subCode, wr_list: [...selected]
      });
      const link = `${window.location.origin}/view/${r.data.token}`;
      navigator.clipboard.writeText(link);
      setSaved(true);
      onSquadraCreata({ nome: nomeSquadra, sub_code: subCode, wr_list: [...selected], link_token: r.data.token });
      setTimeout(() => setSaved(false), 3000);
      setNomeSquadra('');
      setSelected(new Set());
      // Forza ricaricamento mappa per aggiornare colori
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markersRef.current = {};
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current, { center: [42.5, 11.5], zoom: 8 });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.7 }).addTo(map);
      const bounds = [];
      wr.forEach(w => {
        const lat = parseFloat(w.Latitudine);
        const lon = parseFloat(w.Longitudine);
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
        const isAssigned = !!wrToSquadra[String(w.WR)];
        const color = wrToSquadra[String(w.WR)]?.color || '#3b82f6';
        const sqNome = wrToSquadra[String(w.WR)]?.nome || '';
        const marker = L.circleMarker([lat, lon], { 
          radius: isAssigned ? 10 : 9, 
          fillColor: color, 
          color: isAssigned ? 'white' : 'white', 
          weight: isAssigned ? 3 : 2, 
          fillOpacity: 0.9 
        })
          .addTo(map)
          .bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:${color}">WR ${w.WR}</b><br/>${w.Indirizzo||''}, ${w.Localita||''}<br/>Stato: <b>${w.StatoWR}</b>${sqNome ? `<br/><span style="color:${color}">■ ${sqNome}</span>` : ''}</div>`);
        if (!isAssigned) {
          marker.on('click', () => toggleSelect(String(w.WR)));
        }
        markersRef.current[String(w.WR)] = marker;
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [wr, miniSquadre]);

  const selectStyle = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5, fontSize: 11, outline: 'none', width: '100%' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '95vw', height: '90vh', background: 'var(--panel)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>
            Mappa — {wr.filter(w => w.Latitudine && w.Longitudine).length} con coord / {wr.length} totali
          </span>
          {selected.size > 0 && <span style={{ fontSize: 12, color: 'var(--accent2)' }}>● {selected.size} selezionate</span>}

          {/* Legenda mini-squadre */}
          {miniSquadre.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginLeft: 8 }}>
              <button onClick={() => setFiltroSquadra(null)}
                style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${filtroSquadra === null ? 'white' : 'var(--border)'}`, background: filtroSquadra === null ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}>
                Tutte
              </button>
              {miniSquadre.map((sq, idx) => (
                <button key={sq.link_token} onClick={() => setFiltroSquadra(filtroSquadra === sq.link_token ? null : sq.link_token)}
                  style={{ padding: '3px 8px', borderRadius: 4, border: `2px solid ${COLORI[idx % COLORI.length]}`, background: filtroSquadra === sq.link_token ? COLORI[idx % COLORI.length] + '33' : 'transparent', color: COLORI[idx % COLORI.length], fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                  ■ {sq.nome}
                </button>
              ))}
              <button style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}
                onClick={() => setFiltroSquadra('__none__')}>
                □ Non assegnate
              </button>
            </div>
          )}

          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Crea squadra bar */}
        {selected.size > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.08)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: 'var(--accent2)' }}>🟡 {selected.size} WR selezionate:</span>
            <input value={nomeSquadra} onChange={e => setNomeSquadra(e.target.value)} placeholder="Nome squadra..."
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: 6, fontSize: 12, outline: 'none', width: 180 }} />
            <button onClick={creaSquadra} disabled={!nomeSquadra}
              style={{ background: nomeSquadra ? 'rgba(245,158,11,0.2)' : 'var(--bg)', border: `1px solid ${nomeSquadra ? 'var(--accent2)' : 'var(--border)'}`, color: nomeSquadra ? 'var(--accent2)' : 'var(--muted)', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: nomeSquadra ? 'pointer' : 'not-allowed' }}>
              Crea e copia link
            </button>
            {saved && <span style={{ fontSize: 12, color: 'var(--green)' }}>✓ Link copiato!</span>}
            <button onClick={() => { setSelected(new Set()); Object.entries(markersRef.current).forEach(([wrNum, m]) => m.setStyle({ fillColor: wrToSquadra[wrNum]?.color || '#3b82f6' })); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Deseleziona tutto</button>
          </div>
        )}

        {/* Body: mappa + pannello */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div ref={mapRef} style={{ flex: 1 }} />

          {/* Pannello laterale */}
          <div style={{ width: 300, background: 'var(--bg)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={searchWR} onChange={e => setSearchWR(e.target.value)} placeholder="Cerca WR, indirizzo..." style={selectStyle} />
              <select value={filtroCentrale} onChange={e => setFiltroCentrale(e.target.value)} style={selectStyle}>
                <option value="">Tutte le centrali</option>
                {centrali.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroComune} onChange={e => setFiltroComune(e.target.value)} style={selectStyle}>
                <option value="">Tutti i comuni</option>
                {comuni.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'right' }}>{wrFiltrati.length} WR</div>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {wrFiltrati.map((w, i) => {
                const hasCoord = parseFloat(w.Latitudine) && parseFloat(w.Longitudine);
                const isSel = selected.has(String(w.WR));
                const sqInfo = wrToSquadra[String(w.WR)];
                const isAssigned = !!sqInfo;
                return (
                  <div key={i} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: isSel ? 'rgba(245,158,11,0.1)' : isAssigned ? 'rgba(0,0,0,0.1)' : 'transparent', cursor: isAssigned ? 'not-allowed' : 'pointer', borderLeft: sqInfo ? `3px solid ${sqInfo.color}` : '3px solid transparent', opacity: isAssigned ? 0.7 : 1 }}
                    onClick={() => !isAssigned && toggleSelect(String(w.WR))}>
                    <input type="checkbox" checked={isSel} disabled={isAssigned} onChange={() => {}} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isSel ? 'var(--accent2)' : sqInfo ? sqInfo.color : 'var(--accent)' }}>{w.WR}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.Indirizzo}, {w.Localita}</div>
                      {sqInfo && <div style={{ fontSize: 9, color: sqInfo.color, fontWeight: 600 }}>■ {sqInfo.nome}</div>}
                    </div>
                    {hasCoord
                      ? <span onClick={e => { e.stopPropagation(); cercaSuMappa(w); }} title="Vai sulla mappa" style={{ color: 'var(--green)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>◎</span>
                      : <span title="Nessuna coordinata" style={{ color: 'var(--muted)', fontSize: 11, flexShrink: 0 }}>—</span>
                    }
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SubDashboard({ previewMode }) {
  const { API, user, logout } = useAuth();
  const navigate = useNavigate();
  const [wr, setWr] = useState(previewMode?.wrData || []);
  const [miniSquadre, setMiniSquadre] = useState([]);
  const [loading, setLoading] = useState(!previewMode);
  const [showMappa, setShowMappa] = useState(false);
  const [activeTab, setActiveTab] = useState('pratiche');
  const [selectedWR, setSelectedWR] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtro90, setFiltro90] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 100;

  const subCode = previewMode?.subCode || user?.sub_code;

  useEffect(() => {
    if (previewMode) return; // usa dati già passati
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/mini-squadre`)])
      .then(([wrR, sqR]) => {
        setWr(wrR.data.filter(w => !STATI_ESCLUSI.includes(w.StatoWR?.toUpperCase())));
        setMiniSquadre(sqR.data);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [API, previewMode]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return false;
    return (oggi - date) / (1000*60*60*24) > 90;
  };

  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;
  const conCoord = wr.filter(w => parseFloat(w.Latitudine) && parseFloat(w.Longitudine)).length;
  const stati = [...new Set(wr.map(w => w.StatoWR).filter(Boolean))].sort();

  const filtered = wr.filter(w => {
    if (filtroStato && w.StatoWR !== filtroStato) return false;
    if (filtro90 && !isOld(w.Datadispaccio)) return false;
    if (search) {
      const q = search.toLowerCase();
      return w.WR?.toString().includes(q) || w.Indirizzo?.toLowerCase().includes(q) || w.Localita?.toLowerCase().includes(q);
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page-1)*PER_PAGE, page*PER_PAGE);

  const deleteSquad = async (token) => {
    if (!window.confirm('Eliminare questa mini-squadra?')) return;
    try {
      await axios.delete(`${API}/mini-squadre/${token}`);
      setMiniSquadre(prev => prev.filter(s => s.link_token !== token));
    } catch (e) { console.error(e); }
  };

  const removeWR = async (token, wrNum) => {
    const sq = miniSquadre.find(s => s.link_token === token);
    if (!sq) return;
    const newList = sq.wr_list.filter(w => w !== wrNum);
    await axios.put(`${API}/mini-squadre/${token}/wr`, newList);
    setMiniSquadre(prev => prev.map(s => s.link_token === token ? { ...s, wr_list: newList } : s));
  };

  const selectStyle = { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12, outline: 'none' };
  const tabStyle = (tab) => ({ padding: '8px 16px', fontSize: 13, cursor: 'pointer', border: 'none', background: activeTab === tab ? 'rgba(59,130,246,0.15)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--muted)', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {showMappa && <MappaSub wr={wr} onClose={() => setShowMappa(false)} API={API} user={user} subCode={subCode} miniSquadre={miniSquadre} onSquadraCreata={sq => setMiniSquadre(prev => [...prev, sq])} />}
      {selectedWR && <PopupWR w={selectedWR} onClose={() => setSelectedWR(null)} />}

      {/* Topbar */}
      <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '0 16px', height: 48, display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: 2 }}>MDS<span style={{ color: 'var(--muted)' }}>/</span>WR</div>
        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(34,197,94,0.15)', color: 'var(--green)', border: '1px solid rgba(34,197,94,0.3)', fontFamily: 'var(--mono)' }}>{user?.sub_code || 'SUB'}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          {user?.picture && <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />}
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{user?.name}</span>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Esci</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ padding: '14px 20px', display: 'flex', gap: 12, flexShrink: 0, alignItems: 'stretch' }}>
        {[
          { label: 'WR totali', val: wr.length, color: 'var(--accent)' },
          { label: 'Oltre 90gg', val: oltre90, color: oltre90 > 0 ? 'var(--red)' : 'var(--muted)' },
          { label: 'Mini-squadre', val: miniSquadre.length, color: 'var(--accent2)' },
          { label: 'Con coordinate', val: conCoord, color: 'var(--green)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 16px', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 22, fontWeight: 500, color: s.color }}>{s.val}</div>
          </div>
        ))}
        <button onClick={() => setShowMappa(true)} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '12px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer', fontWeight: 500, lineHeight: 1.6 }}>
          ◎ Apri Mappa<br/><span style={{ fontSize: 10, fontWeight: 400, color: 'var(--muted)' }}>Seleziona WR per squadra</span>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', paddingLeft: 20, flexShrink: 0 }}>
        <button style={tabStyle('pratiche')} onClick={() => setActiveTab('pratiche')}>Le mie pratiche</button>
        <button style={tabStyle('squadre')} onClick={() => setActiveTab('squadre')}>Mini-squadre ({miniSquadre.length})</button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'pratiche' ? (
          <>
            <div style={{ padding: '10px 20px', background: 'var(--panel)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Cerca WR, indirizzo..." style={{ ...selectStyle, width: 220 }} />
              <select value={filtroStato} onChange={e => { setFiltroStato(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="">Tutti gli stati</option>
                {stati.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setFiltro90(!filtro90); setPage(1); }}
                style={{ background: filtro90 ? 'rgba(239,68,68,0.2)' : 'var(--bg)', border: `1px solid ${filtro90 ? 'var(--red)' : 'var(--border)'}`, color: filtro90 ? 'var(--red)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                ⚠ +90gg
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> / {wr.length} WR</span>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#1a1f2e' }}>
                      {['WR','Stato','Data','Indirizzo','Località','Pali','Tipo','Assistente'].map(h => (
                        <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((w, i) => {
                      const old = isOld(w.Datadispaccio);
                      return (
                        <tr key={i} onClick={() => setSelectedWR(w)}
                          style={{ borderBottom: '1px solid var(--border)', background: old ? 'rgba(239,68,68,0.04)' : 'transparent', cursor: 'pointer' }}
                          onMouseEnter={e => e.currentTarget.style.background = old ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = old ? 'rgba(239,68,68,0.04)' : 'transparent'}>
                          <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)' }}>{w.WR}</td>
                          <td style={{ padding: '7px 12px', color: old ? 'var(--red)' : 'var(--green)', fontSize: 11 }}>{w.StatoWR}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{w.Datadispaccio}</td>
                          <td style={{ padding: '7px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.Indirizzo}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{w.Localita}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)' }}>{w.Pali || '—'}</td>
                          <td style={{ padding: '7px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }}>{w.JobType}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{w.Assistente}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {totalPages > 1 && (
              <div style={{ padding: '10px 20px', background: 'var(--panel)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <button onClick={() => setPage(1)} disabled={page===1} style={{ ...selectStyle, cursor:'pointer', opacity: page===1?0.4:1 }}>«</button>
                <button onClick={() => setPage(p=>p-1)} disabled={page===1} style={{ ...selectStyle, cursor:'pointer', opacity: page===1?0.4:1 }}>‹</button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Pagina <span style={{ color: 'var(--text)' }}>{page}</span> di {totalPages}</span>
                <button onClick={() => setPage(p=>p+1)} disabled={page===totalPages} style={{ ...selectStyle, cursor:'pointer', opacity: page===totalPages?0.4:1 }}>›</button>
                <button onClick={() => setPage(totalPages)} disabled={page===totalPages} style={{ ...selectStyle, cursor:'pointer', opacity: page===totalPages?0.4:1 }}>»</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
            {miniSquadre.length === 0
              ? <div style={{ color: 'var(--muted)', textAlign: 'center', paddingTop: 40 }}>Nessuna mini-squadra. Apri la mappa e seleziona le WR.</div>
              : miniSquadre.map(sq => {
                const sqWrs = sq.wr_list?.map(wrNum => wr.find(w => String(w.WR) === String(wrNum))).filter(Boolean) || [];
                return (
                  <div key={sq.link_token} style={{ marginBottom: 12, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 14, fontWeight: 500 }}>{sq.nome}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{sqWrs.length} WR</span>
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/view/${sq.link_token}`)}
                        style={{ marginLeft: 'auto', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        ⎘ Copia link
                      </button>
                      <button onClick={() => deleteSquad(sq.link_token)}
                        style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--red)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                        🗑 Elimina
                      </button>
                    </div>
                    <div style={{ padding: '8px 16px' }}>
                      {sqWrs.map((w, i) => w && (
                        <div key={i} onClick={() => setSelectedWR(w)} style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', minWidth: 80 }}>{w.WR}</span>
                          <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.Indirizzo}, {w.Localita}</span>
                          <button onClick={e => { e.stopPropagation(); removeWR(sq.link_token, String(w.WR)); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 14, cursor: 'pointer' }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            }
          </div>
        )}
      </div>
    </div>
  );
}
