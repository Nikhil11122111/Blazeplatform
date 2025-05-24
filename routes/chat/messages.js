const express = require('express');
const router = express.Router();
const multer = require('multer');
const messageController = require('../../controllers/chat/messageController');
const fileController = require('../../controllers/chat/fileController');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Send a text message
router.post('/', messageController.sendMessage);

// Send a file message (original route - keep for backward compatibility)
router.post('/file', upload.single('file'), messageController.sendFileMessage);

// New route for simplified file uploads that doesn't use encryption key
router.post('/upload', upload.single('file'), fileController.uploadFile);

// Get messages from a conversation with a specific user
router.get('/user/:userId', messageController.getMessages);

// Get a specific message by ID
router.get('/:messageId', messageController.getMessage);

// Mark messages from a specific user as read
router.put('/read/:userId', messageController.markAsRead);

// Update a message
router.put('/:messageId', messageController.updateMessage);

// Delete a message (soft delete)
router.delete('/:messageId', messageController.deleteMessage);

module.exports = router; 