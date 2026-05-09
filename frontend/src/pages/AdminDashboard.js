import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    title: 'Principale',
    items: [
      { to: '/admin', label: 'Dashboard', icon: '▦' },
      { to: '/admin/pratiche', label: 'Pratiche', icon: '≡' },
    ]
  },
  {
    title: 'Gestione',
    items: [
      { to: '/admin/sub', label: 'Sub e squadre', icon: '◈' },
      { to: '/admin/link', label: 'Link attivi', icon: '⊕' },
      { to: '/admin/utenti', label: 'Utenti', icon: '⊙' },
    ]
  }
];

function MappaSquadra({ wr, onClose }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

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
        L.circleMarker([lat, lon], { radius: 8, fillColor: '#3b82f6', color: 'white', weight: 2, fillOpacity: 0.9 })
          .addTo(map)
          .bindPopup(`<div style="font-family:monospace;font-size:12px"><b style="color:#3b82f6">WR ${w.WR}</b><br/>${w.Indirizzo || ''}, ${w.Localita || ''}<br/>Stato: <b>${w.StatoWR || 'N/D'}</b><br/>${lat && lon ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}" target="_blank" style="color:#22c55e">📍 Indicazioni</a>` : ''}</div>`);
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [30, 30] });
      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [wr]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '90vw', height: '85vh', background: 'var(--panel)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)' }}>Mappa — {wr.filter(w => w.Latitudine && w.Longitudine).length} punti su {wr.length} WR</span>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div ref={mapRef} style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function PannelloWR({ squadra, wr, onClose }) {
  const [showMappa, setShowMappa] = useState(false);
  const [search, setSearch] = useState('');

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    const p = d.split('/');
    if (p.length !== 3) return false;
    return (oggi - new Date(p[2], p[1] - 1, p[0])) / (1000 * 60 * 60 * 24) > 90;
  };

  const filtered = wr.filter(w =>
    !search || w.WR?.toString().includes(search) ||
    w.Indirizzo?.toLowerCase().includes(search.toLowerCase()) ||
    w.Localita?.toLowerCase().includes(search.toLowerCase())
  );

  const conCoord = wr.filter(w => parseFloat(w.Latitudine) && parseFloat(w.Longitudine)).length;
  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;

  return (
    <>
      {showMappa && <MappaSquadra wr={wr} onClose={() => setShowMappa(false)} />}
      <div style={{ position: 'fixed', right: 0, top: 0, bottom: 0, width: 420, background: 'var(--panel)', borderLeft: '1px solid var(--border)', zIndex: 500, display: 'flex', flexDirection: 'column', boxShadow: '-4px 0 24px rgba(0,0,0,0.4)' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{squadra}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              {wr.length} WR totali
              {oltre90 > 0 && <span style={{ color: 'var(--red)', marginLeft: 8 }}>⚠ {oltre90} oltre 90gg</span>}
            </div>
          </div>
          <button onClick={() => setShowMappa(true)} style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
            ◎ Mappa ({conCoord})
          </button>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca WR, indirizzo..." style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 10px', borderRadius: 6, fontSize: 12, outline: 'none' }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {filtered.map((w, i) => {
            const old = isOld(w.Datadispaccio);
            const lat = parseFloat(w.Latitudine);
            const lon = parseFloat(w.Longitudine);
            return (
              <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', borderLeft: old ? '3px solid var(--red)' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent)', fontWeight: 600 }}>WR {w.WR}</span>
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: old ? 'var(--red)' : 'var(--green)' }}>
                    {old ? '+90gg' : w.StatoWR || 'N/D'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text)', marginBottom: 2 }}>{w.Indirizzo}{w.Localita ? `, ${w.Localita}` : ''}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--muted)' }}>
                  <span>{w.Datadispaccio}</span>
                  {w.Pali && <span>Pali: {w.Pali}</span>}
                  {lat && lon && <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`} target="_blank" rel="noreferrer" style={{ color: 'var(--green)' }}>📍 Nav</a>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function DashboardHome() {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [selectedSquadra, setSelectedSquadra] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/mini-squadre`)])
      .then(([wrR, sqR]) => { setWr(wrR.data); setSquadre(sqR.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [API]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    const p = d.split('/');
    if (p.length !== 3) return false;
    return (oggi - new Date(p[2], p[1] - 1, p[0])) / (1000 * 60 * 60 * 24) > 90;
  };

  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;

  const subMap = {};
  wr.forEach(w => {
    const sq = w.Sq || 'N/D';
    if (!subMap[sq]) subMap[sq] = [];
    subMap[sq].push(w);
  });

  const wrSquadra = selectedSquadra ? (subMap[selectedSquadra] || []) : [];

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento dati...</div>;

  return (
    <div style={{ padding: '24px', paddingRight: selectedSquadra ? '460px' : '24px' }}>
      {selectedSquadra && <PannelloWR squadra={selectedSquadra} wr={wrSquadra} onClose={() => setSelectedSquadra(null)} />}

      <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>Dashboard</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Panoramica di tutte le pratiche</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'WR totali', val: wr.length, color: 'var(--accent)' },
          { label: 'Oltre 90gg', val: oltre90, color: oltre90 > 0 ? 'var(--red)' : 'var(--muted)' },
          { label: 'Squadre/Sub', val: Object.keys(subMap).length, color: 'var(--green)' },
          { label: 'Mini-squadre', val: squadre.length, color: 'var(--accent2)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '10px' }}>
        WR per squadra/sub — clicca per vedere le pratiche
      </div>
      <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--bg)' }}>
              {['Codice', 'Nome', 'WR', 'Oltre 90gg', 'Con coord'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(subMap).sort((a, b) => b[1].length - a[1].length).map(([cod, wrs], i) => {
              const old = wrs.filter(w => isOld(w.Datadispaccio)).length;
              const coord = wrs.filter(w => parseFloat(w.Latitudine) && parseFloat(w.Longitudine)).length;
              const nome = wrs[0]?.Descrizione_Sq || '—';
              const isSel = selectedSquadra === cod;
              return (
                <tr key={i} onClick={() => setSelectedSquadra(isSel ? null : cod)}
                  style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: isSel ? 'rgba(59,130,246,0.1)' : 'transparent', transition: 'background 0.15s' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--accent)', fontWeight: 600 }}>{cod}</td>
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--muted)' }}>{nome}</td>
                  <td style={{ padding: '10px 14px', fontSize: '13px', fontWeight: 500 }}>{wrs.length}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {old > 0 ? <span style={{ fontSize: '12px', color: 'var(--red)' }}>⚠ {old}</span> : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--muted)' }}>{coord}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Layout navItems={NAV}>
      <Routes>
        <Route path="/" element={<DashboardHome />} />
        <Route path="/pratiche" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Pratiche — in sviluppo</div>} />
        <Route path="/sub" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Sub e squadre — in sviluppo</div>} />
        <Route path="/link" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Link attivi — in sviluppo</div>} />
        <Route path="/utenti" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Gestione utenti — in sviluppo</div>} />
      </Routes>
    </Layout>
  );
}
