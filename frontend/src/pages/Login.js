import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
const API = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export default function Login() {
  const { } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    setError('');

    // Carica Google Identity Services
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (response) => {
          if (response.error) {
            setError('Errore Google OAuth');
            setLoading(false);
            return;
          }
          try {
            const r = await axios.post(`${API}/auth/google`, { token: response.access_token });
            const { token, user } = r.data;
            localStorage.setItem('token', token);
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            if (user.role === 'admin') navigate('/admin');
            else if (user.role === 'sub') navigate('/sub');
            else setError(user.role === 'pending' ? 'Accesso in attesa di approvazione' : 'Accesso negato');
          } catch (e) {
            setError(e.response?.data?.detail || 'Accesso negato');
          } finally {
            setLoading(false);
          }
        },
      }).requestAccessToken();
    };
    document.head.appendChild(script);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '32px'
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontFamily: 'var(--mono)',
          fontSize: '28px',
          fontWeight: 600,
          color: 'var(--accent)',
          letterSpacing: '4px',
          marginBottom: '8px'
        }}>
          MDS<span style={{ color: 'var(--muted)' }}>/</span>WR
        </div>
        <div style={{ fontSize: '14px', color: 'var(--muted)' }}>
          Gestionale interventi TIM
        </div>
      </div>

      <div style={{
        background: 'var(--panel)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '32px 40px',
        width: '320px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '16px', fontWeight: 500, marginBottom: '8px' }}>Accedi</div>
        <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '24px' }}>
          Usa il tuo account Google aziendale
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%',
            padding: '12px',
            background: loading ? '#f5f5f5' : 'white',
            border: '1px solid #ddd',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            fontSize: '14px',
            color: '#1f2937',
            fontWeight: 500,
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Accesso in corso...' : 'Accedi con Google'}
        </button>

        {error && (
          <div style={{
            marginTop: '16px',
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: '6px',
            fontSize: '12px',
            color: 'var(--red)'
          }}>
            {error}
          </div>
        )}
      </div>

      <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
        Accesso riservato al personale autorizzato
      </div>
    </div>
  );
}


