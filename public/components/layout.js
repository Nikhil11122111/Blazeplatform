// Theme change function
function layout_change(mode) {
  console.log('Changing theme to:', mode);
  const userId = localStorage.getItem('userId');
  
  // Update the dark_layout variable in config.js
  if (typeof dark_layout !== 'undefined') {
    dark_layout = mode === 'dark' ? 'true' : 'false';
  }
  
  if (mode === 'dark') {
    console.log('Applying dark theme');
    applyTheme('dark');
    
    // Save to database if user is logged in
    if (userId) {
      console.log('Saving dark theme to database for user:', userId);
      saveUserThemePreference(userId, 'dark');
    }
    localStorage.setItem('theme', 'dark');
    console.log('Theme saved to localStorage:', localStorage.getItem('theme'));
  } else {
    console.log('Applying light theme');
    applyTheme('light');
    
    // Save to database if user is logged in
    if (userId) {
      console.log('Saving light theme to database for user:', userId);
      saveUserThemePreference(userId, 'light');
    }
    localStorage.setItem('theme', 'light');
    console.log('Theme saved to localStorage:', localStorage.getItem('theme'));
  }
}

// Theme default change function
function layout_change_default() {
  const userId = localStorage.getItem('userId');
  
  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    layout_change('dark');
  } else {
    layout_change('light');
  }
  
  // Update the dark_layout variable in config.js
  if (typeof dark_layout !== 'undefined') {
    dark_layout = 'default';
  }
  
  // Save to database if user is logged in
  if (userId) {
    saveUserThemePreference(userId, 'default');
  }
  localStorage.removeItem('theme');
}

// Function to save theme preference to database
function saveUserThemePreference(userId, theme) {
  console.log('Saving theme to database:', { userId, theme });
  fetch('/api/users/preferences/theme', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
      'X-Session-ID': localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId') || ''
    },
    body: JSON.stringify({ theme })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Theme preference saved to database:', data);
  })
  .catch(error => {
    console.error('Error saving theme preference to database:', error);
  });
}

// Function to apply theme
function applyTheme(theme) {
  console.log('Applying theme:', theme);
  const body = document.querySelector('body');
  const html = document.documentElement;
  
  // Remove all theme-related classes and attributes first
  body.removeAttribute('data-pc-theme');
  html.removeAttribute('data-theme');
  html.classList.remove('dark', 'light');
  
  if (theme === 'dark') {
    body.setAttribute('data-pc-theme', 'dark');
    html.setAttribute('data-theme', 'dark');
    html.classList.add('dark');
  } else {
    body.setAttribute('data-pc-theme', 'light');
    html.setAttribute('data-theme', 'light');
    html.classList.add('light');
  }
}

// Function to load user's theme preference
function loadUserThemePreference() {
  console.log('Loading theme preference...');
  const userId = localStorage.getItem('userId');
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
  const savedTheme = localStorage.getItem('theme');
  
  console.log('Current saved theme in localStorage:', savedTheme);
  console.log('User ID:', userId);
  
  // First try to load from database if user is logged in
  if (userId && token && sessionId) {
    console.log('Attempting to load theme from database...');
    fetch('/api/users/preferences/theme', {
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    })
    .then(response => response.json())
    .then(data => {
      console.log('Database theme response:', data);
      if (data.theme) {
        console.log('Applying theme from database:', data.theme);
        layout_change(data.theme);
      } else if (savedTheme) {
        console.log('No database theme, using localStorage:', savedTheme);
        layout_change(savedTheme);
      } else {
        console.log('No theme found, using default light theme');
        layout_change('light');
      }
    })
    .catch(error => {
      console.error('Error loading theme preference:', error);
      if (savedTheme) {
        console.log('Database error, using localStorage:', savedTheme);
        layout_change(savedTheme);
      } else {
        console.log('No theme found, using default light theme');
        layout_change('light');
      }
    });
  } else if (savedTheme) {
    console.log('No user logged in, using localStorage:', savedTheme);
    layout_change(savedTheme);
  } else {
    console.log('No theme preference found, using default light theme');
    layout_change('light');
  }
}

// Sidebar contrast change function
function layout_sidebar_change(value) {
  const body = document.querySelector('body');
  
  if (value === 'true') {
    body.setAttribute('data-pc-sidebar-theme', 'true');
    localStorage.setItem('sidebar-theme', 'true');
  } else {
    body.setAttribute('data-pc-sidebar-theme', 'false');
    localStorage.setItem('sidebar-theme', 'false');
  }
}

// Sidebar caption change function
function layout_caption_change(value) {
  const body = document.querySelector('body');
  
  if (value === 'true') {
    body.setAttribute('data-pc-sidebar-caption', 'true');
    localStorage.setItem('caption-layout', 'true');
  } else {
    body.setAttribute('data-pc-sidebar-caption', 'false');
    localStorage.setItem('caption-layout', 'false');
  }
}

// RTL layout change function
function layout_rtl_change(value) {
  const body = document.querySelector('body');
  
  if (value === 'true') {
    body.setAttribute('data-pc-direction', 'rtl');
    localStorage.setItem('layout-direction', 'rtl');
  } else {
    body.setAttribute('data-pc-direction', 'ltr');
    localStorage.setItem('layout-direction', 'ltr');
  }
}

// Container layout change function
function change_box_container(value) {
  const body = document.querySelector('body');
  
  if (value === 'true') {
    body.setAttribute('data-pc-container', 'container');
    localStorage.setItem('box-container', 'true');
  } else {
    body.setAttribute('data-pc-container', 'fluid');
    localStorage.setItem('box-container', 'false');
  }
}

// Reset layout function
function resetLayout() {
  // Clear all layout settings from localStorage
  localStorage.removeItem('theme');
  localStorage.removeItem('sidebar-theme');
  localStorage.removeItem('caption-layout');
  localStorage.removeItem('layout-direction');
  localStorage.removeItem('box-container');
  
  // Reload the page to apply default settings
  window.location.reload();
}

// Logout function
function logout() {
  // Clear user session data
  localStorage.removeItem('user');
  localStorage.removeItem('token');
  
  // Redirect to login page
  window.location.href = 'login.html';
}

// Update user profile function
function updateUserProfile() {
  const token = localStorage.getItem('token');
  if (!token) {
    console.error('No token found');
    return;
  }

  fetch('/api/profile/data', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return response.json();
  })
  .then(data => {
    console.log('Profile data received:', data);
    
    // Helper function to get the correct profile picture path
    function getProfilePicturePath(profilePicture) {
      const defaultAvatar = '../assets/images/user/blank-avatar.png';
      if (!profilePicture) return defaultAvatar;
      
      // If it's already a full URL, use as is
      if (profilePicture.startsWith('http')) {
        return profilePicture;
      }
      
      // If it starts with /assets/ or ../assets/, use as is
      if (profilePicture.startsWith('/assets/') || profilePicture.startsWith('../assets/')) {
        return profilePicture;
      }
      
      // If it starts with /uploads/, use as is
      if (profilePicture.startsWith('/uploads/')) {
        return profilePicture;
      }
      
      // If it starts with profile_pics/, add leading slash
      if (profilePicture.startsWith('profile_pics/')) {
        return `/${profilePicture}`;
      }
      
      // For any other path with no prefix, add a / prefix
      if (!profilePicture.startsWith('/')) {
        return `/${profilePicture}`;
      }
      
      return profilePicture;
    }

    // Update current user's profile images
    const currentUserElements = {
      sidebar: document.getElementById('sidebar-profile-img'),
      header: document.getElementById('header-profile-img'),
      headerDropdown: document.getElementById('header-dropdown-profile-img')
    };

    const profilePic = getProfilePicturePath(data.profilePicture);
    
    // Function to set profile image with fallback
    function setProfileImage(element, imagePath) {
      if (!element) return;
      
      const img = new Image();
      img.onload = function() {
        element.src = imagePath;
        element.style.display = 'block';
      };
      img.onerror = function() {
        element.src = '../assets/images/user/blank-avatar.png';
        element.style.display = 'block';
      };
      img.src = imagePath;
    }

    // Update current user's images
    Object.values(currentUserElements).forEach(element => {
      if (element) setProfileImage(element, profilePic);
    });

    // Update user names and info
    const sidebarUserName = document.getElementById('sidebar-user-name');
    const sidebarUserStudy = document.getElementById('sidebar-user-study');
    const headerUserName = document.getElementById('header-user-name');
    const headerUserEmail = document.getElementById('header-user-email');

    if (sidebarUserName) sidebarUserName.textContent = data.fullName || 'Guest User';
    if (sidebarUserStudy) sidebarUserStudy.textContent = data.yearOfStudy || 'N/A';
    if (headerUserName) headerUserName.textContent = data.fullName || 'Guest User';
    if (headerUserEmail) headerUserEmail.textContent = data.email || 'guest@example.com';

    // Do NOT update other users' profile images - they should be handled by their respective components
    // Only update profile-specific elements if we're on the profile page
    if (window.location.pathname.includes('profile.html')) {
      // Update contact information
      const contactInfo = {
        email: data.email,
        phone: data.phone,
        location: data.city,
        website: data.website
      };

      document.querySelectorAll('.profile-contact-info .d-inline-flex.align-items-center p.mb-0').forEach((el, index) => {
        const values = Object.values(contactInfo);
        if (values[index]) {
          el.textContent = values[index];
        }
      });

      // Update profile completion and connections
      document.querySelectorAll('.profile-stats .col-6 h5').forEach((el, index) => {
        if (index === 0) {
          el.textContent = data.profileCompletion || '0%';
        } else {
          el.textContent = data.connectionsCount || '0';
        }
      });

      // Rest of the profile page specific updates...
    }
  })
  .catch(error => {
    console.error('Error fetching profile data:', error);
    setDefaultProfileValues();
  });
}

// Function to handle profile image loading for any user
// This can be called from other components when needed
function loadUserProfileImage(imageElement, profilePicturePath) {
  if (!imageElement || !profilePicturePath) return;

  // Handle the path formatting
  let imagePath = profilePicturePath;
  if (!profilePicturePath.startsWith('http') && 
      !profilePicturePath.startsWith('/') && 
      !profilePicturePath.startsWith('../')) {
    imagePath = `/${profilePicturePath}`;
  }

  // Set the image with fallback
  const img = new Image();
  img.onload = function() {
    imageElement.src = imagePath;
    imageElement.style.display = 'block';
  };
  img.onerror = function() {
    console.error('Failed to load profile picture:', imagePath);
    imageElement.src = '../assets/images/user/blank-avatar.png';
    imageElement.style.display = 'block';
  };
  img.src = imagePath;
}

// Update setDefaultProfileValues to only handle current user elements
function setDefaultProfileValues() {
  const defaultAvatar = '../assets/images/user/blank-avatar.png';
  
  // Update sidebar
  const sidebarProfileImg = document.getElementById('sidebar-profile-img');
  const sidebarUserName = document.getElementById('sidebar-user-name');
  const sidebarUserStudy = document.getElementById('sidebar-user-study');
  
  if (sidebarProfileImg) {
    sidebarProfileImg.src = defaultAvatar;
    sidebarProfileImg.style.display = 'block';
  }
  if (sidebarUserName) {
    sidebarUserName.textContent = 'Guest User';
  }
  if (sidebarUserStudy) {
    sidebarUserStudy.textContent = 'N/A';
  }
  
  // Update header
  const headerProfileImg = document.getElementById('header-profile-img');
  const headerDropdownProfileImg = document.getElementById('header-dropdown-profile-img');
  const headerUserName = document.getElementById('header-user-name');
  const headerUserEmail = document.getElementById('header-user-email');
  
  if (headerProfileImg) {
    headerProfileImg.src = defaultAvatar;
    headerProfileImg.style.display = 'block';
  }
  if (headerDropdownProfileImg) {
    headerDropdownProfileImg.src = defaultAvatar;
    headerDropdownProfileImg.style.display = 'block';
  }
  if (headerUserName) {
    headerUserName.textContent = 'Guest User';
  }
  if (headerUserEmail) {
    headerUserEmail.textContent = 'guest@example.com';
  }
}

// Load theme immediately when script loads
loadUserThemePreference();

// Load saved layout settings
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - Initializing theme');
  loadUserThemePreference();

  // Load sidebar theme
  const sidebarTheme = localStorage.getItem('sidebar-theme');
  if (sidebarTheme) {
    layout_sidebar_change(sidebarTheme);
  }
  
  // Load caption layout
  const captionLayout = localStorage.getItem('caption-layout');
  if (captionLayout) {
    layout_caption_change(captionLayout);
  }
  
  // Load direction
  const direction = localStorage.getItem('layout-direction');
  if (direction) {
    layout_rtl_change(direction);
  }
  
  // Load container setting
  const container = localStorage.getItem('box-container');
  if (container) {
    change_box_container(container);
  }

  // Update user profile information
  updateUserProfile();

  fetch('components/sidebar.html')
    .then(response => response.text())
    .then(data => {
      document.getElementById('sidebar-container').innerHTML = data;
      // Initialize feather icons after loading sidebar
      feather.replace();
      // Initialize dropdown functionality
      if (!!document.querySelector('.navbar-content')) {
        new SimpleBar(document.querySelector('.navbar-content'));
      }
      var elem = document.querySelectorAll('.pc-navbar li:not(.pc-trigger) .pc-submenu');
      for (var j = 0; j < elem.length; j++) {
        elem[j].style.display = 'none';
      }
      menu_click();
    });

  // Add sidebar collapse functionality (Desktop Only - Re-added)
  console.log('DOM Content Loaded - Initializing sidebar collapse (Desktop Only)');
  
  // Function to initialize sidebar collapse
  function initializeSidebarCollapse() {
    // Handle sidebar collapse on desktop
    const sidebarHideBtn = document.getElementById('sidebar-hide');
    console.log('Looking for sidebar-hide button:', sidebarHideBtn);
    
    if (sidebarHideBtn) {
      console.log('Found sidebar-hide button, adding click listener');
      sidebarHideBtn.addEventListener('click', function(e) {
        console.log('Sidebar hide button clicked');
        e.preventDefault();
        e.stopPropagation();
        
        // Only apply on desktop resolutions
        if (window.innerWidth >= 992) {
          const body = document.querySelector('body');
          const sidebar = document.querySelector('.pc-sidebar');
          const pcContainer = document.querySelector('.pc-container');
          
          console.log('Current body classes:', body.classList);
          console.log('Current sidebar classes:', sidebar.classList);
          
          // Toggle sidebar collapse
          if (body.classList.contains('pc-sidebar-collapsed')) {
            console.log('Removing collapsed state');
            body.classList.remove('pc-sidebar-collapsed');
            sidebar.classList.remove('collapsed');
            sidebar.style.width = ''; // Revert to default/CSS width
            sidebar.style.transform = ''; // Revert to default/CSS transform
            if (pcContainer) {
              pcContainer.style.marginLeft = ''; // Revert to default/CSS margin
            }
            localStorage.removeItem('sidebar-collapsed');
          } else {
            console.log('Adding collapsed state');
            body.classList.add('pc-sidebar-collapsed');
            sidebar.classList.add('collapsed');
            // Set collapsed state styles (adjust as per your CSS for collapsed state)
            sidebar.style.width = '0';
            sidebar.style.transform = 'translateX(-100%)';
             if (pcContainer) {
               pcContainer.style.marginLeft = '0';
             }
            localStorage.setItem('sidebar-collapsed', 'true');
          }
        }
      });
    } else {
      console.log('Could not find sidebar-hide button, will retry in 100ms');
      setTimeout(initializeSidebarCollapse, 100); // Retry initialization if element not found
    }
  }

  // Start desktop sidebar initialization
  initializeSidebarCollapse();

  // Load saved sidebar state on desktop load
  const sidebarCollapsed = localStorage.getItem('sidebar-collapsed');
  if (sidebarCollapsed === 'true' && window.innerWidth >= 992) {
    const body = document.querySelector('body');
    const sidebar = document.querySelector('.pc-sidebar');
    const pcContainer = document.querySelector('.pc-container');
    
    body.classList.add('pc-sidebar-collapsed');
    sidebar.classList.add('collapsed');
     sidebar.style.width = '0';
     sidebar.style.transform = 'translateX(-100%)';
     if (pcContainer) {
       pcContainer.style.marginLeft = '0';
     }
  }

  // Initialize menu click handlers
  const menuItems = document.querySelectorAll('.pc-menu-item');
  menuItems.forEach(item => {
    const link = item.querySelector('a');
    if (link) {
      link.addEventListener('click', function(e) {
        e.preventDefault();
        const parent = this.parentElement;
        const submenu = parent.querySelector('.pc-submenu');
        
        if (submenu) {
          if (submenu.style.display === 'block') {
            submenu.style.display = 'none';
            parent.classList.remove('active');
          } else {
            submenu.style.display = 'block';
            parent.classList.add('active');
          }
        }
      });
    }
  });

  // Add theme change event listener to window
  window.addEventListener('theme-change', function(e) {
    console.log('Theme change event received:', e.detail);
    if (e.detail && e.detail.theme) {
      layout_change(e.detail.theme);
    }
  });

  // Mobile sidebar toggle logic (works on all pages)
  function initializeMobileNav() {
    console.log('Initializing mobile navigation...');
    const mobileCollapseBtn = document.getElementById('mobile-collapse');
    const sidebarElement = document.querySelector('.pc-sidebar');
    const bodyElement = document.body;

    if (mobileCollapseBtn && sidebarElement) {
      console.log('Found mobile collapse button and sidebar', mobileCollapseBtn, sidebarElement);
      mobileCollapseBtn.removeEventListener('click', handleMobileCollapseClick); // Remove existing listeners if any
      mobileCollapseBtn.addEventListener('click', handleMobileCollapseClick);
    } else {
      console.log('Mobile collapse button or sidebar not found, retrying in 100ms...');
      setTimeout(initializeMobileNav, 100); // Retry initialization if elements not found immediately
    }
  }

  function handleMobileCollapseClick(e) {
    console.log('Mobile collapse button clicked');
    e.preventDefault();
    const bodyElement = document.body;
    const sidebarElement = document.querySelector('.pc-sidebar');
    let overlay = document.querySelector('.pc-sidebar-overlay');

    if (bodyElement.classList.contains('mob-nav-shown')) {
      // Close mobile menu
      bodyElement.classList.remove('mob-nav-shown');
      if(sidebarElement) sidebarElement.classList.remove('mob-sidebar-active');
      if(overlay) {
        overlay.removeEventListener('click', overlay._closeHandler, false);
        overlay.remove();
        console.log('Overlay removed on close');
      }
    } else {
      // Open mobile menu
      bodyElement.classList.add('mob-nav-shown');
      if(sidebarElement) sidebarElement.classList.add('mob-sidebar-active');
      // Add overlay if not exists
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'pc-sidebar-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.background = 'rgba(0,0,0,0.5)';
        overlay.style.zIndex = '1010';
        document.body.appendChild(overlay);
        // Add click event to overlay to close menu
        overlay._closeHandler = function() {
          console.log('Overlay clicked');
          bodyElement.classList.remove('mob-nav-shown');
          if(sidebarElement) sidebarElement.classList.remove('mob-sidebar-active');
          overlay.removeEventListener('click', overlay._closeHandler, false);
          overlay.remove();
          console.log('Overlay removed after click');
        };
        overlay.addEventListener('click', overlay._closeHandler, false);
        console.log('Overlay created and event attached');
      }
    }
  }

  // Start mobile nav initialization
  initializeMobileNav();
});

// Also load theme when page is shown (for browser back/forward)
window.addEventListener('pageshow', function(event) {
  console.log('Page shown event - Checking theme');
  if (event.persisted) {
    console.log('Page restored from bfcache, reloading theme');
    loadUserThemePreference();
  }
}); 