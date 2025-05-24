const express = require('express');
const router = express.Router();
const keyController = require('../../controllers/chat/keyController');

// Register a public key for the current user
router.post('/register', keyController.registerPublicKey);

// Get a user's public key by ID
router.get('/:userId', keyController.getPublicKey);

// Verify a fingerprint matches for a specific user
router.post('/verify', keyController.verifyFingerprint);

// Rotate (update) the current user's public key
router.put('/rotate', keyController.rotatePublicKey);

module.exports = router; 