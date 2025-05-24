const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');
const User = require('../models/User');

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    console.log('Created uploads directory');
  } catch (error) {
    console.error('Error creating uploads directory:', error);
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const userId = req.user._id;
    let uploadPath;
    
    if (file.fieldname === 'profilePicture') {
      uploadPath = path.join(uploadsDir, 'profile_pics', userId.toString());
    } else if (file.fieldname === 'resume') {
      uploadPath = path.join(uploadsDir, 'resumes', userId.toString());
    }
    
    // Create user-specific directory if it doesn't exist
    if (!fs.existsSync(uploadPath)) {
      try {
        fs.mkdirSync(uploadPath, { recursive: true });
        console.log(`Created upload directory: ${uploadPath}`);
      } catch (error) {
        console.error('Error creating upload directory:', error);
        return cb(error);
      }
    }
    
    cb(null, uploadPath);
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
  fileFilter: function (req, file, cb) {
    if (file.fieldname === 'profilePicture') {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Only image files are allowed for profile picture'));
      }
    } else if (file.fieldname === 'resume') {
      const allowedTypes = ['.pdf', '.doc', '.docx'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (!allowedTypes.includes(ext)) {
        return cb(new Error('Only PDF, DOC, and DOCX files are allowed for resume'));
      }
    }
    cb(null, true);
  }
});

// Get profile data
router.get('/data', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password_hash');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Format the data according to the expected structure
        const profileData = {
            profilePicture: user.profile_picture ? 
                (user.profile_picture.startsWith('http') ? 
                    user.profile_picture : 
                    `/uploads/profile_pics/${user._id}/${path.basename(user.profile_picture)}`) : 
                `/assets/images/user/blank-avatar.png`,
            resume: user.resume ? 
                (user.resume.startsWith('http') ? 
                    user.resume : 
                    `/uploads/resumes/${user._id}/${path.basename(user.resume)}`) : 
                null,
            fullName: user.full_name || 'Guest User',
            yearOfStudy: user.year_of_study?.value || (user.year_of_study?.custom || 'N/A'),
            yearOfStudyCustom: user.year_of_study?.custom || null,
            email: user.email || 'guest@example.com',
            email_verified: user.email_verified || false,
            phone: user.phone_number || 'N/A',
            location: user.city?.value || 'N/A',
            website: user.website || 'N/A',
            coFoundersCount: user.co_founders_count || 0,
            co_founders_count: user.co_founders_count || 0,
            co_founders_looking_for: user.co_founders_count || 0,
            connectionsCount: user.connections?.length || 0,
            aboutMe: user.bio || 'No bio available',
            bio: user.bio || null,
            institute: user.institution?.value || 'N/A',
            institution: {
              value: user.institution?.value || null,
              custom: user.institution?.custom || null
            },
            major: user.major_category?.value || 'N/A',
            major_category: {
                value: user.major_category?.value || null,
                custom: user.major_category?.custom || null
            },
            majorType: user.major_type || 'N/A',
            majorSubCategory: user.major_sub_category?.value || 'N/A',
            hardSkills: user.technical_skills || [],
            softSkills: user.soft_skills || [],
            username: user.username || 'N/A',
            date_of_birth: user.date_of_birth ? 
                user.date_of_birth.toISOString().split('T')[0] : 
                null,
            dateOfBirth: user.date_of_birth ? 
                user.date_of_birth.toISOString().split('T')[0] : 
                null,
            gender: user.gender?.value || null,
            genderObject: user.gender || { value: null, custom: null },
            pronouns: user.pronoun?.value || null,
            pronoun: user.pronoun || { value: null, custom: null },
            state: user.state?.value || null,
            city: user.city?.value || null,
            zipCode: user.zip?.value || null,
            address: user.address || 'N/A',
            profileCompletion: user.profileCompletion || '0%',
            myInterests: user.my_interests || [],
            my_interests: user.my_interests || [],
            lookingForInterests: user.interests_looking_in_others || [],
            socialLinks: user.urls || [],
            platforms: user.platforms || [],
            userType: user.user_type || 'user',
            verificationStatus: user.verification_status || 'inactive',
            userSince: user.user_since || new Date()
        };

        console.log('Sending profile data with interests:', {
            myInterests: profileData.myInterests,
            my_interests: profileData.my_interests
        });
        res.json(profileData);
    } catch (error) {
        console.error('Error fetching profile data:', error);
        res.status(500).json({ message: 'Error fetching profile data' });
    }
});

// Update profile data
router.post('/update', auth, upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'resume', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Starting profile update...');
    console.log('Request body:', req.body);
    console.log('Request files:', req.files);

    // Parse the JSON data from the form
    let formData;
    try {
      formData = JSON.parse(req.body.data);
      console.log('Parsed form data:', formData);
    } catch (error) {
      console.error('Error parsing form data:', error);
      return res.status(400).json({ message: 'Invalid form data' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Helper function to delete old file
    const deleteOldFile = (filePath) => {
      if (!filePath) return;
      const fullPath = path.join(__dirname, '../uploads', filePath);
      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          console.log('Deleted old file:', fullPath);
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    };

    // Handle profile picture upload
    if (req.files && req.files.profilePicture) {
      const profilePicture = req.files.profilePicture[0];
      const userId = req.user._id;
      
      // Delete old profile picture if it exists
      if (user.profile_picture && !user.profile_picture.includes('blank-avatar.png')) {
        deleteOldFile(user.profile_picture);
      }
      
      // Store the complete relative path
      user.profile_picture = `profile_pics/${userId}/${profilePicture.filename}`;
      console.log('Setting profile picture path:', user.profile_picture);
    }

    // Handle resume upload
    if (req.files && req.files.resume) {
      const resume = req.files.resume[0];
      const userId = req.user._id;
      
      // Delete old resume if it exists
      if (user.resume) {
        deleteOldFile(user.resume);
      }
      
      // Store the complete relative path
      user.resume = `resumes/${userId}/${resume.filename}`;
      console.log('Setting resume path:', user.resume);
    }

    // Update other fields from parsed form data
    Object.keys(formData).forEach(key => {
      if (formData[key] !== undefined && formData[key] !== null) {
        // Special handling for resume field to prevent empty object
        if (key === 'resume' && typeof formData[key] === 'object' && Object.keys(formData[key]).length === 0) {
          return;
        }
        user[key] = formData[key];
      }
    });

    await user.save();
    
    // Return updated user data with proper file paths
    const userData = user.toObject();
    if (userData.profile_picture) {
      userData.profilePicture = `/uploads/${userData.profile_picture}`;
    }
    if (userData.resume) {
      userData.resume = `/uploads/${userData.resume}`;
    }

    res.json({ success: true, user: userData });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(400).json({ message: error.message });
  }
});

// Change password
router.post('/change-password', auth, async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        console.log('Change password request received:', { oldPassword: '********', newPassword: '********' });
        
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Verify old password
        const isMatch = await user.comparePassword(oldPassword);
        if (!isMatch) {
            console.log('Password verification failed for user:', user._id);
            return res.status(400).json({ message: 'Current password is incorrect' });
        }

        // Update password - set password_hash field
        user.password_hash = newPassword;
        await user.save();
        console.log('Password updated successfully for user:', user._id);

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({ message: 'Server error: ' + error.message });
    }
});

// Update privacy settings
router.post('/privacy', auth, async (req, res) => {
    try {
        const { privateMode } = req.body;
        const user = await User.findById(req.user._id);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.privateMode = privateMode;
        await user.save();

        res.json({ message: 'Privacy settings updated successfully' });
    } catch (error) {
        console.error('Error updating privacy settings:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 