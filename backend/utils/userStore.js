// utils/userStore.js
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const ensureDataFile = () => {
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(USERS_FILE)) {
        fs.writeFileSync(USERS_FILE, '[]', 'utf8');
    }
};

const readUsers = () => {
    try {
        ensureDataFile();
        const raw = fs.readFileSync(USERS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error reading users file:', error.message);
        return [];
    }
};

const writeUsers = (users) => {
    ensureDataFile();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
};

const normalize = (username) => String(username || '').trim().toLowerCase();

const sanitizeUser = (user) => ({
    username: user.username,
    role: user.role,
    createdAt: user.createdAt
});

const findUser = (username) => {
    const name = normalize(username);
    if (!name) return null;
    return readUsers().find((user) => user.username === name) || null;
};

const adminExists = () => readUsers().some((user) => user.role === 'admin');

const createUser = ({ username, passwordHash, role = 'user' }) => {
    const name = normalize(username);
    if (!name) {
        throw new Error('Username is required.');
    }

    const users = readUsers();
    if (users.some((user) => user.username === name)) {
        const error = new Error('Username already exists.');
        error.statusCode = 409;
        throw error;
    }

    const user = {
        username: name,
        passwordHash,
        role,
        createdAt: new Date().toISOString()
    };

    users.push(user);
    writeUsers(users);
    return sanitizeUser(user);
};

const listUsers = () => readUsers().map(sanitizeUser);

const deleteUser = (username) => {
    const name = normalize(username);
    const users = readUsers();
    const index = users.findIndex((user) => user.username === name);
    if (index === -1) return null;

    const [removed] = users.splice(index, 1);
    writeUsers(users);
    return sanitizeUser(removed);
};

module.exports = {
    findUser,
    adminExists,
    createUser,
    listUsers,
    deleteUser
};
