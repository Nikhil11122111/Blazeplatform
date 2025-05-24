const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { auth } = require('../middleware/auth');

// Get potential matches based on skills and interests
router.get('/potential', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    // Find users with similar skills or interests
    const potentialMatches = await User.find({
      _id: { $ne: req.user._id },
      $or: [
        { technical_skills: { $in: currentUser.technical_skills } },
        { my_interests: { $in: currentUser.my_interests } },
        { interests_looking_in_others: { $in: currentUser.interests_looking_in_others } }
      ],
      connections: { $ne: req.user._id },
      pendingConnections: { $ne: req.user._id }
    })
    .select('-password_hash')
    .limit(20);

    res.json(potentialMatches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get matches based on major and year of study
router.get('/by-major', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    const matches = await User.find({
      _id: { $ne: req.user._id },
      'major_category.value': currentUser.major_category.value,
      'year_of_study.value': currentUser.year_of_study.value,
      connections: { $ne: req.user._id },
      pendingConnections: { $ne: req.user._id }
    })
    .select('-password_hash')
    .limit(20);

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get matches by location
router.get('/by-location', auth, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user._id);
    
    const matches = await User.find({
      _id: { $ne: req.user._id },
      'state.value': currentUser.state.value,
      'city.value': currentUser.city.value,
      connections: { $ne: req.user._id },
      pendingConnections: { $ne: req.user._id }
    })
    .select('-password_hash')
    .limit(20);

    res.json(matches);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get all matches (connected users)
router.get('/connected', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('connections', '-password_hash');
    
    res.json(user.connections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get pending connection requests
router.get('/pending', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('pendingConnections', '-password_hash');
    
    res.json(user.pendingConnections);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router; 