const mongoose = require('mongoose');

const connectionSchema = new mongoose.Schema({
  // The user who initiated the connection request
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // The user who received the connection request
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Status of the connection: pending, accepted, declined
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending'
  },
  // Purpose of the connection request (e.g. 'general', 'project', 'team')
  // This allows multiple connection types between the same users
  purpose: {
    type: String,
    default: 'general'
  },
  // Timestamps for different status changes
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: null
  },
  accepted_at: {
    type: Date,
    default: null
  },
  // Special field to allow bypassing the unique constraint in edge cases
  // This helps when a connection is detected as duplicate but cannot be found
  force_unique: {
    type: Number,
    default: 0,
    select: false // Don't include in query results by default
  }
}, {
  timestamps: { 
    createdAt: 'created_at',
    updatedAt: 'updated_at'
  }
});

// Create a compound index that includes purpose and force_unique
// This allows multiple connections between same users if they have different purposes
connectionSchema.index({ sender: 1, receiver: 1, purpose: 1, force_unique: 1 }, { unique: true });

// Add pre-save hook to ensure created_at is always set
connectionSchema.pre('save', function(next) {
  if (!this.created_at) {
    this.created_at = new Date();
  }
  if (this.isNew) {
    console.log(`[CONN MODEL] Creating new connection: sender=${this.sender}, receiver=${this.receiver}, force_unique=${this.force_unique || 0}`);
  }
  next();
});

// Method to check if users are connected
connectionSchema.statics.areConnected = async function(userId1, userId2) {
  const connection = await this.findOne({
    $or: [
      { sender: userId1, receiver: userId2, status: 'accepted' },
      { sender: userId2, receiver: userId1, status: 'accepted' }
    ]
  });
  return !!connection;
};

// Method to get connection status between two users
connectionSchema.statics.getConnectionStatus = async function(userId1, userId2) {
  const connection = await this.findOne({
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ]
  });
  
  if (!connection) return 'none';
  return connection.status;
};

// Add cleanup method to remove duplicate connections
connectionSchema.statics.cleanupDuplicates = async function(userId1, userId2, purpose) {
  try {
    // Build base query
    const query = {
      $or: [
        { sender: userId1, receiver: userId2 },
        { sender: userId2, receiver: userId1 }
      ]
    };
    
    // Add purpose filter if provided
    if (purpose) {
      query.$or[0].purpose = purpose;
      query.$or[1].purpose = purpose;
    }
    
    // Find all connections between these users
    const connections = await this.find(query).sort({ created_at: -1 });
    
    if (connections.length <= 1) {
      return { success: true, message: 'No duplicates found' };
    }
    
    // Keep the newest connection, delete the rest
    const toKeep = connections[0];
    const toDelete = connections.slice(1).map(c => c._id);
    
    console.log(`[CONN MODEL] Cleaning up ${toDelete.length} duplicate connections between ${userId1} and ${userId2}${purpose ? ` with purpose '${purpose}'` : ''}`);
    
    if (toDelete.length > 0) {
      await this.deleteMany({ _id: { $in: toDelete } });
    }
    
    return {
      success: true,
      message: `Removed ${toDelete.length} duplicate connections`,
      keptConnection: toKeep._id
    };
  } catch (err) {
    console.error('[CONN MODEL] Error in cleanup:', err);
    return { success: false, error: err.message };
  }
};

const Connection = mongoose.model('Connection', connectionSchema);
module.exports = Connection; 