// routes/userRoutes.js
const express = require('express');
const { getUsers, addUser, removeUser } = require('../controllers/userController');

const router = express.Router();

router.get('/', getUsers);
router.post('/', addUser);
router.delete('/:username', removeUser);

module.exports = router;
