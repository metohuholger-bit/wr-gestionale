import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SubDashboard from './pages/SubDashboard';
import MappaView from './pages/MappaView';
import PublicView from './pages/PublicView';

function PrivateRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div style={{color:'#64748b',padding:'40px',textAlign:'center'}}>Caricamento...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (user.role === 'admin') return <Navigate to="/admin" />;
  if (user.role === 'sub') return <Navigate to="/sub" />;
  return <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/view/:token" element={<PublicView />} />
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/admin/*" element={
            <PrivateRoute roles={['admin']}>
              <AdminDashboard />
            </PrivateRoute>
          } />
          <Route path="/sub/*" element={
            <PrivateRoute roles={['sub']}>
              <SubDashboard />
            </PrivateRoute>
          } />
          <Route path="/mappa" element={
            <PrivateRoute roles={['admin', 'sub']}>
              <MappaView />
            </PrivateRoute>
          } />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
