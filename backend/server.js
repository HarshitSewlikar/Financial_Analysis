// server.js
require('dotenv').config(); // Load environment variables first!

const express = require('express');
const cors = require('cors');
const financeRoutes = require('./routes/financeRoutes'); // Import the finance routes
const authRoutes = require('./routes/authRoutes'); // Authentication routes
const userRoutes = require('./routes/userRoutes'); // User management routes
const { authenticate, requireAdmin } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// app.use(cors()); // Enable CORS for all routes
app.use(cors({
    origin: 'http://localhost:5173', // Allow requests from the frontend
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['X-Data-Source'] // Let the browser read the data-source header
}));
app.use(express.json()); // Enable parsing of JSON request bodies

// Basic route
app.get('/', (req, res) => {
    res.send('Financial Analytics Dashboard Backend is running!');
});

// Public authentication routes
app.use('/api/auth', authRoutes);

// Admin-only user management
app.use('/api/users', authenticate, requireAdmin, userRoutes);

// Finance data requires a valid login
app.use('/api', authenticate, financeRoutes); // All finance routes will be prefixed with /api

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});