import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function SubSquadre() {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [miniSquadre, setMiniSquadre] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedSub, setExpandedSub] = useState({});
  const [expandedSq, setExpandedSq] = useState({});
  const [selectedWR, setSelectedWR] = useState(null);

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/wr`),
      axios.get(`${API}/mini-squadre`)
    ]).then(([wrR, sqR]) => {
      setWr(wrR.data);
      setMiniSquadre(sqR.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [API]);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return false;
    return (oggi - date) / (1000*60*60*24) > 90;
  };

  // Raggruppa WR per sub
  const wrBySub = {};
  wr.forEach(w => {
    const sq = w.Sq || 'N/D';
    if (!wrBySub[sq]) wrBySub[sq] = [];
    wrBySub[sq].push(w);
  });

  // Raggruppa mini-squadre per sub
  const sqBySub = {};
  miniSquadre.forEach(sq => {
    const cod = sq.sub_code || 'N/D';
    if (!sqBySub[cod]) sqBySub[cod] = [];
    sqBySub[cod].push(sq);
  });

  const allSubs = [...new Set([...Object.keys(wrBySub), ...Object.keys(sqBySub)])].sort();

  const toggleSub = (cod) => setExpandedSub(p => ({ ...p, [cod]: !p[cod] }));
  const toggleSq = (tok) => setExpandedSq(p => ({ ...p, [tok]: !p[tok] }));

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)', textAlign: 'center' }}>Caricamento...</div>;

  return (
    <div style={{ padding: 24, overflow: 'auto', height: 'calc(100vh - 48px)' }}>
      {/* Popup WR */}
      {selectedWR && (
        <div onClick={() => setSelectedWR(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 12, width: 440, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 16, fontWeight: 600, color: 'var(--accent)' }}>WR {selectedWR.WR}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{selectedWR.Datadispaccio}</div>
              </div>
              <button onClick={() => setSelectedWR(null)} style={{ background: 'transparent', border: 'none', color: 'var(--muted)', fontSize: 22, cursor: 'pointer' }}>×</button>
            </div>
            <div style={{ padding: '16px 20px' }}>
              {[
                ['Squadra', selectedWR.Sq + (selectedWR.Descrizione_Sq ? ` — ${selectedWR.Descrizione_Sq}` : '')],
                ['Stato', selectedWR.StatoWR],
                ['Tipo', selectedWR.JobType],
                ['Centrale', selectedWR.Desc_Centrale || selectedWR.Centrale],
                ['Indirizzo', `${selectedWR.Indirizzo || ''}${selectedWR.Localita ? ', '+selectedWR.Localita : ''}`],
                ['Assistente', selectedWR.Assistente],
                ['Recapito', selectedWR.Recapito],
                ['N° Pali', selectedWR.Pali],
                ['Note', selectedWR.Note],
              ].filter(([,v]) => v && v.trim()).map(([label, val], i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 13 }}>
                  <span style={{ color: 'var(--muted)', minWidth: 100, fontSize: 12 }}>{label}</span>
                  <span style={{ color: 'var(--text)' }}>{val}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10 }}>
              {selectedWR.Latitudine && selectedWR.Longitudine && (
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${selectedWR.Latitudine},${selectedWR.Longitudine}`}
                  target="_blank" rel="noreferrer"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', color: 'var(--green)', padding: '8px 14px', borderRadius: 7, fontSize: 13, textDecoration: 'none' }}>
                  📍 Indicazioni
                </a>
              )}
              <button onClick={() => setSelectedWR(null)} style={{ marginLeft: 'auto', background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--muted)', padding: '8px 14px', borderRadius: 7, fontSize: 13, cursor: 'pointer' }}>Chiudi</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>Sub e squadre</div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Struttura gerarchica — clicca per espandere</div>

      {allSubs.map(cod => {
        const wrs = wrBySub[cod] || [];
        const sqs = sqBySub[cod] || [];
        const nome = wrs[0]?.Descrizione_Sq || cod;
        const old = wrs.filter(w => isOld(w.Datadispaccio)).length;
        const isExp = expandedSub[cod];
        // WR non assegnate a nessuna mini-squadra
        const assegnate = new Set(sqs.flatMap(s => s.wr_list || []));
        const nonAssegnate = wrs.filter(w => !assegnate.has(String(w.WR)));

        return (
          <div key={cod} style={{ marginBottom: 10, background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {/* Header sub */}
            <div onClick={() => toggleSub(cod)} style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', userSelect: 'none' }}>
              <span style={{ fontSize: 14 }}>{isExp ? '▾' : '▸'}</span>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 14, fontWeight: 600, color: 'var(--accent)' }}>{cod}</div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>{nome}</div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
                {old > 0 && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ {old} +90gg</span>}
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>{wrs.length} WR</span>
                <span style={{ fontSize: 12, color: 'var(--accent2)' }}>{sqs.length} mini-squadre</span>
              </div>
            </div>

            {isExp && (
              <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px' }}>
                {/* Mini-squadre */}
                {sqs.map(sq => {
                  const sqWrs = sq.wr_list?.map(wrNum => wrs.find(w => String(w.WR) === String(wrNum))).filter(Boolean) || [];
                  const isExpSq = expandedSq[sq.link_token];
                  const sqOld = sqWrs.filter(w => isOld(w?.Datadispaccio)).length;
                  const link = `${window.location.origin}/view/${sq.link_token}`;

                  return (
                    <div key={sq.link_token} style={{ marginBottom: 8, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div onClick={() => toggleSq(sq.link_token)} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <span style={{ fontSize: 12 }}>{isExpSq ? '▾' : '▸'}</span>
                        <span style={{ fontSize: 13, fontWeight: 500 }}>{sq.nome}</span>
                        <span style={{ fontSize: 11, color: 'var(--muted)' }}>{sqWrs.length} WR</span>
                        {sqOld > 0 && <span style={{ fontSize: 11, color: 'var(--red)' }}>⚠ {sqOld}</span>}
                        <button
                          onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(link); }}
                          title="Copia link"
                          style={{ marginLeft: 'auto', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: 'var(--accent)', padding: '3px 8px', borderRadius: 4, fontSize: 11, cursor: 'pointer' }}>
                          ⎘ Link
                        </button>
                      </div>
                      {isExpSq && (
                        <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
                          {sqWrs.length === 0
                            ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Nessuna WR assegnata</div>
                            : sqWrs.map((w, i) => (
                              <div key={i} onClick={() => setSelectedWR(w)}
                                style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', minWidth: 80 }}>{w.WR}</span>
                                <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.Indirizzo}, {w.Localita}</span>
                                <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: isOld(w.Datadispaccio) ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)', color: isOld(w.Datadispaccio) ? 'var(--red)' : 'var(--green)', flexShrink: 0 }}>
                                  {isOld(w.Datadispaccio) ? '+90gg' : w.StatoWR}
                                </span>
                              </div>
                            ))
                          }
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* WR non assegnate */}
                {nonAssegnate.length > 0 && (
                  <div style={{ marginTop: 8, background: 'var(--bg)', border: '1px dashed var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                    <div onClick={() => toggleSq(`na-${cod}`)} style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                      <span style={{ fontSize: 12 }}>{expandedSq[`na-${cod}`] ? '▾' : '▸'}</span>
                      <span style={{ fontSize: 13, color: 'var(--muted)' }}>Non assegnate</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)' }}>{nonAssegnate.length} WR</span>
                    </div>
                    {expandedSq[`na-${cod}`] && (
                      <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
                        {nonAssegnate.map((w, i) => (
                          <div key={i} onClick={() => setSelectedWR(w)}
                            style={{ display: 'flex', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', minWidth: 80 }}>{w.WR}</span>
                            <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.Indirizzo}, {w.Localita}</span>
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: isOld(w.Datadispaccio) ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.1)', color: isOld(w.Datadispaccio) ? 'var(--red)' : 'var(--muted)', flexShrink: 0 }}>
                              {isOld(w.Datadispaccio) ? '+90gg' : w.StatoWR}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
