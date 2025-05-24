const express = require('express');
const router = express.Router();
const conversationController = require('../../controllers/chat/conversationController');

// Get all conversations for current user
router.get('/', conversationController.getConversations);

// Get a specific conversation by ID
router.get('/:conversationId', conversationController.getConversation);

// Create a new conversation
router.post('/', conversationController.createConversation);

// Delete a conversation (soft delete for current user only)
router.delete('/:conversationId', conversationController.deleteConversation);

// Get unread message counts across all conversations
router.get('/unread/count', conversationController.getUnreadCounts);

module.exports = router; 