/**
 * Theme Settings Remover
 * 
 * This script removes theme settings elements from all pages
 * and adds CSS to prevent them from being re-added.
 */

(function() {
  // Add CSS to hide theme settings elements
  const style = document.createElement('style');
  style.id = 'hide-theme-settings-style';
  style.textContent = `
    /* Hide theme settings elements */
    #theme-settings-container,
    .pct-c-btn,
    .pct-offcanvas,
    #offcanvas_pc_layout {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      width: 0 !important;
      height: 0 !important;
      position: absolute !important;
      pointer-events: none !important;
      z-index: -9999 !important;
    }
    
    /* Also hide the setting button that may appear outside the container */
    [data-bs-target="#offcanvas_pc_layout"] {
      display: none !important;
      visibility: hidden !important;
    }
    
    /* Hide any elements with theme settings classes */
    .pct-body,
    .pct-config,
    .pct-customizer {
      display: none !important;
    }
  `;
  
  // Add the style element to the head
  (document.head || document.documentElement).appendChild(style);
  
  // Function to remove theme settings elements
  function removeThemeSettings() {
    console.log('Removing theme settings elements');
    
    // Remove the container
    const container = document.getElementById('theme-settings-container');
    if (container) {
      console.log('Removing #theme-settings-container');
      container.innerHTML = ''; // Clear contents first
      container.style.display = 'none';
      container.style.visibility = 'hidden';
      
      // Try to fully remove it
      try {
        container.remove();
      } catch (e) {
        console.log('Could not remove container, cleared it instead');
      }
    }
    
    // Remove any floating buttons
    const buttons = document.querySelectorAll('.pct-c-btn');
    buttons.forEach(button => {
      console.log('Removing pct-c-btn');
      try {
        button.remove();
      } catch (e) {
        button.style.display = 'none';
      }
    });
    
    // Remove any offcanvas elements
    const offcanvas = document.getElementById('offcanvas_pc_layout');
    if (offcanvas) {
      console.log('Removing #offcanvas_pc_layout');
      try {
        offcanvas.remove();
      } catch (e) {
        offcanvas.style.display = 'none';
      }
    }
    
    // For troublesome pages like profile and magic-suggest
    if (window.location.href.includes('profile.html') || 
        window.location.href.includes('magic-suggest.html')) {
      console.log('Enhanced removal for profile/magic-suggest page');
      
      // Use extra force - find any element with 'theme-settings' in its ID or class
      document.querySelectorAll('[id*="theme-settings"], [class*="theme-settings"]').forEach(el => {
        console.log('Removing element with theme-settings in ID/class', el);
        try { el.remove(); } catch(e) { el.style.display = 'none'; }
      });
      
      // Also go through all div elements and look for suspicious content
      document.querySelectorAll('div').forEach(div => {
        if (div.innerHTML && 
            (div.innerHTML.includes('offcanvas_pc_layout') || 
             div.innerHTML.includes('theme-settings') ||
             div.innerHTML.includes('pct-c-btn'))) {
          console.log('Removing suspicious div with theme settings content');
          try { div.remove(); } catch(e) { div.style.display = 'none'; }
        }
      });
      
      // Remove any onClick attributes related to theme settings
      document.querySelectorAll('[onclick*="theme"], [onclick*="layout_change"], [onclick*="setTheme"]').forEach(el => {
        console.log('Removing onClick handler related to theme settings', el);
        el.removeAttribute('onclick');
        el.onclick = null;
        // Also hide the element if it's likely a theme settings button
        if (el.tagName === 'BUTTON' || 
            el.getAttribute('data-theme-toggle') || 
            el.classList.contains('preset-btn')) {
          el.style.display = 'none';
        }
      });
    }
  }
  
  // Remove immediately
  removeThemeSettings();
  
  // Also remove when DOM is loaded
  document.addEventListener('DOMContentLoaded', function() {
    removeThemeSettings();
    
    // Do it again after a short delay to catch late additions
    setTimeout(removeThemeSettings, 500);
    setTimeout(removeThemeSettings, 1000);
    setTimeout(removeThemeSettings, 2000);
  });
  
  // Intercept fetch requests for theme-settings.html
  const originalFetch = window.fetch;
  window.fetch = function(input, init) {
    // If this is a request for theme-settings.html, return an empty response
    if (typeof input === 'string' && 
        (input.includes('theme-settings.html') || input.includes('/components/theme-settings'))) {
      console.log('Intercepted request for theme settings');
      return Promise.resolve(new Response('<!-- Theme settings removed -->', {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }));
    }
    
    // Otherwise, call the original fetch function
    return originalFetch(input, init);
  };
  
  // Set up a MutationObserver to catch any dynamically added theme settings
  const observer = new MutationObserver(function(mutations) {
    let shouldRemove = false;
    
    mutations.forEach(function(mutation) {
      if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
        for (let i = 0; i < mutation.addedNodes.length; i++) {
          const node = mutation.addedNodes[i];
          
          // Check if the added node is a theme settings element
          if ((node.id && node.id === 'theme-settings-container') || 
              (node.classList && node.classList.contains('pct-c-btn')) ||
              (node.id && node.id === 'offcanvas_pc_layout') ||
              // Also check for any element with theme-settings in ID or class
              (node.id && node.id.includes('theme-settings')) ||
              (node.className && typeof node.className === 'string' && node.className.includes('theme-settings'))) {
            shouldRemove = true;
            break;
          }
          
          // Also check if it's a container that contains theme settings elements
          if (node.querySelector) {
            const hasThemeSettings = node.querySelector('#theme-settings-container, .pct-c-btn, #offcanvas_pc_layout, [id*="theme-settings"], [class*="theme-settings"]');
            if (hasThemeSettings) {
              shouldRemove = true;
              break;
            }
            
            // Check for suspiciously similar HTML content
            if (node.innerHTML && 
                (node.innerHTML.includes('offcanvas_pc_layout') || 
                 node.innerHTML.includes('theme-settings') ||
                 node.innerHTML.includes('pct-c-btn'))) {
              shouldRemove = true;
              break;
            }
          }
        }
      }
    });
    
    if (shouldRemove) {
      removeThemeSettings();
    }
  });
  
  // Start observing once DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    });
  } else {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
})(); 