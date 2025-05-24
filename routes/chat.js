const express = require('express');
const router = express.Router();
const chatRoutes = require('./chat/index');

// Forward all requests to the chat routes
router.use('/', chatRoutes);

module.exports = router; 