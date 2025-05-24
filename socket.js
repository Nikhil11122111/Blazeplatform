const jwt = require('jsonwebtoken');
const User = require('./models/User');

module.exports = function(io) {
  // Middleware to handle authentication
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const userId = socket.handshake.auth.userId;

      if (!token || !userId) {
        return next(new Error('Authentication error: Missing credentials'));
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user from database
      const user = await User.findById(userId);
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      // Attach user to socket
      socket.user = user;
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication error: ' + error.message));
    }
  });

  // Chat namespace
  const chat = io.of('/chat');

  chat.on('connection', async (socket) => {
    try {
      // Verify socket.user exists before accessing properties
      if (!socket.user) {
        console.error('Socket connection error: User data missing from socket');
        socket.emit('error', { message: 'User data missing' });
        return;
      }
      
      console.log(`User with ID ${socket.user._id} connected to chat`);

      // Join user's personal room
      socket.join(socket.user._id.toString());

      // Set initial presence
      socket.user.online = true;
      await socket.user.save();
      
      // Broadcast user's online status
      socket.broadcast.emit('user_presence', {
        userId: socket.user._id,
        status: 'online'
      });

      // Handle joining conversations
      socket.on('join_conversation', async (conversationId) => {
        try {
          // Verify socket.user still exists
          if (!socket.user) {
            throw new Error('User data missing');
          }
          
          if (!conversationId) {
            throw new Error('Conversation ID is required');
          }

          // Leave previous conversation if any
          if (socket.currentConversation) {
            socket.leave(socket.currentConversation);
          }

          // Join new conversation room
          socket.join(conversationId);
          socket.currentConversation = conversationId;

          socket.emit('joined_conversation', { conversationId });
        } catch (error) {
          console.error('Error joining conversation:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle new messages
      socket.on('new_message', async (data) => {
        try {
          // Verify socket.user still exists
          if (!socket.user) {
            throw new Error('User data missing');
          }
          
          const { conversationId, message, messageType = 'text' } = data;

          if (!conversationId || !message) {
            throw new Error('Conversation ID and message are required');
          }

          // Save message to database
          const newMessage = {
            conversationId,
            senderId: socket.user._id,
            message,
            messageType,
            timestamp: new Date()
          };

          // Broadcast to conversation room
          chat.to(conversationId).emit('new_message', newMessage);

          // Send confirmation to sender
          socket.emit('message_sent', newMessage);
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing', async (data) => {
        try {
          // Verify socket.user still exists
          if (!socket.user) {
            throw new Error('User data missing');
          }
          
          const { conversationId, isTyping } = data;

          if (!conversationId) {
            throw new Error('Conversation ID is required');
          }

          socket.to(conversationId).emit('user_typing', {
            userId: socket.user._id,
            conversationId,
            isTyping
          });
        } catch (error) {
          console.error('Error with typing indicator:', error);
          socket.emit('error', { message: 'Failed to handle typing indicator' });
        }
      });

      // Handle disconnection
      socket.on('disconnect', async () => {
        try {
          // Verify socket.user still exists
          if (!socket.user) {
            console.log('User disconnected (user data not available)');
            return;
          }
          
          console.log(`User ${socket.user._id} disconnected from chat`);

          // Update user's online status
          socket.user.online = false;
          socket.user.last_seen = new Date();
          await socket.user.save();

          // Broadcast offline status
          socket.broadcast.emit('user_presence', {
            userId: socket.user._id,
            status: 'offline',
            lastSeen: socket.user.last_seen
          });
        } catch (error) {
          console.error('Error handling disconnect:', error);
        }
      });

    } catch (error) {
      console.error('Error in socket connection:', error);
      socket.emit('error', { message: 'Internal server error' });
    }
  });
}; 