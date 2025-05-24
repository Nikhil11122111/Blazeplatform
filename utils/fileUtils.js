const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { promisify } = require('util');
const { encryptWithAES, decryptWithAES } = require('./encryptionUtils');

// Convert callbacks to promises
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const mkdirAsync = promisify(fs.mkdir);

// Allowed file types and their MIME types
const ALLOWED_MIME_TYPES = {
  // Images
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  
  // Documents
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  
  // Text
  'text/plain': '.txt',
  'text/csv': '.csv'
};

// Disallowed file extensions for security
const DISALLOWED_EXTENSIONS = [
  '.exe', '.js', '.jsx', '.ts', '.tsx', '.php', '.sh', '.bat', '.cmd', '.msi', 
  '.dll', '.bin', '.com', '.vbs', '.ps1', '.py', '.rb'
];

// Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Generate a secure random filename
const generateSecureFilename = (originalFilename, userId) => {
  const timestamp = Date.now();
  const randomString = crypto.randomBytes(16).toString('hex');
  const extension = path.extname(originalFilename);
  
  return `${userId}_${timestamp}_${randomString}${extension}`;
};

// Validate file size, type, and extension
const validateFile = (file) => {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
  }
  
  // Check MIME type
  if (!ALLOWED_MIME_TYPES[file.mimetype]) {
    return { valid: false, error: 'File type not allowed' };
  }
  
  // Double check extension to prevent MIME type spoofing
  const extension = path.extname(file.originalname).toLowerCase();
  if (DISALLOWED_EXTENSIONS.includes(extension)) {
    return { valid: false, error: 'File extension not allowed for security reasons' };
  }
  
  // Validate that extension matches the MIME type
  const expectedExtension = ALLOWED_MIME_TYPES[file.mimetype];
  if (extension !== expectedExtension) {
    return { valid: false, error: 'File extension does not match the file type' };
  }
  
  return { valid: true };
};

// Store an encrypted file
const storeEncryptedFile = async (file, userId, secretKey) => {
  try {
    // Validate the file first
    const validation = validateFile(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
    
    // Create directory if it doesn't exist
    const userDir = path.join(__dirname, '..', 'uploads', 'chat', userId);
    try {
      await mkdirAsync(userDir, { recursive: true });
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
    }
    
    // Generate secure filename
    const secureFilename = generateSecureFilename(file.originalname, userId);
    const filePath = path.join(userDir, secureFilename);
    
    // Read the file buffer
    const fileBuffer = file.buffer;
    
    // Skip encryption if no valid secretKey provided - just store the file directly
    if (!secretKey) {
      console.warn('No secretKey provided for file encryption. Storing file without encryption.');
      await writeFileAsync(filePath, fileBuffer);
      
      // Return file metadata
      return {
        originalName: file.originalname,
        fileName: secureFilename,
        mimeType: file.mimetype,
        size: file.size,
        path: `/uploads/chat/${userId}/${secureFilename}`
      };
    }
    
    // Convert buffer to base64 for encryption
    const fileContent = fileBuffer.toString('base64');
    
    // Encrypt the file content
    const encryptedContent = encryptWithAES(fileContent, secretKey);
    
    // Write encrypted file to disk
    await writeFileAsync(filePath, encryptedContent);
    
    // Return file metadata
    return {
      originalName: file.originalname,
      fileName: secureFilename,
      mimeType: file.mimetype,
      size: file.size,
      path: `/uploads/chat/${userId}/${secureFilename}`
    };
  } catch (error) {
    console.error('Error storing encrypted file:', error);
    throw error;
  }
};

// Retrieve and decrypt a file
const retrieveDecryptedFile = async (filePath, secretKey) => {
  try {
    // Read the encrypted file
    const encryptedContent = await readFileAsync(
      path.join(__dirname, '..', filePath)
    );
    
    // Decrypt the content
    const decryptedContent = decryptWithAES(encryptedContent.toString(), secretKey);
    
    // Convert from base64 back to binary
    return Buffer.from(decryptedContent, 'base64');
  } catch (error) {
    console.error('Error retrieving decrypted file:', error);
    throw error;
  }
};

// Sanitize file name to prevent directory traversal
const sanitizeFileName = (fileName) => {
  // Remove any path components
  let sanitized = path.basename(fileName);
  
  // Remove any special chars that might be used maliciously
  sanitized = sanitized.replace(/[^a-zA-Z0-9_.-]/g, '_');
  
  return sanitized;
};

module.exports = {
  validateFile,
  storeEncryptedFile,
  retrieveDecryptedFile,
  sanitizeFileName,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE
}; 