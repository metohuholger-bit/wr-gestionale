import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const STATI_ESCLUSI = ['NUOVA'];

function PopupWR({ w, onClose }) {
  const lat = parseFloat(w.Latitudine);
  const lon = parseFloat(w.Longitudine);
  const [showFullNote, setShowFullNote] = React.useState(false);
  const NOTE_MAX = 200;

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, width: '100%', maxWidth: 440, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>WR {w.WR}</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{w.Datadispaccio}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '16px 20px', overflow: 'auto', flex: 1 }}>
          {[
            ['Stato', w.StatoWR], ['Tipo', w.JobType],
            ['Centrale', w.Desc_Centrale || w.Centrale],
            ['Indirizzo', `${w.Indirizzo || ''}${w.Localita ? ', '+w.Localita : ''}`],
            ['Assistente', w.Assistente], ['Recapito', w.Recapito],
            ['N° Pali', w.Pali], ['Discriminante', w.Discriminante],
          ].filter(([,v]) => v && v.trim()).map(([label, val], i) => (
            <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12, flexShrink: 0 }}>{label}</span>
              <span style={{ color: 'var(--text)' }}>{val}</span>
            </div>
          ))}
          {w.Note && w.Note.trim() && (
            <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12, flexShrink: 0 }}>Note</span>
              <div style={{ color: 'var(--text)', flex: 1 }}>
                <span>{showFullNote || w.Note.length <= NOTE_MAX ? w.Note : w.Note.slice(0, NOTE_MAX) + '...'}</span>
                {w.Note.length > NOTE_MAX && (
                  <button onClick={() => setShowFullNote(!showFullNote)}
                    style={{ display: 'block', marginTop: 4, background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: 0 }}>
                    {showFullNote ? '▲ Mostra meno' : '▼ Mostra tutto'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, flexShrink: 0 }}>
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

function MappaSub({ wr, onClose, API, user, subCode, onSquadraCreata, miniSquadre, solleciti, categorie }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const [selected, setSelected] = useState(new Set());
  const [nomeSquadra, setNomeSquadra] = useState('');
  const [saved, setSaved] = useState(false);
  const [searchWR, setSearchWR] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtroComune, setFiltroComune] = useState('');
  const [filtroMiniSquadra, setFiltroMiniSquadra] = useState('');
  const [filtroExtra, setFiltroExtra] = useState(null);
  const [filtroDiscriminante, setFiltroDiscriminante] = useState('');
  const [filtroSquadra, setFiltroSquadra] = useState(null);

  const COLORI = ['#f59e0b', '#22c55e', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316', '#06b6d4', '#a855f7'];

  const wrToSquadra = {};
  miniSquadre.forEach((sq, idx) => {
    sq.wr_list?.forEach(wrNum => {
      wrToSquadra[String(wrNum)] = { nome: sq.nome, color: COLORI[idx % COLORI.length], token: sq.link_token };
    });
  });

  const comuni = [...new Set(wr.map(w => w.Localita).filter(Boolean))].sort();

  const oggi2 = new Date();
  const ddiff = (d) => {
    if (!d) return null;
    const date = d.includes('-') && d.indexOf('-') === 4 ? new Date(d) : d.includes('/') ? new Date(d.split('/')[2], d.split('/')[1]-1, d.split('/')[0]) : null;
    return date ? (oggi2 - date) / (1000*60*60*24) : null;
  };

  const wrFiltrati = wr.filter(w => {
    if (filtroExtra === 'urgenti' && !(w.Note||'').match(/670050|670100/)) return false;
    if (filtroExtra === 'sollecitati' && !solleciti?.some(s => String(s.wr) === String(w.WR))) return false;
    if (filtroExtra === 'avvicin') { const d = ddiff(w.Datadispaccio); if (d === null || d <= 60 || d > 90) return false; }
    if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) return false;
    if (filtroComune && w.Localita !== filtroComune) return false;
    if (filtroMiniSquadra === '__assegnate__' && !wrToSquadra[String(w.WR)]) return false;
    if (filtroMiniSquadra && filtroMiniSquadra !== '__assegnate__') {
      const sq = wrToSquadra[String(w.WR)];
      if (!sq || sq.token !== filtroMiniSquadra) return false;
    }
    if (filtroSquadra) {
      const sq = wrToSquadra[String(w.WR)];
      if (!sq || sq.token !== filtroSquadra) return false;
    }
    if (filtroCategoriaMappa) {
      try { if (!new RegExp(filtroCategoriaMappa, 'i').test(w.Discriminante || '')) return false; } catch(e) {}
    }
    if (filtroDiscriminante && !w.Discriminante?.toLowerCase().includes(filtroDiscriminante.toLowerCase())) return false;
    if (searchWR) {
      const q = searchWR.toLowerCase();
      return w.WR?.toString().includes(q) || w.Indirizzo?.toLowerCase().includes(q);
    }
    return true;
  });

  const toggleSelect = (wrNum) => {
    if (wrToSquadra[wrNum]) return;
    setSelected(prev => {
      const s = new Set(prev);
      if (s.has(wrNum)) s.delete(wrNum); else s.add(wrNum);
      const m = markersRef.current[wrNum];
      if (m) m.setStyle({ fillColor: s.has(wrNum) ? '#f59e0b' : (wrToSquadra[wrNum]?.color || '#3b82f6') });
      return s;
    });
  };

  const cercaSuMappa = (w) => {
    const lat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
    const lon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
    if (lat && lon && mapInstanceRef.current) {
      mapInstanceRef.current.setView([lat, lon], 15, { animate: true });
      markersRef.current[String(w.WR)]?.openPopup();
    }
  };

  const creaSquadra = async () => {
    if (!nomeSquadra || selected.size === 0) return;
    try {
      const r = await axios.post(`${API}/mini-squadre`, { nome: nomeSquadra, sub_code: subCode, wr_list: [...selected] });
      const link = `${window.location.origin}/#/view/${r.data.token}`;
      navigator.clipboard.writeText(link);
      setSaved(true);
      const nuovaSquadra = { nome: nomeSquadra, sub_code: subCode, wr_list: [...selected], link_token: r.data.token };
      onSquadraCreata(nuovaSquadra);
      // Aggiorna colori marker senza ricreare la mappa
      const nuovoColore = '#f59e0b';
      selected.forEach(wrNum => {
        const m = markersRef.current[wrNum];
        if (m && typeof m.setStyle === 'function') {
          m.setStyle({ fillColor: nuovoColore, weight: 3 });
          m.off('click');
        }
      });
      setTimeout(() => setSaved(false), 3000);
      setNomeSquadra('');
      setSelected(new Set());
    } catch (e) { console.error(e); }
  };

  const aggiungiASquadra = async (token) => {
    if (!token || selected.size === 0) return;
    const sq = miniSquadre.find(s => s.link_token === token);
    if (!sq) return;
    const newList = [...new Set([...(sq.wr_list || []), ...selected])];
    try {
      await axios.put(`${API}/mini-squadre/${token}/wr`, newList);
      const color = COLORI[miniSquadre.indexOf(sq) % COLORI.length];
      selected.forEach(wrNum => {
        const m = markersRef.current[wrNum];
        if (m && typeof m.setStyle === 'function') { m.setStyle({ fillColor: color, weight: 3 }); m.off('click'); }
      });
      onSquadraCreata({ ...sq, wr_list: newList }); // aggiorna parent
      setSelected(new Set());
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { console.error(e); }
  };

  const rimuoviDaSquadra = async (wrNum) => {
    const sqInfo = wrToSquadra[wrNum];
    if (!sqInfo) return;
    const sq = miniSquadre.find(s => s.link_token === sqInfo.token);
    if (!sq) return;
    const newList = sq.wr_list.filter(w => w !== wrNum);
    try {
      await axios.put(`${API}/mini-squadre/${sqInfo.token}/wr`, newList);
      const m = markersRef.current[wrNum];
      if (m && typeof m.setStyle === 'function') {
        m.setStyle({ fillColor: '#3b82f6', weight: 2 });
        m.on('click', () => toggleSelect(wrNum));
      }
      onSquadraCreata({ ...sq, wr_list: newList });
    } catch (e) { console.error(e); }
  };

  // Aggiorna visibilità marker quando cambiano i filtri
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    Object.entries(markersRef.current).forEach(([wrNum, marker]) => {
      const w = wr.find(r => String(r.WR) === wrNum);
      if (!w) return;
      let visible = true;
      if (filtroSquadra) { const sq = wrToSquadra[wrNum]; if (!sq || sq.token !== filtroSquadra) visible = false; }
      if (filtroCentrale && !w.Centrale?.toLowerCase().includes(filtroCentrale.toLowerCase())) visible = false;
      if (filtroComune && w.Localita !== filtroComune) visible = false;
      if (filtroExtra === 'urgenti' && !(w.Note||'').match(/670050|670100/)) visible = false;
      if (filtroExtra === 'sollecitati' && !solleciti?.some(s => String(s.wr) === String(w.WR))) visible = false;
      if (filtroExtra === 'avvicin') { const d = ddiff(w.Datadispaccio); if (d === null || d <= 60 || d > 90) visible = false; }
      if (filtroMiniSquadra === '__assegnate__' && !wrToSquadra[wrNum]) visible = false;
      if (filtroMiniSquadra && filtroMiniSquadra !== '__assegnate__') { const sq = wrToSquadra[wrNum]; if (!sq || sq.token !== filtroMiniSquadra) visible = false; }
      if (filtroCategoriaMappa) {
        try { if (!new RegExp(filtroCategoriaMappa, 'i').test(w.Discriminante || '')) visible = false; } catch(e) {}
      }
      if (filtroDiscriminante && !w.Discriminante?.toLowerCase().includes(filtroDiscriminante.toLowerCase())) visible = false;
      if (typeof marker.setStyle === 'function') marker.setStyle({ opacity: visible ? 1 : 0.05, fillOpacity: visible ? 0.9 : 0.05 });
    });
  }, [filtroSquadra, filtroCentrale, filtroComune, filtroExtra, filtroMiniSquadra, solleciti, filtroDiscriminante, filtroCategoriaMappa]);

  // Inizializza mappa
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const initMap = () => {
      if (!mapRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { center: [42.5, 11.5], zoom: 8 });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.7 }).addTo(map);
      const bounds = [];
      // Calcola offset per marker sovrapposti
      const coordCount = {};
      const coordIndex = {};
      wr.forEach(w => {
        const lat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
        const lon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
        if (!lat || !lon || isNaN(lat) || isNaN(lon)) return;
        const key = `${lat.toFixed(5)},${lon.toFixed(5)}`;
        coordCount[key] = (coordCount[key] || 0) + 1;
      });
      wr.forEach(w => {
        const latOrig = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
        const lonOrig = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
        if (!latOrig || !lonOrig || isNaN(latOrig) || isNaN(lonOrig)) return;
        const key = `${latOrig.toFixed(5)},${lonOrig.toFixed(5)}`;
        const total = coordCount[key] || 1;
        if (!coordIndex[key]) coordIndex[key] = 0;
        const idx = coordIndex[key]++;
        const angle = (2 * Math.PI * idx) / total;
        const offsetDist = total > 1 ? 0.0001 : 0;
        const lat = latOrig + offsetDist * Math.cos(angle);
        const lon = lonOrig + offsetDist * Math.sin(angle);
        const sovrapposto = total > 1;
        const isInferred = !!w.CoordInferita;
        const isAssigned = !!wrToSquadra[String(w.WR)];
        const color = wrToSquadra[String(w.WR)]?.color || (isInferred ? '#94a3b8' : '#3b82f6');
        const sqNome = wrToSquadra[String(w.WR)]?.nome || '';
        const marker = L.circleMarker([lat, lon], {
          radius: isAssigned ? 10 : 9,
          fillColor: color,
          color: isInferred ? '#f59e0b' : 'white',
          weight: isAssigned ? 3 : 2,
          fillOpacity: isInferred ? 0.6 : 0.9
        }).addTo(map).bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:${color}">WR ${w.WR}</b><br/>${w.Indirizzo||''}, ${w.Localita||''}<br/>Stato: <b>${w.StatoWR}</b>${sqNome ? `<br/><span style="color:${color}">■ ${sqNome}</span>` : ''}${isInferred ? '<br/><span style="color:#f59e0b">⚠ Posizione approssimativa</span>' : ''}${sovrapposto ? '<br/><span style="color:#94a3b8">📍 Stesso punto di altra WR</span>' : ''}</div>`);
        if (!isAssigned) marker.on('click', () => toggleSelect(String(w.WR)));
        markersRef.current[String(w.WR)] = marker;
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      mapInstanceRef.current = map;
    };

    if (!document.querySelector('link[href*="leaflet.min.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      setTimeout(initMap, 50);
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = () => setTimeout(initMap, 50);
      document.head.appendChild(script);
    }

    return () => {
      if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; }
    };
  }, []);

  const selectStyle = { background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: 5, fontSize: 11, outline: 'none', width: '100%' };
  const isMobileMap = window.innerWidth < 768;
  const [showPanelMobile, setShowPanelMobile] = React.useState(false);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: isMobileMap ? '100vw' : '95vw', height: isMobileMap ? '100vh' : '90vh', background: 'var(--panel)', borderRadius: isMobileMap ? 0 : 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>
            Mappa — {wr.filter(w => w.Latitudine && w.Longitudine).length} coord / {wr.length} totali
          </span>
          {selected.size > 0 && <span style={{ fontSize: 12, color: 'var(--accent2)' }}>● {selected.size} selezionate</span>}

          {/* Filtri extra */}
          <div style={{ display:'flex', gap:4 }}>
            {[
              { key:'urgenti', label:'⚡ Urgenti', color:'#ec4899' },
              { key:'sollecitati', label:'⚡ Sollecitati', color:'#ec4899' },
              { key:'avvicin', label:'◔ 60-90gg', color:'#f59e0b' },
            ].map(f => (
              <button key={f.key} onClick={() => setFiltroExtra(filtroExtra === f.key ? null : f.key)}
                style={{ padding:'3px 8px', borderRadius:4, border:`1px solid ${filtroExtra === f.key ? f.color : 'var(--border)'}`, background: filtroExtra === f.key ? `${f.color}22` : 'transparent', color: filtroExtra === f.key ? f.color : 'var(--muted)', fontSize:10, cursor:'pointer' }}>
                {f.label}
              </button>
            ))}
          </div>

          {/* Badge categorie discriminante */}
          {solleciti && categorie && categorie.length > 0 && (() => {
            const badgesVisibili = categorie.filter(cat => {
              try { return wr.some(w => new RegExp(cat.pattern, 'i').test(w.Discriminante || '')); } catch(e) { return false; }
            });
            if (badgesVisibili.length === 0) return null;
            return (
              <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                {badgesVisibili.map((cat, i) => {
                  const isActive = filtroCategoriaMappa === cat.pattern;
                  return (
                    <button key={i} onClick={() => setFiltroCategoriaMappa(isActive ? null : cat.pattern)}
                      style={{ padding:'3px 8px', borderRadius:4, border:`1px solid ${cat.colore}`, background: isActive ? `${cat.colore}33` : 'transparent', color:cat.colore, fontSize:10, cursor:'pointer', fontWeight: isActive ? 700 : 400 }}>
                      {cat.emoji} {cat.nome}
                    </button>
                  );
                })}
              </div>
            );
          })()}
          {/* Legenda mini-squadre */}
          {miniSquadre.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => setFiltroSquadra(null)}
                style={{ padding: '3px 8px', borderRadius: 4, border: `1px solid ${!filtroSquadra ? 'white' : 'var(--border)'}`, background: !filtroSquadra ? 'rgba(255,255,255,0.2)' : 'transparent', color: 'var(--text)', fontSize: 11, cursor: 'pointer' }}>
                Tutte
              </button>
              {miniSquadre.map((sq, idx) => (
                <button key={sq.link_token} onClick={() => setFiltroSquadra(filtroSquadra === sq.link_token ? null : sq.link_token)}
                  style={{ padding: '3px 8px', borderRadius: 4, border: `2px solid ${COLORI[idx % COLORI.length]}`, background: filtroSquadra === sq.link_token ? COLORI[idx % COLORI.length] + '33' : 'transparent', color: COLORI[idx % COLORI.length], fontSize: 11, cursor: 'pointer', fontWeight: 500 }}>
                  ■ {sq.nome}
                </button>
              ))}
              <button onClick={() => setFiltroSquadra('__none__')}
                style={{ padding: '3px 8px', borderRadius: 4, border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', fontSize: 11, cursor: 'pointer' }}>
                □ Non assegnate
              </button>
            </div>
          )}

          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        {/* Crea / Aggiungi squadra bar */}
        {selected.size > 0 && (
          <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'rgba(245,158,11,0.08)', display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: 'var(--accent2)', flexShrink: 0 }}>🟡 {selected.size} selezionate:</span>
            {/* Crea nuova */}
            <input value={nomeSquadra} onChange={e => setNomeSquadra(e.target.value)} placeholder="Nome nuova squadra..."
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 10px', borderRadius: 6, fontSize: 12, outline: 'none', width: 160 }} />
            <button onClick={creaSquadra} disabled={!nomeSquadra}
              style={{ background: nomeSquadra ? 'rgba(245,158,11,0.2)' : 'var(--bg)', border: `1px solid ${nomeSquadra ? 'var(--accent2)' : 'var(--border)'}`, color: nomeSquadra ? 'var(--accent2)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 12, cursor: nomeSquadra ? 'pointer' : 'not-allowed', flexShrink: 0 }}>
              + Crea
            </button>
            {/* Aggiungi a esistente */}
            {miniSquadre.length > 0 && (
              <>
                <span style={{ fontSize: 11, color: 'var(--muted)', flexShrink: 0 }}>oppure aggiungi a:</span>
                <select onChange={e => e.target.value && aggiungiASquadra(e.target.value)} defaultValue=""
                  style={{ background: 'var(--bg)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '5px 8px', borderRadius: 6, fontSize: 12, outline: 'none' }}>
                  <option value="">Scegli squadra...</option>
                  {miniSquadre.map(sq => <option key={sq.link_token} value={sq.link_token}>{sq.nome}</option>)}
                </select>
              </>
            )}
            {saved && <span style={{ fontSize: 12, color: 'var(--green)', flexShrink: 0 }}>✓ Salvato!</span>}
            <button onClick={() => { setSelected(new Set()); Object.entries(markersRef.current).forEach(([wrNum, m]) => { if (typeof m.setStyle === 'function') m.setStyle({ fillColor: wrToSquadra[wrNum]?.color || '#3b82f6' }); }); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 12, cursor: 'pointer', marginLeft: 'auto' }}>✕ Deseleziona</button>
          </div>
        )}

        {/* Body: mappa + pannello */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
          <div ref={mapRef} style={{ flex: 1 }} />
          {/* Toggle panel button on mobile */}
          {isMobileMap && (
            <button onClick={() => setShowPanelMobile(!showPanelMobile)}
              style={{ position:'absolute', bottom:16, right:16, zIndex:1000, background:'var(--panel)', border:'1px solid var(--border)', color:'var(--accent)', padding:'10px 14px', borderRadius:8, fontSize:13, cursor:'pointer', boxShadow:'0 2px 8px rgba(0,0,0,0.4)' }}>
              {showPanelMobile ? '◎ Mappa' : '≡ Lista WR'}
            </button>
          )}

          {/* Pannello laterale */}
          <div style={{ width: isMobileMap ? '100%' : 300, background: 'var(--bg)', borderLeft: isMobileMap ? 'none' : '1px solid var(--border)', display: isMobileMap && !showPanelMobile ? 'none' : 'flex', flexDirection: 'column', flexShrink: 0, position: isMobileMap ? 'absolute' : 'relative', inset: isMobileMap ? 0 : 'auto', zIndex: isMobileMap ? 500 : 'auto' }}>
            <div style={{ padding: 10, borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={searchWR} onChange={e => setSearchWR(e.target.value)} placeholder="Cerca WR, indirizzo..." style={selectStyle} />
              <input value={filtroCentrale} onChange={e => setFiltroCentrale(e.target.value)} placeholder="Cerca centrale (es. 575)..." style={selectStyle} />
              <input value={filtroDiscriminante} onChange={e => setFiltroDiscriminante(e.target.value)} placeholder="Discriminante..." style={selectStyle} />
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
                  <div key={i} style={{ padding: '7px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8, background: isSel ? 'rgba(245,158,11,0.1)' : isAssigned ? 'rgba(0,0,0,0.1)' : 'transparent', cursor: 'pointer', borderLeft: sqInfo ? `3px solid ${sqInfo.color}` : '3px solid transparent' }}
                    onClick={() => !isAssigned && toggleSelect(String(w.WR))}>
                    <input type="checkbox" checked={isSel} disabled={isAssigned} onChange={() => {}} style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: isSel ? 'var(--accent2)' : sqInfo ? sqInfo.color : 'var(--accent)' }}>{w.WR}</div>
                      <div style={{ fontSize: 10, color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.Indirizzo}, {w.Localita}</div>
                      {sqInfo && <div style={{ fontSize: 9, color: sqInfo.color, fontWeight: 600 }}>■ {sqInfo.nome}</div>}
                    </div>
                    <div style={{ display:'flex', gap:4, flexShrink:0, alignItems:'center' }}>
                      {hasCoord
                        ? <span onClick={e => { e.stopPropagation(); cercaSuMappa(w); }} title="Vai sulla mappa" style={{ color: 'var(--green)', fontSize: 13, cursor: 'pointer' }}>◎</span>
                        : w.CoordInferita
                          ? <span onClick={e => { e.stopPropagation(); cercaSuMappa(w); }} title="Posizione approssimativa" style={{ color: 'var(--accent2)', fontSize: 13, cursor: 'pointer' }}>◇</span>
                          : <span title="Nessuna coordinata" style={{ color: 'var(--muted)', fontSize: 11 }}>—</span>
                      }
                      {isAssigned && (
                        <button onClick={e => { e.stopPropagation(); rimuoviDaSquadra(String(w.WR)); }}
                          title={`Rimuovi da ${sqInfo.nome}`}
                          style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: 14, cursor: 'pointer', padding: '0 2px' }}>×</button>
                      )}
                    </div>
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
              {CAMPI.map(([label, key]) => {
                const valA = (wrA[key] || '').trim();
                const valB = (wrB[key] || '').trim();
                const uguale = valA === valB;
                if (!valA && !valB) return null;
                return (
                  <tr key={key} style={{ borderBottom:'1px solid var(--border)', background: uguale ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)' }}>
                    <td style={{ padding:'7px 14px', color:'var(--muted)', fontSize:11, whiteSpace:'nowrap' }}>{label}</td>
                    <td style={{ padding:'7px 14px', color: uguale ? 'var(--text)' : 'var(--accent)', fontWeight: uguale ? 400 : 500, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{valA || '—'}</td>
                    <td style={{ padding:'7px 14px', color: uguale ? 'var(--text)' : '#f59e0b', fontWeight: uguale ? 400 : 500, maxWidth:280, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{valB || '—'}</td>
                    <td style={{ padding:'7px 14px', textAlign:'center' }}>
                      {uguale ? <span style={{ color:'#22c55e' }}>✓</span> : <span style={{ color:'#ef4444' }}>✗</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:16, fontSize:12 }}>
          <span style={{ color:'#22c55e' }}>✓ {CAMPI.filter(([,k]) => (wrA[k]||'').trim() === (wrB[k]||'').trim() && ((wrA[k]||'')||(wrB[k]||''))).length} uguali</span>
          <span style={{ color:'#ef4444' }}>✗ {CAMPI.filter(([,k]) => (wrA[k]||'').trim() !== (wrB[k]||'').trim()).length} diversi</span>
        </div>
      </div>
    </div>
  );
}


// ── STORICO SOLLECITI POPUP ──
function StoricoSolleciti({ wr, solleciti, setSolleciti, API, onClose }) {
  const doc = solleciti.find(s => String(s.wr) === String(wr.WR));
  const storico = doc?.storico || [];

  const eliminaTutto = async () => {
    if (!window.confirm('Eliminare tutti i solleciti per questa WR?')) return;
    try {
      await axios.delete(`${API}/solleciti/${wr.WR}`);
      setSolleciti(prev => prev.filter(s => String(s.wr) !== String(wr.WR)));
      onClose();
    } catch(e) { console.error(e); }
  };

  const eliminaSingolo = async (idx) => {
    try {
      const nuovoStorico = storico.filter((_, i) => i !== idx);
      await axios.post(`${API}/solleciti/${wr.WR}/storico`, { storico: nuovoStorico });
      setSolleciti(prev => prev.map(s => String(s.wr) === String(wr.WR) ? { ...s, storico: nuovoStorico } : s));
      if (nuovoStorico.length === 0) onClose();
    } catch(e) { console.error(e); }
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'var(--panel)', border:'1px solid rgba(236,72,153,0.3)', borderRadius:12, width:460, maxHeight:'70vh', overflow:'hidden', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 18px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚡</span>
          <div>
            <div style={{ fontSize:9, fontFamily:'var(--mono)', letterSpacing:3, color:'var(--muted)' }}>STORICO SOLLECITI</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#ec4899' }}>WR {wr.WR} — {storico.length} sollecit{storico.length===1?'o':'i'}</div>
          </div>
          <button onClick={eliminaTutto} title="Elimina tutti" style={{ marginLeft:'auto', background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', color:'var(--red)', padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer' }}>🗑 Tutti</button>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', marginLeft:6 }}>×</button>
        </div>
        <div style={{ overflow:'auto', flex:1, padding:'8px 0' }}>
          {storico.length === 0 ? (
            <div style={{ padding:20, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Nessun sollecito</div>
          ) : storico.map((s, i) => (
            <div key={i} style={{ padding:'12px 18px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', gap:8, marginBottom:4, alignItems:'center' }}>
                <span style={{ fontSize:11, color:'var(--muted)' }}>{s.da}</span>
                <span style={{ fontSize:10, color:'var(--muted)', marginLeft:'auto' }}>{s.data ? new Date(s.data).toLocaleString('it-IT') : ''}</span>
                <button onClick={() => eliminaSingolo(i)} title="Elimina" style={{ background:'transparent', border:'none', color:'var(--red)', fontSize:14, cursor:'pointer', padding:'0 2px' }}>×</button>
              </div>
              {s.messaggio
                ? <div style={{ background:'rgba(236,72,153,0.08)', border:'1px solid rgba(236,72,153,0.15)', borderRadius:6, padding:'8px 12px', fontSize:13, color:'#ec4899', fontStyle:'italic' }}>"{s.messaggio}"</div>
                : <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic' }}>Nessun messaggio</div>
              }
            </div>
          ))}
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


// ── MOBILE LAYOUT ──
function SubDashboardMobile({ wr, miniSquadre, solleciti, setSolleciti, setMiniSquadre, subCode, API, previewMode, categorie }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pratiche'); // pratiche | squadre | mappa
  const [showFiltri, setShowFiltri] = useState(false);
  const [search, setSearch] = useState('');
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroCard, setFiltroCard] = useState(null);
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [selectedWR, setSelectedWR] = useState(null);
  const [showMappa, setShowMappa] = useState(false);
  const [storicoWR, setStoricoWR] = useState(null);
  const [showSolleciti, setShowSolleciti] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [nomeNuovaSquadra, setNomeNuovaSquadra] = useState('');

  const oggi = new Date();
  const daysDiff = (d) => {
    if (!d) return null;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return null;
    return (oggi - date) / (1000*60*60*24);
  };
  const isOld = (d) => (daysDiff(d) || 0) > 90;

  const filtered = wr.filter(w => {
    if (filtroCard === 'over90' && (daysDiff(w.Datadispaccio)||0) <= 90) return false;
    if (filtroCard === 'urgenti' && !(w.Note||'').match(/670050|670100/)) return false;
    if (filtroCard === 'sollecitati' && !solleciti.some(s => String(s.wr) === String(w.WR))) return false;
    if (filtroCategoria) {
      const disc = (w.Discriminante || '').toLowerCase();
      try { if (!new RegExp(filtroCategoria, 'i').test(disc)) return false; } catch(e) { if (!disc.includes(filtroCategoria)) return false; }
    }
    if (filtroStato && w.StatoWR !== filtroStato) return false;
    if (filtroCategoria) {
      try {
        const disc = (w.Discriminante || '');
        if (!new RegExp(filtroCategoria, 'i').test(disc)) return false;
      } catch(e) { /* pattern non valido, ignora */ }
    }
    if (search) return Object.values(w).some(v => v && String(v).toLowerCase().includes(search.toLowerCase()));
    return true;
  });

  const stati = [...new Set(wr.map(w => w.StatoWR).filter(Boolean))].sort();
  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;
  const urgenti = wr.filter(w => (w.Note||'').match(/670050|670100/)).length;

  const toggleRow = (wrNum) => setSelectedRows(prev => { const s = new Set(prev); if (s.has(wrNum)) s.delete(wrNum); else s.add(wrNum); return s; });

  const creaSquadra = async () => {
    if (!nomeNuovaSquadra || selectedRows.size === 0) return;
    try {
      const r = await axios.post(`${API}/mini-squadre`, { nome: nomeNuovaSquadra, sub_code: subCode, wr_list: [...selectedRows] });
      navigator.clipboard.writeText(`${window.location.origin}/#/view/${r.data.token}`);
      setMiniSquadre(prev => [...prev, { nome: nomeNuovaSquadra, sub_code: subCode, wr_list: [...selectedRows], link_token: r.data.token }]);
      setNomeNuovaSquadra('');
      setSelectedRows(new Set());
    } catch(e) { console.error(e); }
  };

  const tabBtnStyle = (tab) => ({
    flex:1, padding:'10px 0', border:'none', background: activeTab === tab ? 'rgba(59,130,246,0.15)' : 'transparent',
    color: activeTab === tab ? '#3b82f6' : '#64748b', fontSize:11, cursor:'pointer',
    borderTop: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
    fontFamily:'monospace', letterSpacing:1
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', color:'var(--text)', overflow:'hidden' }}>
      {selectedWR && <PopupWR w={selectedWR} onClose={() => setSelectedWR(null)} />}
      {storicoWR && <StoricoSolleciti wr={storicoWR} solleciti={solleciti} setSolleciti={setSolleciti} API={API} onClose={() => setStoricoWR(null)} />}
      {showSolleciti && <SollicitiPopup solleciti={solleciti} wr={wr} onClose={() => setShowSolleciti(false)} onSelectWR={w => { setSelectedWR(w); }} />}
      {showMappa && <MappaSub wr={wr} onClose={() => setShowMappa(false)} API={API} user={user} subCode={subCode} miniSquadre={miniSquadre} onSquadraCreata={sq => setMiniSquadre(prev => [...prev, sq])} solleciti={solleciti} categorie={categorie} />}

      {/* Topbar */}
      <div style={{ background:'var(--panel)', borderBottom:'1px solid var(--border)', padding:'0 12px', height:44, display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
        <div style={{ fontFamily:'monospace', fontSize:12, fontWeight:700, color:'#3b82f6', letterSpacing:2 }}>MDS/WR</div>
        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background:'rgba(34,197,94,0.15)', color:'var(--green)', border:'1px solid rgba(34,197,94,0.3)', fontFamily:'monospace' }}>{subCode}</span>
        {solleciti.length > 0 && (
          <button onClick={() => setShowSolleciti(true)} style={{ background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.3)', color:'#ec4899', padding:'3px 8px', borderRadius:5, fontSize:11, cursor:'pointer' }}>
            ⚡ {solleciti.length}
          </button>
        )}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          {user?.picture && <img src={user.picture} alt="" style={{ width:24, height:24, borderRadius:'50%' }} />}
          {!previewMode && <button onClick={() => { logout(); navigate('/login'); }} style={{ background:'transparent', border:'1px solid var(--border)', color:'var(--muted)', padding:'3px 8px', borderRadius:5, fontSize:11, cursor:'pointer' }}>Esci</button>}
        </div>
      </div>

      {/* Alert banner */}
      {(oltre90 > 0 || urgenti > 0) && (
        <div style={{ background:'rgba(239,68,68,0.08)', borderBottom:'1px solid rgba(239,68,68,0.2)', padding:'6px 12px', flexShrink:0 }}>
          {urgenti > 0 && <div style={{ fontSize:11, color:'#ec4899', fontWeight:600 }}>⚡ {urgenti} WR urgenti</div>}
          {oltre90 > 0 && <div style={{ fontSize:11, color:'#ef4444' }}>⚠ {oltre90} WR oltre 90gg</div>}
        </div>
      )}

      {/* Card stats */}
      <div style={{ padding:'8px 12px', display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6, flexShrink:0 }}>
        {[
          { label:'TOTALI', val:wr.length, color:'#3b82f6', key:'reset' },
          { label:'+90GG', val:oltre90, color:'#ef4444', key:'over90' },
          { label:'URGENTI', val:urgenti, color:'#ec4899', key:'urgenti' },
          { label:'SOLLECITI', val:solleciti.length, color:'#ec4899', key:'sollecitati' },
          { label:'SQUADRE', val:miniSquadre.length, color:'#f59e0b', key:null },
          { label:'FILTRATI', val:filtered.length, color:'#22c55e', key:null },
        ].map((s, i) => (
          <div key={i} onClick={() => { if(s.key === 'reset') setFiltroCard(null); else if(s.key) setFiltroCard(filtroCard === s.key ? null : s.key); setActiveTab('pratiche'); }}
            style={{ background: filtroCard === s.key && s.key !== 'reset' ? `${s.color}22` : 'var(--panel)', border:`1px solid ${filtroCard === s.key && s.key !== 'reset' ? s.color : 'var(--border)'}`, borderRadius:8, padding:'6px 8px', cursor: s.key ? 'pointer' : 'default' }}>
            <div style={{ fontSize:8, fontFamily:'monospace', letterSpacing:1, color:s.color, marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:18, fontWeight:700, color:s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
        {activeTab === 'pratiche' && (
          <>
            {/* Search bar */}
            <div style={{ padding:'6px 12px', borderBottom:'1px solid var(--border)', display:'flex', gap:6, flexShrink:0 }}>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca..."
                style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 10px', borderRadius:6, fontSize:13, outline:'none' }} />
              <button onClick={() => setShowFiltri(!showFiltri)}
                style={{ background: filtroStato ? 'rgba(59,130,246,0.2)' : 'var(--bg)', border:'1px solid var(--border)', color: filtroStato ? 'var(--accent)' : 'var(--muted)', padding:'6px 10px', borderRadius:6, fontSize:13, cursor:'pointer' }}>
                ⚙
              </button>
              <button onClick={() => setShowMappa(true)}
                style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', color:'var(--green)', padding:'6px 10px', borderRadius:6, fontSize:13, cursor:'pointer' }}>
                ◎
              </button>
            </div>

            {/* Badge categorie */}
            {categorie && categorie.length > 0 && (
              <div style={{ padding:'4px 12px', display:'flex', gap:6, flexWrap:'wrap', background:'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                {categorie.map((cat, i) => {
                  const count = wr.filter(w => { try { return new RegExp(cat.pattern, 'i').test(w.Discriminante || ''); } catch(e) { return false; } }).length;
                  if (count === 0) return null;
                  const isActive = filtroCategoria === cat.pattern;
                  return (
                    <button key={i} onClick={() => { setFiltroCategoria(isActive ? null : cat.pattern); }}
                      style={{ padding:'3px 8px', borderRadius:20, border:`1px solid ${cat.colore}`, background: isActive ? `${cat.colore}33` : 'transparent', color:cat.colore, fontSize:10, cursor:'pointer', fontWeight: isActive ? 700 : 400, whiteSpace:'nowrap' }}>
                      {cat.emoji} {cat.nome} ({count})
                    </button>
                  );
                })}
              </div>
            )}
            {/* Filtri drawer */}
            {showFiltri && (
              <div style={{ padding:'8px 12px', background:'var(--panel)', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
                <select value={filtroStato} onChange={e => setFiltroStato(e.target.value)}
                  style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'6px 8px', borderRadius:6, fontSize:12, outline:'none' }}>
                  <option value="">Tutti gli stati</option>
                  {stati.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}

            {/* Selezione bar */}
            {selectedRows.size > 0 && (
              <div style={{ padding:'6px 12px', background:'rgba(245,158,11,0.1)', borderBottom:'1px solid var(--border)', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                <span style={{ fontSize:12, color:'var(--accent2)' }}>🟡 {selectedRows.size} selezionate</span>
                <input value={nomeNuovaSquadra} onChange={e => setNomeNuovaSquadra(e.target.value)} placeholder="Nome squadra..."
                  style={{ flex:1, background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'4px 8px', borderRadius:5, fontSize:12, outline:'none' }} />
                <button onClick={creaSquadra} disabled={!nomeNuovaSquadra}
                  style={{ background:'rgba(245,158,11,0.2)', border:'1px solid var(--accent2)', color:'var(--accent2)', padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
                  Crea
                </button>
              </div>
            )}

            {/* Lista pratiche mobile - card style */}
            <div style={{ flex:1, overflow:'auto' }}>
              {filtered.map((w, i) => {
                const old = isOld(w.Datadispaccio);
                const isSel = selectedRows.has(String(w.WR));
                const solDoc = solleciti.find(s => String(s.wr) === String(w.WR));
                const solCnt = solDoc?.storico?.length || 0;
                return (
                  <div key={i} style={{ padding:'10px 12px', borderBottom:'1px solid var(--border)', background: isSel ? 'rgba(245,158,11,0.08)' : old ? 'rgba(239,68,68,0.03)' : 'transparent', borderLeft:`3px solid ${isSel ? '#f59e0b' : old ? '#ef4444' : 'transparent'}` }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                      <input type="checkbox" checked={isSel} onChange={() => toggleRow(String(w.WR))} style={{ flexShrink:0 }} />
                      <span onClick={() => setSelectedWR(w)} style={{ fontFamily:'monospace', fontSize:13, color:'#3b82f6', fontWeight:700, flex:1, cursor:'pointer' }}>WR {w.WR}</span>
                      {solCnt > 0 && <button onClick={() => setStoricoWR(w)} style={{ background:'rgba(236,72,153,0.15)', border:'1px solid rgba(236,72,153,0.3)', color:'#ec4899', padding:'2px 6px', borderRadius:4, fontSize:10, cursor:'pointer' }}>⚡{solCnt}</button>}
                      <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)', color: old ? '#ef4444' : '#22c55e', flexShrink:0 }}>{old ? '+90gg' : w.StatoWR}</span>
                    </div>
                    <div onClick={() => setSelectedWR(w)} style={{ fontSize:12, color:'var(--muted)', cursor:'pointer' }}>{w.Indirizzo}, {w.Localita}</div>
                    <div style={{ display:'flex', gap:8, marginTop:3, fontSize:11, color:'#475569' }}>
                      <span>{w.Datadispaccio}</span>
                      {w.Centrale && <span>• {w.Centrale}</span>}
                      {w.Pali && <span>• {w.Pali} pali</span>}
                    </div>
                    {w.Discriminante && <div style={{ fontSize:10, color:'#f59e0b', marginTop:2 }}>{w.Discriminante}</div>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {activeTab === 'squadre' && (
          <div style={{ flex:1, overflow:'auto', padding:12 }}>
            {miniSquadre.length === 0
              ? <div style={{ color:'var(--muted)', textAlign:'center', paddingTop:40, fontSize:13 }}>Nessuna mini-squadra. Vai sulla mappa o seleziona pratiche.</div>
              : miniSquadre.map(sq => {
                const sqWrs = sq.wr_list?.map(wrNum => wr.find(w => String(w.WR) === String(wrNum))).filter(Boolean) || [];
                return (
                  <div key={sq.link_token} style={{ marginBottom:10, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                    <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid var(--border)' }}>
                      <span style={{ fontSize:13, fontWeight:600, flex:1 }}>{sq.nome}</span>
                      <span style={{ fontSize:11, color:'var(--muted)' }}>{sqWrs.length} WR</span>
                      <button onClick={() => navigator.clipboard.writeText(`${window.location.origin}/#/view/${sq.link_token}`)}
                        style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', color:'var(--accent)', padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer' }}>
                        ⎘ Link
                      </button>
                    </div>
                    {sqWrs.slice(0,3).map((w, i) => w && (
                      <div key={i} onClick={() => setSelectedWR(w)} style={{ padding:'6px 14px', borderBottom:'1px solid var(--border)', display:'flex', gap:8, cursor:'pointer' }}>
                        <span style={{ fontFamily:'monospace', fontSize:11, color:'var(--accent)' }}>{w.WR}</span>
                        <span style={{ fontSize:11, color:'var(--muted)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.Indirizzo}</span>
                      </div>
                    ))}
                    {sqWrs.length > 3 && <div style={{ padding:'4px 14px', fontSize:11, color:'var(--muted)' }}>+{sqWrs.length-3} altre...</div>}
                  </div>
                );
              })
            }
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ display:'flex', borderTop:'1px solid var(--border)', background:'var(--panel)', flexShrink:0 }}>
        <button style={tabBtnStyle('pratiche')} onClick={() => setActiveTab('pratiche')}>≡ PRATICHE</button>
        <button style={tabBtnStyle('squadre')} onClick={() => setActiveTab('squadre')}>⬡ SQUADRE</button>
        <button style={{ ...tabBtnStyle('mappa'), flex:1 }} onClick={() => setShowMappa(true)}>◎ MAPPA</button>
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
  const [showConfronta, setShowConfronta] = useState(false);
  const [storicoWR, setStoricoWR] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  const [filtroStato, setFiltroStato] = useState('');
  const [filtroCentrale, setFiltroCentrale] = useState('');
  const [filtroComune, setFiltroComune] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroCard, setFiltroCard] = useState(null);
  const [search, setSearch] = useState('');
  const [categorie, setCategorie] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(null);
  const [multiWR, setMultiWR] = useState('');
  const [showMultiWR, setShowMultiWR] = useState(false); // null | 'over90' | 'avvicin' | 'urgenti'
  const [colFilter, setColFilter] = useState({ WR:'', StatoWR:'', Centrale:'', Desc_Centrale:'', Discriminante:'', Indirizzo:'', Localita:'', Pali:'', JobType:'', Assistente:'' });
  const [filtroDiscriminanteMappa, setFiltroDiscriminanteMappa] = useState('');
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
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/mini-squadre`), axios.get(`${API}/solleciti`), axios.get(`${API}/categorie-discriminante`)])
      .then(([wrR, sqR, solR, catR]) => {
        setWr(wrR.data.filter(w => !STATI_ESCLUSI.includes(w.StatoWR?.toUpperCase())));
        setMiniSquadre(sqR.data);
        setSolleciti(solR.data);
        setCategorie(catR.data.categorie || []);
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
    if (filtroCategoria) {
      const disc = (w.Discriminante || '').toLowerCase();
      try { if (!new RegExp(filtroCategoria, 'i').test(disc)) return false; } catch(e) { if (!disc.includes(filtroCategoria)) return false; }
    }
    if (multiWR.trim()) {
      const lista = multiWR.split(/[\n,;\s]+/).map(s => s.trim()).filter(Boolean);
      if (lista.length > 0 && !lista.includes(String(w.WR).trim())) return false;
    }
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

  // Mobile layout
  if (isMobile) return (
    <SubDashboardMobile
      wr={wr} miniSquadre={miniSquadre} solleciti={solleciti}
      setSolleciti={setSolleciti} setMiniSquadre={setMiniSquadre}
      subCode={subCode} API={API} previewMode={previewMode}
      categorie={categorie}
    />
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {storicoWR && <StoricoSolleciti wr={storicoWR} solleciti={solleciti} setSolleciti={setSolleciti} API={API} onClose={() => setStoricoWR(null)} />}
      {showConfronta && selectedRows.size === 2 && (() => { const [a,b] = [...selectedRows]; const wrA = wr.find(w=>String(w.WR)===a); const wrB = wr.find(w=>String(w.WR)===b); return wrA && wrB ? <ConfrontaWR wrA={wrA} wrB={wrB} onClose={() => setShowConfronta(false)} /> : null; })()}
      {showSolleciti && <SollicitiPopup solleciti={solleciti} wr={wr} onClose={() => setShowSolleciti(false)} onSelectWR={w => { setSelectedWR(w); setActiveTab('pratiche'); }} />}
      {showMappa && <MappaSub wr={wr} onClose={() => setShowMappa(false)} API={API} user={user} subCode={subCode} miniSquadre={miniSquadre} onSquadraCreata={sq => setMiniSquadre(prev => [...prev, sq])} solleciti={solleciti} categorie={categorie} />}
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
              <div style={{ position:'relative', display:'flex', gap:4 }}>
                <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Cerca tutto..." style={{ ...selectStyle, width: 150 }} />
                <button onClick={() => setShowMultiWR(!showMultiWR)} title="Ricerca multipla WR"
                  style={{ background: multiWR.trim() ? 'rgba(59,130,246,0.2)' : 'var(--bg)', border:`1px solid ${multiWR.trim() ? 'var(--accent)' : 'var(--border)'}`, color: multiWR.trim() ? 'var(--accent)' : 'var(--muted)', padding:'4px 7px', borderRadius:5, fontSize:11, cursor:'pointer', whiteSpace:'nowrap' }}>
                  ☰{multiWR.trim() ? ` ${multiWR.split(/[\n,;\s]+/).filter(s=>s.trim()).length}` : ''}
                </button>
                {showMultiWR && (
                  <div style={{ position:'absolute', top:'100%', left:0, zIndex:100, background:'var(--panel)', border:'1px solid var(--border)', borderRadius:8, padding:10, marginTop:4, width:200, boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
                    <div style={{ fontSize:9, color:'var(--muted)', marginBottom:5, fontFamily:'var(--mono)', letterSpacing:2 }}>LISTA WR</div>
                    <textarea value={multiWR} onChange={e => { setMultiWR(e.target.value); setPage(1); }}
                      placeholder={"Incolla WR\nuno per riga"}
                      rows={5}
                      style={{ width:'100%', background:'var(--bg)', border:'1px solid var(--border)', color:'var(--text)', padding:'5px 7px', borderRadius:4, fontSize:11, outline:'none', resize:'vertical', boxSizing:'border-box', fontFamily:'var(--mono)' }} />
                    {multiWR.trim() && (
                      <button onClick={() => { setMultiWR(''); setPage(1); }}
                        style={{ marginTop:5, background:'transparent', border:'1px solid var(--border)', color:'var(--red)', padding:'3px 8px', borderRadius:4, fontSize:10, cursor:'pointer', width:'100%' }}>
                        ✕ Cancella
                      </button>
                    )}
                  </div>
                )}
              </div>
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
                {categorie.length > 0 && (
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {categorie.map((cat, i) => {
                      const count = wr.filter(w => { try { return new RegExp(cat.pattern, 'i').test(w.Discriminante || ''); } catch(e) { return false; } }).length;
                      if (count === 0) return null;
                      const isActive = filtroCategoria === cat.pattern;
                      return (
                        <button key={i} onClick={() => { setFiltroCategoria(isActive ? null : cat.pattern); setPage(1); setFiltroCard(null); }}
                          style={{ padding:'3px 8px', borderRadius:20, border:`1px solid ${cat.colore}`, background: isActive ? `${cat.colore}33` : 'transparent', color:cat.colore, fontSize:10, cursor:'pointer', fontWeight: isActive ? 700 : 400, whiteSpace:'nowrap' }}>
                          {cat.emoji} {cat.nome} ({count})
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedRows.size === 2 && (
                  <button onClick={() => setShowConfronta(true)}
                    style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', color:'var(--accent2)', padding:'5px 10px', borderRadius:6, fontSize:12, cursor:'pointer', fontWeight:600 }}>
                    ⚖ Confronta
                  </button>
                )}
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
                        { label: 'Discriminante', col: 'Discriminante' },
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
                          <td style={{ padding: '7px 12px', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#f59e0b', fontSize: 11 }} onClick={() => setSelectedWR(w)}>{w.Discriminante || '—'}</td>
                          <td style={{ padding: '7px 12px', color: 'var(--muted)', whiteSpace: 'nowrap' }} onClick={() => setSelectedWR(w)}>{w.Assistente}</td>
                          <td style={{ padding:'4px 8px' }}>
                            {(() => {
                              const doc = solleciti.find(s => String(s.wr) === String(w.WR));
                              const cnt = doc?.storico?.length || 0;
                              return cnt > 0 ? (
                                <button onClick={e => { e.stopPropagation(); setStoricoWR(w); }}
                                  style={{ background:'rgba(236,72,153,0.15)', border:'1px solid rgba(236,72,153,0.3)', color:'#ec4899', padding:'2px 8px', borderRadius:4, fontSize:10, cursor:'pointer', fontWeight:700, whiteSpace:'nowrap' }}>
                                  ⚡ {cnt}
                                </button>
                              ) : null;
                            })()}
                          </td>
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
