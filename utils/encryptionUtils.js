const crypto = require('crypto');
const CryptoJS = require('crypto-js');

// Generate RSA key pair for asymmetric encryption
const generateKeyPair = () => {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });
};

/**
 * Calculate a fingerprint (hash) for a public key
 * @param {string} publicKeyBase64 - The base64-encoded public key
 * @returns {string} The fingerprint as a hex string
 */
const calculateFingerprint = (publicKeyBase64) => {
  try {
    // Convert base64 string to Buffer
    const publicKeyBuffer = Buffer.from(publicKeyBase64, 'base64');
    
    // Create a hash of the public key
    const hash = crypto.createHash('sha256');
    hash.update(publicKeyBuffer);
    const fingerprint = hash.digest('hex');
    
    return fingerprint;
  } catch (error) {
    console.error('Error calculating fingerprint:', error);
    throw new Error('Invalid public key format');
  }
};

// Generate a random AES key for symmetric encryption
const generateAESKey = () => {
  return crypto.randomBytes(32).toString('hex'); // 256-bit key
};

// Encrypt a message with RSA public key (for initial key exchange)
const encryptWithRSA = (publicKey, message) => {
  const buffer = Buffer.from(message);
  const encrypted = crypto.publicEncrypt(
    {
      key: publicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    buffer
  );
  return encrypted.toString('base64');
};

// Decrypt a message with RSA private key (for initial key exchange)
const decryptWithRSA = (privateKey, encryptedMessage) => {
  const buffer = Buffer.from(encryptedMessage, 'base64');
  const decrypted = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING
    },
    buffer
  );
  return decrypted.toString();
};

// Encrypt message or file content with AES (symmetric key)
const encryptWithAES = (plaintext, secretKey) => {
  return CryptoJS.AES.encrypt(plaintext, secretKey).toString();
};

// Decrypt message or file content with AES (symmetric key)
const decryptWithAES = (ciphertext, secretKey) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, secretKey);
  return bytes.toString(CryptoJS.enc.Utf8);
};

// Create encryption format for sending messages
// This is the main message encryption function used when sending a message
const encryptMessage = (message, publicKey) => {
  // Generate a one-time symmetric key for this message
  const messageKey = generateAESKey();
  
  // Encrypt the actual message with AES (faster for large data)
  const encryptedMessage = encryptWithAES(message, messageKey);
  
  // Encrypt the AES key with the recipient's public key
  const encryptedKey = encryptWithRSA(publicKey, messageKey);
  
  // Return both pieces which will be needed for decryption
  return {
    encryptedContent: encryptedMessage,
    encryptedKey: encryptedKey
  };
};

// Decrypt a message - the corresponding function to encryptMessage
// Used when receiving a message
const decryptMessage = (encryptedMessage, encryptedKey, privateKey) => {
  // First decrypt the symmetric key using our private key
  const messageKey = decryptWithRSA(privateKey, encryptedKey);
  
  // Then use that key to decrypt the actual message
  return decryptWithAES(encryptedMessage, messageKey);
};

/**
 * Generate a random AES key
 * @returns {Object} Object containing key and iv
 */
const generateRandomKey = () => {
  const key = crypto.randomBytes(32); // 256 bits
  const iv = crypto.randomBytes(16);  // For AES
  
  return {
    key: key.toString('base64'),
    iv: iv.toString('base64')
  };
};

/**
 * Encrypt data with AES
 * @param {string} data - The data to encrypt
 * @param {string} keyBase64 - The AES key in base64
 * @param {string} ivBase64 - The IV in base64
 * @returns {string} Encrypted data in base64
 */
const aesEncrypt = (data, keyBase64, ivBase64) => {
  try {
    const key = Buffer.from(keyBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(data, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    return encrypted;
  } catch (error) {
    console.error('Error encrypting with AES:', error);
    throw new Error('Encryption failed');
  }
};

/**
 * Decrypt data with AES
 * @param {string} encryptedBase64 - The encrypted data in base64
 * @param {string} keyBase64 - The AES key in base64
 * @param {string} ivBase64 - The IV in base64
 * @returns {string} Decrypted data
 */
const aesDecrypt = (encryptedBase64, keyBase64, ivBase64) => {
  try {
    const key = Buffer.from(keyBase64, 'base64');
    const iv = Buffer.from(ivBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Error decrypting with AES:', error);
    throw new Error('Decryption failed');
  }
};

module.exports = {
  generateKeyPair,
  calculateFingerprint,
  generateAESKey,
  encryptWithRSA,
  decryptWithRSA,
  encryptWithAES,
  decryptWithAES,
  encryptMessage,
  decryptMessage,
  generateRandomKey,
  aesEncrypt,
  aesDecrypt
}; 