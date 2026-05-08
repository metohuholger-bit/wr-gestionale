import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children, navItems }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* TOPBAR */}
      <div style={{
        background: 'var(--panel)',
        borderBottom: '1px solid var(--border)',
        padding: '0 16px',
        height: '48px',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0,
        zIndex: 100
      }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '2px'
        }}>
          MDS<span style={{ color: 'var(--muted)' }}>/</span>WR
        </div>

        <span style={{
          fontSize: '11px',
          padding: '2px 8px',
          borderRadius: '4px',
          background: user?.role === 'admin' ? 'rgba(59,130,246,0.15)' : 'rgba(34,197,94,0.15)',
          color: user?.role === 'admin' ? 'var(--accent)' : 'var(--green)',
          border: `1px solid ${user?.role === 'admin' ? 'rgba(59,130,246,0.3)' : 'rgba(34,197,94,0.3)'}`,
          fontFamily: 'var(--mono)'
        }}>
          {user?.role === 'admin' ? 'ADMIN' : user?.sub_code || 'SUB'}
        </span>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user?.picture && (
            <img src={user.picture} alt="" style={{ width: 28, height: 28, borderRadius: '50%' }} />
          )}
          <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{user?.name}</span>
          <button onClick={handleLogout} style={{
            background: 'transparent',
            border: '1px solid var(--border)',
            color: 'var(--muted)',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            Esci
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* SIDEBAR */}
        <div style={{
          width: '200px',
          background: 'var(--panel)',
          borderRight: '1px solid var(--border)',
          padding: '12px 0',
          flexShrink: 0,
          overflowY: 'auto'
        }}>
          {navItems.map((section, i) => (
            <div key={i}>
              <div style={{
                fontSize: '10px',
                color: 'var(--muted)',
                padding: '10px 16px 4px',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                {section.title}
              </div>
              {section.items.map((item, j) => (
                <NavLink
                  key={j}
                  to={item.to}
                  style={({ isActive }) => ({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    fontSize: '13px',
                    color: isActive ? 'var(--accent)' : 'var(--muted)',
                    background: isActive ? 'rgba(59,130,246,0.1)' : 'transparent',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    textDecoration: 'none',
                    transition: 'all 0.15s'
                  })}
                >
                  <span style={{ fontSize: '16px' }}>{item.icon}</span>
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </div>

        {/* MAIN CONTENT */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
          {children}
        </div>
      </div>
    </div>
  );
}
