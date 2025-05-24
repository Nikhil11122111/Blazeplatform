const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { auth, preventAuthAccess } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const { sendVerificationEmail, sendOTPEmail, sendPasswordResetEmail } = require('../utils/emailService');
const bcrypt = require('bcryptjs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fileType = file.fieldname === 'profile_picture' ? 'profile_pics' : 'resumes';
    cb(null, `uploads/${fileType}`);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profile_picture') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed for profile picture'));
      }
    } else if (file.fieldname === 'resume') {
      if (file.mimetype !== 'application/pdf') {
        return cb(new Error('Only PDF files are allowed for resume'));
      }
    }
    cb(null, true);
  }
});

// Generate OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Register - Initial registration with mandatory fields
router.post('/register', preventAuthAccess, async (req, res) => {
  try {
    const { full_name, username, email, password_hash, confirm_password } = req.body;
    
    // Validate password match
    if (password_hash !== confirm_password) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        message: existingUser.email === email ? 
          'Email already registered' : 
          'Username already taken' 
      });
    }

    // Generate verification token
    const verification_token = crypto.randomBytes(32).toString('hex');

    // Create new user with mandatory fields
    const user = new User({
      full_name,
      username,
      email,
      password_hash,
      verification_token
    });

    await user.save();

    // Send verification email
    await sendVerificationEmail(email, verification_token);

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(201).json({ 
      user: {
        _id: user._id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        verification_status: user.verification_status
      }, 
      token,
      message: 'Registration successful. Please check your email for verification link.'
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Verify email with token
router.get('/verify-email', preventAuthAccess, async (req, res) => {
  try {
    const token = req.query.token;
    
    if (!token) {
      console.log('Verification attempt without token');
      return res.status(400).json({ message: 'Verification token is required' });
    }
    
    console.log('Attempting to verify email with token:', token);
    const user = await User.findOne({ verification_token: token });
    
    if (!user) {
      console.log('Invalid verification token:', token);
      return res.status(400).json({ 
        message: 'Invalid verification token. The token may have expired or already been used. Please request a new verification email.'
      });
    }
    
    if (user.email_verified) {
      console.log('Email already verified for user:', user.email);
      return res.status(400).json({ message: 'Email is already verified' });
    }
    
    // Update user verification status
    user.email_verified = true;
    user.verification_status = 'active';
    user.verification_token = null;
    await user.save();
    
    console.log('Email verified successfully for user:', user.email);
    
    // Redirect to success page
    res.redirect('/verify-email-success');
  } catch (error) {
    console.error('Error during email verification:', error);
    res.status(500).json({ 
      message: 'An error occurred during email verification. Please try again or contact support.'
    });
  }
});

// Login
router.post('/login', preventAuthAccess, async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is verified
    if (user.verification_status === 'inactive') {
      return res.status(403).json({ 
        message: 'Account not verified. Please verify your email.',
        needsVerification: true
      });
    }

    // Check if user is already logged in
    if (user.sessionId) {
      // Check if this is the same user trying to log in again
      if (user.email === email) {
        // Clear the old session and create a new one
        user.sessionId = null;
        await user.save();
      }
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Update user with session ID
    user.sessionId = sessionId;
    await user.save();

    // Generate token
    const token = jwt.sign({ 
      userId: user._id,
      sessionId: sessionId 
    }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.json({ 
      user: {
        _id: user._id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        user_type: user.user_type,
        verification_status: user.verification_status
      }, 
      token,
      sessionId
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find user by username
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if the user is an admin
    if (user.user_type !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin privileges required.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate session ID
    const sessionId = crypto.randomBytes(32).toString('hex');
    
    // Update user with session ID
    user.sessionId = sessionId;
    await user.save();

    // Generate token
    const token = jwt.sign({ 
      userId: user._id,
      sessionId: sessionId,
      userType: 'admin'
    }, process.env.JWT_SECRET, {
      expiresIn: '1d'  // Shorter expiry for admin tokens
    });

    // Set cookies for server-side authentication
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });
    
    res.cookie('sessionId', sessionId, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 1 day
      path: '/'
    });

    res.json({ 
      user: {
        _id: user._id,
        full_name: user.full_name,
        username: user.username,
        user_type: user.user_type
      }, 
      token,
      sessionId
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Logout
router.post('/logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (user) {
      // Clear session ID
      user.sessionId = null;
      await user.save();
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error during logout' });
  }
});

// Admin Logout
router.post('/admin-logout', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      // Clear session ID
      user.sessionId = null;
      await user.save();
    }

    // Clear cookies
    res.clearCookie('token');
    res.clearCookie('sessionId');
    
    res.json({ message: 'Admin logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error during logout' });
  }
});

// Update profile with files
router.post('/profile/update', auth, upload.fields([
  { name: 'profile_picture', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), async (req, res) => {
  try {
    const updates = req.body;
    
    // Handle file uploads
    if (req.files) {
      if (req.files.profile_picture) {
        const profilePic = req.files.profile_picture[0];
        updates.profile_picture = `uploads/profile_pics/${profilePic.filename}`;
      }
      if (req.files.resume) {
        updates.resume = req.files.resume[0].path;
      }
    }

    // Update user
    Object.keys(updates).forEach(update => {
      req.user[update] = updates[update];
    });

    await req.user.save();
    
    // Return updated user data with proper image path
    const userData = req.user.toObject();
    if (userData.profile_picture) {
      userData.profile_picture = userData.profile_picture.startsWith('http') ? 
        userData.profile_picture : 
        `${process.env.BASE_URL || 'http://localhost:3000'}/${userData.profile_picture.replace(/^\/+/, '')}`;
    }
    res.json(userData);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  res.json(req.user);
});

// Request password reset
router.post('/forgot-password', preventAuthAccess, async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send reset email
    const emailSent = await sendPasswordResetEmail(email, resetToken);
    if (!emailSent) {
      return res.status(500).json({ message: 'Error sending password reset email' });
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Error in forgot-password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', preventAuthAccess, async (req, res) => {
  try {
    const { token, password } = req.body;

    // Validate password
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    // Update password and clear reset fields
    user.password_hash = password; // The pre-save middleware will handle hashing
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    console.error('Error in reset-password:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router; 