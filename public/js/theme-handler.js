/**
 * Theme Handler
 * Manages theme preferences and synchronizes with the server
 */

// Theme options
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system'
};

// Get current user ID from localStorage or data attribute
function getCurrentUserId() {
  return localStorage.getItem('userId') || document.body.getAttribute('data-user-id');
}

// Apply theme to document
function applyTheme(theme) {
  // Remove any existing theme classes
  document.documentElement.classList.remove('theme-light', 'theme-dark');
  
  if (theme === THEMES.SYSTEM) {
    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.add(`theme-${prefersDark ? 'dark' : 'light'}`);
    
    // Listen for system theme changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      document.documentElement.classList.remove('theme-light', 'theme-dark');
      document.documentElement.classList.add(`theme-${e.matches ? 'dark' : 'light'}`);
    });
  } else {
    // Apply specific theme
    document.documentElement.classList.add(`theme-${theme}`);
  }
  
  // Store theme in localStorage for faster initial load
  localStorage.setItem('theme', theme);
}

// Load theme preference from server
async function loadThemePreference() {
  try {
    const userId = getCurrentUserId();
    if (!userId) {
      console.warn('User ID not found, using default theme');
      applyTheme(THEMES.LIGHT);
      return;
    }
    
    const response = await fetch(`/api/user/preferences/theme/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': localStorage.getItem('sessionId')
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      applyTheme(data.theme || THEMES.LIGHT);
    } else {
      console.warn('Failed to load theme preference from server, using default');
      applyTheme(THEMES.LIGHT);
    }
  } catch (error) {
    console.error('Error loading theme preference:', error);
    applyTheme(THEMES.LIGHT);
  }
}

// Save theme preference to server
async function saveThemePreference(theme) {
  try {
    const response = await fetch('/api/user/preferences/theme', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-id': localStorage.getItem('sessionId')
      },
      body: JSON.stringify({ theme })
    });
    
    if (response.ok) {
      console.log('Theme preference saved successfully');
      return true;
    } else {
      console.warn('Failed to save theme preference to server');
      return false;
    }
  } catch (error) {
    console.error('Error saving theme preference:', error);
    return false;
  }
}

// Set theme and save to server
function setTheme(theme) {
  applyTheme(theme);
  saveThemePreference(theme);
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  // Try to use cached theme first for faster rendering
  const cachedTheme = localStorage.getItem('theme');
  if (cachedTheme) {
    applyTheme(cachedTheme);
  }
  
  // Then load from server to ensure it's up-to-date
  loadThemePreference();
  
  // Set up theme toggle buttons if they exist
  document.querySelectorAll('[data-theme-toggle]').forEach(button => {
    button.addEventListener('click', (e) => {
      const targetTheme = e.currentTarget.getAttribute('data-theme-toggle');
      setTheme(targetTheme);
    });
  });
}); 