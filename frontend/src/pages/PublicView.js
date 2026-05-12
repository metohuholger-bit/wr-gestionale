import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

function Mappa({ wr, selected, onSelect }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});

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
        const inferred = !!w.CoordInferita;

        // Icona con etichetta WR visibile sempre
        const icon = L.divIcon({
          className: '',
          html: `<div style="display:flex;flex-direction:column;align-items:center;cursor:pointer">
            <div style="background:#1e2330;color:#3b82f6;font-family:monospace;font-size:10px;font-weight:700;padding:2px 5px;border-radius:3px;border:1px solid #3b82f6;white-space:nowrap;margin-bottom:2px">${w.WR}</div>
            <div style="width:14px;height:14px;background:#3b82f6;border:2px solid white;border-radius:50%;box-shadow:0 2px 4px rgba(0,0,0,0.5);${inferred ? 'border-color:#f59e0b;opacity:0.7' : ''}"></div>
          </div>`,
          iconSize: [60, 32],
          iconAnchor: [30, 32],
          popupAnchor: [0, -34]
        });

        const navLink = (lat && lon) ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" style="display:inline-block;margin-top:8px;background:#22c55e;color:white;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600">📍 Indicazioni</a>` : '';

        const popup = `<div style="font-family:sans-serif;font-size:13px;min-width:220px;max-width:280px">
          <div style="font-family:monospace;font-size:15px;font-weight:700;color:#3b82f6;margin-bottom:4px">WR ${w.WR}</div>
          <div style="color:#888;font-size:11px;margin-bottom:8px">${w.Datadispaccio || ''}</div>
          ${w.Indirizzo ? `<div style="margin-bottom:4px"><b>📍</b> ${w.Indirizzo}${w.Localita ? ', '+w.Localita : ''}</div>` : ''}
          ${w.StatoWR ? `<div style="margin-bottom:4px"><b>Stato:</b> <span style="color:${w.StatoWR==='SOSPESA'?'#f59e0b':w.StatoWR==='IN CARICO'?'#22c55e':'#94a3b8'}">${w.StatoWR}</span></div>` : ''}
          ${w.JobType ? `<div style="margin-bottom:4px"><b>Tipo:</b> ${w.JobType}</div>` : ''}
          ${w.Pali ? `<div style="margin-bottom:4px"><b>Pali:</b> ${w.Pali}</div>` : ''}
          ${w.Desc_Centrale || w.Centrale ? `<div style="margin-bottom:4px"><b>Centrale:</b> ${w.Desc_Centrale || w.Centrale}</div>` : ''}
          ${w.Assistente ? `<div style="margin-bottom:4px"><b>Assistente:</b> ${w.Assistente}</div>` : ''}
          ${w.Recapito ? `<div style="margin-bottom:4px"><b>Tel:</b> ${w.Recapito}</div>` : ''}
          ${w.Note ? `<div style="margin-bottom:4px;font-size:11px;color:#666"><b>Note:</b> ${w.Note.substring(0,100)}${w.Note.length>100?'...':''}</div>` : ''}
          ${inferred ? `<div style="color:#f59e0b;font-size:11px;margin-top:4px">⚠ Posizione approssimativa</div>` : ''}
          ${navLink}
        </div>`;

        const marker = L.marker([lat, lon], { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 300 });

        marker.on('click', () => onSelect(w));
        markersRef.current[String(w.WR)] = marker;
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [40, 40] });
      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [wr]);

  useEffect(() => {
    if (!selected || !mapInstanceRef.current) return;
    const lat = parseFloat(selected.Latitudine) || parseFloat(selected.LatInferita);
    const lon = parseFloat(selected.Longitudine) || parseFloat(selected.LonInferita);
    if (lat && lon) {
      mapInstanceRef.current.setView([lat, lon], 15, { animate: true });
      setTimeout(() => markersRef.current[String(selected.WR)]?.openPopup(), 400);
    }
  }, [selected]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

export default function PublicView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('lista');
  const [categorie, setCategorie] = useState([]);
  const [filtroCategoria, setFiltroCategoria] = useState(null);

  useEffect(() => {
    axios.get(`${API}/view/${token}`)
      .then(r => setData(r.data))
      .catch(() => setError('Link non valido o scaduto'));
    axios.get(`${API}/categorie-discriminante`)
      .then(r => setCategorie(r.data.categorie || []))
      .catch(() => {});
  }, [token]);

  if (error) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: 40 }}>⚠</div>
      <div style={{ color: '#ef4444', fontSize: 14 }}>{error}</div>
    </div>
  );

  if (!data) return (
    <div style={{ minHeight: '100vh', background: '#0f1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#64748b', fontSize: 14 }}>Caricamento...</div>
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

  return (
    <div style={{ height: '100vh', background: '#0f1117', color: '#e2e8f0', display: 'flex', flexDirection: 'column', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#171b26', borderBottom: '1px solid #252a3a', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
        <div style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: '#3b82f6', letterSpacing: 2 }}>
          MDS<span style={{ color: '#64748b' }}>/</span>WR
        </div>
        <span style={{ fontSize: 12, color: '#64748b' }}>{data.squadra} — {data.wr.length} pratiche</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['lista','mappa'].map(v => (
            <button key={v} onClick={() => setView(v)}
              style={{ padding: '7px 16px', borderRadius: 8, border: 'none', background: view === v ? '#3b82f6' : '#252a3a', color: view === v ? 'white' : '#94a3b8', fontSize: 13, cursor: 'pointer', fontWeight: view === v ? 600 : 400 }}>
              {v === 'lista' ? '≡ Lista' : '◎ Mappa'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {view === 'lista' ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Badge categorie */}
        {categorie.length > 0 && (
          <div style={{ padding:'8px 12px', display:'flex', gap:6, flexWrap:'wrap', borderBottom:'1px solid #1e2330' }}>
            {categorie.filter(cat => {
              try { return data.wr.some(w => new RegExp(cat.pattern, 'i').test(w.Discriminante || '')); } catch(e) { return false; }
            }).map((cat, i) => {
              const isActive = filtroCategoria === cat.pattern;
              return (
                <button key={i} onClick={() => setFiltroCategoria(isActive ? null : cat.pattern)}
                  style={{ padding:'3px 8px', borderRadius:20, border:`1px solid ${cat.colore}`, background: isActive ? `${cat.colore}33` : 'transparent', color:cat.colore, fontSize:11, cursor:'pointer', fontWeight: isActive ? 700 : 400 }}>
                  {cat.emoji} {cat.nome}
                </button>
              );
            })}
          </div>
        )}
        {data.wr.filter(w => {
          if (!filtroCategoria) return true;
          try { return new RegExp(filtroCategoria, 'i').test(w.Discriminante || ''); } catch(e) { return true; }
        }).map((w, i) => {
            const old = isOld(w.Datadispaccio);
            const isSel = selected?.WR === w.WR;
            return (
              <div key={i} onClick={() => setSelected(isSel ? null : w)}
                style={{ padding: '14px 16px', borderBottom: '1px solid #252a3a', cursor: 'pointer', background: isSel ? 'rgba(59,130,246,0.1)' : 'transparent', borderLeft: `4px solid ${isSel ? '#3b82f6' : old ? '#ef4444' : 'transparent'}` }}>
                <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#3b82f6', fontWeight: 700, marginBottom: 4 }}>WR {w.WR}</div>
                <div style={{ fontSize: 13, marginBottom: 6 }}>{w.Indirizzo}{w.Localita ? ', '+w.Localita : ''}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: old ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{old ? '+90gg' : w.StatoWR}</span>
                  <span style={{ fontSize: 11, color: '#64748b' }}>{w.Datadispaccio}</span>
                  {w.Pali && <span style={{ fontSize: 11, color: '#64748b' }}>• {w.Pali} pali</span>}
                </div>
                {isSel && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #252a3a' }}>
                    {[
                      ['Tipo', w.JobType], ['Centrale', w.Desc_Centrale || w.Centrale],
                      ['Assistente', w.Assistente], ['Recapito', w.Recapito],
                      ['Note', w.Note],
                    ].filter(([,v]) => v && v.trim()).map(([label, val], j) => (
                      <div key={j} style={{ display: 'flex', gap: 10, marginBottom: 6, fontSize: 13 }}>
                        <span style={{ color: '#64748b', minWidth: 90, fontSize: 12, flexShrink: 0 }}>{label}</span>
                        <span style={{ color: '#e2e8f0' }}>{val}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                      {(w.Latitudine || w.LatInferita) && (
                        <a href={`https://www.google.com/maps/dir/?api=1&destination=${w.Latitudine||w.LatInferita},${w.Longitudine||w.LonInferita}`}
                          target="_blank" rel="noreferrer"
                          style={{ background: '#22c55e', color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
                          📍 Indicazioni
                        </a>
                      )}
                      <button onClick={e => { e.stopPropagation(); setView('mappa'); }}
                        style={{ background: '#3b82f6', color: 'white', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
                        ◎ Mappa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ flex: 1 }}>
          <Mappa wr={data.wr} selected={selected} onSelect={w => setSelected(w)} />
        </div>
      )}
    </div>
  );
}
