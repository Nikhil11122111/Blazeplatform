/**
 * Chat Test Fix
 * This is a script you can copy and paste into your browser console to fix message directions
 * without refreshing the page.
 */

// Copy all of this code and paste it into your browser console when viewing the messages page

console.log('🛠️ Chat message fix script started');

// Function to fix message directions
function fixMessageDirections() {
  console.log('🔄 Running message direction fix...');
  
  // Get the current user ID from localStorage/sessionStorage
  const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
  if (!currentUserId) {
      console.error('❌ No user ID found in storage');
      return;
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
      
      // If this is our own message but has the wrong class
      if (senderId === currentUserId && element.classList.contains('force-message-in')) {
          console.log('🔧 Fixing outgoing message:', senderId);
          // Fix the direction
          element.classList.remove('force-message-in');
          element.classList.add('force-message-out');
          
          // Also rearrange the content if needed
          const container = element.querySelector('div[style*="display: flex"]');
          if (container) {
              container.style.justifyContent = 'flex-end';
          }
          
          fixedCount++;
      }
      // If it's our message but with a different format (sometimes happens in chat systems)
      else if (element.dataset.clientMessageId && element.classList.contains('force-message-in')) {
          console.log('🔧 Fixing outgoing message by client ID');
          element.classList.remove('force-message-in');
          element.classList.add('force-message-out');
          
          // Also rearrange the content if needed
          const container = element.querySelector('div[style*="display: flex"]');
          if (container) {
              container.style.justifyContent = 'flex-end';
          }
          
          fixedCount++;
      }
  });
  
  console.log(`✅ Fixed ${fixedCount} message directions`);
  return fixedCount;
}

// Override the renderSingleMessage function if it exists
if (typeof window.renderSingleMessage === 'function') {
  console.log('🔧 Patching renderSingleMessage function');
  
  const originalRenderSingleMessage = window.renderSingleMessage;
  
  window.renderSingleMessage = function(message, isFromCurrentUser) {
    // If we're not sure if this is from the current user, check ourselves
    if (isFromCurrentUser === undefined) {
      // Get current user ID
      const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      isFromCurrentUser = String(message.senderId).trim() === String(currentUserId).trim();
      
      // For new messages from this session
      if (!isFromCurrentUser && (message.clientMessageId || message._id?.startsWith('temp-'))) {
        isFromCurrentUser = true;
      }
      
      console.log(`Message direction check: ${isFromCurrentUser ? 'outgoing' : 'incoming'}`, message);
    }
    
    // Call original with corrected direction
    return originalRenderSingleMessage(message, isFromCurrentUser);
  };
}

// Fix existing messages
const fixedCount = fixMessageDirections();

// Fix new messages as they come in
const chatContainer = document.querySelector('.scroll-block.chat-message .card-body');
if (chatContainer) {
  console.log('👀 Setting up message observer');
  
  // Create an observer to watch for new messages
  const observer = new MutationObserver(function(mutations) {
    setTimeout(fixMessageDirections, 100);
  });
  
  // Start observing
  observer.observe(chatContainer, { childList: true, subtree: true });
}

// Fix simplified mode by turning it off
console.log('🔄 Disabling simplified mode');
sessionStorage.removeItem('useSimplifiedChatMode');

// Return summary
console.log('✅ Chat fixes complete');
`Fixed ${fixedCount} message directions`; 