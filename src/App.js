import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './components/Notification';
import Navbar from './components/Navbar';

import Home from './pages/Home';
import Login from './pages/auth/Login';
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import RescueDashboard from './pages/rescue/RescueDashboard';
import AuthorityDashboard from './pages/authority/AuthorityDashboard';

function ProtectedRoute({ children, requiredRole }) {

  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          fontWeight: "bold"
        }}
      >
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && user.role !== requiredRole) {

    const dest =
      user.role === "rescue_team"
        ? "/rescue"
        : `/${user.role}`;

    return <Navigate to={dest} replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div
        style={{
          height: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          fontSize: "22px",
          fontWeight: "bold"
        }}
      >
        Loading...
      </div>
    );
  }
  return (
    <>
      <Navbar />
      {/* Pass user context to notification provider for realtime subscriptions */}
      <NotificationProvider userId={user?.id} userRole={user?.role} />
      <Routes>
        <Route path="/" element={user ? <Navigate to={user.role === 'rescue_team' ? '/rescue' : `/${user.role}`} /> : <Home />} />
        <Route path="/login" element={user ? <Navigate to={user.role === 'rescue_team' ? '/rescue' : `/${user.role}`} /> : <Login />} />
        <Route path="/citizen" element={<ProtectedRoute requiredRole="citizen"><CitizenDashboard /></ProtectedRoute>} />
        <Route path="/rescue" element={<ProtectedRoute requiredRole="rescue_team"><RescueDashboard /></ProtectedRoute>} />
        <Route path="/authority" element={<ProtectedRoute requiredRole="authority"><AuthorityDashboard /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
