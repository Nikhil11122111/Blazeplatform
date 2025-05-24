const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { Parser } = require('json2csv');
const { getDashboardStats } = require('../controllers/adminController');
const jwt = require('jsonwebtoken');
const { auth } = require('../middleware/auth');

// Admin middleware - should be used after auth middleware
function isAdmin(req, res, next) {
  // Check if the user is an admin
  if (req.user && req.user.user_type === 'admin') {
    return next();
  }
  
  // If request has token in query params (for export), validate it
  if (req.query.token && req.query.sessionId) {
    try {
      const token = req.query.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Find and validate user
      User.findById(decoded.userId)
        .then(user => {
          if (user && user.user_type === 'admin') {
            req.user = user;
            return next();
          }
          res.status(403).send('Access denied');
        })
        .catch(err => {
          console.error('Error finding user:', err);
          res.status(403).send('Access denied');
        });
    } catch (error) {
      console.error('Token verification error:', error);
      res.status(403).send('Access denied');
    }
  } else {
    res.status(403).send('Access denied');
  }
}

// Apply auth middleware to all routes
router.use(auth);

// Get admin dashboard stats
router.get('/dashboard-stats', isAdmin, getDashboardStats);

// Route to get all users
router.get('/users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).send('Server error');
  }
});

// Route to export users as CSV
router.get('/export-users', isAdmin, async (req, res) => {
  try {
    const users = await User.find({});
    
    // Prepare data for CSV export by flattening complex objects
    const preparedUsers = users.map(user => {
      const userData = user.toObject();
      
      // Helper function to extract nested values from objects
      const extractNestedValue = (obj, property) => {
        if (!obj || !obj[property]) return '';
        if (typeof obj[property] === 'object' && obj[property] !== null) {
          if (obj[property].value) {
            return obj[property].value;
          } else if (obj[property].custom) {
            return obj[property].custom;
          } else if (Array.isArray(obj[property])) {
            return obj[property].join(', ');
          }
        }
        return obj[property] || '';
      };
      
      // Format date fields
      const formatDate = (dateString) => {
        if (!dateString) return '';
        try {
          const date = new Date(dateString);
          return date.toISOString().split('T')[0]; // YYYY-MM-DD format
        } catch (err) {
          return '';
        }
      };
      
      // Create a flattened version of the user data
      const flattenedUser = {
        _id: userData._id.toString(),
        full_name: userData.full_name || '',
        username: userData.username || '',
        email: userData.email || '',
        phone_number: userData.phone_number || '',
        date_of_birth: formatDate(userData.date_of_birth),
        gender: extractNestedValue(userData, 'gender'),
        pronoun: extractNestedValue(userData, 'pronoun'),
        bio: userData.bio || '',
        verification_status: userData.verification_status || '',
        user_type: userData.user_type || '',
        user_since: formatDate(userData.user_since),
        email_verified: userData.email_verified ? 'Yes' : 'No',
        co_founders_count: userData.co_founders_count || 0,
        year_of_study: extractNestedValue(userData, 'year_of_study'),
        major_category: extractNestedValue(userData, 'major_category'),
        major_sub_category: extractNestedValue(userData, 'major_sub_category'),
        major_type: userData.major_type || '',
        institution: extractNestedValue(userData, 'institution'),
        city: extractNestedValue(userData, 'city'),
        state: extractNestedValue(userData, 'state'),
        zip: extractNestedValue(userData, 'zip'),
        address: userData.address || '',
        technical_skills: Array.isArray(userData.technical_skills) ? userData.technical_skills.join(', ') : '',
        soft_skills: Array.isArray(userData.soft_skills) ? userData.soft_skills.join(', ') : '',
        my_interests: Array.isArray(userData.my_interests) ? userData.my_interests.join(', ') : '',
        interests_looking_in_others: Array.isArray(userData.interests_looking_in_others) ? userData.interests_looking_in_others.join(', ') : ''
      };
      
      return flattenedUser;
    });
    
    // Set up fields for the CSV export
    const fields = [
      { label: 'ID', value: '_id' },
      { label: 'Full Name', value: 'full_name' },
      { label: 'Username', value: 'username' },
      { label: 'Email', value: 'email' },
      { label: 'User Type', value: 'user_type' },
      { label: 'Verification Status', value: 'verification_status' },
      { label: 'Registration Date', value: 'user_since' },
      { label: 'Email Verified', value: 'email_verified' },
      { label: 'Phone Number', value: 'phone_number' },
      { label: 'Date of Birth', value: 'date_of_birth' },
      { label: 'Gender', value: 'gender' },
      { label: 'Pronouns', value: 'pronoun' },
      { label: 'Address', value: 'address' },
      { label: 'City', value: 'city' },
      { label: 'State', value: 'state' },
      { label: 'ZIP Code', value: 'zip' },
      { label: 'Bio', value: 'bio' },
      { label: 'Year of Study', value: 'year_of_study' },
      { label: 'Institution', value: 'institution' },
      { label: 'Major Category', value: 'major_category' },
      { label: 'Major Sub-Category', value: 'major_sub_category' },
      { label: 'Major Type', value: 'major_type' },
      { label: 'Technical Skills', value: 'technical_skills' },
      { label: 'Soft Skills', value: 'soft_skills' },
      { label: 'Interests', value: 'my_interests' },
      { label: 'Looking for Interests', value: 'interests_looking_in_others' },
      { label: 'Co-Founders Count', value: 'co_founders_count' }
    ];
    
    // Configure the CSV Parser with additional options
    const json2csvParser = new Parser({ 
      fields,
      defaultValue: '',
      delimiter: ',',
      header: true,
      quote: '"'
    });
    
    // Generate the CSV
    const csv = json2csvParser.parse(preparedUsers);
    
    // Set appropriate headers for file download
    res.header('Content-Type', 'text/csv; charset=utf-8');
    res.header('Content-Disposition', 'attachment; filename=blaze-users-export.csv');
    res.header('Cache-Control', 'no-cache');
    
    // Send the CSV data
    res.send(csv);
  } catch (error) {
    console.error('Error exporting users:', error);
    res.status(500).send('Server error: ' + error.message);
  }
});

// Route to create a new admin user
router.post('/create-admin', isAdmin, async (req, res) => {
  try {
    const { full_name, username, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ 
      $or: [{ email }, { username }] 
    });
    
    if (existingUser) {
      return res.status(400).json({ 
        success: false,
        message: existingUser.email === email ? 
          'Email already registered' : 
          'Username already taken' 
      });
    }

    // Create new admin user
    const admin = new User({
      full_name,
      username,
      email,
      password_hash: password,
      user_type: 'admin',
      verification_status: 'active',
      email_verified: true,
    });

    await admin.save();
    
    res.json({ 
      success: true,
      message: 'Admin user created successfully',
      admin: {
        _id: admin._id,
        full_name: admin.full_name,
        username: admin.username,
        email: admin.email
      }
    });
  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ 
      success: false,
      message: error.message || 'Error creating admin user' 
    });
  }
});

// Route to get dashboard stats
router.get('/dashboard-stats', isAdmin, async (req, res) => {
  try {
    // Get user counts
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ verification_status: 'active' });
    const pendingUsers = await User.countDocuments({ verification_status: 'inactive' });
    const adminUsers = await User.countDocuments({ user_type: 'admin' });

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        pendingUsers,
        adminUsers
      }
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error getting dashboard stats' 
    });
  }
});

// Route to get a single user by ID
router.get('/users/:userId', isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    // Return user data
    res.json(user);
  } catch (error) {
    console.error('Error getting user details:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Route to delete a user by ID
router.delete('/users/:userId', isAdmin, async (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Don't allow deleting yourself
    if (req.user._id.toString() === userId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account from admin panel'
      });
    }
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Check if this is an admin
    if (user.user_type === 'admin') {
      // Find the first admin (by creation date)
      const firstAdmin = await User.findOne({ user_type: 'admin' }).sort({ user_since: 1 });
      
      // Don't allow deleting the first admin
      if (firstAdmin && firstAdmin._id.toString() === userId) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete the primary admin account'
        });
      }
    }
    
    await User.findByIdAndDelete(userId);
    
    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error deleting user'
    });
  }
});

// Route to update admin details
router.post('/update-admin', isAdmin, async (req, res) => {
  try {
    console.log('Received update admin request:', req.body);
    const { full_name, username, email } = req.body;
    const adminId = req.user._id;
    
    // Validate required fields
    if (!full_name || !username || !email) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Check for username or email conflicts
    const existingUser = await User.findOne({
      _id: { $ne: adminId },
      $or: [
        { username: username },
        { email: email }
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: existingUser.username === username ? 
          'Username already taken' : 'Email already registered'
      });
    }

    // Update admin details
    const updatedAdmin = await User.findByIdAndUpdate(
      adminId,
      { 
        full_name, 
        username, 
        email 
      },
      { new: true }
    );

    if (!updatedAdmin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    console.log('Admin updated successfully:', updatedAdmin.username);
    res.json({
      success: true,
      message: 'Admin details updated successfully',
      admin: {
        _id: updatedAdmin._id,
        full_name: updatedAdmin.full_name,
        username: updatedAdmin.username,
        email: updatedAdmin.email
      }
    });
  } catch (error) {
    console.error('Error updating admin details:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error updating admin details'
    });
  }
});

// Route to change admin password
router.post('/change-password', isAdmin, async (req, res) => {
  try {
    console.log('Received change password request');
    const { current_password, new_password, confirm_password } = req.body;
    const adminId = req.user._id;

    // Validate required fields
    if (!current_password || !new_password || !confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate password match
    if (new_password !== confirm_password) {
      return res.status(400).json({
        success: false,
        message: 'New passwords do not match'
      });
    }

    // Find admin
    const admin = await User.findById(adminId);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    console.log('Verifying password for admin:', admin.username);
    const isMatch = await admin.comparePassword(current_password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    admin.password_hash = new_password;
    await admin.save();
    console.log('Password changed successfully for admin:', admin.username);

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error changing password'
    });
  }
});

module.exports = router; 