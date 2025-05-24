/**
 * Profile Picture Handling Utility
 * Handles loading profile pictures with graceful fallbacks
 */

/**
 * Loads a profile picture with proper error handling
 * @param {string} imageUrl - The URL of the profile picture to load
 * @param {string} userId - The user ID
 * @param {function} callback - Optional callback function to execute after image loads or fails
 */
function loadProfilePicture(imageUrl, userId, callback) {
  // Default image path
  const defaultAvatar = '/assets/images/user/blank-avatar.png';
  
  // If no image URL provided, return default
  if (!imageUrl) {
    if (callback) callback(defaultAvatar);
    return defaultAvatar;
  }
  
  // Try different possible paths if the image fails to load
  return new Promise((resolve) => {
    // Create a test image to check if the URL is valid
    const img = new Image();
    
    img.onload = function() {
      if (callback) callback(imageUrl);
      resolve(imageUrl);
    };
    
    img.onerror = function() {
      // If original path fails, try alternative paths
      if (imageUrl.includes('/uploads/profile_pics/')) {
        // Try legacy path
        const fileName = imageUrl.split('/').pop();
        const alternativePath = `/profile_pics/${userId}/${fileName}`;
        
        const altImg = new Image();
        altImg.onload = function() {
          if (callback) callback(alternativePath);
          resolve(alternativePath);
        };
        
        altImg.onerror = function() {
          console.log('Failed to load profile picture, using default avatar');
          if (callback) callback(defaultAvatar);
          resolve(defaultAvatar);
        };
        
        altImg.src = alternativePath;
      } else {
        // No alternative path available, use default
        console.log('Failed to load profile picture, using default avatar');
        if (callback) callback(defaultAvatar);
        resolve(defaultAvatar);
      }
    };
    
    img.src = imageUrl;
  });
}

/**
 * Updates all profile picture elements on the page
 * @param {string} userId - The user ID
 */
function updateAllProfilePictures(userId) {
  document.querySelectorAll('[data-profile-picture]').forEach(img => {
    const pictureSrc = img.getAttribute('src');
    
    loadProfilePicture(pictureSrc, userId, (validSrc) => {
      img.src = validSrc;
    });
  });
} 