/**
 * EMERGENCY MESSAGE DIRECTION FIX
 * This script forcibly fixes message directions in the chat UI
 * Add this to the bottom of your messages.html page
 */

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚨 Emergency message direction fix loaded!');
  
  // Run immediately and also set interval to catch new messages
  setTimeout(fixAllMessageDirections, 1000);
  
  // Run every 2 seconds to catch any new messages
  setInterval(fixAllMessageDirections, 2000);
  
  // Also hook into the sendMessage function to fix directions right after sending
  hookSendMessageFunction();
});

// Function to hook into the sendMessage function
function hookSendMessageFunction() {
  // Check if window.sendMessage exists
  if (typeof window.sendMessage === 'function') {
    console.log('Hooking into sendMessage function...');
    
    // Store the original function
    const originalSendMessage = window.sendMessage;
    
    // Replace with our wrapped version
    window.sendMessage = async function() {
      // Call the original function
      const result = await originalSendMessage.apply(this, arguments);
      
      // Fix message directions after a small delay
      setTimeout(fixAllMessageDirections, 500);
      
      return result;
    };
    
    console.log('Successfully hooked into sendMessage function');
  } else {
    console.warn('sendMessage function not found, cannot hook');
  }
}

// Main fix function
function fixAllMessageDirections() {
  console.log('Running message direction fix...');
  
  try {
    // Get the current user ID from local storage
    const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (!currentUserId) {
      console.warn('Cannot fix message directions: No user ID found in storage');
      return;
    }
    
    console.log(`Current user ID: ${currentUserId}`);
    
    // Get all message elements
    const messages = document.querySelectorAll('[data-message-id]');
    console.log(`Found ${messages.length} messages to check`);
    
    // Fix each message
    let fixedCount = 0;
    messages.forEach(message => {
      const senderId = message.dataset.senderId;
      if (!senderId) return;
      
      // Determine if this should be an outgoing message (from current user)
      const isOutgoing = senderId === currentUserId || 
                        senderId.includes(currentUserId) || 
                        currentUserId.includes(senderId);
      
      const currentDirection = message.classList.contains('force-message-out') ? 'outgoing' : 'incoming';
      const correctDirection = isOutgoing ? 'outgoing' : 'incoming';
      
      if (currentDirection !== correctDirection) {
        console.log(`Fixing message ${message.dataset.messageId}: Should be ${correctDirection} but is ${currentDirection}`);
        
        // Remove existing direction classes
        message.classList.remove('force-message-in', 'force-message-out');
        
        // Add correct direction class
        message.classList.add(isOutgoing ? 'force-message-out' : 'force-message-in');
        
        // Fix the inner layout
        fixMessageLayout(message, isOutgoing);
        
        fixedCount++;
      }
    });
    
    if (fixedCount > 0) {
      console.log(`Fixed ${fixedCount} message directions`);
    }
    
    return fixedCount;
  } catch (error) {
    console.error('Error fixing message directions:', error);
  }
}

// Fix the inner layout of a message
function fixMessageLayout(messageElement, isOutgoing) {
  try {
    // Get the flex container
    const container = messageElement.querySelector('div[style*="display: flex"]');
    if (!container) return;
    
    // Set correct justification
    container.style.justifyContent = isOutgoing ? 'flex-end' : 'flex-start';
    
    // Get the avatar and content elements
    const avatar = container.querySelector('.chat-avatar-wrapper') || 
                  container.querySelector('.rounded-circle') ||
                  container.querySelector('img.wid-40');
                  
    const content = container.querySelector('div[style*="max-width: 70%"]');
    
    if (!avatar || !content) return;
    
    // Remove all children
    container.innerHTML = '';
    
    // Rebuild with correct order
    if (isOutgoing) {
      // Outgoing: content then avatar
      container.appendChild(content);
      container.appendChild(avatar);
    } else {
      // Incoming: avatar then content
      container.appendChild(avatar);
      container.appendChild(content);
    }
  } catch (e) {
    console.error('Error fixing message layout:', e);
  }
}

// Add a visible fix button
function addFixButton() {
  // Remove any existing button
  const existingButton = document.getElementById('direction-fix-button');
  if (existingButton) {
    existingButton.remove();
  }
  
  // Create button
  const button = document.createElement('button');
  button.id = 'direction-fix-button';
  button.textContent = 'Fix Message Directions';
  button.style.position = 'fixed';
  button.style.bottom = '20px';
  button.style.right = '20px';
  button.style.backgroundColor = '#dc2626';
  button.style.color = 'white';
  button.style.padding = '12px 20px';
  button.style.borderRadius = '8px';
  button.style.border = 'none';
  button.style.cursor = 'pointer';
  button.style.zIndex = '9999';
  button.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
  
  // Add click handler
  button.addEventListener('click', function() {
    const fixedCount = fixAllMessageDirections();
    alert(`Fixed ${fixedCount} message directions`);
  });
  
  // Add to page
  document.body.appendChild(button);
  
  console.log('Fix button added to page');
}

// Expose functions globally
window.fixAllMessageDirections = fixAllMessageDirections;
window.addFixButton = addFixButton;

// Add fix button after a delay
setTimeout(addFixButton, 1500); 