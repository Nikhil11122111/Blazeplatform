const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const Notification = require('../models/Notification');
const Connection = require('../models/Connection');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for the current user
 * @access  Private
 */
router.get('/', auth, async (req, res) => {
  try {
    console.log('Getting notifications for user:', req.user._id);
    
    // Get all notifications for the current user with populated sender field
    const notifications = await Notification.find({
      userId: req.user._id
    })
    .populate('sender', 'full_name username email profile_picture')
    .sort({ timestamp: -1 }); // Sort by timestamp, newest first
    
    console.log(`Found ${notifications.length} notifications for user ${req.user._id}`);
    
    // Log the first few notifications for debugging
    if (notifications.length > 0) {
      console.log('Latest notification details:', {
        id: notifications[0]._id,
        type: notifications[0].type,
        status: notifications[0].status,
        title: notifications[0].title,
        senderId: notifications[0].sender ? notifications[0].sender._id : 'none',
        senderName: notifications[0].sender ? (notifications[0].sender.full_name || notifications[0].sender.username) : 'Unknown',
        timestamp: notifications[0].timestamp || notifications[0].created_at
      });
      
      // Log notification structure for troubleshooting
      console.log('Notification data structure:', JSON.stringify({
        ...notifications[0].toObject(),
        // Only include relevant sender fields to avoid large logs
        sender: notifications[0].sender ? {
          _id: notifications[0].sender._id,
          name: notifications[0].sender.full_name || notifications[0].sender.username,
          email: notifications[0].sender.email
        } : null
      }, null, 2));
    }
    
    // Return notifications array
    res.json(notifications);
  } catch (err) {
    console.error('Error getting notifications:', err.message);
    res.status(500).json({ message: 'Server error getting notifications' });
  }
});

/**
 * @route   POST /api/notifications/mark-read
 * @desc    Mark notifications as read
 * @access  Private
 */
router.post('/mark-read', auth, async (req, res) => {
  try {
    const { notificationIds } = req.body;
    
    // Mark specific notifications or all as read
    await Notification.markAsRead(req.user._id, notificationIds);
    
    res.json({ success: true, message: 'Notifications marked as read' });
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/read-all
 * @desc    Mark all notifications as read for the current user
 * @access  Private
 */
router.put('/read-all', auth, async (req, res) => {
  try {
    console.log('Marking all notifications as read for user:', req.user._id);
    
    // First get a count of unread notifications for logging
    const unreadCount = await Notification.countDocuments({ 
      userId: req.user._id, 
      status: 'unread'
    });
    
    console.log(`Found ${unreadCount} unread notifications to mark as read`);
    
    // Mark all notifications as read for this user
    const result = await Notification.updateMany(
      { userId: req.user._id, status: 'unread' },
      { $set: { status: 'read', read: true, readAt: new Date() } }
    );
    
    console.log('Update result:', result);
    
    // Verify the update was successful
    const remainingUnread = await Notification.countDocuments({ 
      userId: req.user._id, 
      status: 'unread'
    });
    
    if (remainingUnread > 0) {
      console.warn(`Warning: ${remainingUnread} notifications still marked as unread after update`);
    } else {
      console.log('All notifications successfully marked as read');
    }
    
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      markedCount: result.modifiedCount,
      totalMatched: result.matchedCount,
      remainingUnread
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/read/all
 * @desc    Alternative route to mark all notifications as read (for compatibility)
 * @access  Private
 */
router.put('/read/all', auth, async (req, res) => {
  try {
    console.log('Alternative route: Marking all notifications as read for user:', req.user._id);
    
    // Mark all notifications as read for this user
    const result = await Notification.updateMany(
      { userId: req.user._id, status: 'unread' },
      { $set: { status: 'read', read: true, readAt: new Date() } }
    );
    
    console.log('Alternative route update result:', result);
    
    res.json({ 
      success: true, 
      message: 'All notifications marked as read',
      markedCount: result.modifiedCount,
      totalMatched: result.matchedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read (alt route):', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications/clear-all
 * @desc    Delete all notifications for the current user
 * @access  Private
 */
router.delete('/clear-all', auth, async (req, res) => {
  try {
    console.log('Clearing all notifications for user:', req.user._id);
    
    // Delete all notifications for this user
    const result = await Notification.deleteMany({ userId: req.user._id });
    
    res.json({ 
      success: true, 
      message: 'All notifications cleared',
      count: result.deletedCount
    });
  } catch (error) {
    console.error('Error clearing all notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/notifications/connection-request
 * @desc    Create a notification for a connection request (for testing)
 * @access  Private
 */
router.post('/connection-request', auth, async (req, res) => {
  try {
    const { connectionId, receiverId } = req.body;
    
    // Validate required fields
    if (!connectionId || !receiverId) {
      return res.status(400).json({ message: 'Connection ID and receiver ID are required' });
    }
    
    // Check if connection exists
    const connection = await Connection.findById(connectionId)
      .populate('sender', 'full_name username profile_picture');
    
    if (!connection) {
      return res.status(404).json({ message: 'Connection not found' });
    }
    
    // Create notification
    const notification = await Notification.createFromConnectionRequest({
      userId: receiverId,
      connectionId: connection._id,
      senderId: connection.sender._id,
      senderName: connection.sender.full_name || connection.sender.username,
      senderAvatar: connection.sender.profile_picture || null,
      message: `${connection.sender.full_name || connection.sender.username} sent you a connection request`
    });
    
    // Emit real-time notification if socket is available
    const io = req.app.get('io');
    if (io) {
      io.to(receiverId).emit('connection_request', {
        ...notification.toObject(),
        type: 'connection_request',
        timestamp: new Date(),
        status: 'unread'
      });
    }
    
    res.json({ success: true, notification });
  } catch (error) {
    console.error('Error creating connection request notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications
 * @desc    Delete all notifications for a user
 * @access  Private
 */
router.delete('/', auth, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user._id });
    res.json({ success: true, message: 'All notifications deleted' });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   DELETE /api/notifications/:id
 * @desc    Delete a specific notification
 * @access  Private
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    
    res.json({ success: true, message: 'Notification deleted' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/notifications/test
 * @desc    Create a test notification for debugging
 * @access  Private
 */
router.post('/test', auth, async (req, res) => {
  try {
    const userId = req.user._id;
    const message = req.body.message || 'This is a test notification';
    
    console.log('Creating test notification for user:', userId);
    
    // Create a simple notification
    const notification = new Notification({
      userId,
      type: 'system',
      title: 'Test Notification',
      message,
      sender: userId, // Set self as sender for test
      senderId: userId, // Set self as sender for test
      senderName: req.user.full_name || req.user.username || 'Test User',
      status: 'unread',
      url: '#'
    });
    
    await notification.save();
    console.log('Test notification created:', notification._id);
    
    // Try to emit via socket if available
    if (req.app.io) {
      req.app.io.to(userId.toString()).emit('notification', notification);
      console.log('Emitted test notification via Socket.IO');
    }
    
    res.json({ 
      success: true, 
      message: 'Test notification created',
      notification 
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   PUT /api/notifications/fix-status
 * @desc    Fix inconsistent notification statuses for the current user
 * @access  Private
 */
router.put('/fix-status', auth, async (req, res) => {
  try {
    console.log('Fixing inconsistent notification statuses for user:', req.user._id);
    
    // 1. Find notifications with inconsistent status
    const inconsistentStatus = await Notification.find({
      userId: req.user._id,
      $or: [
        // Case 1: status is 'read' but read flag is false
        { status: 'read', read: false },
        // Case 2: status is 'unread' but read flag is true
        { status: 'unread', read: true }
      ]
    });
    
    console.log(`Found ${inconsistentStatus.length} notifications with inconsistent status fields`);
    
    // 2. Fix notifications with read: true but status: 'unread'
    const fixReadResult = await Notification.updateMany(
      { userId: req.user._id, read: true, status: 'unread' },
      { $set: { status: 'read' } }
    );
    
    // 3. Fix notifications with read: false but status: 'read'
    const fixUnreadResult = await Notification.updateMany(
      { userId: req.user._id, read: false, status: 'read' },
      { $set: { read: true } }
    );
    
    // 4. Check if any notifications still have null or undefined read field
    const fixMissingReadResult = await Notification.updateMany(
      { userId: req.user._id, read: { $exists: false } },
      { $set: { read: true, status: 'read' } }
    );
    
    // 5. Check if any notifications still have null or undefined status field
    const fixMissingStatusResult = await Notification.updateMany(
      { userId: req.user._id, status: { $exists: false } },
      { $set: { status: 'read', read: true } }
    );
    
    // Verify the fixes
    const stillInconsistent = await Notification.countDocuments({
      userId: req.user._id,
      $or: [
        { status: 'read', read: false },
        { status: 'unread', read: true }
      ]
    });
    
    console.log('Fix results:', {
      readFixed: fixReadResult.modifiedCount,
      unreadFixed: fixUnreadResult.modifiedCount,
      missingReadFixed: fixMissingReadResult.modifiedCount,
      missingStatusFixed: fixMissingStatusResult.modifiedCount,
      stillInconsistent
    });
    
    res.json({
      success: true,
      message: 'Notification statuses fixed',
      readFixed: fixReadResult.modifiedCount,
      unreadFixed: fixUnreadResult.modifiedCount,
      missingReadFixed: fixMissingReadResult.modifiedCount,
      missingStatusFixed: fixMissingStatusResult.modifiedCount,
      stillInconsistent,
      initialInconsistentCount: inconsistentStatus.length
    });
  } catch (error) {
    console.error('Error fixing notification statuses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/notifications/mark-all-read
 * @desc    POST route for marking all notifications as read (for clients that can't use PUT)
 * @access  Private
 */
router.post('/mark-all-read', auth, async (req, res) => {
  try {
    console.log('POST route: Marking all notifications as read for user:', req.user._id);
    
    // Mark all notifications as read for this user
    const result = await Notification.updateMany(
      { userId: req.user._id, status: 'unread' },
      { $set: { status: 'read', read: true, readAt: new Date() } }
    );
    
    console.log('POST route update result:', result);
    
    res.json({ 
      success: true, 
      message: 'All notifications marked as read via POST',
      markedCount: result.modifiedCount,
      totalMatched: result.matchedCount
    });
  } catch (error) {
    console.error('Error marking all notifications as read (POST route):', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router; 