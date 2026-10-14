// middleware/auth.js
const jwt = require('jsonwebtoken');

const getSecret = () => process.env.JWT_SECRET || 'insecure-dev-secret-change-me';

const authenticate = (req, res, next) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;

    if (!token) {
        return res.status(401).json({ error: 'Authentication required.' });
    }

    try {
        const payload = jwt.verify(token, getSecret());
        req.user = { username: payload.username, role: payload.role };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token.' });
    }
};

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin privileges required.' });
    }
    next();
};

module.exports = {
    authenticate,
    requireAdmin
};
