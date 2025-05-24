const mongoose = require('mongoose');

const UserKeySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  // The user's public key for E2E encryption
  publicKey: {
    type: String,
    required: true
  },
  // The key's fingerprint (hash of the public key) for verification
  fingerprint: {
    type: String,
    required: true
  },
  // When the key was last rotated/updated
  lastRotated: {
    type: Date,
    default: Date.now
  },
  // If the key is currently active
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

// Create indexes for fast lookups
UserKeySchema.index({ userId: 1 }, { unique: true });
UserKeySchema.index({ fingerprint: 1 });

// Get a user's active public key
UserKeySchema.statics.getPublicKey = async function(userId) {
  return this.findOne({ userId, isActive: true });
};

// Register or update a user's public key
UserKeySchema.statics.registerPublicKey = async function(userId, publicKey, fingerprint) {
  return this.findOneAndUpdate(
    { userId },
    {
      publicKey,
      fingerprint,
      lastRotated: new Date(),
      isActive: true
    },
    { upsert: true, new: true }
  );
};

// Validate if the fingerprint matches for a user's key
UserKeySchema.statics.validateFingerprint = async function(userId, fingerprint) {
  const userKey = await this.findOne({ userId, isActive: true });
  if (!userKey) return false;
  
  return userKey.fingerprint === fingerprint;
};

module.exports = mongoose.model('UserKey', UserKeySchema); 