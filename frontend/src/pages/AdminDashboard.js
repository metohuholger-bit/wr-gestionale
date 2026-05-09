import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    title: 'Principale',
    items: [
      { to: '/admin', label: 'Dashboard', icon: '▦' },
      { to: '/admin/mappa', label: 'Mappa WR', icon: '◎' },
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

function DashboardHome() {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [squadre, setSquadre] = useState([]);

  useEffect(() => {
    axios.get(`${API}/wr`).then(r => setWr(r.data)).catch(() => {});
    axios.get(`${API}/mini-squadre`).then(r => setSquadre(r.data)).catch(() => {});
  }, [API]);

  const oggi = new Date();
  const oltre90 = wr.filter(w => {
    if (!w.Datadispaccio) return false;
    const [d, m, y] = w.Datadispaccio.split('/');
    const data = new Date(y, m - 1, d);
    return (oggi - data) / (1000 * 60 * 60 * 24) > 90;
  });

  const subMap = {};
  wr.forEach(w => {
    if (!subMap[w.Sq]) subMap[w.Sq] = 0;
    subMap[w.Sq]++;
  });

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ fontSize: '18px', fontWeight: 500, marginBottom: '4px' }}>Dashboard</div>
      <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>
        Panoramica di tutte le pratiche
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {[
          { label: 'WR totali', val: wr.length, color: 'var(--accent)' },
          { label: 'Oltre 90gg', val: oltre90.length, color: 'var(--red)' },
          { label: 'Sub attivi', val: Object.keys(subMap).length, color: 'var(--green)' },
          { label: 'Mini-squadre', val: squadre.length, color: 'var(--accent2)' },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--panel)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '16px'
          }}>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '6px' }}>{s.label}</div>
            <div style={{ fontSize: '28px', fontWeight: 500, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Sub breakdown */}
      <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--muted)', marginBottom: '10px' }}>
        WR per sub
      </div>
      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        overflow: 'hidden'
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--panel2)' }}>
              {['Codice', 'WR', 'Oltre 90gg', 'Mini-squadre'].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(subMap).map(([cod, count], i) => {
              const old = wr.filter(w => {
                if (w.Sq !== cod || !w.Datadispaccio) return false;
                const [d, m, y] = w.Datadispaccio.split('/');
                return (oggi - new Date(y, m - 1, d)) / (1000 * 60 * 60 * 24) > 90;
              }).length;
              const sqs = squadre.filter(s => s.sub_code === cod).length;
              return (
                <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 14px', fontFamily: 'var(--mono)', fontSize: '12px', color: 'var(--accent)' }}>{cod}</td>
                  <td style={{ padding: '10px 14px', fontSize: '13px' }}>{count}</td>
                  <td style={{ padding: '10px 14px' }}>
                    {old > 0 ? <span style={{ fontSize: '12px', color: 'var(--red)' }}>⚠ {old}</span> : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: '13px' }}>{sqs}</td>
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
        <Route path="/pratiche" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Pratiche — collegare Sheet</div>} />
        <Route path="/sub" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Sub e squadre</div>} />
        <Route path="/link" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Link attivi</div>} />
        <Route path="/utenti" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Gestione utenti</div>} />
        <Route path="/mappa" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Mappa — collegare Sheet</div>} />
      </Routes>
    </Layout>
  );
}
