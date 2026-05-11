import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const RUOLI = ['admin', 'sub', 'pending'];
const SUB_CODES = ['S060','S077','S090','S096','S131','S186','S230','S265','S305'];

export default function Utenti() {
  const { API } = useAuth();
  const [utenti, setUtenti] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [saved, setSaved] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/users`)
      .then(r => setUtenti(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [API]);

  const pending = utenti.filter(u => u.role === 'pending');
  const admins = utenti.filter(u => u.role === 'admin');
  const subs = utenti.filter(u => u.role === 'sub');

  const startEdit = (u) => {
    setEditing(u.email);
    setEditData({ role: u.role, sub_code: u.sub_code || '' });
  };

  const saveEdit = async (email) => {
    try {
      await axios.put(`${API}/admin/users/${email}`, null, {
        params: { role: editData.role, sub_code: editData.sub_code || null }
      });
      setUtenti(prev => prev.map(u => u.email === email ? { ...u, role: editData.role, sub_code: editData.sub_code } : u));
      setEditing(null);
      setSaved(email);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) { console.error(e); }
  };

  const approvaAdmin = async (email) => {
    try {
      await axios.put(`${API}/admin/users/${email}`, null, { params: { role: 'admin', sub_code: null } });
      setUtenti(prev => prev.map(u => u.email === email ? { ...u, role: 'admin', sub_code: null } : u));
      setSaved(email);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) { console.error(e); }
  };

  const approvaSub = async (email, sub_code) => {
    if (!sub_code) return;
    try {
      await axios.put(`${API}/admin/users/${email}`, null, { params: { role: 'sub', sub_code } });
      setUtenti(prev => prev.map(u => u.email === email ? { ...u, role: 'sub', sub_code } : u));
      setSaved(email);
      setTimeout(() => setSaved(null), 2000);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div>;

  const cardStyle = { background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 24 };
  const thStyle = { padding: '9px 14px', textAlign: 'left', fontSize: 11, color: 'var(--muted)', fontWeight: 500, borderBottom: '1px solid var(--border)', background: 'var(--bg)' };
  const tdStyle = { padding: '10px 14px', fontSize: 13, borderBottom: '1px solid var(--border)' };

  const UserRow = ({ u, showApprova }) => {
    const [subCodeSel, setSubCodeSel] = useState('');
    const isEditing = editing === u.email;
    const isSaved = saved === u.email;

    return (
      <tr style={{ background: u.role === 'pending' ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
        <td style={tdStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {u.picture && <img src={u.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />}
            <div>
              <div style={{ fontWeight: 500 }}>{u.name || u.email}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>{u.email}</div>
            </div>
          </div>
        </td>
        <td style={tdStyle}>
          {isEditing ? (
            <select value={editData.role} onChange={e => setEditData(p => ({ ...p, role: e.target.value }))}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: 5, fontSize: 12 }}>
              {RUOLI.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          ) : (
            <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, fontWeight: 600,
              background: u.role === 'admin' ? 'rgba(59,130,246,0.15)' : u.role === 'sub' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: u.role === 'admin' ? 'var(--accent)' : u.role === 'sub' ? 'var(--green)' : 'var(--red)' }}>
              {u.role}
            </span>
          )}
        </td>
        <td style={tdStyle}>
          {isEditing ? (
            <select value={editData.sub_code} onChange={e => setEditData(p => ({ ...p, sub_code: e.target.value }))}
              style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: 5, fontSize: 12 }}>
              <option value="">— nessuno —</option>
              {SUB_CODES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          ) : (
            <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--accent2)' }}>{u.sub_code || '—'}</span>
          )}
        </td>
        <td style={tdStyle}>
          {showApprova && !isEditing && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => approvaAdmin(u.email)}
                style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: 'var(--accent)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                ✓ Admin
              </button>
              <select value={subCodeSel} onChange={e => setSubCodeSel(e.target.value)}
                style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', padding: '4px 8px', borderRadius: 5, fontSize: 11 }}>
                <option value="">Sub...</option>
                {SUB_CODES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <button onClick={() => approvaSub(u.email, subCodeSel)} disabled={!subCodeSel}
                style={{ background: subCodeSel ? 'rgba(34,197,94,0.15)' : 'var(--bg)', border: `1px solid ${subCodeSel ? 'rgba(34,197,94,0.3)' : 'var(--border)'}`, color: subCodeSel ? 'var(--green)' : 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: subCodeSel ? 'pointer' : 'not-allowed' }}>
                ✓ Sub
              </button>
            </div>
          )}
          {!showApprova && (
            <div style={{ display: 'flex', gap: 8 }}>
              {isEditing ? (
                <>
                  <button onClick={() => saveEdit(u.email)}
                    style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Salva
                  </button>
                  <button onClick={() => setEditing(null)}
                    style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                    Annulla
                  </button>
                </>
              ) : (
                <button onClick={() => startEdit(u)}
                  style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--muted)', padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>
                  ✎ Modifica
                </button>
              )}
              {isSaved && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Salvato</span>}
            </div>
          )}
          {showApprova && isSaved && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓ Approvato</span>}
        </td>
      </tr>
    );
  };

  const TableSection = ({ title, users, showApprova, color }) => (
    <div style={cardStyle}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color }}>{title}</span>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{users.length} utenti</span>
      </div>
      {users.length === 0 ? (
        <div style={{ padding: '20px 16px', color: 'var(--muted)', fontSize: 13 }}>Nessun utente</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thStyle}>Utente</th>
              <th style={thStyle}>Ruolo</th>
              <th style={thStyle}>Codice sub</th>
              <th style={thStyle}>Azioni</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => <UserRow key={u.email} u={u} showApprova={showApprova} />)}
          </tbody>
        </table>
      )}
    </div>
  );

  return (
    <div style={{ padding: 24, overflow: 'auto', height: 'calc(100vh - 48px)' }}>
      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Gestione Utenti</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
        Approva accessi e assegna ruoli senza andare su MongoDB
      </div>

      {pending.length > 0 && (
        <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚠</span>
          <span style={{ fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>
            {pending.length} {pending.length === 1 ? 'utente in attesa' : 'utenti in attesa'} di approvazione
          </span>
        </div>
      )}

      <TableSection title="⏳ In attesa" users={pending} showApprova={true} color="var(--red)" />
      <TableSection title="👑 Admin" users={admins} showApprova={false} color="var(--accent)" />
      <TableSection title="🏢 Sub" users={subs} showApprova={false} color="var(--green)" />
    </div>
  );
}
