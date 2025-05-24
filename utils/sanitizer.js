const he = require('he');

/**
 * Sanitize string input to prevent XSS attacks
 * @param {string} input - The string to sanitize
 * @returns {string} The sanitized string
 */
const sanitizeInput = (input) => {
  if (!input || typeof input !== 'string') {
    return input;
  }
  
  // HTML encode special characters to prevent script execution
  return he.encode(input);
};

/**
 * Sanitize an object by processing all string properties
 * @param {object} obj - The object to sanitize
 * @returns {object} The sanitized object
 */
const sanitizeObject = (obj) => {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
};

/**
 * Sanitize an array of strings or objects
 * @param {Array} array - The array to sanitize
 * @returns {Array} The sanitized array
 */
const sanitizeArray = (array) => {
  if (!Array.isArray(array)) {
    return array;
  }
  
  return array.map(item => {
    if (typeof item === 'string') {
      return sanitizeInput(item);
    } else if (typeof item === 'object' && item !== null) {
      return sanitizeObject(item);
    }
    return item;
  });
};

/**
 * Remove any HTML tags from a string
 * Useful when we need to display plain text only
 * @param {string} html - String potentially containing HTML
 * @returns {string} Plain text with HTML removed
 */
const stripHtml = (html) => {
  if (!html || typeof html !== 'string') {
    return html;
  }
  
  return html.replace(/<\/?[^>]+(>|$)/g, '');
};

/**
 * Sanitize a filename to ensure it's safe
 * @param {string} filename - The filename to sanitize
 * @returns {string} Safe filename
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return filename;
  }
  
  // Remove path traversal characters and other unsafe chars
  return filename
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\.\./g, '');
};

module.exports = {
  sanitizeInput,
  sanitizeObject,
  sanitizeArray,
  stripHtml,
  sanitizeFilename
}; 