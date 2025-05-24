const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Connection = require('../models/Connection');
const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Helper function to find an existing connection between two users
 * @param {String} senderId - Sender user ID
 * @param {String} receiverId - Receiver user ID
 * @param {String} purpose - Optional purpose of the connection
 * @returns {Promise<Object|null>} Connection object or null if not found
 */
async function findExistingConnection(senderId, receiverId, purpose) {
  console.log('[CONN DEBUG] Trying exact match query');
  let foundConnection = await Connection.findOne({
    sender: senderId,
    receiver: receiverId
  });
  
  if (foundConnection) {
    console.log('[CONN DEBUG] Found connection with exact match');
    return foundConnection;
  }
  
  console.log('[CONN DEBUG] Trying reverse match query');
  foundConnection = await Connection.findOne({
    sender: receiverId,
    receiver: senderId
  });
  
  if (foundConnection) {
    console.log('[CONN DEBUG] Found connection with reverse match');
    return foundConnection;
  }
  
  if (purpose) {
    console.log('[CONN DEBUG] Trying query with purpose:', purpose);
    foundConnection = await Connection.findOne({
      $or: [
        { sender: senderId, receiver: receiverId, purpose },
        { sender: receiverId, receiver: senderId, purpose }
      ]
    });
    
    if (foundConnection) {
      console.log('[CONN DEBUG] Found connection with purpose:', purpose);
      return foundConnection;
    }
  }
  
  console.log('[CONN DEBUG] No connection found between users');
  return null;
}

/**
 * @route   GET /api/connections/debug
 * @desc    Debug endpoint to check all connections in the database (REMOVE IN PRODUCTION)
 * @access  Private
 */
router.get('/debug', auth, async (req, res) => {
  try {
    // Find all connections in the database
    const allConnections = await Connection.find({})
      .populate('sender receiver', 'full_name username email');

    // Transform to easier to read format
    const formattedConnections = allConnections.map(conn => ({
      id: conn._id,
      sender: {
        id: conn.sender._id,
        name: conn.sender.full_name || conn.sender.username,
        email: conn.sender.email
      },
      receiver: {
        id: conn.receiver._id,
        name: conn.receiver.full_name || conn.receiver.username,
        email: conn.receiver.email
      },
      status: conn.status,
      created_at: conn.created_at
    }));

    res.json({
      currentUserId: req.user._id,
      currentUserEmail: req.user.email,
      totalConnections: formattedConnections.length,
      connections: formattedConnections
    });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/connections
 * @desc    Get all user connections (accepted only)
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    // Find all connections where current user is either sender or receiver with status 'accepted'
    const connections = await Connection.find({
      $or: [
        { sender: req.user._id, status: 'accepted' },
        { receiver: req.user._id, status: 'accepted' }
      ]
    }).populate('sender receiver', 'full_name username profile_picture');

    // Format response to include only the other user, not the current user
    const formattedConnections = connections.map(conn => {
      const otherUser = conn.sender._id.toString() === req.user._id.toString() ? conn.receiver : conn.sender;
      return {
        connectionId: conn._id,
        user: otherUser,
        status: conn.status,
        createdAt: conn.created_at,
        updatedAt: conn.updated_at,
        accepted_at: conn.accepted_at
      };
    });

    res.json(formattedConnections);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/connections/pending
 * @desc    Get pending connection requests received by the user
 * @access  Private
 */
router.get('/pending', auth, async (req, res) => {
  try {
    // Find all connections where current user is the receiver with status 'pending'
    const pendingRequests = await Connection.find({
      receiver: req.user._id,
      status: 'pending'
    }).populate('sender', 'full_name username profile_picture');

    res.json(pendingRequests);
  } catch (error) {
    console.error('Error fetching pending requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/connections/sent
 * @desc    Get connection requests sent by the user
 * @access  Private
 */
router.get('/sent', auth, async (req, res) => {
  try {
    // Find all connections where current user is the sender with status 'pending'
    const sentRequests = await Connection.find({
      sender: req.user._id,
      status: 'pending'
    }).populate('receiver', 'full_name username profile_picture');

    res.json(sentRequests);
  } catch (error) {
    console.error('Error fetching sent requests:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/connections/status/:userId
 * @desc    Get connection status with another user
 * @access  Private
 */
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify valid userId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid user ID format' });
    }

    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find connection between users
    const connection = await Connection.findOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    });

    if (!connection) {
      return res.json({ status: 'none' });
    }

    // Determine the relationship direction
    const isRequester = connection.sender.toString() === req.user._id.toString();
    
    res.json({
      connectionId: connection._id,
      status: connection.status,
      direction: isRequester ? 'outgoing' : 'incoming'
    });
  } catch (error) {
    console.error('Error fetching connection status:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/connections/request
 * @desc    Create a connection request to another user
 * @access  Private
 */
router.post('/request', auth, async (req, res) => {
  try {
    const { userId, purpose } = req.body;
    
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }
    
    // Don't allow connecting to self
    if (userId === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot connect to yourself' });
    }
    
    // Ensure targetUser exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Debug data for logging
    console.log('[CONN DEBUG] Processing connection request from', req.user._id, 'to', userId, 'with purpose', purpose || 'general');
    
    // Log current user data
    console.log('[CONN DEBUG] Current user:', {
      id: req.user._id,
      email: req.user.email,
      name: req.user.full_name || req.user.username
    });
    
    // Log target user data
    console.log('[CONN DEBUG] Target user:', {
      id: targetUser._id,
      email: targetUser.email,
      name: targetUser.full_name || targetUser.username
    });

    // First check if there is an existing connection of any status
    // We have to check both ways (sender/receiver)
    console.log('[CONN DEBUG] Checking for existing connection with query:', {
      '$or': [
        { sender: req.user._id, receiver: userId, purpose: purpose },
        { sender: userId, receiver: req.user._id, purpose: purpose }
      ]
    });
    
    // Create connection data
    console.log('[CONN DEBUG] Creating new connection from', req.user._id, 'to', userId);
    const connectionData = {
      sender: req.user._id,
      receiver: userId,
      status: 'pending',
      purpose: purpose || 'general'
    };
    console.log('[CONN DEBUG] New connection data:', connectionData);
    
    // Use try/catch to handle race conditions with unique constraints
    try {
      console.log('[CONN DEBUG] Using findOneAndUpdate with upsert to create/find connection');
      const connection = await Connection.findOneAndUpdate(
        { sender: req.user._id, receiver: userId },
        connectionData,
        { 
          new: true, 
          upsert: true,
          setDefaultsOnInsert: true
        }
      );
      
      // Add a flag to indicate if this is a newly created connection
      connection.isNewlyCreated = true;
      
      console.log('[CONN DEBUG] Connection:', {
        id: connection._id,
        sender: connection.sender,
        receiver: connection.receiver,
        status: connection.status,
        created_at: connection.created_at,
        isNewlyCreated: connection.isNewlyCreated
      });
      
      // Create notification for the connection request
      const notification = await Notification.createFromConnectionRequest({
        userId: userId,
        connectionId: connection._id,
        senderId: req.user._id,
        senderName: req.user.full_name || req.user.username,
        senderAvatar: req.user.profile_picture,
        message: `${req.user.full_name || req.user.username} sent you a connection request`
      });

      // Send real-time notification if socket.io is available
      const io = req.app.get('io');
      if (io) {
        console.log('[NOTIFY] Sent connection request notification to user', userId);
        
        // Emit to the specific room (userId) for real-time notification
        io.to(userId).emit('connection_request', {
          _id: notification._id,
          type: 'connection_request',
          title: 'Connection Request',
          message: `${req.user.full_name || req.user.username} sent you a connection request`,
          connectionId: connection._id,
          senderId: req.user._id,
          senderName: req.user.full_name || req.user.username,
          senderAvatar: req.user.profile_picture || null,
          status: 'unread',
          timestamp: new Date()
        });
      }
      
      res.status(201).json({ success: true, connection, status: connection.status });
    } catch (error) {
      // Handle duplicate key errors (connection already exists)
      if (error.code === 11000) {
        console.log('[CONN DEBUG] Duplicate connection detected - race condition:', error.message);
        
        // Log more details
        if (error.keyPattern) console.log('[CONN DEBUG] Duplicate key pattern:', error.keyPattern);
        if (error.keyValue) console.log('[CONN DEBUG] Duplicate key value:', error.keyValue);
        
        // Try to find the existing connection
        console.log('[CONN DEBUG] Retry attempt 1/3 to find the connection');
        const existingConnection = await findExistingConnection(req.user._id, userId, purpose);
        
        if (existingConnection) {
          console.log('[CONN DEBUG] Successfully found connection after retry:', {
            id: existingConnection._id,
            sender: existingConnection.sender,
            receiver: existingConnection.receiver,
            status: existingConnection.status,
            isRequester: existingConnection.sender.toString() === req.user._id.toString()
          });
          
          // If the connection was already declined, create a notification to fix it
          if (existingConnection.status === 'declined') {
            // Create notification for the connection request
            const notification = await Notification.createFromConnectionRequest({
              userId: userId,
              connectionId: existingConnection._id,
              senderId: req.user._id,
              senderName: req.user.full_name || req.user.username,
              senderAvatar: req.user.profile_picture,
              message: `${req.user.full_name || req.user.username} sent you a connection request`
            });
            
            // Send real-time notification if socket.io is available
            const io = req.app.get('io');
            if (io) {
              console.log('[NOTIFY] Sent connection request notification to user', userId);
              
              // Emit to the specific room (userId) for real-time notification
              io.to(userId).emit('connection_request', {
                _id: notification._id,
                type: 'connection_request',
                title: 'Connection Request',
                message: `${req.user.full_name || req.user.username} sent you a connection request`,
                connectionId: existingConnection._id,
                senderId: req.user._id,
                senderName: req.user.full_name || req.user.username,
                senderAvatar: req.user.profile_picture || null,
                status: 'unread',
                timestamp: new Date()
              });
            }
          }
          
          return res.json({ 
            success: true, 
            connection: existingConnection, 
            status: existingConnection.status,
            message: `Connection request already exists with status: ${existingConnection.status}`
          });
        } else {
          return res.status(400).json({ 
            success: false, 
            message: 'Connection already exists but could not be retrieved' 
          });
        }
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('Error creating connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/connections/accept/:connectionId
 * @desc    Accept a connection request
 * @access  Private
 */
router.put('/accept/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Find the connection and verify it's for this user
    const connection = await Connection.findOne({
      _id: connectionId,
      receiver: req.user._id,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found or already processed' });
    }

    // Update connection status
    connection.status = 'accepted';
    connection.accepted_at = new Date();
    await connection.save();

    // Return the updated connection with populated user data
    const populatedConnection = await Connection.findById(connectionId)
      .populate('sender', 'full_name username profile_picture');

    res.json({
      message: 'Connection request accepted',
      connection: populatedConnection
    });
  } catch (error) {
    console.error('Error accepting connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/connections/decline/:connectionId
 * @desc    Decline a connection request
 * @access  Private
 */
router.put('/decline/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Find the connection and verify it's for this user
    const connection = await Connection.findOne({
      _id: connectionId,
      receiver: req.user._id,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found or already processed' });
    }

    // Update connection status
    connection.status = 'declined';
    await connection.save();

    res.json({ message: 'Connection request declined' });
  } catch (error) {
    console.error('Error declining connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/connections/cancel/:connectionId
 * @desc    Cancel a sent connection request
 * @access  Private
 */
router.put('/cancel/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Find the connection and verify it was sent by this user and is still pending
    const connection = await Connection.findOne({
      _id: connectionId,
      sender: req.user._id,
      status: 'pending'
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection request not found or already processed' });
    }

    // You have two options here: either delete the connection or mark it as canceled
    // Option 1: Delete the connection
    await Connection.deleteOne({ _id: connectionId });
    
    // Option 2 (alternative): Mark as canceled but keep the record
    // connection.status = 'canceled';
    // await connection.save();

    res.json({ message: 'Connection request canceled successfully' });
  } catch (error) {
    console.error('Error canceling connection request:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/connections/:connectionId
 * @desc    Remove a connection or cancel a request
 * @access  Private
 */
router.delete('/:connectionId', auth, async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    // Find the connection and verify it's for this user
    const connection = await Connection.findOne({
      _id: connectionId,
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id }
      ]
    });

    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }

    // Delete the connection
    await Connection.deleteOne({ _id: connectionId });

    res.json({ message: 'Connection removed successfully' });
  } catch (error) {
    console.error('Error removing connection:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   GET /api/connections/diagnostics/:userId
 * @desc    Diagnostic endpoint to check connection with specific user (Admin/Debug only)
 * @access  Private
 */
router.get('/diagnostics/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { purpose } = req.query; // Optional purpose filter from query string
    
    // Log diagnostic request
    console.log(`[CONN DIAG] Diagnostic check for connection between ${req.user._id} and ${userId}${purpose ? ` with purpose '${purpose}'` : ''}`);
    
    // Get current user info
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(400).json({
        success: false,
        message: 'Current user not found in database'
      });
    }
    
    // Check target user
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }
    
    // Return basic info about both users
    const userInfo = {
      currentUser: {
        id: currentUser._id,
        email: currentUser.email,
        name: currentUser.full_name || currentUser.username
      },
      targetUser: {
        id: targetUser._id,
        email: targetUser.email,
        name: targetUser.full_name || targetUser.username
      }
    };
    
    // Build query based on whether purpose is provided
    const baseQuery = purpose 
      ? { purpose } // Include purpose if provided
      : {}; // Otherwise any purpose
    
    // Check for exact connection matches
    console.log('[CONN DIAG] Checking direct connection...');
    const directConnectionQuery = {
      ...baseQuery,
      sender: req.user._id,
      receiver: userId
    };
    console.log('Direct connection query:', directConnectionQuery);
    const directConnection = await Connection.findOne(directConnectionQuery);
    
    // Check for reverse connection matches
    console.log('[CONN DIAG] Checking reverse connection...');
    const reverseConnectionQuery = {
      ...baseQuery,
      sender: userId,
      receiver: req.user._id
    };
    console.log('Reverse connection query:', reverseConnectionQuery);
    const reverseConnection = await Connection.findOne(reverseConnectionQuery);
    
    // Get all connections involving either user
    console.log('[CONN DIAG] Checking all connections for either user...');
    const allConnectionsQuery = {
      $or: [
        { sender: req.user._id },
        { receiver: req.user._id },
        { sender: userId },
        { receiver: userId }
      ]
    };
    
    // Add purpose filter if provided
    if (purpose) {
      allConnectionsQuery.purpose = purpose;
    }
    
    const allConnections = await Connection.find(allConnectionsQuery);
    
    // Format connections for easier reading
    const formattedConnections = allConnections.map(conn => ({
      id: conn._id,
      sender: conn.sender.toString(),
      receiver: conn.receiver.toString(),
      status: conn.status,
      purpose: conn.purpose,
      created_at: conn.created_at,
      isBetweenTargetUsers: 
        (conn.sender.toString() === req.user._id.toString() && conn.receiver.toString() === userId) ||
        (conn.sender.toString() === userId && conn.receiver.toString() === req.user._id.toString())
    }));
    
    // Check Connection model for unique indexes
    let indexInfo = null;
    try {
      indexInfo = await Connection.collection.indexInformation();
    } catch (error) {
      console.error('[CONN DIAG] Error getting index information:', error);
    }
    
    // Build diagnostic response
    const diagnosticData = {
      success: true,
      userInfo,
      purposeFilter: purpose || 'any',
      directConnection: directConnection ? {
        id: directConnection._id,
        status: directConnection.status,
        purpose: directConnection.purpose,
        created_at: directConnection.created_at
      } : null,
      reverseConnection: reverseConnection ? {
        id: reverseConnection._id,
        status: reverseConnection.status,
        purpose: reverseConnection.purpose,
        created_at: reverseConnection.created_at
      } : null,
      relevantConnections: formattedConnections.filter(c => c.isBetweenTargetUsers),
      totalConnections: formattedConnections.length,
      allUserConnections: formattedConnections,
      indexInfo
    };
    
    // Add recommendation for next steps
    if (directConnection || reverseConnection) {
      diagnosticData.recommendation = 'Connection exists - use the existing connection';
    } else if (formattedConnections.length > 0) {
      diagnosticData.recommendation = 'No direct connection found, but users have other connections';
    } else {
      diagnosticData.recommendation = 'No connections found - should be able to create a new connection';
    }
    
    res.json(diagnosticData);
  } catch (error) {
    console.error('[CONN DIAG] Diagnostic error:', error);
    res.status(500).json({
      success: false,
      message: 'Error running connection diagnostic',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/connections/fix/:userId
 * @desc    Fix connection issues with a specific user
 * @access  Private
 */
router.put('/fix/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { purpose = 'general' } = req.body; // Get purpose from request body, default to 'general'
    
    // Log fix request
    console.log(`[CONN FIX] Fixing connection between ${req.user._id} and ${userId} with purpose '${purpose}'`);
    
    // Check if user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'Target user not found'
      });
    }
    
    // Step 1: Run cleanup to remove any duplicates
    console.log('[CONN FIX] Cleaning up duplicate connections');
    const cleanupResult = await Connection.cleanupDuplicates(req.user._id, userId);
    console.log('[CONN FIX] Cleanup result:', cleanupResult);
    
    // Step 2: Check if we have a valid connection now
    const existingConnection = await Connection.findOne({
      $or: [
        { sender: req.user._id, receiver: userId, purpose },
        { sender: userId, receiver: req.user._id, purpose }
      ]
    });
    
    // If a connection exists, return it
    if (existingConnection) {
      console.log('[CONN FIX] Found existing connection after cleanup:', existingConnection._id);
      const isRequester = existingConnection.sender.toString() === req.user._id.toString();
      
      return res.json({
        success: true,
        message: 'Connection fixed - existing connection found',
        connectionId: existingConnection._id,
        status: existingConnection.status,
        direction: isRequester ? 'outgoing' : 'incoming',
        connection: {
          id: existingConnection._id,
          sender: existingConnection.sender.toString(),
          receiver: existingConnection.receiver.toString(),
          status: existingConnection.status,
          created_at: existingConnection.created_at,
          purpose: existingConnection.purpose
        }
      });
    }
    
    // Step 3: If no connection, create a new one with force_unique
    console.log('[CONN FIX] No connection found, creating a new one');
    const timestamp = new Date().getTime();
    const newConnection = new Connection({
      sender: req.user._id,
      receiver: userId,
      status: 'pending',
      purpose,
      force_unique: timestamp
    });
    
    await newConnection.save();
    console.log('[CONN FIX] Created new connection:', newConnection._id);
    
    return res.json({
      success: true,
      message: 'Connection fixed - created new connection',
      connectionId: newConnection._id,
      status: 'pending',
      direction: 'outgoing',
      connection: {
        id: newConnection._id,
        sender: newConnection.sender.toString(),
        receiver: newConnection.receiver.toString(),
        status: newConnection.status,
        created_at: newConnection.created_at,
        purpose: newConnection.purpose
      }
    });
  } catch (error) {
    console.error('[CONN FIX] Error fixing connection:', error);
    res.status(500).json({
      success: false,
      message: 'Error fixing connection',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/connections/fix/:userId
 * @desc    Fix declined connection requests by setting them to pending
 * @access  Private
 */
router.post('/fix/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify valid userId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    
    // Find connection between the two users regardless of status
    const connection = await Connection.findOne({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id }
      ]
    });
    
    if (!connection) {
      return res.status(404).json({ success: false, message: 'No connection found' });
    }
    
    // Debug logging
    console.log(`[CONN FIX] Found connection to fix:`, {
      id: connection._id,
      sender: connection.sender.toString(),
      receiver: connection.receiver.toString(),
      status: connection.status
    });
    
    // If it's in declined state, update it to pending
    if (connection.status === 'declined') {
      // Always make the user performing the fix the sender
      const needsRoleFlip = connection.sender.toString() !== req.user._id.toString();
      
      if (needsRoleFlip) {
        // Swap roles
        const origSender = connection.sender;
        connection.sender = connection.receiver;
        connection.receiver = origSender;
        console.log(`[CONN FIX] Swapped roles for connection ${connection._id}`);
      }
      
      // Set status to pending
      connection.status = 'pending';
      await connection.save();
      
      // Create notification for the connection request
      try {
        // Get sender info
        const sender = await User.findById(req.user._id, 'full_name username profile_picture');
        const senderName = sender.full_name || sender.username;
        const senderAvatar = sender.profile_picture || '/assets/images/user/blank-avatar.png';
        
        console.log('[NOTIFY] Creating database notification for fixed connection request to user', userId);
        const notification = await Notification.createFromConnectionRequest({
          userId: userId,
          connectionId: connection._id,
          senderId: req.user._id,
          senderName: senderName,
          senderAvatar: senderAvatar, 
          message: `${senderName} sent you a connection request`
        });
        console.log('[NOTIFY] Successfully created notification:', notification._id);
        
        // Send real-time notification via socket.io
        const io = req.app.get('io');
        if (io) {
          io.to(userId).emit('connection_request', {
            type: 'connection_request',
            connectionId: connection._id,
            senderId: req.user._id,
            senderName: senderName,
            senderAvatar: senderAvatar,
            message: `${senderName} sent you a connection request`,
            timestamp: new Date(),
            status: 'unread'
          });
        }
      } catch (notifyError) {
        console.error('[NOTIFY] Error creating notification for fixed connection:', notifyError);
      }
      
      return res.json({ 
        success: true, 
        message: 'Connection updated from declined to pending',
        connectionId: connection._id
      });
    }
    
    // If it's already in accepted or pending state, return current status
    return res.json({ 
      success: true, 
      message: `Connection already in ${connection.status} state`,
      connectionId: connection._id,
      status: connection.status
    });
    
  } catch (error) {
    console.error('Error fixing connection:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/connections/test-notification/:userId
 * @desc    Send a test notification to a specific user
 * @access  Private
 */
router.post('/test-notification/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Verify valid userId
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID format' });
    }
    
    // Check if target user exists
    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    console.log(`Sending test notification to user ${userId} from ${req.user._id}`);
    
    // Create a notification in the database
    const notification = await Notification.create({
      userId: userId,
      type: 'connection_request',
      title: 'Test Notification',
      message: 'This is a test notification for debugging',
      senderId: req.user._id,
      senderName: req.user.full_name || req.user.username,
      senderAvatar: req.user.profile_picture || '/assets/images/user/blank-avatar.png',
      status: 'unread',
      timestamp: new Date()
    });
    
    // Send real-time notification
    const io = req.app.get('io');
    if (io) {
      io.to(userId).emit('connection_request', {
        ...notification.toObject(),
        type: 'connection_request',
        message: 'This is a test notification for debugging',
        timestamp: new Date(),
        status: 'unread'
      });
      
      console.log(`Emitted test notification to user ${userId} via Socket.IO`);
    } else {
      console.warn('Socket.IO instance not available');
    }
    
    res.json({
      success: true,
      message: 'Test notification sent',
      notification: notification
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

module.exports = router; 