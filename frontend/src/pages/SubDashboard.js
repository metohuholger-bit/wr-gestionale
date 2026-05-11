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
  const [filtroMiniSquadra, setFiltroMiniSquadra] = useState('');
  const [filtroMappaExtra, setFiltroMappaExtra] = useState(null); // null | 'urgenti' | 'sollecitati' | 'avvicin'

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
    if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) return false;
    if (filtroComune && w.Localita !== filtroComune) return false;
    if (filtroSquadra) {
      const sq = wrToSquadra[String(w.WR)];
      if (!sq || sq.token !== filtroSquadra) return false;
    }
    if (filtroMiniSquadra === '__assegnate__') {
      if (!wrToSquadra[String(w.WR)]) return false;
    } else if (filtroMiniSquadra) {
      const sq = wrToSquadra[String(w.WR)];
      if (!sq || sq.token !== filtroMiniSquadra) return false;
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

  // Aggiorna visibilità marker quando cambiano i filtri
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    Object.entries(markersRef.current).forEach(([wrNum, marker]) => {
      const w = wr.find(r => String(r.WR) === wrNum);
      if (!w) return;
      let visible = true;
      if (filtroSquadra) {
        const sq = wrToSquadra[wrNum];
        visible = sq && sq.token === filtroSquadra;
      }
      if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) visible = false;
      if (filtroComune && w.Localita !== filtroComune) visible = false;
      if (filtroMiniSquadra === '__assegnate__') {
        if (!wrToSquadra[wrNum]) visible = false;
      } else if (filtroMiniSquadra) {
        const sq = wrToSquadra[wrNum];
        if (!sq || sq.token !== filtroMiniSquadra) visible = false;
      }
      if (filtroMappaExtra === 'urgenti' && !(w.Note||'').match(/670050|670100/)) visible = false;
      if (filtroMappaExtra === 'sollecitati' && !solleciti?.some(s => String(s.wr) === String(w.WR))) visible = false;
      if (filtroMappaExtra === 'avvicin') { const d2 = (oggi2 - new Date(w.Datadispaccio)) / (1000*60*60*24); if (isNaN(d2) || d2 <= 60 || d2 > 90) visible = false; }
      marker.setStyle({ opacity: visible ? 1 : 0.05, fillOpacity: visible ? 0.9 : 0.05 });
    });
  }, [filtroSquadra, filtroCentrale, filtroComune, filtroMiniSquadra, filtroMappaExtra, solleciti]);

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
      const link = `${window.location.origin}/#/view/${r.data.token}`;
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
        const lat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
        const lon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
        const isInferred = !!w.CoordInferita;
        const isAssigned = !!wrToSquadra[String(w.WR)];
        const color = wrToSquadra[String(w.WR)]?.color || (isInferred ? '#94a3b8' : '#3b82f6');
        const sqNome = wrToSquadra[String(w.WR)]?.nome || '';
        let marker;
        if (isInferred) {
          // Rombo per coordinate inferite - usa circleMarker con stile diverso
          marker = L.circleMarker([lat, lon], {
            radius: 8,
            fillColor: color,
            color: '#f59e0b',
            weight: 3,
            fillOpacity: 0.6,
            dashArray: '4,2'
          })
            .addTo(map)
            .bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:${color}">WR ${w.WR}</b><br/>${w.Indirizzo||''}, ${w.Localita||''}<br/>Stato: <b>${w.StatoWR}</b><br/><span style="color:#f59e0b">⚠ Posizione approssimativa (${w.Localita||w.Centrale})</span>${sqNome ? `<br/><span style="color:${color}">■ ${sqNome}</span>` : ''}</div>`);
        } else {
          marker = L.circleMarker([lat, lon], { 
            radius: isAssigned ? 10 : 9, 
            fillColor: color, 
            color: 'white', 
            weight: isAssigned ? 3 : 2, 
            fillOpacity: 0.9 
          })
            .addTo(map)
            .bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:${color}">WR ${w.WR}</b><br/>${w.Indirizzo||''}, ${w.Localita||''}<br/>Stato: <b>${w.StatoWR}</b>${sqNome ? `<br/><span style="color:${color}">■ ${sqNome}</span>` : ''}</div>`);
        }
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

          {/* Filtri extra */}
          <div style={{ display:'flex', gap:4 }}>
            {[
              { key:'urgenti', label:'⚡ Urgenti', color:'#ec4899' },
              { key:'sollecitati', label:'⚡ Sollecitati', color:'#ec4899' },
              { key:'avvicin', label:'◔ 60-90gg', color:'#f59e0b' },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltroMappaExtra(filtroMappaExtra === f.key ? null : f.key)}
                style={{ padding:'3px 8px', borderRadius:4, border:`1px solid ${filtroMappaExtra === f.key ? f.color : 'var(--border)'}`, background: filtroMappaExtra === f.key ? `${f.color}22` : 'transparent', color: filtroMappaExtra === f.key ? f.color : 'var(--muted)', fontSize:10, cursor:'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>
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
              <input value={filtroCentrale} onChange={e => setFiltroCentrale(e.target.value)} placeholder="Cerca centrale (es. 575)..." style={selectStyle} />
              <select value={filtroComune} onChange={e => setFiltroComune(e.target.value)} style={selectStyle}>
                <option value="">Tutti i comuni</option>
                {comuni.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={filtroMiniSquadra} onChange={e => setFiltroMiniSquadra(e.target.value)} style={selectStyle}>
                <option value="">Tutte le WR</option>
                <option value="__assegnate__">Tutte le squadre (assegnate)</option>
                {miniSquadre.map(sq => <option key={sq.link_token} value={sq.link_token}>{sq.nome}</option>)}
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
                      : w.CoordInferita
                        ? <span onClick={e => { e.stopPropagation(); cercaSuMappa(w); }} title="Posizione approssimativa" style={{ color: 'var(--accent2)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }}>◇</span>
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


// ── POPUP SOLLECITI ──
function SollicitiPopup({ solleciti, wr, onClose, onSelectWR }) {
  const [search, setSearch] = React.useState('');
  const filtered = solleciti.filter(s => {
    if (!search) return true;
    const w = wr.find(r => String(r.WR) === String(s.wr));
    return String(s.wr).includes(search) || w?.Indirizzo?.toLowerCase().includes(search.toLowerCase()) || w?.Localita?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--panel)', border:'1px solid rgba(236,72,153,0.3)', borderRadius:12, width:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 0 40px rgba(236,72,153,0.1)' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:20 }}>⚡</span>
          <div>
            <div style={{ fontSize:9, fontFamily:'var(--mono)', letterSpacing:3, color:'var(--muted)' }}>PRATICHE SOLLECITATE DA MDS</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#ec4899' }}>{solleciti.length} sollecit{solleciti.length === 1 ? 'o' : 'i'}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filtra per WR, indirizzo..."
            style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 10px', borderRadius:6, fontSize:12, outline:'none' }} />
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding:24, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Nessun sollecito trovato</div>
          ) : filtered.map((s, i) => {
            const w = wr.find(r => String(r.WR) === String(s.wr));
            return (
              <div key={i} onClick={() => { if(w) { onSelectWR(w); onClose(); } }}
                style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)', cursor: w ? 'pointer' : 'default', transition:'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(236,72,153,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontFamily:'var(--mono)', fontSize:13, color:'#ec4899', fontWeight:700 }}>WR {s.wr}</span>
                  <span style={{ fontFamily:'var(--mono)', fontSize:11, color:'var(--muted)' }}>{s.sub_code}</span>
                  {s.data && <span style={{ fontSize:10, color:'var(--muted)', marginLeft:'auto' }}>{new Date(s.data).toLocaleDateString('it-IT')}</span>}
                </div>
                {w && <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>{w.Indirizzo}, {w.Localita}</div>}
                {w && <div style={{ display:'flex', gap:8 }}>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background:'rgba(34,197,94,0.1)', color:'var(--green)' }}>{w.StatoWR}</span>
                  <span style={{ fontSize:10, color:'var(--muted)' }}>{w.Datadispaccio}</span>
                  {w.Pali && <span style={{ fontSize:10, color:'var(--muted)' }}>• {w.Pali} pali</span>}
                </div>}
                {s.messaggio && (
                  <div style={{ marginTop:8, padding:'6px 10px', background:'rgba(236,72,153,0.08)', borderRadius:5, fontSize:12, color:'#ec4899', fontStyle:'italic' }}>
                    "{s.messaggio}"
                  </div>
                )}
              </div>
            );
          })}
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
  const [solleciti, setSolleciti] = useState([]);
  const [showSolleciti, setShowSolleciti] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtroComune, setFiltroComune] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCard, setFiltroCard] = useState(null); // null | 'over90' | 'avvicin' | 'urgenti'
  const [colFilter, setColFilter] = useState({ WR:'', StatoWR:'', Centrale:'', Desc_Centrale:'', Indirizzo:'', Localita:'', Pali:'', JobType:'', Assistente:'' });
  const setCol = (col, val) => setColFilter(prev => ({ ...prev, [col]: val }));
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [nomeNuovaSquadra, setNomeNuovaSquadra] = useState('');
  const [showCreaSquadra, setShowCreaSquadra] = useState(false);
  const [filtro90, setFiltro90] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 100;

  const subCode = previewMode?.subCode || user?.sub_code;

  useEffect(() => {
    if (previewMode) {
      setLoading(true);
      Promise.all([
        axios.get(`${API}/mini-squadre?sub_code=${previewMode.subCode}`),
        axios.get(`${API}/solleciti`)
      ]).then(([sqR, solR]) => {
        setMiniSquadre(sqR.data);
        const filtered = solR.data.filter(s => String(s.sub_code).trim() === String(previewMode.subCode).trim());
        console.log('Solleciti totali:', solR.data.length, 'filtrati per', previewMode.subCode, ':', filtered.length);
        setSolleciti(filtered);
      }).catch(e => console.error('Errore caricamento preview:', e))
      .finally(() => setLoading(false));
      return;
    }
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/mini-squadre`), axios.get(`${API}/solleciti`)])
      .then(([wrR, sqR, solR]) => {
        setWr(wrR.data.filter(w => !STATI_ESCLUSI.includes(w.StatoWR?.toUpperCase())));
        setMiniSquadre(sqR.data);
        setSolleciti(solR.data);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [API, previewMode?.subCode]);

  // Ricarica solleciti ogni 2 minuti
  useEffect(() => {
    if (previewMode) return;
    const interval = setInterval(() => {
      axios.get(`${API}/solleciti`).then(r => setSolleciti(r.data)).catch(() => {});
    }, 120000);
    return () => clearInterval(interval);
  }, [API, previewMode]);

  const oggi = new Date();
  const daysDiff = (d) => {
    if (!d) return null;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return null;
    return (new Date() - date) / (1000*60*60*24);
  };

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
  const centrali = [...new Set(wr.map(w => w.Centrale).filter(Boolean))].sort();
  const comuni = [...new Set(wr.map(w => w.Localita).filter(Boolean))].sort();
  const tipi = [...new Set(wr.map(w => w.JobType).filter(Boolean))].sort();

  const filtered = wr.filter(w => {
    if (filtroCard === 'sollecitati' && !solleciti.some(s => String(s.wr) === String(w.WR))) return false;
    if (filtroCard === 'over90' && (daysDiff(w.Datadispaccio)||0) <= 90) return false;
    if (filtroCard === 'avvicin') { const d = daysDiff(w.Datadispaccio); if (d === null || d <= 60 || d > 90) return false; }
    if (filtroCard === 'urgenti' && !(w.Note||'').match(/670050|670100/)) return false;
    if (filtroStato && w.StatoWR !== filtroStato) return false;
    if (filtro90 && !isOld(w.Datadispaccio)) return false;
    if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) return false;
    if (filtroComune && w.Localita !== filtroComune) return false;
    if (filtroTipo && w.JobType !== filtroTipo) return false;
    // Filtri colonna inline
    for (const [col, val] of Object.entries(colFilter)) {
      if (val && !String(w[col] || '').toLowerCase().includes(val.toLowerCase())) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return Object.values(w).some(v => v && String(v).toLowerCase().includes(q));
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

  const toggleRowSelect = (wrNum) => {
    setSelectedRows(prev => {
      const s = new Set(prev);
      if (s.has(wrNum)) s.delete(wrNum);
      else s.add(wrNum);
      return s;
    });
  };

  const creaSquadraFromTable = async () => {
    if (!nomeNuovaSquadra || selectedRows.size === 0) return;
    try {
      const r = await axios.post(`${API}/mini-squadre`, {
        nome: nomeNuovaSquadra, sub_code: subCode, wr_list: [...selectedRows]
      });
      setMiniSquadre(prev => [...prev, { nome: nomeNuovaSquadra, sub_code: subCode, wr_list: [...selectedRows], link_token: r.data.token }]);
      navigator.clipboard.writeText(`${window.location.origin}/#/view/${r.data.token}`);
      setNomeNuovaSquadra('');
      setSelectedRows(new Set());
      setShowCreaSquadra(false);
      setActiveTab('squadre');
    } catch (e) { console.error(e); }
  };

  const selectStyle = { background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 6, fontSize: 12, outline: 'none' };
  const resetFiltroCard = () => setFiltroCard(null);

  const tabStyle = (tab) => ({ padding: '8px 16px', fontSize: 13, cursor: 'pointer', border: 'none', background: activeTab === tab ? 'rgba(59,130,246,0.15)' : 'transparent', color: activeTab === tab ? 'var(--accent)' : 'var(--muted)', borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent', marginBottom: -1 });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {showSolleciti && <SollicitiPopup solleciti={solleciti} wr={wr} onClose={() => setShowSolleciti(false)} onSelectWR={w => { setSelectedWR(w); setActiveTab('pratiche'); }} />}
      {showMappa && <MappaSub wr={wr} onClose={() => setShowMappa(false)} API={API} user={user} subCode={subCode} miniSquadre={miniSquadre} onSquadraCreata={sq => setMiniSquadre(prev => [...prev, sq])} solleciti={solleciti} />}
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

      {/* Stats + Alert urgenze */}
      <div style={{ padding: '12px 20px', flexShrink: 0 }}>
        {/* Alert urgenze */}
        {(() => {
          const urgenti = wr.filter(w => (w.Note||'').match(/670050|670100/));
          const avvicin = wr.filter(w => { const d = daysDiff(w.Datadispaccio); return d !== null && d > 60 && d <= 90; });
          if (urgenti.length === 0 && oltre90 === 0) return null;
          return (
            <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 14px', marginBottom:10, fontSize:12 }}>
              {urgenti.length > 0 && <div style={{ color:'#ec4899', fontWeight:600, marginBottom:2 }}>⚡ {urgenti.length} WR URGENTI (670050/670100) — da lavorare con priorità</div>}
              {oltre90 > 0 && <div style={{ color:'#ef4444' }}>⚠ {oltre90} WR oltre 90 giorni — verificare stato avanzamento</div>}
              {avvicin.length > 0 && <div style={{ color:'#f59e0b', marginTop:2 }}>◔ {avvicin.length} WR in avvicinamento (60-90gg) — pianificare intervento</div>}
            </div>
          );
        })()}

        {/* Card statistiche */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>
          {[
            { label: 'WR TOTALI', val: wr.length, color: '#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)', key: 'reset' },
            { label: 'OLTRE 90GG', val: oltre90, color: oltre90 > 0 ? '#ef4444' : '#475569', bg: oltre90 > 0 ? 'rgba(239,68,68,0.08)' : 'rgba(100,116,139,0.05)', border: oltre90 > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(100,116,139,0.1)', key: 'over90' },
            { label: '60-90GG', val: wr.filter(w => { const d = daysDiff(w.Datadispaccio); return d !== null && d > 60 && d <= 90; }).length, color: '#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', key: 'avvicin' },
            { label: 'URGENTI', val: wr.filter(w => (w.Note||'').match(/670050|670100/)).length, color: '#ec4899', bg:'rgba(236,72,153,0.08)', border:'rgba(236,72,153,0.2)', key: 'urgenti' },
            { label: 'SOLLECITATI', val: solleciti.length, color: '#ec4899', bg:'rgba(236,72,153,0.08)', border:'rgba(236,72,153,0.2)', key: 'sollecitati' },
            { label: 'MINI-SQUADRE', val: miniSquadre.length, color: '#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', key: null },
          ].map((s, i) => (
            <div key={i} onClick={() => { if(s.key) { setFiltroCard(filtroCard === s.key ? null : s.key); setActiveTab('pratiche'); setPage(1); } }}
              style={{ background: s.bg, border: `2px solid ${filtroCard === s.key && s.key !== 'reset' ? s.color : s.border}`, borderRadius: 8, padding: '10px 14px', flex: 1, cursor: s.key ? 'pointer' : 'default', transition:'border 0.2s' }}>
              <div style={{ fontSize: 9, fontFamily:'monospace', letterSpacing:2, color: s.color, marginBottom: 6, fontWeight:600 }}>{s.label}{filtroCard === s.key && s.key !== 'reset' ? ' ✓' : ''}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
          <button onClick={() => setShowMappa(true)} style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', color: '#22c55e', padding: '10px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontWeight: 600, lineHeight: 1.6, flexShrink:0 }}>
            ◎ Apri Mappa<br/><span style={{ fontSize: 10, fontWeight: 400, color: '#475569' }}>Seleziona WR</span>
          </button>
        </div>
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
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Cerca tutto..." style={{ ...selectStyle, width: 180 }} />
              <select value={filtroStato} onChange={e => { setFiltroStato(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="">Tutti gli stati</option>
                {stati.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input value={filtroCentrale} onChange={e => { setFiltroCentrale(e.target.value); setPage(1); }} placeholder="Centrale (es. 575)..." style={{ ...selectStyle, width: 150 }} />
              <select value={filtroComune} onChange={e => { setFiltroComune(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="">Tutti i comuni</option>
                {comuni.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={filtroTipo} onChange={e => { setFiltroTipo(e.target.value); setPage(1); }} style={selectStyle}>
                <option value="">Tutti i tipi</option>
                {tipi.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => { setFiltro90(!filtro90); setPage(1); }}
                style={{ background: filtro90 ? 'rgba(239,68,68,0.2)' : 'var(--bg)', border: `1px solid ${filtro90 ? 'var(--red)' : 'var(--border)'}`, color: filtro90 ? 'var(--red)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                ⚠ +90gg
              </button>
              <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:10 }}>
                <button onClick={() => setShowSolleciti(true)}
                  title="Apri solleciti"
                  style={{ background: solleciti.length > 0 ? 'rgba(236,72,153,0.1)' : 'transparent', border:`1px solid ${solleciti.length > 0 ? 'rgba(236,72,153,0.3)' : 'var(--border)'}`, color: solleciti.length > 0 ? '#ec4899' : 'var(--muted)', padding:'5px 10px', borderRadius:6, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:5 }}>
                  ⚡ {solleciti.length > 0 && <span style={{ fontSize:11, fontWeight:700 }}>{solleciti.length}</span>}
                </button>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}><span style={{ color: 'var(--accent)', fontWeight: 600 }}>{filtered.length}</span> / {wr.length} WR</span>
              </div>
            </div>
            {selectedRows.size > 0 && (
              <div style={{ padding: '8px 20px', background: 'rgba(245,158,11,0.08)', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: 'var(--accent2)' }}>🟡 {selectedRows.size} WR selezionate</span>
                <input value={nomeNuovaSquadra} onChange={e => setNomeNuovaSquadra(e.target.value)} placeholder="Nome mini-squadra..."
                  style={{ ...selectStyle, width: 200 }} />
                <button onClick={creaSquadraFromTable} disabled={!nomeNuovaSquadra}
                  style={{ background: nomeNuovaSquadra ? 'rgba(245,158,11,0.2)' : 'var(--bg)', border: `1px solid ${nomeNuovaSquadra ? 'var(--accent2)' : 'var(--border)'}`, color: nomeNuovaSquadra ? 'var(--accent2)' : 'var(--muted)', padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: nomeNuovaSquadra ? 'pointer' : 'not-allowed' }}>
                  Crea e copia link
                </button>
                <button onClick={() => setSelectedRows(new Set())} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>Deseleziona tutto</button>
              </div>
            )}
            <div style={{ flex: 1, overflow: 'auto' }}>
              {loading ? <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr style={{ background: '#1a1f2e' }}>
                      <th style={{ padding: '9px 8px', width: 32, borderBottom: '1px solid var(--border)' }}>
                        <input type="checkbox" onChange={e => { if (e.target.checked) setSelectedRows(new Set(paginated.map(w => String(w.WR)))); else setSelectedRows(new Set()); }} />
                      </th>
                      {[
                        { label: 'WR', col: 'WR' },
                        { label: 'Stato', col: 'StatoWR' },
                        { label: 'Data', col: null },
                        { label: 'Centrale', col: 'Centrale' },
                        { label: 'Desc. Centrale', col: 'Desc_Centrale' },
                        { label: 'Indirizzo', col: 'Indirizzo' },
                        { label: 'Località', col: 'Localita' },
                        { label: 'Pali', col: 'Pali' },
                        { label: 'Tipo', col: 'JobType' },
                        { label: 'Assistente', col: 'Assistente' },
                      ].map(({ label, col }) => (
                        <th key={label} style={{ padding: '6px 8px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                          <div style={{ marginBottom: 4 }}>{label}</div>
                          {col ? (
                            <input
                              value={colFilter[col] || ''}
                              onChange={e => setCol(col, e.target.value)}
                              placeholder="🔍"
                              onClick={e => e.stopPropagation()}
                              style={{ width: '100%', minWidth: 60, background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '3px 6px', borderRadius: 4, fontSize: 10, outline: 'none' }}
                            />
                          ) : <div style={{ height: 22 }} />}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginated.map((w, i) => {
                      const old = isOld(w.Datadispaccio);
                      const isSel = selectedRows.has(String(w.WR));
                      const isSollecitata = solleciti.some(s => String(s.wr) === String(w.WR));
                      return (
                        <tr key={i}
                          style={{ borderBottom: '1px solid var(--border)', background: isSel ? 'rgba(245,158,11,0.08)' : isSollecitata ? 'rgba(236,72,153,0.06)' : old ? 'rgba(239,68,68,0.04)' : 'transparent', cursor: 'pointer', borderLeft: isSollecitata ? '3px solid #ec4899' : '' }}
                          onMouseEnter={e => e.currentTarget.style.background = isSel ? 'rgba(245,158,11,0.15)' : old ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.06)'}
                          onMouseLeave={e => e.currentTarget.style.background = isSel ? 'rgba(245,158,11,0.08)' : old ? 'rgba(239,68,68,0.04)' : 'transparent'}>
                          <td style={{ padding: '7px 8px' }} onClick={e => { e.stopPropagation(); toggleRowSelect(String(w.WR)); }}>
                            <input type="checkbox" checked={isSel} onChange={() => {}} />
                          </td>
                          <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: isSollecitata ? '#ec4899' : 'var(--accent)' }} onClick={() => setSelectedWR(w)}>{w.WR} {isSollecitata && <span style={{ fontSize:9 }}>⚡</span>}</td>
                          <td style={{ padding: '7px 12px', color: old ? 'var(--red)' : 'var(--green)', fontSize: 11 }} onClick={() => setSelectedWR(w)}>{w.StatoWR}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Datadispaccio}</td>
                          <td style={{ padding: '7px 12px', fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Centrale || '—'}</td>
                          <td style={{ padding: '7px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }} onClick={() => setSelectedWR(w)}>{w.Desc_Centrale || '—'}</td>
                          <td style={{ padding: '7px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Indirizzo}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Localita}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)' }} onClick={() => setSelectedWR(w)}>{w.Pali || '—'}</td>
                          <td style={{ padding: '7px 12px', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--muted)' }} onClick={() => setSelectedWR(w)}>{w.JobType}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Assistente}</td>
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
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/view/${sq.link_token}`)}
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
