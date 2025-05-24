const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Notification = require('../models/Notification');
const chatHandler = require('./chatHandler');

// Initialize all socket handlers
module.exports = function(io) {
  // Main namespace handlers (already in server.js)
  io.on('connection', (socket) => {
    console.log('New client connected with socket ID:', socket.id);

    // Extract auth data from socket handshake
    const token = socket.handshake.auth.token;
    const sessionId = socket.handshake.auth.sessionId;
    
    // Validate authentication credentials
    if (token && sessionId) {
      try {
        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;
        
        // Store user ID on the socket object
        socket.userId = userId;
        console.log(`Authenticated socket connection for user: ${userId}`);
        
        // Join the user's personal notification room
        socket.join(userId);
        console.log(`User ${userId} joined their notification room`);
        
        // Handle test connection requests
        socket.on('test_connection', (data) => {
          console.log(`Received test connection from user ${userId}:`, data);
          // Send test response back to verify two-way communication
          socket.emit('test_response', {
            success: true,
            message: 'Server received your test connection',
            timestamp: new Date()
          });
        });
        
        // Listen for the client marking notifications as read
        socket.on('mark_notifications_read', async (notificationIds) => {
          console.log(`User ${userId} marked notifications as read:`, notificationIds);
          try {
            // Mark notifications as read in the database
            await Notification.markAsRead(userId, notificationIds);
            console.log(`Successfully marked notifications as read for user ${userId}`);
          } catch (error) {
            console.error(`Error marking notifications as read for user ${userId}:`, error);
          }
        });
      } catch (error) {
        console.error('Socket authentication error:', error);
      }
    } else {
      console.log('Unauthenticated socket connection');
    }

    socket.on('disconnect', () => {
      console.log('Client disconnected');
    });
  });
  
  // Initialize the chat namespace
  const chat = chatHandler(io);
  
  return io;
}; 