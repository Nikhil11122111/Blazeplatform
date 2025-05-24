const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');
const userController = require('../controllers/userController');

// Search users by fullname, email, or username
router.get('/search', auth, async (req, res) => {
  try {
    const query = req.query.q || '';
    if (query.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
    }

    // Search in full_name, username, and email fields
    const users = await User.find({
      $or: [
        { full_name: { $regex: query, $options: 'i' } },
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } }
      ],
      _id: { $ne: req.user._id } // Exclude current user
    }).select('_id full_name username email profile_picture');

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching users',
      error: error.message
    });
  }
});

// Get all users (for profile suggestions)
router.get('/', async (req, res) => {
  try {
    // Find all users excluding those with privateMode enabled
    const users = await User.find({ 
      privateMode: { $ne: true } // Exclude users with privateMode enabled
    })
      .select('-password_hash -resetPasswordToken -resetPasswordExpires -otp -verification_token -__v')
      .limit(50); // Limit to 50 users for performance
    
    console.log(`Returning ${users.length} users with profile pictures`);
    
    // Log profile picture paths to help debug
    users.forEach(user => {
      console.log(`User ${user._id} (${user.full_name || 'Unknown'}): profile_picture = "${user.profile_picture || 'none'}"`);
    });
    
    res.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: error.message });
  }
});

// Get user profile by ID - Note: This route should be last to avoid conflicts with the other routes
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update user profile
router.patch('/profile', auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowedUpdates = ['name', 'skills', 'interests', 'bio', 'profilePicture'];
  const isValidOperation = updates.every(update => allowedUpdates.includes(update));

  if (!isValidOperation) {
    return res.status(400).json({ message: 'Invalid updates' });
  }

  try {
    updates.forEach(update => req.user[update] = req.body[update]);
    await req.user.save();
    res.json(req.user);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Send connection request
router.post('/connect/:id', auth, async (req, res) => {
  try {
    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.connections.includes(req.user._id)) {
      return res.status(400).json({ message: 'Already connected' });
    }

    if (targetUser.pendingConnections.includes(req.user._id)) {
      return res.status(400).json({ message: 'Connection request already sent' });
    }

    targetUser.pendingConnections.push(req.user._id);
    await targetUser.save();

    res.json({ message: 'Connection request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Accept connection request
router.post('/accept/:id', auth, async (req, res) => {
  try {
    const requestingUser = await User.findById(req.params.id);
    if (!requestingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (!req.user.pendingConnections.includes(requestingUser._id)) {
      return res.status(400).json({ message: 'No pending connection request' });
    }

    // Remove from pending connections
    req.user.pendingConnections = req.user.pendingConnections.filter(
      id => id.toString() !== requestingUser._id.toString()
    );

    // Add to connections for both users
    req.user.connections.push(requestingUser._id);
    requestingUser.connections.push(req.user._id);

    await req.user.save();
    await requestingUser.save();

    res.json({ message: 'Connection accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get potential matches
router.get('/matches/potential', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Find users with similar skills or interests
    const potentialMatches = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { skills: { $in: currentUser.skills } },
        { interests: { $in: currentUser.interests } }
      ],
      connections: { $ne: req.user._id },
      pendingConnections: { $ne: req.user._id }
    }).select('-password_hash');

    res.json(potentialMatches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route   GET /api/users/preferences/theme
 * @desc    Get user theme preferences
 * @access  Private
 */
router.get('/preferences/theme', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Return theme preferences or defaults
    res.json({
      theme: user.preferences?.theme || 'light',
      rtl: user.preferences?.rtl || false,
      boxed: user.preferences?.boxed || false,
      container: user.preferences?.container || false,
      captionShow: user.preferences?.captionShow || true,
      preset: user.preferences?.preset || 'preset-5'
    });
  } catch (error) {
    console.error('Error fetching theme preferences:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

/**
 * @route   POST /api/users/preferences/theme
 * @desc    Update user theme preferences
 * @access  Private
 */
router.post('/preferences/theme', auth, async (req, res) => {
  try {
    const { theme, rtl, boxed, container, captionShow, preset } = req.body;
    
    // Find user and update preferences
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize preferences object if it doesn't exist
    if (!user.preferences) {
      user.preferences = {};
    }
    
    // Update theme preferences
    if (theme !== undefined) user.preferences.theme = theme;
    if (rtl !== undefined) user.preferences.rtl = rtl;
    if (boxed !== undefined) user.preferences.boxed = boxed;
    if (container !== undefined) user.preferences.container = container;
    if (captionShow !== undefined) user.preferences.captionShow = captionShow;
    if (preset !== undefined) user.preferences.preset = preset;
    
    await user.save();
    
    res.json({
      success: true,
      message: 'Theme preferences updated successfully',
      preferences: user.preferences
    });
  } catch (error) {
    console.error('Error updating theme preferences:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// User registration
router.post('/register', userController.register);

// Login
router.post('/login', userController.login);

// Email verification
router.get('/verify-email', userController.verifyEmail);

// Send verification email
router.post('/send-verification', userController.sendVerificationEmail);

// Forgot password - request reset
router.post('/forgot-password', userController.forgotPassword);

// Reset password with token
router.post('/reset-password', userController.resetPassword);

// Get current user
router.get('/me', auth, userController.getCurrentUser);

// Update user profile
router.put('/profile', auth, userController.updateProfile);

// Change password
router.put('/change-password', auth, userController.changePassword);

// Logout
router.post('/logout', auth, userController.logout);

// Get user by ID
router.get('/:id', auth, userController.getUserById);

// Update avatar
router.post('/avatar', auth, userController.updateAvatar);

// Save resume
router.post('/resume', auth, userController.saveResume);

/**
 * @route   GET /api/users/profile/privacy-settings
 * @desc    Get user privacy settings
 * @access  Private
 */
router.get('/profile/privacy-settings', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Return privacy settings
    res.json({
      success: true,
      privateMode: user.privateMode !== undefined ? user.privateMode : false
    });
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

/**
 * @route   POST /api/users/profile/privacy-settings
 * @desc    Update user privacy settings
 * @access  Private
 */
router.post('/profile/privacy-settings', auth, async (req, res) => {
  try {
    const { privateMode } = req.body;
    
    if (typeof privateMode !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'Invalid input: privateMode must be a boolean'
      });
    }
    
    // Find user and update privacy settings
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found' 
      });
    }
    
    // Update privacy settings
    user.privateMode = privateMode;
    await user.save();
    
    res.json({
      success: true,
      message: 'Privacy settings updated successfully',
      privateMode: user.privateMode
    });
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error',
      error: error.message 
    });
  }
});

module.exports = router; 