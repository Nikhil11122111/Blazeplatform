const Message = require('../../models/chat/Message');
const Conversation = require('../../models/chat/Conversation');
const { validateFile } = require('../../utils/fileUtils');
const { sanitizeInput } = require('../../utils/sanitizer');
const uuid = require('uuid');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

// Promisify fs functions
const mkdirAsync = promisify(fs.mkdir);
const writeFileAsync = promisify(fs.writeFile);

// Send a file message - ultra-simplified version that doesn't use encryption
exports.uploadFile = async (req, res) => {
  try {
    console.log('File upload received with body fields:', Object.keys(req.body));
    console.log('File upload received with receiverId:', req.body.receiverId);
    console.log('File upload received with file:', !!req.file);
    
    const { receiverId } = req.body;
    const senderId = req.user._id;
    const file = req.file;
    
    // Basic validation
    if (!receiverId) {
      return res.status(400).json({ success: false, message: 'Missing required field: receiverId' });
    }
    
    if (!file) {
      return res.status(400).json({ success: false, message: 'Missing required field: file' });
    }
    
    // Generate message ID
    const clientMessageId = uuid.v4();
    
    // Find or create conversation
    const conversation = await Conversation.findOrCreateConversation(senderId, receiverId);
    
    try {
      // Create directory structure if it doesn't exist
      const baseDir = path.join(__dirname, '..', '..', 'uploads');
      const chatDir = path.join(baseDir, 'chat');
      const userDir = path.join(chatDir, senderId.toString());
      
      try {
        if (!fs.existsSync(baseDir)) await mkdirAsync(baseDir, { recursive: true });
        if (!fs.existsSync(chatDir)) await mkdirAsync(chatDir, { recursive: true });
        if (!fs.existsSync(userDir)) await mkdirAsync(userDir, { recursive: true });
      } catch (err) {
        console.error('Error creating directories:', err);
        if (err.code !== 'EEXIST') throw err;
      }
      
      // Generate secure filename
      const timestamp = Date.now();
      const randomString = crypto.randomBytes(8).toString('hex');
      const extension = path.extname(file.originalname);
      const secureFilename = `${senderId}_${timestamp}_${randomString}${extension}`;
      const filePath = path.join(userDir, secureFilename);
      
      console.log('Writing file to:', filePath);
      
      // Write file directly (no encryption at all)
      await writeFileAsync(filePath, file.buffer);
      
      // File metadata
      const fileMetadata = {
        originalName: file.originalname,
        fileName: secureFilename,
        mimeType: file.mimetype,
        size: file.size,
        path: `/uploads/chat/${senderId}/${secureFilename}`
      };
      
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
        encryptedContent: `File: ${fileMetadata.originalName}`,
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
      
      // Update conversation with latest message
      await Conversation.updateLastMessage(conversation.conversationId, newMessage);
      
      // Return success response with file data
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
    console.error('Error handling file upload:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to handle file upload', 
      error: error.message 
    });
  }
}; 