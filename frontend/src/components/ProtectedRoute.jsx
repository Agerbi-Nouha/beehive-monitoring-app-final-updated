import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
}

export function AdminRoute({ children }) {
  const { token, loading, isAdmin } = useAuth();
  if (loading) return <div className="p-6 text-sm text-muted">Loading...</div>;
  if (!token) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/" replace />;
  return children;
}
