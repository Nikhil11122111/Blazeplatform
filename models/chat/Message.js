const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The plaintext content (for simplified mode)
  content: {
    type: String,
    required: false
  },
  // The encrypted message content (for secure mode)
  encryptedContent: {
    type: String,
    required: false
  },
  // The encrypted symmetric key (optional for simplified mode)
  encryptedKey: {
    type: String,
    required: false
  },
  // Initialization vector for encryption (optional for simplified mode)
  iv: {
    type: String,
    required: false
  },
  // Type of message (text, file, etc.)
  messageType: {
    type: String,
    enum: ['text', 'image', 'file', 'emoji'],
    default: 'text'
  },
  // If the message is a file, store its details
  fileMetadata: {
    fileName: String,
    fileSize: Number,
    filePath: String,
    mimeType: String
  },
  // Delivery status tracking
  status: {
    delivered: {
      type: Boolean,
      default: false
    },
    deliveredAt: Date,
    read: {
      type: Boolean,
      default: false
    },
    readAt: Date
  },
  // Message metadata - keep this in plaintext for filtering/searching
  metadata: {
    conversationId: String,
    clientGeneratedId: String,  // Client-side UUID to prevent duplicates
    simplified: {
      type: Boolean,
      default: false
    } // Flag for simplified mode (unencrypted)
  },
  // Track if message is deleted (soft delete)
  isDeleted: {
    type: Boolean,
    default: false
  },
  // Track if message has been edited
  isEdited: {
    type: Boolean,
    default: false
  },
  // Store when the message was last edited
  editedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Custom validation to ensure either content or encryptedContent is provided
MessageSchema.pre('validate', function(next) {
  if (!this.content && !this.encryptedContent) {
    this.invalidate('content', 'Either content or encryptedContent must be provided');
  }
  next();
});

// Create indexes for fast lookups
MessageSchema.index({ senderId: 1, receiverId: 1 });
MessageSchema.index({ 'metadata.conversationId': 1 });
MessageSchema.index({ createdAt: -1 });

// Method to get conversation between two users
MessageSchema.statics.getConversation = async function(userId1, userId2, limit = 50, offset = 0) {
  // Ensure we search in both directions (sender/receiver)
  return this.find({
    $or: [
      { senderId: userId1, receiverId: userId2, isDeleted: false },
      { senderId: userId2, receiverId: userId1, isDeleted: false }
    ]
  })
  .sort({ createdAt: -1 })
  .skip(offset)
  .limit(limit);
};

// Method to mark messages as delivered
MessageSchema.statics.markAsDelivered = async function(userId, senderId) {
  const now = new Date();
  return this.updateMany(
    { 
      senderId: senderId,
      receiverId: userId,
      'status.delivered': false
    },
    {
      $set: {
        'status.delivered': true,
        'status.deliveredAt': now
      }
    }
  );
};

// Method to mark messages as read
MessageSchema.statics.markAsRead = async function(userId, senderId) {
  const now = new Date();
  return this.updateMany(
    { 
      senderId: senderId,
      receiverId: userId,
      'status.read': false
    },
    {
      $set: {
        'status.read': true,
        'status.readAt': now
      }
    }
  );
};

module.exports = mongoose.model('Message', MessageSchema); 