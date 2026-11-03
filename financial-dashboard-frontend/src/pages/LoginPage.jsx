// src/pages/LoginPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getAuthStatus } from '../services/api';
import '../styles/Auth.css';

const LoginPage = () => {
    const { user, loading, login, signupAdmin } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const from = location.state?.from || '/dashboard';

    const [adminCreated, setAdminCreated] = useState(null);
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ username: '', password: '', signupCode: '' });
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        getAuthStatus()
            .then((data) => {
                setAdminCreated(data.adminCreated);
                setMode(data.adminCreated ? 'login' : 'signup');
            })
            .catch(() => setAdminCreated(true));
    }, []);

    // Already signed in - go straight to the dashboard
    if (!loading && user) {
        return <Navigate to="/dashboard" replace />;
    }

    const updateField = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError(null);
        setBusy(true);
        try {
            if (mode === 'signup') {
                await signupAdmin(form);
            } else {
                await login(form.username, form.password);
            }
            navigate(from, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || err.message || 'Request failed.');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="card auth-card">
                <h2 className="card-title">Financial Analytics Dashboard</h2>
                <p className="text-center text-muted auth-subtitle">
                    {adminCreated === false
                        ? 'Create the first admin account to get started.'
                        : 'Sign in to access your dashboard.'}
                </p>

                {adminCreated === false && (
                    <div className="auth-tabs">
                        <button
                            type="button"
                            className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
                            onClick={() => { setMode('login'); setError(null); }}
                        >
                            Log In
                        </button>
                        <button
                            type="button"
                            className={`auth-tab ${mode === 'signup' ? 'active' : ''}`}
                            onClick={() => { setMode('signup'); setError(null); }}
                        >
                            Register Admin
                        </button>
                    </div>
                )}

                <form className="auth-form" onSubmit={handleSubmit}>
                    <label htmlFor="auth-username">Username</label>
                    <input
                        id="auth-username"
                        type="text"
                        value={form.username}
                        onChange={updateField('username')}
                        autoComplete="username"
                        required
                    />

                    <label htmlFor="auth-password">Password</label>
                    <input
                        id="auth-password"
                        type="password"
                        value={form.password}
                        onChange={updateField('password')}
                        autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                        required
                    />

                    {mode === 'signup' && (
                        <>
                            <label htmlFor="auth-signup-code">Admin Signup Code</label>
                            <input
                                id="auth-signup-code"
                                type="password"
                                value={form.signupCode}
                                onChange={updateField('signupCode')}
                                placeholder="Provided in the server .env file"
                                required
                            />
                            <p className="field-hint">
                                Only the first account (admin) can register. You can then create
                                logins for other users from the admin panel.
                            </p>
                        </>
                    )}

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" className="btn-primary" disabled={busy}>
                        {busy ? 'Please wait…' : mode === 'signup' ? 'Register & Sign In' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default LoginPage;
