// controllers/userController.js
const bcrypt = require('bcryptjs');
const { findUser, createUser, listUsers, deleteUser } = require('../utils/userStore');

const MIN_USERNAME_LENGTH = 3;
const MIN_PASSWORD_LENGTH = 6;

// GET /api/users - list all users (admin only)
const getUsers = (req, res) => {
    res.json({ users: listUsers() });
};

// POST /api/users - create a new user (admin only)
const addUser = async (req, res) => {
    try {
        const { username, password } = req.body || {};
        const name = String(username || '').trim();

        if (name.length < MIN_USERNAME_LENGTH) {
            return res.status(400).json({ error: `Username must be at least ${MIN_USERNAME_LENGTH} characters.` });
        }
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
            return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` });
        }

        const passwordHash = bcrypt.hashSync(String(password), 10);
        const user = createUser({ username: name, passwordHash, role: 'user' });

        res.status(201).json({ user });
    } catch (error) {
        res.status(error.statusCode || 500).json({ error: error.message });
    }
};

// DELETE /api/users/:username - remove a user (admin only)
const removeUser = async (req, res) => {
    try {
        const username = req.params.username;

        if (username === req.user.username) {
            return res.status(400).json({ error: 'You cannot delete your own account.' });
        }

        const target = findUser(username);
        if (!target) {
            return res.status(404).json({ error: 'User not found.' });
        }
        if (target.role === 'admin') {
            return res.status(400).json({ error: 'The admin account cannot be deleted.' });
        }

        deleteUser(username);
        res.json({ message: `User '${username}' deleted.` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getUsers,
    addUser,
    removeUser
};
