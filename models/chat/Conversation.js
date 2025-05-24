const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
  // The two users in this conversation (always sorted for consistency)
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  // Unique conversation ID composed of both user IDs (for easy lookup)
  conversationId: {
    type: String,
    required: true,
    unique: true
  },
  // Most recent message details (for preview)
  lastMessage: {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    encryptedPreview: String, // Encrypted preview text
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'emoji'],
      default: 'text'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  },
  // Count of unread messages for each participant
  unreadCount: {
    type: Map,
    of: Number,
    default: {}
  },
  // Track if conversation is deleted for each user (soft delete)
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, { timestamps: true });

// Create indexes for fast lookups
ConversationSchema.index({ participants: 1 });
ConversationSchema.index({ conversationId: 1 }, { unique: true });
ConversationSchema.index({ 'lastMessage.timestamp': -1 });

// Generate a unique conversation ID for two users
ConversationSchema.statics.generateConversationId = function(userId1, userId2) {
  // Sort IDs to ensure the same ID regardless of order
  const sortedIds = [userId1.toString(), userId2.toString()].sort();
  return `${sortedIds[0]}_${sortedIds[1]}`;
};

// Find or create a conversation between two users
ConversationSchema.statics.findOrCreateConversation = async function(userId1, userId2) {
  const conversationId = this.generateConversationId(userId1, userId2);
  
  let conversation = await this.findOne({ conversationId });
  
  if (!conversation) {
    conversation = await this.create({
      participants: [userId1, userId2],
      conversationId,
      unreadCount: {
        [userId1.toString()]: 0,
        [userId2.toString()]: 0
      }
    });
  }
  
  return conversation;
};

// Update the last message in a conversation
ConversationSchema.statics.updateLastMessage = async function(conversationId, message) {
  return this.findOneAndUpdate(
    { conversationId },
    {
      lastMessage: {
        senderId: message.senderId,
        encryptedPreview: message.encryptedContent.substring(0, 100), // Store first 100 chars
        messageType: message.messageType,
        timestamp: message.createdAt || new Date()
      },
      $inc: {
        [`unreadCount.${message.receiverId}`]: 1
      }
    },
    { new: true }
  );
};

// Get user's conversations
ConversationSchema.statics.getConversationsForUser = async function(userId) {
  return this.find({
    participants: userId,
    deletedFor: { $ne: userId }
  })
  .sort({ 'lastMessage.timestamp': -1 })
  .populate('participants', 'fullName email username profile_picture')
  .exec();
};

// Mark conversation as read for a user
ConversationSchema.statics.markAsRead = async function(conversationId, userId) {
  return this.findOneAndUpdate(
    { conversationId },
    {
      $set: {
        [`unreadCount.${userId}`]: 0
      }
    }
  );
};

module.exports = mongoose.model('Conversation', ConversationSchema); 