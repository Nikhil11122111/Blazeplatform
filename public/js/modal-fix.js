/**
 * Modal z-index enforcer script
 * This script ensures all modals appear above all other elements by applying
 * extremely high z-index values and making sure modals are direct children of body
 */

document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing modal z-index enforcer');
  
  // Global click handler to enforce z-index on any modal that's being opened
  document.addEventListener('click', function(event) {
    // Find any click that might be opening a modal
    if (event.target.getAttribute('onclick') && 
        (event.target.getAttribute('onclick').includes('openImageModal') || 
         event.target.getAttribute('onclick').includes('openFileModal'))) {
      
      console.log('Modal open click detected, scheduling z-index enforcement');
      
      // Run after a small delay to ensure the modal is actually open
      setTimeout(() => {
        console.log('Enforcing z-index on active modals');
        
        // Find all visible modals
        const modals = document.querySelectorAll('.image-preview-modal, .file-preview-modal');
        modals.forEach(modal => {
          if (modal.style.display !== 'none') {
            console.log('Enforcing z-index on modal:', modal.id);
            
            // Apply extreme z-index
            modal.style.setProperty('z-index', '10000000', 'important');
            
            // Also apply to modal content
            const content = modal.querySelector('.modal-content');
            if (content) {
              content.style.setProperty('z-index', '10000001', 'important');
            }
            
            // Move to body if needed
            if (modal.parentElement !== document.body) {
              console.log('Moving modal to document.body for proper rendering');
              document.body.appendChild(modal);
            }
          }
        });
      }, 50);
    }
  });
  
  // Keyboard handler for closing modals with escape key
  document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
      // Find any open modals
      const openModals = document.querySelectorAll('.image-preview-modal[style*="display: block"], .file-preview-modal[style*="display: block"]');
      
      // Close them
      openModals.forEach(modal => {
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Restore scrolling
      });
    }
  });
  
  // Mutation observer to watch for modals being added to DOM
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        for (let node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if it's a modal or contains a modal
            const modals = node.classList && 
              (node.classList.contains('image-preview-modal') || node.classList.contains('file-preview-modal')) ? 
              [node] : node.querySelectorAll('.image-preview-modal, .file-preview-modal');
            
            if (modals.length) {
              console.log('New modal elements detected in DOM, enforcing z-index');
              
              modals.forEach(modal => {
                // Apply extreme z-index
                modal.style.setProperty('z-index', '10000000', 'important');
                
                // Also apply to modal content
                const content = modal.querySelector('.modal-content');
                if (content) {
                  content.style.setProperty('z-index', '10000001', 'important');
                }
              });
            }
          }
        }
      }
    });
  });
  
  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
  
  // Immediately fix any existing modals
  const existingModals = document.querySelectorAll('.image-preview-modal, .file-preview-modal');
  if (existingModals.length) {
    console.log(`Found ${existingModals.length} existing modals, applying z-index fixes`);
    
    existingModals.forEach(modal => {
      // Apply extreme z-index
      modal.style.setProperty('z-index', '10000000', 'important');
      
      // Also apply to modal content
      const content = modal.querySelector('.modal-content');
      if (content) {
        content.style.setProperty('z-index', '10000001', 'important');
      }
    });
  }
});

// Helper function to fix any modals that might not be working properly
window.fixModalZIndex = function() {
  console.log('Manual modal z-index fix triggered');
  
  // Get all modals
  const modals = document.querySelectorAll('.image-preview-modal, .file-preview-modal');
  
  if (modals.length === 0) {
    console.log('No modals found in DOM');
    return 'No modals found to fix';
  }
  
  console.log(`Fixing z-index for ${modals.length} modals`);
  
  modals.forEach((modal, index) => {
    console.log(`Fixing modal ${index+1}/${modals.length}: ${modal.id || 'unnamed modal'}`);
    
    // Apply extreme z-index
    modal.style.setProperty('z-index', '10000000', 'important');
    
    // Also apply to modal content
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.style.setProperty('z-index', '10000001', 'important');
    }
    
    // Move to body if needed
    if (modal.parentElement !== document.body) {
      console.log(`Moving modal ${index+1} to document.body for proper rendering`);
      document.body.appendChild(modal);
    }
  });
  
  return `Fixed z-index for ${modals.length} modals`;
};
