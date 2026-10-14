// src/services/api.js
import axios from 'axios';

// Get the base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// Create Axios instance with fallback
const apiClient = axios.create({
    baseURL: API_BASE_URL || 'http://localhost:5000/api', // Fallback URL
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add optional environment check (only in development)
if (import.meta.env.DEV && !API_BASE_URL) {
    console.warn('VITE_API_BASE_URL is not defined - using fallback URL');
}

// --- Authentication token handling ---
const TOKEN_KEY = 'fd_auth_token';

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);

export const setAuthToken = (token) => {
    if (token) {
        localStorage.setItem(TOKEN_KEY, token);
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
        localStorage.removeItem(TOKEN_KEY);
        delete apiClient.defaults.headers.common['Authorization'];
    }
};

// Restore any token from a previous session on load
const existingToken = getStoredToken();
if (existingToken) {
    apiClient.defaults.headers.common['Authorization'] = `Bearer ${existingToken}`;
}

// Lets AuthContext react when the server rejects a token (e.g. expired)
let unauthorizedHandler = null;
export const setUnauthorizedHandler = (handler) => {
    unauthorizedHandler = handler;
};

// Add request interceptor for debugging
apiClient.interceptors.request.use(config => {
    console.log('Requesting:', config.url);
    return config;
});

// Add response interceptor
apiClient.interceptors.response.use(
    response => response,
    error => {
        if (error.response && error.response.status === 401) {
            setAuthToken(null);
            if (unauthorizedHandler) {
                unauthorizedHandler();
            }
        }
        console.error('API Error:', error.message);
        return Promise.reject(error);
    }
);

// API functions
export const getDailyStockData = async (symbol) => {
    try {
        const response = await apiClient.get(`/stock/daily/${symbol}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching daily stock data for ${symbol}:`, error);
        throw error;
    }
};

export const getSectorPerformance = async () => {
    try {
        const response = await apiClient.get('/sector-performance');
        return response.data;
    } catch (error) {
        console.error('Error fetching sector performance data:', error);
        throw error;
    }
};

export const getMarketMovers = async () => {
    try {
        const response = await apiClient.get('/market-movers');
        return response.data;
    } catch (error) {
        console.error('Error fetching market movers data:', error);
        throw error;
    }
};

export const getStockScore = async (symbol) => {
    try {
        const response = await apiClient.get(`/stock/score/${symbol}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching stock score for ${symbol}:`, error);
        throw error;
    }
};

// --- Authentication API ---
export const getAuthStatus = async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
};

export const signupAdmin = async ({ username, password, signupCode }) => {
    const response = await apiClient.post('/auth/signup', { username, password, signupCode });
    return response.data;
};

export const login = async ({ username, password }) => {
    const response = await apiClient.post('/auth/login', { username, password });
    return response.data;
};

export const getMe = async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
};

// --- User management API (admin only) ---
export const getUsers = async () => {
    const response = await apiClient.get('/users');
    return response.data;
};

export const createUser = async ({ username, password }) => {
    const response = await apiClient.post('/users', { username, password });
    return response.data;
};

export const deleteUser = async (username) => {
    const response = await apiClient.delete(`/users/${encodeURIComponent(username)}`);
    return response.data;
};