// controllers/authController.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { findUser, adminExists, createUser } = require('../utils/userStore');

const TOKEN_EXPIRY = '7d';
const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

const getSecret = () => process.env.JWT_SECRET || 'insecure-dev-secret-change-me';

const signToken = (user) =>
    jwt.sign({ username: user.username, role: user.role }, getSecret(), { expiresIn: TOKEN_EXPIRY });

const publicUser = (user) => ({ username: user.username, role: user.role });

// GET /api/auth/status - tells the frontend whether the admin account exists yet
const getAuthStatus = (req, res) => {
    res.json({ adminCreated: adminExists() });
};

// POST /api/auth/signup - only allowed while no admin exists, and only with the signup code
const signupAdmin = async (req, res) => {
    try {
        if (adminExists()) {
            return res.status(409).json({ error: 'An admin account already exists.' });
        }

        const { username, password, signupCode } = req.body || {};
        const configuredCode = process.env.ADMIN_SIGNUP_CODE;

        if (!configuredCode) {
            return res.status(500).json({ error: 'Admin signup is not configured on the server.' });
        }
        if (!signupCode || signupCode !== configuredCode) {
            return res.status(403).json({ error: 'Invalid admin signup code.' });
        }

        const name = String(username || '').trim();
        if (name.length < MIN_USERNAME_LENGTH) {
            return res.status(400).json({ error: `Username must be at least ${MIN_USERNAME_LENGTH} characters.` });
        }
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
        }

        const passwordHash = bcrypt.hashSync(String(password), 10);
        const user = createUser({ username: name, passwordHash, role: 'admin' });

        const token = signToken(user);
        res.status(201).json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// POST /api/auth/login
const login = async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const user = findUser(username);

        if (!user || !bcrypt.compareSync(String(password || ''), user.passwordHash)) {
            return res.status(401).json({ error: 'Invalid username or password.' });
        }

        const token = signToken(user);
        res.json({ token, user: publicUser(user) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// GET /api/auth/me - returns the current user from the token
const getMe = (req, res) => {
    res.json({ user: req.user });
};

module.exports = {
    getAuthStatus,
    signupAdmin,
    login,
    getMe
};
