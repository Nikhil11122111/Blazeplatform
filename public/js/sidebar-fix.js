/**
 * Sidebar Dropdown Fix
 * This script ensures that the Settings dropdown in the sidebar works correctly
 * on all pages including profile.html and magic-suggest.html
 */

document.addEventListener('DOMContentLoaded', function() {
  // Function to initialize pcoded properly
  function initializePcoded() {
    if (typeof pcoded !== 'undefined') {
      try {
        // This is the exact same call used in dashboard.html
        pcoded.start();
        console.log('pcoded initialized');
      } catch (e) {
        console.error('Error starting pcoded:', e);
      }
    }
  }
  
  // Initialize pcoded on DOM ready (same as dashboard.html)
  initializePcoded();
  
  // Create an observer to watch for the sidebar being added to the DOM
  const observer = new MutationObserver(function(mutations) {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        const sidebar = document.querySelector('.pc-sidebar');
        if (sidebar) {
          // Fix the Settings menu item structure
          fixSettingsMenuStructure();
          
          // Sidebar has been loaded, initialize pcoded again
          initializePcoded();
          
          // Stop observing
          observer.disconnect();
          break;
        }
      }
    }
  });
  
  // Function to fix the Settings menu structure
  function fixSettingsMenuStructure() {
    // Get the settings menu item or create it if it doesn't exist
    let settingsMenuItem = document.querySelector('.pc-sidebar .pc-navbar .pc-item.pc-hasmenu#settings-menu-item');
    
    // If not found by ID, try without ID
    if (!settingsMenuItem) {
      settingsMenuItem = document.querySelector('.pc-sidebar .pc-navbar .pc-item.pc-hasmenu');
    }
    
    // If still not found, we need to create it
    if (!settingsMenuItem) {
      // Find the navbar
      const navbar = document.querySelector('.pc-sidebar .pc-navbar');
      if (!navbar) return; // No navbar found, can't proceed
      
      // Create the settings menu item from scratch
      settingsMenuItem = document.createElement('li');
      settingsMenuItem.className = 'pc-item pc-hasmenu';
      settingsMenuItem.id = 'settings-menu-item';
      
      // Add it to the navbar
      navbar.appendChild(settingsMenuItem);
      
      // Set the full HTML structure
      settingsMenuItem.innerHTML = `
        <a href="#!" class="pc-link">
          <span class="pc-micon">
            <svg class="pc-icon">
              <use xlink:href="#custom-setting-2"></use>
            </svg>
          </span>
          <span class="pc-mtext">Settings</span>
          <span class="pc-arrow"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg></span>
        </a>
        <ul class="pc-submenu" style="display: none;">
          <li class="pc-item"><a class="pc-link" href="change-password.html">Change Password</a></li>
        </ul>
      `;
    } else {
      // Ensure the menu item has the correct ID
      settingsMenuItem.id = 'settings-menu-item';
      
      // Get the menu structure elements
      let pcLink = settingsMenuItem.querySelector('.pc-link');
      let pcMicon = settingsMenuItem.querySelector('.pc-micon');
      let pcMtext = settingsMenuItem.querySelector('.pc-mtext');
      let pcArrow = settingsMenuItem.querySelector('.pc-arrow');
      let pcSubmenu = settingsMenuItem.querySelector('.pc-submenu');
      
      // Check and fix each component if needed
      
      // Fix the link
      if (!pcLink) {
        pcLink = document.createElement('a');
        pcLink.className = 'pc-link';
        pcLink.href = '#!';
        settingsMenuItem.prepend(pcLink);
      } else {
        pcLink.href = '#!';
      }
      
      // Fix the icon
      if (!pcMicon) {
        pcMicon = document.createElement('span');
        pcMicon.className = 'pc-micon';
        pcMicon.innerHTML = `<svg class="pc-icon"><use xlink:href="#custom-setting-2"></use></svg>`;
        pcLink.prepend(pcMicon);
      } else {
        pcMicon.innerHTML = `<svg class="pc-icon"><use xlink:href="#custom-setting-2"></use></svg>`;
      }
      
      // Fix the text
      if (!pcMtext) {
        pcMtext = document.createElement('span');
        pcMtext.className = 'pc-mtext';
        pcMtext.textContent = 'Settings';
        pcLink.appendChild(pcMtext);
      } else {
        pcMtext.textContent = 'Settings';
      }
      
      // Fix the arrow
      if (!pcArrow) {
        pcArrow = document.createElement('span');
        pcArrow.className = 'pc-arrow';
        pcArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>';
        pcLink.appendChild(pcArrow);
      } else {
        pcArrow.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="feather feather-chevron-right"><polyline points="9 18 15 12 9 6"></polyline></svg>';
      }
      
      // Fix the submenu
      if (!pcSubmenu) {
        pcSubmenu = document.createElement('ul');
        pcSubmenu.className = 'pc-submenu';
        pcSubmenu.style.display = 'none';
        pcSubmenu.innerHTML = `<li class="pc-item"><a class="pc-link" href="change-password.html">Change Password</a></li>`;
        settingsMenuItem.appendChild(pcSubmenu);
      } else {
        pcSubmenu.style.display = 'none';
        
        // Check if the submenu has the proper content
        const submenuLinks = pcSubmenu.querySelectorAll('.pc-item a');
        if (submenuLinks.length === 0) {
          // If empty or incorrect, set the correct content
          pcSubmenu.innerHTML = `<li class="pc-item"><a class="pc-link" href="change-password.html">Change Password</a></li>`;
        }
      }
    }
    
    // Get the link again to ensure we have the latest version
    const pcLink = settingsMenuItem.querySelector('.pc-link');
    if (pcLink) {
      // Remove existing handlers
      const newLink = pcLink.cloneNode(true);
      pcLink.parentNode.replaceChild(newLink, pcLink);
      
      // Add click handler
      newLink.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const parent = this.parentNode;
        const submenu = parent.querySelector('.pc-submenu');
        
        if (parent.classList.contains('pc-trigger')) {
          // Close the menu
          parent.classList.remove('pc-trigger');
          if (submenu) submenu.style.display = 'none';
        } else {
          // Open the menu
          parent.classList.add('pc-trigger');
          if (submenu) submenu.style.display = 'block';
        }
      });
    }
    
    // If on change-password page, open the dropdown
    if (window.location.pathname.includes('change-password.html')) {
      settingsMenuItem.classList.add('pc-trigger');
      const pcSubmenu = settingsMenuItem.querySelector('.pc-submenu');
      if (pcSubmenu) pcSubmenu.style.display = 'block';
    }
    
    // Ensure feather icons are rendered
    if (typeof feather !== 'undefined' && typeof feather.replace === 'function') {
      feather.replace();
    }
  }
  
  // Start observing the document for changes
  observer.observe(document.documentElement, { 
    childList: true, 
    subtree: true 
  });
  
  // Also try to initialize after a delay as fallback
  setTimeout(function() {
    initializePcoded();
    fixSettingsMenuStructure();
  }, 500);
});

// Chat message direction fix script

(function() {
    // Fix message directions when DOM is loaded
    document.addEventListener('DOMContentLoaded', function() {
        console.log('📱 Message direction fix script loaded');
        
        // Try to fix message directions immediately
        setTimeout(fixMessageDirections, 1000);
        
        // Also add a mutation observer to catch future messages
        setupMessageObserver();
    });
    
    // Fix existing messages
    function fixMessageDirections() {
        console.log('🔄 Running message direction fix...');
        
        // Get the current user ID from localStorage/sessionStorage
        let currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
        
        if (!currentUserId) {
            console.warn('⚠️ No user ID found in storage, trying to recover...');
            
            // Try to get userId from network calls or other storages
            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
            const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
            
            if (!token || !sessionId) {
                console.error('❌ No authentication credentials found');
                return;
            }
            
            // Look for userId in the DOM as a fallback
            const userIdElements = document.querySelectorAll('[data-user-id]');
            if (userIdElements && userIdElements.length > 0) {
                currentUserId = userIdElements[0].dataset.userId;
                console.log('🔍 Found user ID in DOM:', currentUserId);
                
                // Store it for future use
                if (currentUserId) {
                    localStorage.setItem('userId', currentUserId);
                }
            } else {
                // Fetch user ID asynchronously - this won't help the current execution
                // but will help on future calls to this function
                fetch('https://blaze-266099623138.asia-east1.run.app/api/auth/me', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'X-Session-ID': sessionId
                    }
                })
                .then(response => {
                    if (response.ok) return response.json();
                    throw new Error('Failed to fetch user data');
                })
                .then(userData => {
                    if (userData && userData._id) {
                        localStorage.setItem('userId', userData._id);
                        console.log('💾 Retrieved and stored user ID for future use:', userData._id);
                        
                        // Try to run the fix again now that we have the userId
                        setTimeout(fixMessageDirections, 500);
                    }
                })
                .catch(error => console.error('Failed to fetch user ID:', error));
                
                console.error('❌ No user ID found and could not recover immediately');
                return;
            }
        }
        
        console.log('👤 Current user ID:', currentUserId);
        
        // Find all message elements
        const messageElements = document.querySelectorAll('.force-message-in, .force-message-out');
        console.log(`Found ${messageElements.length} messages to check`);
        
        // Count fixed messages
        let fixedCount = 0;
        
        // Check each message
        messageElements.forEach(element => {
            // Get sender ID from data attribute
            const senderId = element.dataset.senderId;
            if (!senderId) return;
            
            // If it's an outgoing message (from current user) but has the wrong class
            if (senderId === currentUserId && element.classList.contains('force-message-in')) {
                console.log('🔧 Fixing outgoing message:', senderId);
                // Fix the direction
                element.classList.remove('force-message-in');
                element.classList.add('force-message-out');
                fixedCount++;
            }
            // If it's our message but with a different format (sometimes happens in chat systems)
            else if (element.dataset.clientMessageId && element.classList.contains('force-message-in')) {
                console.log('🔧 Fixing outgoing message by client ID');
                element.classList.remove('force-message-in');
                element.classList.add('force-message-out');
                fixedCount++;
            }
        });
        
        console.log(`✅ Fixed ${fixedCount} message directions`);
        return fixedCount;
    }
    
    // Setup observer to catch new messages
    function setupMessageObserver() {
        const chatContainer = document.querySelector('.scroll-block.chat-message .card-body');
        if (!chatContainer) return;
        
        // Create an observer to watch for new messages
        const observer = new MutationObserver(function(mutations) {
            // If new nodes were added, check if they're messages
            mutations.forEach(mutation => {
                if (mutation.addedNodes.length > 0) {
                    // Run the fix after a short delay to ensure elements are rendered
                    setTimeout(fixMessageDirections, 100);
                }
            });
        });
        
        // Start observing the chat container
        observer.observe(chatContainer, { childList: true, subtree: true });
        console.log('👀 Message observer started');
    }
    
    // Add a global function to manually fix messages
    window.fixChatMessageDirections = fixMessageDirections;
})(); 