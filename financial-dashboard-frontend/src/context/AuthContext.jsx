// src/context/AuthContext.jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
    getMe,
    login as apiLogin,
    signupAdmin as apiSignupAdmin,
    setAuthToken,
    getStoredToken,
    setUnauthorizedHandler
} from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // When the server rejects a token (expired/invalid), drop the session
    useEffect(() => {
        setUnauthorizedHandler(() => setUser(null));
    }, []);

    // Restore the session on first load
    useEffect(() => {
        const token = getStoredToken();
        if (!token) {
            setLoading(false);
            return;
        }

        setAuthToken(token);
        getMe()
            .then((data) => setUser(data.user))
            .catch(() => setAuthToken(null))
            .finally(() => setLoading(false));
    }, []);

    const login = useCallback(async (username, password) => {
        const data = await apiLogin({ username, password });
        setAuthToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const signupAdmin = useCallback(async ({ username, password, signupCode }) => {
        const data = await apiSignupAdmin({ username, password, signupCode });
        setAuthToken(data.token);
        setUser(data.user);
        return data.user;
    }, []);

    const logout = useCallback(() => {
        setAuthToken(null);
        setUser(null);
    }, []);

    const value = {
        user,
        loading,
        isAdmin: user?.role === 'admin',
        login,
        signupAdmin,
        logout
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
