// src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Loading = () => <p className="text-center text-muted">Loading...</p>;

export const RequireAuth = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) return <Loading />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    return children;
};

export const RequireAdmin = ({ children }) => {
    const { user, loading, isAdmin } = useAuth();
    const location = useLocation();

    if (loading) return <Loading />;
    if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    if (!isAdmin) return <Navigate to="/dashboard" replace />;
    return children;
};
