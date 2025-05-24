const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: ['connection_request', 'message', 'system', 'other'],
    default: 'system'
  },
  title: {
    type: String
  },
  message: {
    type: String,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['read', 'unread'],
    default: 'unread'
  },
  // For connection requests
  connectionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Connection'
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  senderName: {
    type: String
  },
  senderAvatar: {
    type: String
  },
  // Additional metadata (optional)
  metadata: {
    type: Object,
    default: {}
  },
  // URL to navigate to when clicked
  url: {
    type: String
  }
}, {
  timestamps: {
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Add indexes for better performance
notificationSchema.index({ userId: 1, status: 1 });
notificationSchema.index({ timestamp: -1 });

/**
 * Create a new notification from a connection request event
 */
notificationSchema.statics.createFromConnectionRequest = async function(data) {
  try {
    const { type, connectionId, senderId, senderName, message, userId } = data;
    
    // Create and save the notification
    const notification = new this({
      userId,
      type: 'connection_request',
      title: 'Connection Request',
      message,
      connectionId,
      sender: senderId, // Set the sender field for population
      senderId,
      senderName,
      senderAvatar: data.senderAvatar || null,
      status: 'unread',
      url: '/connections?tab=pending'
    });
    
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Error creating notification from connection request:', error);
    throw error;
  }
};

/**
 * Mark notifications as read
 */
notificationSchema.statics.markAsRead = async function(userId, notificationIds) {
  try {
    // If notificationIds is provided, mark specific notifications as read
    if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      return await this.updateMany(
        { userId, _id: { $in: notificationIds } },
        { $set: { status: 'read' } }
      );
    }
    // Otherwise mark all notifications as read
    return await this.updateMany(
      { userId, status: 'unread' },
      { $set: { status: 'read' } }
    );
  } catch (error) {
    console.error('Error marking notifications as read:', error);
    throw error;
  }
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification; 