import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const ZoomToMarker = ({ position, zoomLevel }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lon], zoomLevel || 14);
  }, [position, map, zoomLevel]);
  return null;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState({ total_wr: 0, old_90: 0, active_subs: 0 });
  const [subList, setSubList] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [wrList, setWrList] = useState([]);
  const [showMap, setShowMap] = useState(false);
  const [mapMarkers, setMapMarkers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter90, setFilter90] = useState(false);
  const [mapCenter, setMapCenter] = useState([42.5, 11.8]);
  const token = localStorage.getItem('token');

  const fetchStats = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/stats`, { headers: { Authorization: `Bearer ${token}` }});
    setStats(await res.json());
  };

  const fetchSubs = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/wr?page=1&limit=1`, { headers: { Authorization: `Bearer ${token}` }});
    const data = await res.json();
    const uniqueSubs = [...new Set(data.data.map(r => r.Sq))].filter(Boolean);
    setSubList(uniqueSubs);
  };

  const fetchWR = async (sq) => {
    setSelectedSub(sq);
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/wr?squadra=${sq}&limit=500`, { headers: { Authorization: `Bearer ${token}` }});
    const json = await res.json();
    setWrList(json.data || []);
  };

  const loadMapData = async () => {
    const res = await fetch(`${process.env.REACT_APP_API_URL}/api/wr/map?squadra=${selectedSub}`, { headers: { Authorization: `Bearer ${token}` }});
    setMapMarkers(await res.json());
    setShowMap(true);
  };

  useEffect(() => {
    fetchStats();
    fetchSubs();
  }, []);

  const filteredWR = wrList.filter(r => {
    const matchSearch = !searchTerm || r.WR?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        r.Indirizzo?.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter90 && r.Datadispaccio) {
      const d = r.Datadispaccio.split('/');
      const date = new Date(`${d[2]}-${d[1]}-${d[0]}`);
      const days = (new Date() - date) / (1000 * 60 * 60 * 24);
      if (days <= 90) return false;
    }
    return matchSearch;
  });

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', color: '#e2e8f0' }}>
      {/* Sidebar */}
      <div style={{ width: 280, background: '#1e293b', padding: 16, borderRight: '1px solid #334155', overflowY: 'auto' }}>
        <h2 style={{ color: '#38bdf8', marginBottom: 16 }}>📊 Dashboard</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
          <div style={{ background: '#334155', padding: 10, borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.total_wr}</div>
            <div style={{ fontSize: 12 }}>WR Totali</div>
          </div>
          <div style={{ background: '#334155', padding: 10, borderRadius: 6, textAlign: 'center', color: '#f87171' }}>
            <div style={{ fontSize: 20, fontWeight: 'bold' }}>{stats.old_90}</div>
            <div style={{ fontSize: 12 }}>+90gg</div>
          </div>
        </div>

        <h3 style={{ marginTop: 8, marginBottom: 12 }}>Squadre / Sub</h3>
        {subList.map(sq => (
          <button key={sq} onClick={() => fetchWR(sq)} style={{
            display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6,
            background: selectedSub === sq ? '#0ea5e9' : '#334155',
            border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer', textAlign: 'left'
          }}>
            {sq}
          </button>
        ))}
      </div>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedSub && (
          <div style={{ padding: 12, background: '#1e293b', borderBottom: '1px solid #334155', display: 'flex', gap: 12, alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{selectedSub} ({filteredWR.length} WR)</h3>
            <input placeholder="Cerca WR o Indirizzo..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              style={{ padding: 6, borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#fff', flex: 1 }} />
            <button onClick={() => setFilter90(!filter90)} style={{
              padding: '6px 12px', background: filter90 ? '#ef4444' : '#475569',
              border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer'
            }}>⚠ +90gg</button>
            <button onClick={loadMapData} style={{ padding: '6px 12px', background: '#22c55e', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>🗺 Mappa</button>
          </div>
        )}

        {showMap ? (
          <div style={{ flex: 1, position: 'relative' }}>
            <button onClick={() => setShowMap(false)} style={{ position: 'absolute', top: 10, left: 10, zIndex: 1000, padding: '6px 10px', background: '#334155', border: 'none', borderRadius: 4, color: '#fff', cursor: 'pointer' }}>← Torna alla lista</button>
            <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 1000, display: 'flex', gap: 8 }}>
              <input placeholder="Cerca WR..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                style={{ padding: 6, borderRadius: 4, border: '1px solid #475569', background: '#0f172a', color: '#fff' }} />
            </div>
            <MapContainer center={mapCenter} zoom={9} style={{ height: '100%', width: '100%' }}>
              <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
              <ZoomToMarker position={mapCenter} />
              {mapMarkers.filter(m => !searchTerm || m.wr.toLowerCase().includes(searchTerm.toLowerCase())).map((m, i) => (
                <Marker key={i} position={[m.lat, m.lon]}>
                  <Popup>
                    <strong>WR: {m.wr}</strong><br/>
                    {m.indirizzo}<br/>
                    Stato: {m.stato} | Pali: {m.pali}<br/>
                    Dispaccio: {m.datadispaccio}<br/>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${m.lat},${m.lon}`} target="_blank" rel="noreferrer" style={{ color: '#2563eb' }}>🧭 Indicazioni</a>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: '#334155' }}>
                <th style={{ padding: 8, textAlign: 'left' }}>WR</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Stato</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Indirizzo</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Data</th>
                <th style={{ padding: 8, textAlign: 'left' }}>Pali</th>
              </tr></thead>
              <tbody>
                {filteredWR.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #334155', background: i % 2 === 0 ? '#1e293b' : '#0f172a' }}>
                    <td style={{ padding: 8 }}>{r.WR}</td>
                    <td style={{ padding: 8 }}>{r.StatoWR}</td>
                    <td style={{ padding: 8 }}>{r.Indirizzo}, {r.Localita}</td>
                    <td style={{ padding: 8 }}>{r.Datadispaccio}</td>
                    <td style={{ padding: 8 }}>{r.Pali}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}