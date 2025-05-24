const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const multer = require('multer');
const fileController = require('../../controllers/chat/fileController');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Import sub-routes
const messageRoutes = require('./messages');
const conversationRoutes = require('./conversations');
const keyRoutes = require('./keys');

// Health check endpoint (not requiring auth)
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Chat server is running',
    timestamp: new Date().toISOString()
  });
});

// Apply authentication middleware to all other chat routes
router.use(auth);

// Direct file upload route that doesn't use the /messages path
router.post('/upload-file', upload.single('file'), fileController.uploadFile);

// Mount chat-related subroutes
router.use('/messages', messageRoutes);
router.use('/conversations', conversationRoutes);
router.use('/keys', keyRoutes);

module.exports = router; 