const express = require('express');
const router = express.Router();
const { auth } = require('../middleware/auth');
const User = require('../models/User');

/**
 * @route   GET /api/user/preferences/theme/:userId
 * @desc    Get user theme preferences
 * @access  Private
 */
router.get('/theme/:userId', auth, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Verify the user is requesting their own preferences or is an admin
    if (req.user._id.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({ message: 'Not authorized to access these preferences' });
    }
    
    const user = await User.findById(userId).select('preferences');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // If user has no preferences yet, return default
    if (!user.preferences || !user.preferences.theme) {
      return res.json({ theme: 'light' });
    }
    
    return res.json({ theme: user.preferences.theme });
  } catch (error) {
    console.error('Error getting theme preferences:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

/**
 * @route   POST /api/user/preferences/theme
 * @desc    Update user theme preferences
 * @access  Private
 */
router.post('/theme', auth, async (req, res) => {
  try {
    const { theme } = req.body;
    
    // Validate theme value
    if (!theme || !['light', 'dark', 'system'].includes(theme)) {
      return res.status(400).json({ message: 'Invalid theme value. Must be light, dark, or system' });
    }
    
    // Update user preferences
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Initialize preferences object if it doesn't exist
    if (!user.preferences) {
      user.preferences = {};
    }
    
    // Set theme preference
    user.preferences.theme = theme;
    
    // Save the updated user document
    await user.save();
    
    return res.json({ 
      success: true, 
      message: 'Theme preferences updated',
      theme 
    });
  } catch (error) {
    console.error('Error updating theme preferences:', error);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 