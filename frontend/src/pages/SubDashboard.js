import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import Layout from '../components/Layout';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const NAV = [
  {
    title: 'Principale',
    items: [
      { to: '/sub', label: 'Le mie pratiche', icon: '≡' },
      { to: '/sub/mappa', label: 'Mappa', icon: '◎' },
    ]
  },
  {
    title: 'Squadre',
    items: [
      { to: '/sub/squadre', label: 'Mini-squadre', icon: '◈' },
      { to: '/sub/link', label: 'Link attivi', icon: '⊕' },
    ]
  }
];

function PraticheList() {
  const { API, user } = useAuth();
  const [wr, setWr] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [assignTarget, setAssignTarget] = useState('');
  const [newSquadNome, setNewSquadNome] = useState('');
  const [showNewSquad, setShowNewSquad] = useState(false);

  useEffect(() => {
    axios.get(`${API}/wr`).then(r => setWr(r.data)).catch(() => {});
    axios.get(`${API}/mini-squadre`).then(r => setSquadre(r.data)).catch(() => {});
  }, [API]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    const [dd, mm, yy] = d.split('/');
    return (oggi - new Date(yy, mm - 1, dd)) / (1000 * 60 * 60 * 24) > 90;
  };

  const toggleRow = (wr_num) => {
    const s = new Set(selected);
    if (s.has(wr_num)) s.delete(wr_num);
    else s.add(wr_num);
    setSelected(s);
  };

  const assignSelected = async () => {
    if (!assignTarget || selected.size === 0) return;
    const sq = squadre.find(s => s.link_token === assignTarget);
    if (!sq) return;
    const newList = [...new Set([...sq.wr_list, ...selected])];
    await axios.put(`${API}/mini-squadre/${assignTarget}/wr`, newList);
    setSquadre(prev => prev.map(s => s.link_token === assignTarget ? { ...s, wr_list: newList } : s));
    setSelected(new Set());
  };

  const createSquad = async () => {
    if (!newSquadNome) return;
    const r = await axios.post(`${API}/mini-squadre`, { nome: newSquadNome, sub_code: user.sub_code, wr_list: [] });
    setSquadre(prev => [...prev, { nome: newSquadNome, sub_code: user.sub_code, wr_list: [], link_token: r.data.token }]);
    setNewSquadNome('');
    setShowNewSquad(false);
  };

  const removeFromSquad = async (token, wr_num) => {
    const sq = squadre.find(s => s.link_token === token);
    if (!sq) return;
    const newList = sq.wr_list.filter(w => w !== wr_num);
    await axios.put(`${API}/mini-squadre/${token}/wr`, newList);
    setSquadre(prev => prev.map(s => s.link_token === token ? { ...s, wr_list: newList } : s));
  };

  const getAssignedSquad = (wr_num) => {
    return squadre.find(s => s.wr_list.includes(wr_num));
  };

  const copyLink = (token) => {
    const url = `${window.location.origin}/view/${token}`;
    navigator.clipboard.writeText(url);
  };

  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;
  const nonAssegnate = wr.filter(w => !getAssignedSquad(w.WR)).length;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', overflow: 'hidden' }}>
      {/* LEFT — tabella WR */}
      <div style={{ flex: 1, padding: '20px', overflow: 'auto', minWidth: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '4px' }}>Le mie pratiche</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
          Seleziona le WR e assegnale a una mini-squadra
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'WR totali', val: wr.length },
            { label: 'Non assegnate', val: nonAssegnate, red: true },
            { label: 'Oltre 90gg', val: oltre90, red: oltre90 > 0 },
          ].map((s, i) => (
            <div key={i} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '8px', padding: '12px' }}>
              <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 500, color: s.red ? 'var(--red)' : 'var(--text)' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
            <span style={{ color: 'var(--accent)', fontWeight: 500 }}>{selected.size}</span> selezionate
          </span>
          <select
            value={assignTarget}
            onChange={e => setAssignTarget(e.target.value)}
            style={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--text)', padding: '5px 8px', borderRadius: '6px', fontSize: '12px' }}
          >
            <option value="">Assegna a...</option>
            {squadre.map(s => <option key={s.link_token} value={s.link_token}>{s.nome}</option>)}
          </select>
          <button onClick={assignSelected} style={{
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            color: 'var(--accent)', padding: '5px 12px', borderRadius: '6px', fontSize: '12px'
          }}>
            Assegna →
          </button>
        </div>

        {/* Tabella */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--panel2)' }}>
                <th style={{ padding: '8px 10px', width: 32 }}>
                  <input type="checkbox" onChange={e => {
                    if (e.target.checked) setSelected(new Set(wr.map(w => w.wr)));
                    else setSelected(new Set());
                  }} />
                </th>
                {['WR', 'Indirizzo', 'Data', 'Stato', 'Squadra'].map(h => (
                  <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontSize: '11px', color: 'var(--muted)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {wr.map((w, i) => {
                const sq = getAssignedSquad(w.WR);
                const old = isOld(w.Datadispaccio);
                return (
                  <tr key={i}
                    onClick={() => toggleRow(w.WR)}
                    style={{
                      borderTop: '1px solid var(--border)',
                      background: selected.has(w.WR) ? 'rgba(59,130,246,0.08)' : 'transparent',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '6px 10px' }}>
                      <input type="checkbox" checked={selected.has(w.WR)} onChange={() => {}} />
                    </td>
                    <td style={{ padding: '6px 10px', fontFamily: 'var(--mono)', fontSize: '11px', color: 'var(--accent)' }}>{w.WR}</td>
                    <td style={{ padding: '6px 10px', fontSize: '12px', maxWidth: 160, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {w.Indirizzo}, {w.Localita}
                    </td>
                    <td style={{ padding: '6px 10px', fontSize: '11px', color: 'var(--muted)' }}>{w.Datadispaccio}</td>
                    <td style={{ padding: '6px 10px' }}>
                      {old
                        ? <span style={{ fontSize: '10px', padding: '2px 5px', background: 'rgba(239,68,68,0.15)', color: 'var(--red)', borderRadius: '4px' }}>+90gg</span>
                        : <span style={{ fontSize: '10px', padding: '2px 5px', background: 'rgba(34,197,94,0.15)', color: 'var(--green)', borderRadius: '4px' }}>{w.StatoWR || 'N/D'}</span>
                      }
                    </td>
                    <td style={{ padding: '6px 10px' }}>
                      {sq
                        ? <span style={{ fontSize: '10px', padding: '2px 5px', background: 'rgba(59,130,246,0.15)', color: 'var(--accent)', borderRadius: '4px' }}>{sq.nome}</span>
                        : <span style={{ fontSize: '11px', color: 'var(--muted)' }}>—</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT — mini-squadre */}
      <div style={{ width: '280px', background: 'var(--panel)', borderLeft: '1px solid var(--border)', padding: '16px', overflow: 'auto', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--muted)' }}>MINI-SQUADRE</span>
          <button onClick={() => setShowNewSquad(true)} style={{
            background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
            color: 'var(--accent)', padding: '4px 8px', borderRadius: '5px', fontSize: '11px'
          }}>+ Nuova</button>
        </div>

        {showNewSquad && (
          <div style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', marginBottom: '10px' }}>
            <input
              value={newSquadNome}
              onChange={e => setNewSquadNome(e.target.value)}
              placeholder="Nome squadra..."
              style={{ width: '100%', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 8px', borderRadius: '5px', fontSize: '12px', marginBottom: '6px' }}
            />
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={createSquad} style={{ flex: 1, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '5px', borderRadius: '5px', fontSize: '11px' }}>Crea</button>
              <button onClick={() => setShowNewSquad(false)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px', borderRadius: '5px', fontSize: '11px' }}>Annulla</button>
            </div>
          </div>
        )}

        {squadre.map((sq, i) => (
          <div key={i} style={{ background: 'var(--panel2)', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>{sq.nome}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginBottom: '8px' }}>
              {sq.wr_list.length === 0
                ? <div style={{ fontSize: '11px', color: 'var(--muted)', padding: '4px 0' }}>Nessuna WR assegnata</div>
                : sq.wr_list.map(wr_num => {
                    const w = wr.find(r => r.wr === wr_num);
                    return (
                      <div key={wr_num} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--panel)', borderRadius: '4px', padding: '3px 6px' }}>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--accent)', flex: 1 }}>{wr_num}</span>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {w?.citta || ''}
                        </span>
                        <button onClick={() => removeFromSquad(sq.link_token, wr_num)} style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: '12px', padding: '0 2px' }}>×</button>
                      </div>
                    );
                  })
              }
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '4px', padding: '4px 6px', fontSize: '10px', fontFamily: 'var(--mono)', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {window.location.origin}/view/{sq.link_token}
              </div>
              <button onClick={() => copyLink(sq.link_token)} title="Copia link" style={{
                background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px'
              }}>⎘</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SubDashboard() {
  return (
    <Layout navItems={NAV}>
      <Routes>
        <Route path="/" element={<PraticheList />} />
        <Route path="/squadre" element={<PraticheList />} />
        <Route path="/link" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Link attivi</div>} />
        <Route path="/mappa" element={<div style={{ padding: 24, color: 'var(--muted)' }}>Mappa</div>} />
      </Routes>
    </Layout>
  );
}
