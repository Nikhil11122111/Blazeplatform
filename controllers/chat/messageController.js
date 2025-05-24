const Message = require('../../models/chat/Message');
const Conversation = require('../../models/chat/Conversation');
const UserKey = require('../../models/chat/UserKey');
const { validateFile, storeEncryptedFile } = require('../../utils/fileUtils');
const { sanitizeInput } = require('../../utils/sanitizer');
const uuid = require('uuid');
const crypto = require('crypto');

// Send a new text message
exports.sendMessage = async (req, res) => {
  try {
    const { receiverId, messageType = 'text', simplified = false } = req.body;
    const senderId = req.user._id;
    
    // Check if using simplified mode or encrypted mode
    if (simplified) {
      // Simplified mode - direct text content without encryption
      const { content } = req.body;
      
      if (!receiverId || !content) {
        return res.status(400).json({ success: false, message: 'Missing required fields' });
      }
      
      // Sanitize content
      const sanitizedContent = sanitizeInput(content);
      
      // Generate a unique client ID to prevent duplicate messages
      const clientMessageId = uuid.v4();
      
      // Find or create conversation
      const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);
      
      // Create the message
      const newMessage = await Message.create({
        senderId,
        receiverId,
        encryptedContent: sanitizedContent, // In simplified mode, content is not encrypted
        messageType,
        metadata: {
          conversationId: conversation.conversationId,
          clientGeneratedId: clientMessageId,
          simplified: true  // Mark as simplified (unencrypted)
        }
      });
      
      // Update the conversation with latest message
      await Conversation.updateLastMessage(conversation.conversationId, newMessage);
      
      // Return the new message
      return res.status(201).json({
        success: true,
        message: 'Message sent successfully (simplified mode)',
        data: {
          messageId: newMessage._id,
          clientMessageId,
          conversationId: conversation.conversationId,
          timestamp: newMessage.createdAt,
          simplified: true
        }
      });
    } else {
      // Encrypted mode - require encryption fields
      const { encryptedContent, encryptedKey, iv } = req.body;
      
      // Basic validation
      if (!receiverId || !encryptedContent || !encryptedKey) {
        return res.status(400).json({ success: false, message: 'Missing required fields for encrypted message' });
      }
      
      // Sanitize input to prevent XSS
      const sanitizedContent = sanitizeInput(encryptedContent);
      
      // Generate a unique client ID to prevent duplicate messages
      const clientMessageId = uuid.v4();
      
      // Find or create conversation
      const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);
      
      // Create the message
      const newMessage = await Message.create({
        senderId,
        receiverId,
        encryptedContent: sanitizedContent,
        encryptedKey,
        iv,
        messageType,
        metadata: {
          conversationId: conversation.conversationId,
          clientGeneratedId: clientMessageId
        }
      });
      
      // Update the conversation with latest message
      await Conversation.updateLastMessage(conversation.conversationId, newMessage);
      
      // Return the new message
      return res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: {
          messageId: newMessage._id,
          clientMessageId,
          conversationId: conversation.conversationId,
          timestamp: newMessage.createdAt
        }
      });
    }
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ success: false, message: 'Failed to send message', error: error.message });
  }
};

// Send a file message
exports.sendFileMessage = async (req, res) => {
  try {
    console.log('File upload received with body fields:', Object.keys(req.body));
    console.log('File upload received with receiverId:', req.body.receiverId);
    console.log('File upload received with encryptedKey present:', !!req.body.encryptedKey);
    console.log('File upload received with file:', !!req.file);
    
    const { receiverId, encryptedKey } = req.body;
    const senderId = req.user._id;
    const file = req.file;
    
    // Basic validation with better error messages
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Missing required field: receiverId' });
    }
    
    if (!encryptedKey) {
      return res.status(400).json({ success: false, message: 'Missing required field: encryptedKey' });
    }
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Missing required field: file' });
    }
    
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.error });
    }
    
    // Generate message ID
    const clientMessageId = uuid.v4();
    
    // Find conversation
    const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);
    
    // Generate a new encryption key (no more session dependency)
    const secretKey = crypto.randomBytes(32).toString('hex');
    console.log('Generated secret key for file encryption');
    
    // Store the file
    try {
      const fileMetadata = await storeEncryptedFile(file, senderId, secretKey);
      console.log('File stored successfully:', fileMetadata.fileName);
      
      // Determine message type based on MIME type
      let messageType = 'file';
      if (file.mimetype.startsWith('image/')) {
        messageType = 'image';
      }
      
      // Create message record
      const newMessage = await Message.create({
        senderId,
        receiverId,
        encryptedContent: `File: ${fileMetadata.originalName}`, // Just a placeholder
        messageType,
        fileMetadata: {
          fileName: fileMetadata.originalName,
          fileSize: fileMetadata.size,
          filePath: fileMetadata.path,
          mimeType: fileMetadata.mimeType
        },
        metadata: {
          conversationId: conversation.conversationId,
          clientGeneratedId: clientMessageId
        }
      });
      
      // Update conversation
      await Conversation.updateLastMessage(conversation.conversationId, newMessage);
      
      // Return success response
      res.status(201).json({
        success: true,
        message: 'File sent successfully',
        data: {
          messageId: newMessage._id,
          clientMessageId,
          conversationId: conversation.conversationId,
          timestamp: newMessage.createdAt,
          fileType: messageType,
          fileName: fileMetadata.originalName,
          filePath: fileMetadata.path,
          senderId: senderId
        }
      });
    } catch (fileError) {
      console.error('Error processing file:', fileError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error processing file',
        error: fileError.message 
      });
    }
  } catch (error) {
    console.error('Error sending file message:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send file', 
      error: error.message 
    });
  }
};

// Get messages from a conversation
exports.getMessages = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    const { limit = 50, offset = 0 } = req.query;
    
    // Get messages
    const messages = await Message.getConversation(
      currentUserId,
      userId,
      parseInt(limit),
      parseInt(offset)
    );
    
    // Mark messages as read
    await Message.markAsRead(currentUserId, userId);
    
    // Also update conversation unread count
    const conversationId = Conversation.generateConversationId(currentUserId, userId);
    await Conversation.markAsRead(conversationId, currentUserId);
    
    // Return messages
    res.status(200).json({
      success: true,
      count: messages.length,
      data: messages
    });
  } catch (error) {
    console.error('Error getting messages:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve messages', error: error.message });
  }
};

// Get a single message by ID
exports.getMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    
    // Find the message and ensure it belongs to the requesting user
    const message = await Message.findOne({
      _id: messageId,
      $or: [{ senderId: userId }, { receiverId: userId }],
      isDeleted: false
    });
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error('Error getting message:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve message', error: error.message });
  }
};

// Mark messages as read
exports.markAsRead = async (req, res) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    // Mark messages from this user as read
    await Message.markAsRead(currentUserId, userId);
    
    // Update conversation
    const conversationId = Conversation.generateConversationId(currentUserId, userId);
    await Conversation.markAsRead(conversationId, currentUserId);
    
    res.status(200).json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ success: false, message: 'Failed to mark messages as read', error: error.message });
  }
};

// Delete a message (soft delete)
exports.deleteMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;
    
    // Find the message and ensure it belongs to the requesting user
    const message = await Message.findOne({
      _id: messageId,
      $or: [{ senderId: userId }, { receiverId: userId }]
    });
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }
    
    // Soft delete by marking as deleted
    message.isDeleted = true;
    await message.save();
    
    res.status(200).json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ success: false, message: 'Failed to delete message', error: error.message });
  }
}; 

// Update a message
exports.updateMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!content) {
      return res.status(400).json({ success: false, message: 'Message content is required' });
    }
    
    // Sanitize content
    const sanitizedContent = sanitizeInput(content);
    
    // Find the message and ensure it belongs to the requesting user (sender)
    const message = await Message.findOne({
      _id: messageId,
      senderId: userId // Only the sender can edit their message
    });
    
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found or you do not have permission to edit it' });
    }
    
    // Don't allow editing of deleted messages
    if (message.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });
    }
    
    // Don't allow editing file/image messages
    if (message.messageType === 'file' || message.messageType === 'image') {
      return res.status(400).json({ success: false, message: 'Cannot edit file or image messages' });
    }
    
    // Update the message content
    if (message.metadata && message.metadata.simplified) {
      // For simplified mode, update directly
      message.encryptedContent = sanitizedContent;
    } else {
      // For encrypted mode, handle similarly (in this implementation we just update directly)
      message.encryptedContent = sanitizedContent;
    }
    
    // Add edit timestamp
    message.editedAt = new Date();
    message.isEdited = true;
    
    // Save the updated message
    await message.save();
    
    // Return success response
    res.status(200).json({
      success: true,
      message: 'Message updated successfully',
      data: message
    });
  } catch (error) {
    console.error('Error updating message:', error);
    res.status(500).json({ success: false, message: 'Failed to update message', error: error.message });
  }
}; 