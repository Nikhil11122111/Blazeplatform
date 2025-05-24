const Message = require('../models/chat/Message');
const Conversation = require('../models/chat/Conversation');
const UserKey = require('../models/chat/UserKey');
const { sanitizeInput } = require('../utils/sanitizer');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const uuid = require('uuid');

// Socket.io chat handler
module.exports = function(io) {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      console.log('Socket authentication attempt...');
      
      // Get authentication data from the handshake
      const token = socket.handshake.auth.token;
      const sessionId = socket.handshake.auth.sessionId;
      const providedUserId = socket.handshake.auth.userId; // Get userId from handshake
      
      // Store basic info even before authentication succeeds
      if (providedUserId) {
        socket.userId = providedUserId;
        socket.user = { _id: providedUserId }; // Minimum data needed
      }
      
      // Continue with full authentication
      if (!token || !sessionId) {
        console.warn('Missing token or session ID for socket auth, using simplified mode');
        // Allow connection but mark as simplified mode with limited functionality
        socket.simplifiedMode = true;
        return next();
      }
      
      try {
        // Verify JWT
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Verify session with database
        const user = await User.findOne({ _id: userId });
        if (!user || user.sessionId !== sessionId) {
          console.warn('Invalid session for socket auth, using simplified mode');
          // Allow connection but mark as simplified mode
          socket.simplifiedMode = true;
          return next();
        }
        
        // Store user info on socket
        socket.userId = userId;
        socket.user = {
          _id: user._id,
          username: user.username || 'Unknown',
          fullName: user.full_name || user.username || 'Unknown'
        };
        
        console.log(`Authenticated socket user: ${user.username} (${userId})`);
      } catch (jwtError) {
        console.warn('JWT verification failed for socket auth:', jwtError.message);
        // Allow connection but mark as simplified mode
        socket.simplifiedMode = true;
      }
      
      next();
    } catch (err) {
      console.error('Socket authentication error:', err);
      // Allow connection even on error, but mark as simplified mode
      socket.simplifiedMode = true;
      next();
    }
  });
  
  const chatNamespace = io.of('/chat');
  
  chatNamespace.on('connection', (socket) => {
    if (socket.user) {
      console.log(`User ${socket.user.username} (${socket.userId}) connected to chat`);
    } else {
      console.log(`User with ID ${socket.userId || 'unknown'} connected to chat (no user object)`);
    }
    
    // Add user to their personal room
    if (socket.userId) {
      socket.join(`user_${socket.userId}`);
    }
    
    // Handle joining a specific conversation
    socket.on('join_conversation', async (conversationId) => {
      try {
        // For simplified mode, we need a more permissive check
        if (socket.simplifiedMode) {
          // In simplified mode, join the conversation without verifying
          socket.join(`conversation_${conversationId}`);
          console.log(`User ${socket.userId || 'unknown'} joined conversation in simplified mode: ${conversationId}`);
          
          // Notify the user that they've joined successfully
          socket.emit('joined_conversation', { conversationId });
          return;
        }
        
        // Regular verification for non-simplified mode
        if (!socket.userId) {
          socket.emit('error', { message: 'Cannot join conversation: User ID not available' });
          return;
        }
        
        // Verify that the user is part of this conversation
        const conversation = await Conversation.findOne({ 
          conversationId, 
          participants: socket.userId
        });
        
        if (!conversation) {
          socket.emit('error', { message: 'Cannot join conversation: Not authorized' });
          return;
        }
        
        socket.join(`conversation_${conversationId}`);
        console.log(`User ${socket.userId} joined conversation: ${conversationId}`);
        
        // Mark messages as read when joining a conversation
        try {
          const otherParticipant = conversation.participants.find(
            p => p.toString() !== socket.userId.toString()
          );
          
          if (otherParticipant) {
            await Message.markAsRead(socket.userId, otherParticipant);
            await Conversation.markAsRead(conversationId, socket.userId);
          }
        } catch (markError) {
          console.error('Error marking messages as read:', markError);
          // Continue anyway - this isn't critical
        }
        
        // Notify the user that they've joined successfully
        socket.emit('joined_conversation', { conversationId });
      } catch (error) {
        console.error('Error joining conversation:', error);
        socket.emit('error', { message: 'Failed to join conversation', error: error.message });
      }
    });
    
    // Handle sending a message
    socket.on('send_message', async (data) => {
      try {
        // Check for simplified mode or regular encrypted mode
        const isSimplifiedMode = data.simplified === true || socket.simplifiedMode === true;
        const { receiverId, messageType = 'text' } = data;
        
        // Basic validation for required fields
        if (!receiverId) {
          socket.emit('error', { message: 'Missing required field: receiverId' });
          return;
        }
        
        // Check if user ID is available (minimum requirement)
        if (!socket.userId) {
          console.warn('User ID not available in socket for send_message event');
          socket.emit('error', { message: 'Authentication error: User ID not found' });
          return;
        }
        
        // Populate minimal user data if not available
        const senderName = socket.user?.fullName || socket.user?.username || 'Unknown user';
        
        // Validate content based on mode
        if (isSimplifiedMode) {
          // Simplified mode validation
          if (!data.content) {
            socket.emit('error', { message: 'Missing required field: content' });
            return;
          }
        } else {
          // Encrypted mode validation
          if (!data.encryptedContent || !data.encryptedKey) {
            socket.emit('error', { message: 'Missing required encryption fields' });
            return;
          }
        }
        
        // Sanitize input to prevent XSS
        const sanitizedContent = isSimplifiedMode 
          ? sanitizeInput(data.content) 
          : sanitizeInput(data.encryptedContent);
        
        // Generate a unique client ID to prevent duplicate messages
        const clientMessageId = data.clientMessageId || uuid.v4();
        
        // Find or create conversation
        const conversation = await Conversation.findOrCreateConversation(socket.userId, receiverId);
        
        // Create the message based on mode
        const messageData = {
          senderId: socket.userId,
          receiverId: receiverId,
          messageType,
          metadata: {
            conversationId: conversation.conversationId,
            clientGeneratedId: clientMessageId,
            simplified: isSimplifiedMode
          }
        };
        
        // Add the appropriate content field based on mode
        if (isSimplifiedMode) {
          messageData.content = sanitizedContent;
        } else {
          messageData.encryptedContent = sanitizedContent;
          messageData.encryptedKey = data.encryptedKey;
          messageData.iv = data.iv;
        }
        
        // Create the message
        const newMessage = await Message.create(messageData);
        
        // Update the conversation with latest message
        await Conversation.updateLastMessage(conversation.conversationId, newMessage);
        
        // Create response data
        const responseData = {
          _id: newMessage._id,
          senderId: newMessage.senderId,
          senderName: senderName,
          receiverId: newMessage.receiverId,
          messageType: newMessage.messageType,
          createdAt: newMessage.createdAt,
          conversationId: conversation.conversationId,
          clientMessageId: clientMessageId,
          simplified: isSimplifiedMode
        };
        
        // Add the appropriate content field to the response based on mode
        if (isSimplifiedMode) {
          responseData.content = newMessage.content;
        } else {
          responseData.encryptedContent = newMessage.encryptedContent;
          responseData.encryptedKey = newMessage.encryptedKey;
          responseData.iv = newMessage.iv;
        }
        
        // Emit to sender's room for acknowledgment
        socket.emit('message_sent', responseData);
        
        // Emit to receiver's room for real-time updates
        socket.to(`user_${receiverId}`).emit('new_message', responseData);
        
        // Also emit to the conversation room if active
        socket.to(`conversation_${conversation.conversationId}`).emit('new_message', responseData);
      } catch (error) {
        console.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message', error: error.message });
      }
    });
    
    // Handle marking messages as read
    socket.on('mark_read', async (data) => {
      try {
        const { conversationId, senderId } = data;
        
        if (!conversationId || !senderId) {
          socket.emit('error', { message: 'Missing required fields' });
          return;
        }
        
        // Mark messages as read
        await Message.markAsRead(socket.userId, senderId);
        
        // Update conversation unread count
        await Conversation.markAsRead(conversationId, socket.userId);
        
        // Notify the sender that their messages were read
        socket.to(`user_${senderId}`).emit('messages_read', {
          conversationId,
          readBy: socket.userId,
          readAt: new Date()
        });
      } catch (error) {
        console.error('Error marking messages as read:', error);
        socket.emit('error', { message: 'Failed to mark messages as read', error: error.message });
      }
    });
    
    // Handle user typing indicator
    socket.on('typing', (data) => {
      const { conversationId, isTyping } = data;
      
      if (!conversationId) {
        return;
      }
      
      // Make sure user data is available before accessing properties
      const username = socket.user?.username || 'Unknown user';
      const userId = socket.userId || 'unknown';
      
      // Broadcast to the conversation that user is typing
      socket.to(`conversation_${conversationId}`).emit('user_typing', {
        conversationId,
        userId: userId,
        username: username,
        isTyping
      });
    });
    
    // Handle user online presence
    socket.on('set_presence', (status) => {
      // Make sure user data is available before using it
      if (!socket.userId) {
        console.warn('User data not available in socket for presence event');
        return;
      }
      
      // Broadcast to all users that follow/message this user
      socket.broadcast.emit('user_presence', {
        userId: socket.userId,
        status: status
      });
    });
    
    // Handle heartbeat pings to keep connection alive
    socket.on('heartbeat', (data) => {
      // Respond immediately to confirm the connection is alive
      socket.emit('heartbeat_ack', {
        timestamp: Date.now(),
        requestTimestamp: data.timestamp || Date.now(),
        status: 'ok'
      });
      
      // Reset disconnect timer if one exists
      if (socket.heartbeatTimeout) {
        clearTimeout(socket.heartbeatTimeout);
      }
      
      // Set a new timeout - disconnect if no heartbeat for 2 minutes
      socket.heartbeatTimeout = setTimeout(() => {
        console.log(`No heartbeat from user ${socket.userId} for 2 minutes, closing connection`);
        socket.disconnect(true);
      }, 120000); // 2 minutes
    });
    
    // Handle connection health ping
    socket.on('ping', (data, callback) => {
      // If callback function provided, use it to respond
      if (typeof callback === 'function') {
        callback({
          success: true,
          timestamp: Date.now(),
          userId: socket.userId
        });
      } else {
        // Otherwise emit an event
        socket.emit('pong', {
          timestamp: Date.now(),
          requestTimestamp: data?.timestamp || Date.now()
        });
      }
    });
    
    // Handle heartbeat/ping messages to keep the connection alive
    socket.on('heartbeat', (data) => {
      // Send back a simple acknowledgement with server timestamp
      socket.emit('heartbeat_ack', {
        clientTimestamp: data.timestamp,
        serverTimestamp: Date.now(),
        userId: socket.userId
      });
    });
    
    // Handle ping messages for connection testing
    socket.on('ping', (data, callback) => {
      if (typeof callback === 'function') {
        // Send response directly through the callback
        callback({
          success: true,
          clientTime: data.timestamp,
          serverTime: Date.now(),
          userId: socket.userId,
          rooms: Array.from(socket.rooms)
        });
      } else {
        // Fallback if callback isn't provided
        socket.emit('pong', {
          success: true,
          clientTime: data.timestamp,
          serverTime: Date.now(),
          userId: socket.userId
        });
      }
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`User ${socket.userId || 'undefined'} disconnected from chat`);
      
      // Broadcast offline status to relevant users
      socket.broadcast.emit('user_presence', {
        userId: socket.userId,
        status: 'offline'
      });
    });
  });
  
  return chatNamespace;
};