import React, { useState, useEffect, useRef } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Pratiche from './Pratiche';
import SubSquadre from './SubSquadre';
import SubDashboard from './SubDashboard';
import Utenti from './Utenti';

const NAV = [
  { title: 'PRINCIPALE', items: [
    { to: '/admin', label: 'Dashboard', icon: '◈' },
    { to: '/admin/pratiche', label: 'Pratiche', icon: '≡' },
    { to: '/admin/vista-sub', label: 'Vista Sub', icon: '◉' },
  ]},
  { title: 'GESTIONE', items: [
    { to: '/admin/sub', label: 'Sub e squadre', icon: '⬡' },
    { to: '/admin/utenti', label: 'Utenti', icon: '⊙' },
  ]}
];

// ── ANIMATED COUNTER ──
function Counter({ value, color }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (value === 0) return;
    let start = 0;
    const duration = 800;
    const step = (timestamp) => {
      if (!ref.current) return;
      const progress = Math.min((timestamp - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(eased * value));
      if (progress < 1) requestAnimationFrame(step);
      else setDisplay(value);
    };
    requestAnimationFrame((ts) => { start = ts; requestAnimationFrame(step); });
  }, [value]);
  return <span style={{ color }} ref={ref}>{display}</span>;
}


// ── STAT POPUP ──
function StatPopup({ title, color, icon, wr, filterFn, onClose }) {
  const subMap = {};
  wr.filter(filterFn).forEach(w => {
    const sq = w.Sq || 'N/D';
    if (!subMap[sq]) subMap[sq] = [];
    subMap[sq].push(w);
  });
  const sorted = Object.entries(subMap).sort((a,b) => b[1].length - a[1].length);

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#111827', border:`1px solid ${color}33`, borderRadius:14, width:520, maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:`0 0 40px ${color}22` }}>
        <div style={{ padding:'16px 20px', borderBottom:`1px solid ${color}22`, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20, color }}>{icon}</span>
          <div>
            <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:3, color:'#475569' }}>DETTAGLIO PER SQUADRA</div>
            <div style={{ fontSize:15, fontWeight:700, color }}>{title}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'#475569', fontSize:22, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ overflow:'auto', padding:'12px 0' }}>
          {sorted.length === 0 ? (
            <div style={{ padding:'24px', textAlign:'center', color:'#22c55e', fontSize:13 }}>✓ Nessuna WR in questa categoria</div>
          ) : sorted.map(([sq, wrs], i) => (
            <div key={sq} style={{ padding:'10px 20px', borderBottom:'1px solid #0f1420', display:'flex', alignItems:'center', gap:12, animationDelay:`${i*0.05}s` }}>
              <div style={{ fontFamily:'monospace', fontSize:12, color, minWidth:60, fontWeight:700 }}>{sq}</div>
              <div style={{ flex:1, height:6, background:'#1e2330', borderRadius:3, overflow:'hidden' }}>
                <div style={{ height:'100%', background:`${color}`, borderRadius:3, width:`${(wrs.length/sorted[0][1].length)*100}%`, transition:'width 0.8s ease', opacity:0.8 }} />
              </div>
              <div style={{ fontFamily:'monospace', fontSize:13, color:'#e2e8f0', minWidth:30, textAlign:'right', fontWeight:600 }}>{wrs.length}</div>
              <div style={{ fontSize:10, color:'#475569', minWidth:80 }}>{wrs[0]?.Descrizione_Sq?.slice(0,12) || ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ALERT BANNER ──
function AlertBanner({ wr }) {
  const [dismissed, setDismissed] = React.useState(false);
  if (dismissed) return null;

  const oggi = new Date();
  const daysDiff = (d) => {
    if (!d) return null;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return null;
    return (oggi - date) / (1000*60*60*24);
  };

  const urgenti = wr.filter(w => (w.Note || '').match(/670050|670100/));
  const critici = wr.filter(w => (daysDiff(w.Datadispaccio) || 0) > 90);

  if (urgenti.length === 0 && critici.length === 0) return null;

  return (
    <div style={{ background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.25)', borderRadius:8, padding:'10px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
      <span style={{ fontSize:18 }}>🚨</span>
      <div style={{ flex:1 }}>
        {urgenti.length > 0 && <div style={{ fontSize:12, color:'#ef4444', fontWeight:600 }}>⚡ {urgenti.length} WR urgenti (670050/670100) — squadre: {[...new Set(urgenti.map(w=>w.Sq))].join(', ')}</div>}
        {critici.length > 0 && <div style={{ fontSize:12, color:'#f59e0b', marginTop: urgenti.length>0?2:0 }}>⚠ {critici.length} WR oltre 90gg — squadre: {[...new Set(critici.map(w=>w.Sq))].slice(0,5).join(', ')}{[...new Set(critici.map(w=>w.Sq))].length>5?'...':''}</div>}
      </div>
      <button onClick={() => setDismissed(true)} style={{ background:'transparent', border:'none', color:'#475569', cursor:'pointer', fontSize:16 }}>×</button>
    </div>
  );
}

// ── MINI BAR CHART ──
function BarChart({ data, maxVal }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 60, marginTop: 8 }}>
      {data.slice(0, 12).map((d, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <div style={{
            width: '100%', background: d.color || '#3b82f6',
            height: `${maxVal > 0 ? (d.value / maxVal) * 52 : 0}px`,
            borderRadius: '2px 2px 0 0',
            transition: 'height 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
            minHeight: d.value > 0 ? 2 : 0,
            opacity: 0.85
          }} />
          <div style={{ fontSize: 8, color: '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 28, transform: 'rotate(-30deg)', transformOrigin: 'top center' }}>{d.label}</div>
        </div>
      ))}
    </div>
  );
}

// ── DONUT CHART ──
function Donut({ segments, size = 80 }) {
  const total = segments.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  const r = 28, cx = 40, cy = 40, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1e2330" strokeWidth="12" />
      {segments.map((seg, i) => {
        const pct = total > 0 ? seg.value / total : 0;
        const dash = pct * circ;
        const gap = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="12"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset * circ}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 1s ease' }}
          />
        );
        offset += pct;
        return el;
      })}
    </svg>
  );
}


// ── SOLLECITA POPUP ──
function SollecitaPopup({ wr, subCode, API, onClose, onSollecitato }) {
  const [messaggio, setMessaggio] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const salva = async () => {
    setSaving(true);
    try {
      await axios.post(`${API}/solleciti`, { wr: String(wr.WR), sub_code: subCode || wr.Sq, messaggio });
      onSollecitato(String(wr.WR));
      onClose();
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div onClick={e => e.stopPropagation()} style={{ background:'#111827', border:'1px solid rgba(236,72,153,0.3)', borderRadius:12, width:420, overflow:'hidden', boxShadow:'0 0 40px rgba(236,72,153,0.15)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ fontSize:18 }}>⚡</span>
          <div>
            <div style={{ fontFamily:'monospace', fontSize:10, color:'#475569', letterSpacing:2 }}>SOLLECITA PRATICA</div>
            <div style={{ fontSize:14, fontWeight:700, color:'#ec4899' }}>WR {wr.WR}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft:'auto', background:'transparent', border:'none', color:'#475569', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'16px 20px' }}>
          <div style={{ fontSize:12, color:'#64748b', marginBottom:4 }}>{wr.Indirizzo}, {wr.Localita}</div>
          <div style={{ fontSize:11, color:'#475569', marginBottom:16 }}>Squadra: <span style={{ color:'#ec4899', fontFamily:'monospace' }}>{subCode || wr.Sq}</span></div>
          <textarea
            value={messaggio}
            onChange={e => setMessaggio(e.target.value)}
            placeholder="Messaggio per il sub (opzionale)... es. 'Completare entro venerdì'"
            rows={3}
            style={{ width:'100%', background:'#0a0d14', border:'1px solid #1e2330', color:'#e2e8f0', padding:'8px 10px', borderRadius:6, fontSize:12, outline:'none', resize:'vertical', fontFamily:'sans-serif', boxSizing:'border-box' }}
          />
        </div>
        <div style={{ padding:'12px 20px', borderTop:'1px solid #1e2330', display:'flex', gap:10 }}>
          <button onClick={salva} disabled={saving}
            style={{ flex:1, background:'rgba(236,72,153,0.15)', border:'1px solid rgba(236,72,153,0.3)', color:'#ec4899', padding:'10px', borderRadius:8, fontSize:13, fontWeight:600, cursor:'pointer' }}>
            {saving ? '...' : '⚡ Invia sollecito'}
          </button>
          <button onClick={onClose} style={{ background:'transparent', border:'1px solid #1e2330', color:'#475569', padding:'10px 16px', borderRadius:8, fontSize:13, cursor:'pointer' }}>Annulla</button>
        </div>
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ──
function DashboardHome({ onSelectSquadra }) {
  const { API } = useAuth();
  const [wr, setWr] = useState([]);
  const [miniSquadre, setMiniSquadre] = useState([]);
  const [selectedSub, setSelectedSub] = useState(null);
  const [selectedPanel, setSelectedPanel] = useState(null);
  const [openPopup, setOpenPopup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [solleciti, setSolleciti] = useState([]);
  const [sollecitaWR, setSollecitaWR] = useState(null);

  useEffect(() => {
    Promise.all([axios.get(`${API}/wr`), axios.get(`${API}/mini-squadre`), axios.get(`${API}/solleciti`)])
      .then(([w, s, sol]) => { setWr(w.data); setMiniSquadre(s.data); setSolleciti(sol.data); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [API]);

  const oggi = new Date();
  const daysDiff = (d) => {
    if (!d) return null;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return null;
    return (oggi - date) / (1000*60*60*24);
  };

  const filtered = selectedSub ? wr.filter(w => w.Sq === selectedSub) : wr;

  const stats = {
    totale: filtered.length,
    over90: filtered.filter(w => (daysDiff(w.Datadispaccio) || 0) > 90).length,
    avvicin: filtered.filter(w => { const d = daysDiff(w.Datadispaccio); return d !== null && d > 60 && d <= 90; }).length,
    urgenti: filtered.filter(w => (w.Note || '').match(/670050|670100/)).length,
    senzaCoord: filtered.filter(w => !parseFloat(w.Latitudine) && !parseFloat(w.Longitudine)).length,
    assegnate: filtered.filter(w => miniSquadre.some(s => s.wr_list?.includes(String(w.WR)))).length,
  };

  // Per stato
  const statiOrder = ['SOSPESA','IN CARICO','ACQUISITA','ASSEGNATA'];
  const statiColors = { 'SOSPESA':'#f59e0b','IN CARICO':'#3b82f6','ACQUISITA':'#22c55e','ASSEGNATA':'#8b5cf6' };
  const perStato = statiOrder.map(s => ({ label: s.replace(' ','_'), value: filtered.filter(w => w.StatoWR === s).length, color: statiColors[s] }));

  // Per sub
  const subMap = {};
  wr.forEach(w => { if (!subMap[w.Sq]) subMap[w.Sq] = 0; subMap[w.Sq]++; });
  const subList = Object.entries(subMap).sort((a,b) => b[1]-a[1]);

  // Top sub per over90
  const subOver90 = Object.entries(
    wr.filter(w => (daysDiff(w.Datadispaccio) || 0) > 90).reduce((acc, w) => { acc[w.Sq] = (acc[w.Sq]||0)+1; return acc; }, {})
  ).sort((a,b) => b[1]-a[1]).slice(0,5);

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'#475569', flexDirection:'column', gap:12 }}>
      <div style={{ fontFamily:'monospace', fontSize:11, letterSpacing:4, color:'#3b82f6' }}>CARICAMENTO</div>
      <div style={{ display:'flex', gap:4 }}>
        {[0,1,2].map(i => <div key={i} style={{ width:6, height:6, borderRadius:'50%', background:'#3b82f6', animation:`pulse 1.2s ease-in-out ${i*0.2}s infinite`, opacity:0.7 }} />)}
      </div>
    </div>
  );

  const CARDS = [
    { key:'totale', label:'WR TOTALI', icon:'◈', color:'#3b82f6', bg:'rgba(59,130,246,0.08)', border:'rgba(59,130,246,0.2)', filterFn: w => true },
    { key:'over90', label:'OLTRE 90GG', icon:'⚠', color:'#ef4444', bg:'rgba(239,68,68,0.08)', border:'rgba(239,68,68,0.2)', filterFn: w => (daysDiff(w.Datadispaccio)||0) > 90 },
    { key:'avvicin', label:'60-90GG', icon:'◔', color:'#f59e0b', bg:'rgba(245,158,11,0.08)', border:'rgba(245,158,11,0.2)', filterFn: w => { const d = daysDiff(w.Datadispaccio); return d !== null && d > 60 && d <= 90; } },
    { key:'urgenti', label:'URGENTI', icon:'⚡', color:'#ec4899', bg:'rgba(236,72,153,0.08)', border:'rgba(236,72,153,0.2)', filterFn: w => !!(w.Note||'').match(/670050|670100/) },
    { key:'senzaCoord', label:'SENZA COORD', icon:'◎', color:'#64748b', bg:'rgba(100,116,139,0.08)', border:'rgba(100,116,139,0.2)', filterFn: w => !parseFloat(w.Latitudine) && !parseFloat(w.Longitudine) },
    { key:'assegnate', label:'ASSEGNATE', icon:'✓', color:'#22c55e', bg:'rgba(34,197,94,0.08)', border:'rgba(34,197,94,0.2)', filterFn: w => miniSquadre.some(s => s.wr_list?.includes(String(w.WR))) },
  ];

  return (
    <div style={{ padding:'20px 24px', overflow:'auto', height:'calc(100vh - 48px)', background:'#0a0d14' }}>
      <style>{`
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:0.7} 50%{transform:scale(1.3);opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .stat-card { animation: fadeUp 0.4s ease both; }
        .stat-card:hover { transform: translateY(-2px); transition: transform 0.2s; }
        .sub-pill:hover { opacity:1 !important; }
        .wr-row:hover { background: rgba(59,130,246,0.06) !important; }
      `}</style>

      <AlertBanner wr={selectedSub ? filtered : wr} />
      {sollecitaWR && <SollecitaPopup wr={sollecitaWR} subCode={selectedSub} API={API} onClose={() => setSollecitaWR(null)} onSollecitato={wrNum => setSolleciti(prev => [...prev.filter(s => s.wr !== wrNum), { wr: wrNum, sub_code: sollecitaWR.Sq }])} />}
      {openPopup && (
        <StatPopup
          title={openPopup.label}
          color={openPopup.color}
          icon={openPopup.icon}
          wr={selectedSub ? filtered : wr}
          filterFn={openPopup.filterFn}
          onClose={() => setOpenPopup(null)}
        />
      )}
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <div style={{ fontFamily:'monospace', fontSize:10, letterSpacing:4, color:'#475569', marginBottom:6 }}>MDS IMPIANTI / GESTIONALE WR</div>
          <div style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', letterSpacing:-0.5 }}>
            {selectedSub ? `Squadra ${selectedSub}` : 'Panoramica Generale'}
          </div>
          <div style={{ fontSize:12, color:'#475569', marginTop:4 }}>
            {oggi.toLocaleDateString('it-IT', { weekday:'long', year:'numeric', month:'long', day:'numeric' })}
          </div>
        </div>
        {selectedSub && (
          <button onClick={() => setSelectedSub(null)}
            style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#ef4444', padding:'6px 14px', borderRadius:6, fontSize:12, cursor:'pointer', fontFamily:'monospace' }}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Sub selector */}
      <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:24 }}>
        <button onClick={() => setSelectedSub(null)}
          className="sub-pill"
          style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${!selectedSub ? '#3b82f6' : '#252a3a'}`, background: !selectedSub ? 'rgba(59,130,246,0.15)' : 'transparent', color: !selectedSub ? '#3b82f6' : '#475569', fontSize:11, cursor:'pointer', fontFamily:'monospace', opacity: !selectedSub ? 1 : 0.7 }}>
          TUTTI ({wr.length})
        </button>
        {subList.map(([cod, cnt]) => {
          const over = wr.filter(w => w.Sq === cod && (daysDiff(w.Datadispaccio)||0) > 90).length;
          return (
            <React.Fragment key={cod}>
            <button onClick={() => setSelectedSub(selectedSub === cod ? null : cod)}
              className="sub-pill"
              style={{ padding:'5px 12px', borderRadius:20, border:`1px solid ${selectedSub === cod ? '#3b82f6' : '#252a3a'}`, background: selectedSub === cod ? 'rgba(59,130,246,0.15)' : 'transparent', color: selectedSub === cod ? '#3b82f6' : '#94a3b8', fontSize:11, cursor:'pointer', fontFamily:'monospace', opacity: selectedSub === cod ? 1 : 0.7, position:'relative' }}>
              {cod} <span style={{ color:'#475569' }}>({cnt})</span>
              {over > 0 && <span style={{ marginLeft:4, color:'#ef4444', fontSize:9 }}>⚠{over}</span>}
            </button>
            <button onClick={() => onSelectSquadra && onSelectSquadra(cod)}
              title="Apri mappa e pratiche"
              style={{ padding:'4px 7px', borderRadius:20, border:'1px solid #1e2330', background:'transparent', color:'#475569', fontSize:10, cursor:'pointer' }}>
              ◎
            </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:10, marginBottom:24 }}>
        {CARDS.map((c, i) => (
          <div key={c.key} className="stat-card" onClick={() => setOpenPopup(c)} style={{ animationDelay:`${i*0.07}s`, background:c.bg, border:`1px solid ${c.border}`, borderRadius:10, padding:'14px 16px', cursor:'pointer' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ fontSize:9, fontFamily:'monospace', letterSpacing:2, color:c.color, fontWeight:600 }}>{c.label}</div>
              <div style={{ fontSize:16, color:c.color, opacity:0.6 }}>{c.icon}</div>
            </div>
            <div style={{ fontSize:32, fontWeight:700, lineHeight:1 }}>
              <Counter value={stats[c.key]} color={c.color} />
            </div>
            {stats.totale > 0 && (
              <div style={{ marginTop:6, fontSize:10, color:'#475569' }}>
                {((stats[c.key]/stats.totale)*100).toFixed(1)}% del totale
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:24 }}>

        {/* Donut stati */}
        <div style={{ background:'#111827', border:'1px solid #1e2330', borderRadius:10, padding:16 }}>
          <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:3, color:'#475569', marginBottom:12 }}>DISTRIBUZIONE STATI</div>
          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
            <Donut segments={perStato} size={90} />
            <div style={{ flex:1 }}>
              {perStato.map(s => (
                <div key={s.label} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
                  <div style={{ width:8, height:8, borderRadius:2, background:s.color, flexShrink:0 }} />
                  <div style={{ fontSize:10, color:'#64748b', flex:1, fontFamily:'monospace' }}>{s.label}</div>
                  <div style={{ fontSize:11, color:'#e2e8f0', fontWeight:600 }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart sub */}
        <div style={{ background:'#111827', border:'1px solid #1e2330', borderRadius:10, padding:16 }}>
          <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:3, color:'#475569', marginBottom:4 }}>WR PER SQUADRA</div>
          <BarChart
            data={subList.slice(0,10).map(([cod, cnt]) => ({ label: cod, value: cnt, color: '#3b82f6' }))}
            maxVal={Math.max(...subList.map(([,v]) => v), 1)}
          />
        </div>

        {/* Top over90 */}
        <div style={{ background:'#111827', border:'1px solid #1e2330', borderRadius:10, padding:16 }}>
          <div style={{ fontFamily:'monospace', fontSize:9, letterSpacing:3, color:'#475569', marginBottom:12 }}>TOP ARRETRATE +90GG</div>
          {subOver90.length === 0 ? (
            <div style={{ color:'#22c55e', fontSize:12, marginTop:8 }}>✓ Nessuna squadra arretrata</div>
          ) : subOver90.map(([cod, cnt], i) => {
            const tot = subMap[cod] || 1;
            const pct = cnt/tot;
            return (
              <div key={cod} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#94a3b8' }}>{cod}</span>
                  <span style={{ fontSize:11, color:'#ef4444', fontWeight:600 }}>{cnt} <span style={{ color:'#475569', fontWeight:400 }}>/ {tot}</span></span>
                </div>
                <div style={{ height:4, background:'#1e2330', borderRadius:2, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct*100}%`, background: pct > 0.5 ? '#ef4444' : '#f59e0b', borderRadius:2, transition:'width 1s ease' }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* WR list per sub selezionato */}
      {selectedSub && (
        <div style={{ background:'#111827', border:'1px solid #1e2330', borderRadius:10, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e2330', fontFamily:'monospace', fontSize:9, letterSpacing:3, color:'#475569' }}>
            WR — {selectedSub} ({filtered.length})
          </div>
          <div style={{ overflow:'auto', maxHeight:300 }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ background:'#0a0d14' }}>
                  {['WR','Stato','Data','Indirizzo','Pali'].map(h => (
                    <th key={h} style={{ padding:'8px 12px', textAlign:'left', fontSize:10, color:'#475569', fontFamily:'monospace', letterSpacing:1, borderBottom:'1px solid #1e2330' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0,50).map((w, i) => {
                  const days = daysDiff(w.Datadispaccio);
                  const isOld = days > 90;
                  const isWarn = days > 60 && days <= 90;
                  return (
                    <tr key={i} className="wr-row" style={{ borderBottom:'1px solid #0f1420' }}>
                      <td style={{ padding:'7px 12px', fontFamily:'monospace', fontSize:11, color: isOld ? '#ef4444' : isWarn ? '#f59e0b' : '#3b82f6' }}>{w.WR}</td>
                      <td style={{ padding:'7px 12px' }}>
                        <span style={{ fontSize:10, padding:'2px 6px', borderRadius:3, background: isOld ? 'rgba(239,68,68,0.15)' : 'rgba(100,116,139,0.15)', color: isOld ? '#ef4444' : '#64748b' }}>
                          {isOld ? '+90gg' : w.StatoWR}
                        </span>
                      </td>
                      <td style={{ padding:'7px 12px', color:'#475569', fontSize:11 }}>{w.Datadispaccio}</td>
                      <td style={{ padding:'7px 12px', color:'#94a3b8', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.Indirizzo}, {w.Localita}</td>
                      <td style={{ padding:'7px 12px', color:'#475569' }}>{w.Pali || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PANNELLO + MAPPA ──
function PannelloWR({ squadra, wr, onClose }) {
  const [showMappa, setShowMappa] = useState(false);
  const [search, setSearch] = useState('');
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const oggi = new Date();
  const isOld = (d) => {
    if (!d) return false;
    let date;
    if (d.includes('-') && d.indexOf('-') === 4) date = new Date(d);
    else if (d.includes('/')) { const p = d.split('/'); date = new Date(p[2], p[1]-1, p[0]); }
    else return false;
    return (oggi - date) / (1000*60*60*24) > 90;
  };

  const filtered = wr.filter(w =>
    !search || w.WR?.toString().includes(search) ||
    w.Indirizzo?.toLowerCase().includes(search.toLowerCase()) ||
    w.Localita?.toLowerCase().includes(search.toLowerCase())
  );

  const conCoord = wr.filter(w => parseFloat(w.Latitudine) && parseFloat(w.Longitudine)).length;
  const oltre90 = wr.filter(w => isOld(w.Datadispaccio)).length;

  useEffect(() => {
    if (!showMappa || !mapRef.current || mapInstanceRef.current) return;
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
        if (!lat || !lon) return;
        L.circleMarker([lat, lon], { radius: 8, fillColor: isOld(w.Datadispaccio) ? '#ef4444' : '#3b82f6', color: 'white', weight: 2, fillOpacity: 0.9 })
          .addTo(map)
          .bindPopup(`<b>WR ${w.WR}</b><br/>${w.Indirizzo}, ${w.Localita}<br/>${w.StatoWR}`);
        bounds.push([lat, lon]);
      });
      if (bounds.length > 0) map.fitBounds(bounds, { padding: [20, 20] });
      mapInstanceRef.current = map;
    };
    document.head.appendChild(script);
    return () => { if (mapInstanceRef.current) { mapInstanceRef.current.remove(); mapInstanceRef.current = null; } };
  }, [showMappa, wr]);

  return (
    <>
      {showMappa && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ width:'90vw', height:'85vh', background:'#111827', borderRadius:12, overflow:'hidden', display:'flex', flexDirection:'column' }}>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'monospace', fontSize:12, color:'#3b82f6' }}>{squadra} — {conCoord} punti su {wr.length} WR</span>
              <button onClick={() => setShowMappa(false)} style={{ background:'transparent', border:'none', color:'#64748b', fontSize:20, cursor:'pointer' }}>×</button>
            </div>
            <div ref={mapRef} style={{ flex:1 }} />
          </div>
        </div>
      )}
      <div style={{ position:'fixed', right:0, top:0, bottom:0, width:380, background:'#111827', borderLeft:'1px solid #1e2330', zIndex:500, display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #1e2330', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ flex:1 }}>
            <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:600, color:'#3b82f6' }}>{squadra}</div>
            <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>{wr.length} WR {oltre90 > 0 && <span style={{ color:'#ef4444', marginLeft:6 }}>⚠ {oltre90} oltre 90gg</span>}</div>
          </div>
          <button onClick={() => setShowMappa(true)} style={{ background:'rgba(34,197,94,0.1)', border:'1px solid rgba(34,197,94,0.3)', color:'#22c55e', padding:'5px 10px', borderRadius:6, fontSize:11, cursor:'pointer' }}>◎ Mappa ({conCoord})</button>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'#475569', fontSize:20, cursor:'pointer' }}>×</button>
        </div>
        <div style={{ padding:'8px 12px', borderBottom:'1px solid #1e2330' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cerca WR, indirizzo..." style={{ width:'100%', background:'#0a0d14', border:'1px solid #1e2330', color:'#e2e8f0', padding:'5px 8px', borderRadius:5, fontSize:11, outline:'none' }} />
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          {filtered.map((w, i) => {
            const old = isOld(w.Datadispaccio);
            return (
              <div key={i} style={{ padding:'9px 14px', borderBottom:'1px solid #0f1420', borderLeft:`3px solid ${old ? '#ef4444' : 'transparent'}` }}>
                <div style={{ display:'flex', gap:8, marginBottom:2 }}>
                  <span style={{ fontFamily:'monospace', fontSize:11, color:'#3b82f6', fontWeight:600 }}>{w.WR}</span>
                  <span style={{ fontSize:9, padding:'2px 5px', borderRadius:3, background: old ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.1)', color: old ? '#ef4444' : '#22c55e' }}>{old ? '+90gg' : w.StatoWR}</span>
                </div>
                <div style={{ fontSize:11, color:'#64748b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{w.Indirizzo}, {w.Localita}</div>
                <div style={{ display:'flex', gap:10, marginTop:3, fontSize:10, color:'#475569', alignItems:'center' }}>
                  <span>{w.Datadispaccio}</span>
                  {w.Pali && <span>Pali: {w.Pali}</span>}
                  {(parseFloat(w.Latitudine) || parseFloat(w.LatInferita)) && (
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${w.Latitudine||w.LatInferita},${w.Longitudine||w.LonInferita}`} target="_blank" rel="noreferrer" style={{ color:'#22c55e' }}>📍</a>
                  )}
                  <button onClick={() => setSollecitaWR(w)} style={{ marginLeft:'auto', background:'rgba(236,72,153,0.1)', border:'1px solid rgba(236,72,153,0.2)', color:'#ec4899', padding:'2px 8px', borderRadius:4, fontSize:10, cursor:'pointer' }}>⚡ Sollecita</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

function VistaSub() {
  const { API, user } = useAuth();
  const [wr, setWr] = useState([]);
  const [selectedSq, setSelectedSq] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { axios.get(`${API}/wr`).then(r => setWr(r.data)).catch(() => {}); }, [API]);

  const squadre = [...new Set(wr.map(w => w.Sq).filter(Boolean))].sort();
  const wrFiltrati = wr.filter(w => w.Sq === selectedSq && w.StatoWR?.toUpperCase() !== 'NUOVA');
  const fakeUser = { ...user, role: 'sub', sub_code: selectedSq };

  if (loaded && selectedSq) {
    return (
      <div style={{ height:'calc(100vh - 48px)', overflow:'hidden', position:'relative' }}>
        <div style={{ position:'absolute', top:10, left:10, zIndex:100, display:'flex', gap:8 }}>
          <button onClick={() => setLoaded(false)} style={{ background:'rgba(0,0,0,0.8)', border:'1px solid #1e2330', color:'#e2e8f0', padding:'6px 12px', borderRadius:6, fontSize:12, cursor:'pointer' }}>← Torna</button>
          <span style={{ background:'rgba(0,0,0,0.8)', border:'1px solid #1e2330', color:'#3b82f6', padding:'6px 12px', borderRadius:6, fontSize:12, fontFamily:'monospace' }}>Anteprima: {selectedSq}</span>
        </div>
        <SubDashboard previewMode={{ subCode: selectedSq, wrData: wrFiltrati }} />
      </div>
    );
  }

  return (
    <div style={{ padding:24 }}>
      <div style={{ fontSize:18, fontWeight:500, marginBottom:4 }}>Vista Sub</div>
      <div style={{ fontSize:13, color:'var(--muted)', marginBottom:24 }}>Scegli un sub per vedere la sua vista</div>
      <div style={{ display:'flex', gap:12, alignItems:'center', marginBottom:20 }}>
        <select value={selectedSq} onChange={e => setSelectedSq(e.target.value)}
          style={{ background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)', padding:'8px 12px', borderRadius:8, fontSize:14, outline:'none', minWidth:200 }}>
          <option value="">Seleziona squadra/sub...</option>
          {squadre.map(s => { const nome = wr.find(w => w.Sq === s)?.Descrizione_Sq || ''; return <option key={s} value={s}>{s}{nome ? ` — ${nome}` : ''}</option>; })}
        </select>
        <button onClick={() => selectedSq && setLoaded(true)} disabled={!selectedSq}
          style={{ background: selectedSq ? 'rgba(59,130,246,0.2)' : 'var(--bg)', border:`1px solid ${selectedSq ? 'var(--accent)' : 'var(--border)'}`, color: selectedSq ? 'var(--accent)' : 'var(--muted)', padding:'8px 16px', borderRadius:8, fontSize:14, cursor: selectedSq ? 'pointer' : 'not-allowed' }}>
          Visualizza →
        </button>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [wr, setWr] = useState([]);
  const [squadre, setSquadre] = useState([]);
  const [selectedSquadra, setSelectedSquadra] = useState(null);
  const { API } = useAuth();

  useEffect(() => {
    axios.get(`${API}/wr`).then(r => setWr(r.data)).catch(() => {});
    axios.get(`${API}/mini-squadre`).then(r => setSquadre(r.data)).catch(() => {});
  }, [API]);

  const subMap = {};
  wr.forEach(w => { if (!subMap[w.Sq]) subMap[w.Sq] = []; subMap[w.Sq].push(w); });

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      {/* Topbar */}
      <div style={{ background:'#0d1117', borderBottom:'1px solid #1e2330', padding:'0 20px', height:48, display:'flex', alignItems:'center', gap:16, flexShrink:0 }}>
        <div style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, color:'#3b82f6', letterSpacing:3 }}>MDS<span style={{ color:'#1e2330' }}>/</span>WR</div>
        <span style={{ fontSize:9, padding:'2px 8px', borderRadius:3, background:'rgba(59,130,246,0.1)', color:'#3b82f6', border:'1px solid rgba(59,130,246,0.2)', fontFamily:'monospace', letterSpacing:2 }}>ADMIN</span>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:12 }}>
          {user?.picture && <img src={user.picture} alt="" style={{ width:26, height:26, borderRadius:'50%', opacity:0.8 }} />}
          <span style={{ fontSize:12, color:'#475569' }}>{user?.name}</span>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ background:'transparent', border:'1px solid #1e2330', color:'#475569', padding:'4px 10px', borderRadius:5, fontSize:11, cursor:'pointer', fontFamily:'monospace' }}>EXIT</button>
        </div>
      </div>

      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        {/* Sidebar */}
        <div style={{ width:190, background:'#0d1117', borderRight:'1px solid #1e2330', padding:'16px 0', flexShrink:0, overflowY:'auto' }}>
          {NAV.map((section, i) => (
            <div key={i}>
              <div style={{ fontSize:8, color:'#2d3748', padding:'10px 16px 4px', letterSpacing:3, fontFamily:'monospace' }}>{section.title}</div>
              {section.items.map((item, j) => (
                <NavLink key={j} to={item.to} style={({ isActive }) => ({
                  display:'flex', alignItems:'center', gap:10, padding:'8px 16px', fontSize:12,
                  color: isActive ? '#3b82f6' : '#475569',
                  background: isActive ? 'rgba(59,130,246,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #3b82f6' : '2px solid transparent',
                  textDecoration:'none', fontFamily:'monospace', transition:'all 0.15s'
                })}>
                  <span style={{ fontSize:14, opacity:0.7 }}>{item.icon}</span>{item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex:1, overflow:'auto', background:'#0a0d14', position:'relative' }}>
          {selectedSquadra && (
            <PannelloWR squadra={selectedSquadra} wr={subMap[selectedSquadra] || []} onClose={() => setSelectedSquadra(null)} />
          )}
          <Routes>
            <Route path="/" element={<DashboardHome onSelectSquadra={setSelectedSquadra} />} />
            <Route path="/pratiche" element={<Pratiche />} />
            <Route path="/vista-sub" element={<VistaSub />} />
            <Route path="/sub" element={<SubSquadre />} />
            <Route path="/utenti" element={<Utenti />} />
            <Route path="/link" element={<div style={{ padding:24, color:'var(--muted)' }}>Link attivi — in sviluppo</div>} />
          </Routes>
        </div>
      </div>
    </div>
  );
}
