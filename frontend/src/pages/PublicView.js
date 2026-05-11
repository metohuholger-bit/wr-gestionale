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
        const marker = L.circleMarker([lat, lon], {
          radius: 9, fillColor: '#3b82f6',
          color: inferred ? '#f59e0b' : 'white',
          weight: inferred ? 3 : 2,
          fillOpacity: inferred ? 0.6 : 0.9
        }).addTo(map)
          .bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:#3b82f6">WR ${w.WR}</b><br/>${w.Indirizzo||''}, ${w.Localita||''}<br/>Stato: <b>${w.StatoWR}</b>${inferred ? '<br/><span style="color:#f59e0b">⚠ Posizione approssimativa</span>' : ''}</div>`);
        marker.on('click', () => onSelect(w));
        markersRef.current[String(w.WR)] = marker;
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
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
      mapInstanceRef.current.setView([lat, lon], 14, { animate: true });
      markersRef.current[String(selected.WR)]?.openPopup();
    }
  }, [selected]);

  return <div ref={mapRef} style={{ width: '100%', height: '100%' }} />;
}

export default function PublicView() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState('');
  const [view, setView] = useState('dettaglio');

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
    <div style={{ height: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--accent)', letterSpacing: 2 }}>
          MDS<span style={{ color: 'var(--muted)' }}>/</span>WR
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{data.squadra} — {data.wr.length} pratiche</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button onClick={() => setView('dettaglio')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: view === 'dettaglio' ? 'var(--accent)' : 'transparent', color: view === 'dettaglio' ? 'white' : 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>≡ Lista</button>
          <button onClick={() => setView('mappa')} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: view === 'mappa' ? 'var(--accent)' : 'transparent', color: view === 'mappa' ? 'white' : 'var(--muted)', fontSize: 12, cursor: 'pointer' }}>◎ Mappa</button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: 280, background: 'var(--panel)', borderRight: '1px solid var(--border)', overflow: 'auto', flexShrink: 0 }}>
          {data.wr.map((w, i) => {
            const old = isOld(w.Datadispaccio);
            return (
              <div key={i} onClick={() => { setSelected(w); setView('dettaglio'); }}
                style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: selected?.WR === w.WR ? 'rgba(59,130,246,0.1)' : 'transparent', borderLeft: selected?.WR === w.WR ? '3px solid var(--accent)' : old ? '3px solid var(--red)' : '3px solid transparent' }}>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', marginBottom: 2 }}>WR {w.WR}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.Indirizzo}, {w.Localita}</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '2px 5px', background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: old ? 'var(--red)' : 'var(--green)', borderRadius: 3 }}>{old ? '+90gg' : w.StatoWR || 'N/D'}</span>
                  <span style={{ fontSize: 10, color: 'var(--muted)' }}>{w.Datadispaccio}</span>
                </div>
              </div>
            );
          })}
        </div>

        {view === 'mappa' ? (
          <div style={{ flex: 1 }}>
            <Mappa wr={data.wr} selected={selected} onSelect={w => setSelected(w)} />
          </div>
        ) : selected ? (
          <div style={{ flex: 1, padding: 24, overflow: 'auto' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 16, color: 'var(--accent)', marginBottom: 4 }}>WR {selected.WR}</div>
            <div style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 500, marginBottom: 16 }}>DISPACCIO {selected.Datadispaccio}</div>
            {[
              ['Tipo', selected.JobType],
              ['Indirizzo', `${selected.Indirizzo||''}, ${selected.Localita||''}`],
              ['Assistente', selected.Assistente],
              ['Recapito', selected.Recapito],
              ['N° Pali', selected.Pali],
              ['Centrale', selected.Desc_Centrale || selected.Centrale],
              ['Stato', selected.StatoWR],
              ['Note', selected.Note],
              ['Riepilogo', selected.RiepilogoPrev],
            ].filter(([, v]) => v && v.trim()).map(([label, val], i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 13 }}>
                <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12, flexShrink: 0 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 500 }}>{val}</span>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 24, flexWrap: 'wrap' }}>
              {(selected.Latitudine || selected.LatInferita) && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selected.Latitudine||selected.LatInferita},${selected.Longitudine||selected.LonInferita}`}
                  target="_blank" rel="noreferrer"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                  📍 Indicazioni stradali
                </a>
              )}
              <button onClick={() => setView('mappa')}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '10px 16px', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>
                ◎ Vedi su mappa
              </button>
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
