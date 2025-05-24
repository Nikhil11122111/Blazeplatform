// Profile picture upload handling
function handleProfilePictureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('error', 'Please upload a valid image file (JPEG, PNG, or WebP)');
    return;
  }

  // Validate file size (max 5MB)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (file.size > maxSize) {
    showToast('error', 'Image file size must be less than 5MB');
    return;
  }

  const formData = new FormData();
  formData.append('profile_picture', file);

  // Show loading state
  const uploadButton = document.querySelector('#upload-profile-picture');
  const originalText = uploadButton.textContent;
  uploadButton.disabled = true;
  uploadButton.textContent = 'Uploading...';

  // Upload the file
  fetch('/api/users/avatar', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getToken()}`
    },
    body: formData
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      // Update profile picture preview
      const preview = document.querySelector('#profile-picture-preview');
      preview.src = data.profile_picture_url;
      
      // Update all instances of user avatar in the UI
      document.querySelectorAll('.user-avatar').forEach(avatar => {
        avatar.src = data.profile_picture_url;
      });

      showToast('success', 'Profile picture updated successfully');
    } else {
      throw new Error(data.message || 'Failed to update profile picture');
    }
  })
  .catch(error => {
    console.error('Error uploading profile picture:', error);
    showToast('error', error.message || 'Failed to upload profile picture');
  })
  .finally(() => {
    // Reset button state
    uploadButton.disabled = false;
    uploadButton.textContent = originalText;
  });
}

// Handle profile picture errors
function handleProfilePictureError(event) {
  const img = event.target;
  img.src = '/assets/images/user/blank-avatar.png'; // Set default avatar
}

// Initialize profile picture handling
document.addEventListener('DOMContentLoaded', () => {
  // Set up profile picture upload
  const uploadInput = document.querySelector('#profile-picture-input');
  if (uploadInput) {
    uploadInput.addEventListener('change', handleProfilePictureUpload);
  }

  // Set up error handling for all profile pictures
  document.querySelectorAll('.profile-picture, .user-avatar').forEach(img => {
    img.addEventListener('error', handleProfilePictureError);
  });
}); 