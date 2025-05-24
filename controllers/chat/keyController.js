const UserKey = require('../../models/chat/UserKey');
const { calculateFingerprint } = require('../../utils/encryptionUtils');

// Register a new public key for a user
exports.registerPublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user._id;
    
    // Enhanced validation
    if (!publicKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Public key is required'
      });
    }
    
    // Additional validation for key format - basic check
    if (typeof publicKey !== 'string' || publicKey.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Invalid public key format'
      });
    }
    
    console.log(`Registering public key for user ${userId}`);
    
    // Calculate the key fingerprint for verification
    try {
      var fingerprint = calculateFingerprint(publicKey);
      console.log(`Generated fingerprint: ${fingerprint}`);
    } catch (fingerprintError) {
      console.error('Error calculating fingerprint:', fingerprintError);
      return res.status(400).json({
        success: false,
        message: 'Invalid key format - unable to calculate fingerprint'
      });
    }
    
    // Register the public key
    try {
      const userKey = await UserKey.registerPublicKey(userId, publicKey, fingerprint);
      
      res.status(201).json({
        success: true,
        message: 'Public key registered successfully',
        data: {
          fingerprint: userKey.fingerprint,
          lastRotated: userKey.lastRotated
        }
      });
    } catch (dbError) {
      console.error('Database error registering key:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Database error while registering key',
        error: dbError.message
      });
    }
  } catch (error) {
    console.error('Error registering public key:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to register public key', 
      error: error.message 
    });
  }
};

// Retrieve a user's public key
exports.getPublicKey = async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`Getting public key for user ID: ${userId}`);
    
    // Input validation
    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid user ID format' 
      });
    }
    
    // Find the user's active public key
    const userKey = await UserKey.getPublicKey(userId);
    
    if (!userKey) {
      console.log(`Public key not found for user ${userId}`);
      return res.status(404).json({ 
        success: false, 
        message: 'Public key not found for this user',
        errorCode: 'KEY_NOT_FOUND' 
      });
    }
    
    console.log(`Retrieved public key for user ${userId}, fingerprint: ${userKey.fingerprint}`);
    
    res.status(200).json({
      success: true,
      data: {
        userId: userKey.userId,
        publicKey: userKey.publicKey,
        fingerprint: userKey.fingerprint,
        lastRotated: userKey.lastRotated
      }
    });
  } catch (error) {
    console.error(`Error retrieving public key for ${req.params.userId}:`, error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve public key', 
      error: error.message 
    });
  }
};

// Verify a fingerprint against the stored public key
exports.verifyFingerprint = async (req, res) => {
  try {
    const { userId, fingerprint } = req.body;
    
    // Validate input
    if (!userId || !fingerprint) {
      return res.status(400).json({ success: false, message: 'User ID and fingerprint are required' });
    }
    
    // Verify fingerprint
    const isValid = await UserKey.validateFingerprint(userId, fingerprint);
    
    res.status(200).json({
      success: true,
      data: {
        isValid
      }
    });
  } catch (error) {
    console.error('Error verifying fingerprint:', error);
    res.status(500).json({ success: false, message: 'Failed to verify fingerprint', error: error.message });
  }
};

// Rotate a user's public key (create a new one)
exports.rotatePublicKey = async (req, res) => {
  try {
    const { publicKey } = req.body;
    const userId = req.user._id;
    
    // Validate input
    if (!publicKey) {
      return res.status(400).json({ success: false, message: 'New public key is required' });
    }
    
    // Calculate the key fingerprint
    const fingerprint = calculateFingerprint(publicKey);
    
    // Register the new public key
    const userKey = await UserKey.registerPublicKey(userId, publicKey, fingerprint);
    
    res.status(200).json({
      success: true,
      message: 'Public key rotated successfully',
      data: {
        fingerprint: userKey.fingerprint,
        lastRotated: userKey.lastRotated
      }
    });
  } catch (error) {
    console.error('Error rotating public key:', error);
    res.status(500).json({ success: false, message: 'Failed to rotate public key', error: error.message });
  }
}; 