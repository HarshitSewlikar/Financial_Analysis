// routes/authRoutes.js
const express = require('express');
const {
    getAuthStatus,
    signupAdmin,
    login,
    getMe
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.get('/status', getAuthStatus);
router.post('/signup', signupAdmin);
router.post('/login', login);
router.get('/me', authenticate, getMe);

module.exports = router;
