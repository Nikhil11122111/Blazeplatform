const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const fileType = file.fieldname === 'profilePicture' ? 'profile_pics' : 'resumes';
    const userId = req.user._id;
    const uploadPath = `uploads/${fileType}/${userId}`;
    
    // Create directory if it doesn't exist
    fs.mkdirSync(uploadPath, { recursive: true });
    
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
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'profilePicture') {
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

module.exports = upload; 