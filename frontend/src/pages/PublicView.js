import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function MappaPublic({ wr, selected, onSelect, lavorazioni }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    if (!document.querySelector('link[href*="leaflet.min.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }
    const initMap = () => {
      const L = window.L;
      const map = L.map(mapRef.current, { center: [42.5, 11.5], zoom: 8 });
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, opacity: 0.7 }).addTo(map);
      const bounds = [];
      wr.forEach((w, idx) => {
        const lat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
        const lon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
        if (!lat || !lon) return;
        const lavorata = lavorazioni.some(l => l.wr === String(w.WR));
        const color = lavorata ? '#22c55e' : '#3b82f6';
        const marker = L.circleMarker([lat, lon], {
          radius: 10, fillColor: color, color: 'white', weight: 2, fillOpacity: 0.9
        }).addTo(map)
          .bindPopup(`<div style="font-family:monospace;font-size:12px;max-width:220px">
  <b style="color:${color}">WR ${w.WR}</b><br/>
  ${w.Indirizzo||''}, ${w.Localita||''}<br/>
  ${lavorata ? '✅ Lavorata' : '⏳ Da fare'}
  ${w.Note ? `<hr style="border-color:#333;margin:6px 0"/><span style="color:#f59e0b;font-size:11px">📋 ${w.Note}</span>` : ''}
  ${(() => { const notaLav = lavorazioni.find(l => l.wr === String(w.WR)); return notaLav?.nota ? `<br/><span style="color:#22c55e;font-size:11px">📝 ${notaLav.nota}</span>` : ''; })()}
</div>`);
        marker.on('click', () => onSelect(w));
        markersRef.current[String(w.WR)] = marker;
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      mapInstanceRef.current = map;
    };
    if (window.L) setTimeout(initMap, 50);
    else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      script.onload = () => setTimeout(initMap, 50);
      document.head.appendChild(script);
    }
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [wr]);

  useEffect(() => {
    if (!selected || !mapInstanceRef.current) return;
    const lat = parseFloat(selected.Latitudine) || parseFloat(selected.LatInferita);
    const lon = parseFloat(selected.Longitudine) || parseFloat(selected.LonInferita);
    if (lat && lon) {
      mapInstanceRef.current.setView([lat, lon], 14, { animate: true });
      setTimeout(() => markersRef.current[String(selected.WR)]?.openPopup(), 400);
    }
  }, [selected]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

function distanza(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function ordinaPerDistanza(wr, startLat, startLon) {
  const wrConCoord = wr.filter(w => parseFloat(w.Latitudine) || parseFloat(w.LatInferita));
  const wrSenzaCoord = wr.filter(w => !parseFloat(w.Latitudine) && !parseFloat(w.LatInferita));
  const risultato = [];
  let rimanenti = [...wrConCoord];
  let curLat = startLat, curLon = startLon;
  while (rimanenti.length > 0) {
    let minDist = Infinity, minIdx = 0;
    rimanenti.forEach((w, i) => {
      const lat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
      const lon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
      const d = distanza(curLat, curLon, lat, lon);
      if (d < minDist) { minDist = d; minIdx = i; }
    });
    const w = rimanenti[minIdx];
    w._distanza = minDist;
    risultato.push(w);
    curLat = parseFloat(w.Latitudine) || parseFloat(w.LatInferita);
    curLon = parseFloat(w.Longitudine) || parseFloat(w.LonInferita);
    rimanenti.splice(minIdx, 1);
  }
  return [...risultato, ...wrSenzaCoord];
}

export default function PublicView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('lista');
  const [lavorazioni, setLavorazioni] = useState([]);
  const [noteEdit, setNoteEdit] = useState({});
  const [showNota, setShowNota] = useState(null);
  const [posPartenza, setPosPartenza] = useState(null);
  const [ordinato, setOrdinato] = useState(false);
  const [wrOrdinati, setWrOrdinati] = useState([]);

  useEffect(() => {
    axios.get(`${API}/view/${token}`)
      .then(r => { setData(r.data); setWrOrdinati(r.data.wr); })
      .catch(() => setError('Link non valido o scaduto'));
    axios.get(`${API}/lavorazioni/${token}`)
      .then(r => setLavorazioni(r.data))
      .catch(() => {});
  }, [token]);

  const toggleLavorazione = async (w) => {
    try {
      const r = await axios.post(`${API}/lavorazioni`, { token, wr: String(w.WR), nota: noteEdit[w.WR] || '' });
      if (r.data.action === 'added') {
        setLavorazioni(prev => [...prev, { token, wr: String(w.WR), nota: noteEdit[w.WR] || '' }]);
      } else {
        setLavorazioni(prev => prev.filter(l => l.wr !== String(w.WR)));
      }
    } catch(e) { console.error(e); }
  };

  const salvaNota = async (w) => {
    const nota = noteEdit[w.WR] || '';
    try {
      await axios.put(`${API}/lavorazioni/${token}/${w.WR}/nota`, { nota });
      setLavorazioni(prev => prev.map(l => l.wr === String(w.WR) ? { ...l, nota } : l));
      setShowNota(null);
    } catch(e) { console.error(e); }
  };

  const usaGPS = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setPosPartenza({ lat, lon });
      const ordinati = ordinaPerDistanza(data.wr, lat, lon);
      setWrOrdinati(ordinati);
      setOrdinato(true);
    }, () => alert('Impossibile ottenere la posizione GPS'));
  };

  const resetOrdine = () => { setWrOrdinati(data.wr); setOrdinato(false); setPosPartenza(null); };

  if (error) return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:16 }}>
      <div style={{ fontSize:40 }}>⚠</div>
      <div style={{ color:'#ef4444', fontSize:14 }}>{error}</div>
    </div>
  );
  if (!data) return (
    <div style={{ minHeight:'100vh', background:'#0f1117', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'#64748b', fontSize:14 }}>Caricamento...</div>
    </div>
  );

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return false;
    return (oggi - date) / (1000*60*60*24) > 90;
  };

  const lavorate = lavorazioni.length;
  const totale = data.wr.length;

  return (
    <div style={{ height:'100vh', background:'#0f1117', color:'#e2e8f0', display:'flex', flexDirection:'column', fontFamily:'IBM Plex Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background:'#171b26', borderBottom:'1px solid #1e2330', padding:'10px 16px', display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
        <div style={{ fontFamily:'monospace', fontSize:14, fontWeight:700, color:'#3b82f6', letterSpacing:2 }}>
          MDS<span style={{ color:'#475569' }}>/</span>WR
        </div>
        <span style={{ fontSize:12, color:'#64748b' }}>{data.squadra}</span>
        {/* Progress bar */}
        <div style={{ flex:1, maxWidth:200, marginLeft:8 }}>
          <div style={{ height:4, background:'#1e2330', borderRadius:2, overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${totale > 0 ? (lavorate/totale)*100 : 0}%`, background:'#22c55e', borderRadius:2, transition:'width 0.5s ease' }} />
          </div>
          <div style={{ fontSize:10, color:'#64748b', marginTop:2 }}>{lavorate}/{totale} lavorate</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          <button onClick={() => setView('lista')} style={{ padding:'5px 10px', borderRadius:6, border:'none', background: view === 'lista' ? '#3b82f6' : '#252a3a', color: view === 'lista' ? 'white' : '#94a3b8', fontSize:12, cursor:'pointer' }}>≡ Lista</button>
          <button onClick={() => setView('mappa')} style={{ padding:'5px 10px', borderRadius:6, border:'none', background: view === 'mappa' ? '#3b82f6' : '#252a3a', color: view === 'mappa' ? 'white' : '#94a3b8', fontSize:12, cursor:'pointer' }}>◎ Mappa</button>
        </div>
      </div>

      {/* GPS ordine */}
      <div style={{ padding:'8px 16px', background:'#0d1117', borderBottom:'1px solid #1e2330', display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
        {!ordinato ? (
          <button onClick={usaGPS}
            style={{ background:'rgba(59,130,246,0.15)', border:'1px solid rgba(59,130,246,0.3)', color:'#3b82f6', padding:'6px 14px', borderRadius:6, fontSize:12, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            📍 Ordina per distanza dal mio punto
          </button>
        ) : (
          <>
            <span style={{ fontSize:12, color:'#22c55e' }}>✓ Ordinate per distanza dal tuo punto</span>
            <button onClick={resetOrdine} style={{ background:'transparent', border:'1px solid #1e2330', color:'#64748b', padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer' }}>Reset ordine</button>
          </>
        )}
        <span style={{ marginLeft:'auto', fontSize:12, color:'#475569' }}>
          {totale - lavorate} rimanenti
        </span>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Lista */}
        <div style={{ width: view === 'mappa' ? '0' : '100%', maxWidth: view === 'mappa' ? 0 : 340, background:'#111827', borderRight:'1px solid #1e2330', overflow:'auto', flexShrink:0, transition:'max-width 0.2s' }}>
          {wrOrdinati.map((w, i) => {
            const old = isOld(w.Datadispaccio);
            const lavorata = lavorazioni.some(l => l.wr === String(w.WR));
            const notaDoc = lavorazioni.find(l => l.wr === String(w.WR));
            return (
              <div key={i} style={{ borderBottom:'1px solid #0f1420', background: lavorata ? 'rgba(34,197,94,0.06)' : 'transparent', borderLeft:`3px solid ${lavorata ? '#22c55e' : old ? '#ef4444' : 'transparent'}`, opacity: lavorata ? 0.7 : 1 }}>
                <div style={{ padding:'10px 14px', display:'flex', gap:10, alignItems:'flex-start' }}>
                  {/* Numero ordine */}
                  {ordinato && (
                    <div style={{ fontFamily:'monospace', fontSize:11, color:'#475569', minWidth:20, paddingTop:2 }}>{i+1}.</div>
                  )}
                  <div style={{ flex:1, cursor:'pointer' }} onClick={() => { setSelected(w); if(view === 'mappa') return; }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:3 }}>
                      <span style={{ fontFamily:'monospace', fontSize:13, color: lavorata ? '#22c55e' : '#3b82f6', fontWeight:700, textDecoration: lavorata ? 'line-through' : 'none' }}>
                        WR {w.WR}
                      </span>
                      {ordinato && w._distanza && (
                        <span style={{ fontSize:10, color:'#475569' }}>{w._distanza.toFixed(1)}km</span>
                      )}
                    </div>
                    <div style={{ fontSize:12, color:'#64748b', marginBottom:3 }}>{w.Indirizzo}, {w.Localita}</div>
                    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                      <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)', color: old ? '#ef4444' : '#22c55e' }}>{old ? '+90gg' : w.StatoWR}</span>
                      <span style={{ fontSize:10, color:'#475569' }}>{w.Datadispaccio}</span>
                    </div>
                    {notaDoc?.nota && (
                      <div style={{ marginTop:4, fontSize:11, color:'#f59e0b', fontStyle:'italic' }}>📝 {notaDoc.nota}</div>
                    )}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'flex-end' }}>
                    {/* Toggle lavorato */}
                    <button onClick={() => toggleLavorazione(w)}
                      style={{ background: lavorata ? 'rgba(34,197,94,0.2)' : 'rgba(100,116,139,0.15)', border:`1px solid ${lavorata ? '#22c55e' : '#475569'}`, color: lavorata ? '#22c55e' : '#64748b', padding:'4px 10px', borderRadius:6, fontSize:11, cursor:'pointer', fontWeight:600, whiteSpace:'nowrap' }}>
                      {lavorata ? '✓ Fatto' : '○ Da fare'}
                    </button>
                    {/* Nota */}
                    <button onClick={() => setShowNota(showNota === w.WR ? null : w.WR)}
                      style={{ background:'transparent', border:'1px solid #1e2330', color:'#475569', padding:'3px 8px', borderRadius:5, fontSize:10, cursor:'pointer' }}>
                      📝 Nota
                    </button>
                  </div>
                </div>
                {/* Nota editor */}
                {showNota === w.WR && (
                  <div style={{ padding:'0 14px 10px', display:'flex', gap:6 }}>
                    <input value={noteEdit[w.WR] || notaDoc?.nota || ''} onChange={e => setNoteEdit(p => ({...p, [w.WR]: e.target.value}))}
                      placeholder="Aggiungi nota (es. palo sostituito, manca cavo)..."
                      style={{ flex:1, background:'#0a0d14', border:'1px solid #1e2330', color:'#e2e8f0', padding:'5px 8px', borderRadius:5, fontSize:11, outline:'none' }} />
                    <button onClick={() => salvaNota(w)} style={{ background:'rgba(59,130,246,0.2)', border:'1px solid #3b82f6', color:'#3b82f6', padding:'5px 10px', borderRadius:5, fontSize:11, cursor:'pointer' }}>Salva</button>
                  </div>
                )}
                {/* Indicazioni */}
                {(parseFloat(w.Latitudine) || parseFloat(w.LatInferita)) && (
                  <div style={{ padding:'0 14px 8px' }}>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${w.Latitudine||w.LatInferita},${w.Longitudine||w.LonInferita}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize:11, color:'#22c55e', textDecoration:'none' }}>📍 Indicazioni stradali</a>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Mappa */}
        {view === 'mappa' && (
          <div style={{ flex:1 }}>
            <MappaPublic wr={data.wr} selected={selected} onSelect={w => setSelected(w)} lavorazioni={lavorazioni} />
          </div>
        )}
      </div>
    </div>
  );
}
