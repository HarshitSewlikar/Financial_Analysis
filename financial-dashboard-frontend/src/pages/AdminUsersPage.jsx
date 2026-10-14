// src/pages/AdminUsersPage.jsx
import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getUsers, createUser, deleteUser } from '../services/api';
import '../styles/Auth.css';

const formatDate = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const AdminUsersPage = () => {
    const { user } = useAuth();
    const [users, setUsers] = useState([]);
    const [form, setForm] = useState({ username: '', password: '' });
    const [error, setError] = useState(null);
    const [message, setMessage] = useState(null);
    const [busy, setBusy] = useState(false);

    const loadUsers = useCallback(() => {
        getUsers()
            .then((data) => setUsers(data.users || []))
            .catch((err) => setError(err.response?.data?.error || err.message));
    }, []);

    useEffect(() => {
        loadUsers();
    }, [loadUsers]);

    const updateField = (field) => (event) => {
        setForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleAdd = async (event) => {
        event.preventDefault();
        setError(null);
        setMessage(null);
        setBusy(true);
        try {
            const data = await createUser(form);
            setMessage(`User '${data.user.username}' created.`);
            setForm({ username: '', password: '' });
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        } finally {
            setBusy(false);
        }
    };

    const handleDelete = async (username) => {
        if (!window.confirm(`Delete user '${username}'?`)) return;
        setError(null);
        setMessage(null);
        try {
            await deleteUser(username);
            setMessage(`User '${username}' deleted.`);
            loadUsers();
        } catch (err) {
            setError(err.response?.data?.error || err.message);
        }
    };

    return (
        <div className="admin-container">
            <h2 className="text-center">Manage Users</h2>
            <p className="text-center text-muted">
                Create logins for other people and share the credentials with them.
            </p>

            {error && <p className="auth-error text-center">{error}</p>}
            {message && <p className="auth-success text-center">{message}</p>}

            <div className="admin-layout">
                <div className="card">
                    <h4 className="card-title">Add New User</h4>
                    <form className="auth-form" onSubmit={handleAdd}>
                        <label htmlFor="new-username">Username</label>
                        <input
                            id="new-username"
                            type="text"
                            value={form.username}
                            onChange={updateField('username')}
                            autoComplete="off"
                            required
                        />

                        <label htmlFor="new-password">Password</label>
                        <input
                            id="new-password"
                            type="password"
                            value={form.password}
                            onChange={updateField('password')}
                            autoComplete="new-password"
                            required
                        />

                        <button type="submit" className="btn-primary" disabled={busy}>
                            {busy ? 'Creating…' : 'Create User'}
                        </button>
                    </form>
                </div>

                <div className="table-container">
                    <h4 className="card-title">Existing Users</h4>
                    {users.length === 0 ? (
                        <p className="text-center text-muted">No users yet.</p>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Role</th>
                                    <th>Created</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((entry) => {
                                    const isSelf = entry.username === user?.username;
                                    const isAdmin = entry.role === 'admin';
                                    return (
                                        <tr key={entry.username}>
                                            <td>{entry.username}</td>
                                            <td>{entry.role}</td>
                                            <td>{formatDate(entry.createdAt)}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn-danger"
                                                    disabled={isSelf || isAdmin}
                                                    onClick={() => handleDelete(entry.username)}
                                                >
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    <p className="text-center admin-back">
                        <Link to="/dashboard" className="nav-link">← Back to Dashboard</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminUsersPage;
