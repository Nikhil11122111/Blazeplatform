const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendEmail } = require('../utils/email');

exports.register = async (req, res) => {
  try {
    const { email, password, full_name, username } = req.body;

    // Check if user already exists
    let user = await User.findOne({ $or: [{ email }, { username }] });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create verification token
    const verification_token = crypto.randomBytes(32).toString('hex');

    // Create new user
    user = new User({
      email,
      full_name,
      username,
      verification_token,
      password_hash: await bcrypt.hash(password, 10)
    });

    await user.save();

    // Send verification email
    await sendEmail(email, 'Email Verification', `Please verify your email by clicking this link: ${process.env.BASE_URL}/api/users/verify-email?token=${verification_token}`);

    res.status(201).json({ message: 'User registered successfully. Please verify your email.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Error registering user', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if email is verified
    if (!user.is_verified) {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    // Generate token
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });

    res.json({ token, user: { 
      _id: user._id,
      email: user.email,
      full_name: user.full_name,
      username: user.username,
      profile_picture: user.profile_picture
    }});
  } catch (error) {
    res.status(500).json({ message: 'Login error', error: error.message });
  }
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    
    const user = await User.findOne({ verification_token: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid verification token' });
    }

    user.is_verified = true;
    user.verification_token = undefined;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error verifying email', error: error.message });
  }
};

exports.sendVerificationEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.is_verified) {
      return res.status(400).json({ message: 'Email already verified' });
    }

    const verification_token = crypto.randomBytes(32).toString('hex');
    user.verification_token = verification_token;
    await user.save();

    await sendEmail(email, 'Email Verification', `Please verify your email by clicking this link: ${process.env.BASE_URL}/api/users/verify-email?token=${verification_token}`);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Error sending verification email', error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    await sendEmail(email, 'Password Reset', `Reset your password by clicking this link: ${process.env.BASE_URL}/reset-password?token=${resetToken}`);

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    res.status(500).json({ message: 'Error processing password reset', error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password_hash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successful' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password_hash');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = Object.keys(req.body);
    const allowedUpdates = ['full_name', 'bio', 'skills', 'interests'];
    const isValidOperation = updates.every(update => allowedUpdates.includes(update));

    if (!isValidOperation) {
      return res.status(400).json({ message: 'Invalid updates' });
    }

    updates.forEach(update => req.user[update] = req.body[update]);
    await req.user.save();

    res.json(req.user);
  } catch (error) {
    res.status(400).json({ message: 'Error updating profile', error: error.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const isMatch = await bcrypt.compare(currentPassword, req.user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    req.user.password_hash = await bcrypt.hash(newPassword, 10);
    await req.user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error changing password', error: error.message });
  }
};

exports.logout = async (req, res) => {
  try {
    // If you're using token blacklisting or session management, handle it here
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error logging out', error: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching user', error: error.message });
  }
};

exports.updateAvatar = async (req, res) => {
  try {
    // Handle avatar upload logic here
    // This would typically involve processing the uploaded file
    // and updating the user's profile_picture field
    res.json({ message: 'Avatar updated successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating avatar', error: error.message });
  }
};

exports.saveResume = async (req, res) => {
  try {
    // Handle resume upload logic here
    // This would typically involve processing the uploaded file
    // and updating the user's resume field
    res.json({ message: 'Resume saved successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error saving resume', error: error.message });
  }
}; 