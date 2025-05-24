/**
 * Theme Management for Blaze Application
 * Handles loading and saving theme preferences across all pages
 */

// Theme switching function
function setTheme(theme) {
  console.log('Setting theme:', theme);
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId');
  const userId = localStorage.getItem('userId');
  
  // Update UI for theme selection buttons
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    if (btn.getAttribute('data-theme-toggle') === theme) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
  
  // Apply the theme
  if (theme === 'dark') {
    layout_change('dark');
    
    // Save to database if user is logged in
    if (token && sessionId && userId) {
      saveThemeToDatabase(theme);
    }
  } else if (theme === 'light') {
    layout_change('light');
    
    // Save to database if user is logged in
    if (token && sessionId && userId) {
      saveThemeToDatabase(theme);
    }
  } else if (theme === 'system') {
    layout_change_default();
    
    // Save default preference to database if user is logged in
    if (token && sessionId && userId) {
      saveThemeToDatabase('system');
    }
  }
}

// Save theme preference to database
function saveThemeToDatabase(theme) {
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId');
  
  if (!token || !sessionId) {
    console.log('Cannot save theme to database: not authenticated');
    return;
  }
  
  fetch('/api/users/preferences/theme', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId
    },
    body: JSON.stringify({ theme })
  })
  .then(response => response.json())
  .then(data => {
    console.log('Theme preference saved to database:', data);
    
    // Update localStorage to keep it in sync
    localStorage.setItem('theme', theme);
    
    // Dispatch event for any other components that need to know
    document.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
  })
  .catch(error => {
    console.error('Error saving theme preference:', error);
  });
}

// Load theme preference from database
function loadThemeFromDatabase() {
  const token = localStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId');
  
  if (!token || !sessionId) {
    console.log('No authentication, using localStorage theme');
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('light'); // Default theme
    }
    return;
  }
  
  fetch('/api/users/preferences/theme', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId
    }
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to fetch theme preferences');
    }
    return response.json();
  })
  .then(data => {
    console.log('Theme preference loaded from database:', data);
    if (data.theme) {
      // Set theme and update localStorage
      localStorage.setItem('theme', data.theme);
      setTheme(data.theme);
    } else {
      // Use localStorage if no database preference
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme) {
        setTheme(savedTheme);
      } else {
        setTheme('light'); // Default theme
      }
    }
  })
  .catch(error => {
    console.error('Error loading theme preference:', error);
    // Fallback to localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      setTheme('light'); // Default theme
    }
  });
}

// Initialize theme
function initializeTheme() {
  // Load theme preference from database
  loadThemeFromDatabase();
  
  // Add event listeners for theme toggle buttons
  setTimeout(() => {
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      btn.addEventListener('click', function() {
        const theme = this.getAttribute('data-theme-toggle');
        setTheme(theme);
      });
    });
    
    // Initialize layout reset button
    const resetBtn = document.getElementById('layoutreset');
    if (resetBtn) {
      resetBtn.addEventListener('click', function() {
        resetLayout();
        // Also clear theme preference in database
        saveThemeToDatabase('light');
      });
    }
    
    // Activate the current theme button
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
      if (btn.getAttribute('data-theme-toggle') === currentTheme) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }, 500);
}

// Initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  // Don't initialize immediately, wait for theme settings to load
  // This will be called explicitly from each page
});

// Apply theme immediately from localStorage to prevent flashing
(function() {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    document.documentElement.classList.add('dark');
    document.body.setAttribute('data-pc-theme', 'dark');
  }
})(); 