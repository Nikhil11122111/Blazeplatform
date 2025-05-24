/**
 * Chat UI Controller
 * Manages the chat interface, conversations, and messages
 */

// Add CSS for message direction - with important flags to override any existing styles
document.addEventListener('DOMContentLoaded', function() {
  const style = document.createElement('style');
  style.textContent = `
    /* Force message styling - using !important to override any conflicting styles */
    .force-message-out {
      display: flex !important;
      justify-content: flex-end !important;
      margin-bottom: 15px !important;
      width: 100% !important;
    }
    
    .force-message-in {
      display: flex !important;
      justify-content: flex-start !important;
      margin-bottom: 15px !important;
      width: 100% !important;
    }
    
    .force-message-out .msg-content {
      background-color: #dc2626 !important;
      color: white !important;
      border-radius: 10px !important;
      padding: 10px 15px !important;
      display: inline-block !important;
      max-width: 70% !important;
      text-align: left !important;
    }
    
    .force-message-in .msg-content {
      background-color: #f3f3f3 !important;
      color: #333 !important;
      border-radius: 10px !important;
      padding: 10px 15px !important;
      display: inline-block !important;
      max-width: 70% !important;
      text-align: left !important;
    }
  `;
  document.head.appendChild(style);
  
  // Add refresh button functionality
  const refreshButton = document.getElementById('refresh-chats-btn');
  if (refreshButton) {
    refreshButton.addEventListener('click', async function() {
      // Visual feedback on click
      const icon = this.querySelector('i');
      if (icon) {
        icon.classList.add('ti-spin');
        this.disabled = true;
      }
      
      try {
        console.log('Refreshing conversations list...');
        await loadConversations();
        
        // If there's a current conversation, refresh messages too
        if (currentConversation && currentConversation.otherUser) {
          console.log('Refreshing current conversation messages...');
          await loadMessages(currentConversation.otherUser._id);
        }
        
        // Show success toast
        const toast = document.createElement('div');
        toast.className = 'alert alert-success position-fixed';
        toast.style.top = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.padding = '10px 15px';
        toast.style.borderRadius = '4px';
        toast.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
        toast.innerHTML = '<i class="ti ti-check me-2"></i> Chats refreshed successfully';
        document.body.appendChild(toast);
        
        // Remove toast after 3 seconds
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 3000);
      } catch (error) {
        console.error('Error refreshing chats:', error);
        alert('Failed to refresh chats. Please try again.');
      } finally {
        // Reset button state
        if (icon) {
          icon.classList.remove('ti-spin');
          this.disabled = false;
        }
      }
    });
  }
});

// Keep track of current state
let currentConversation = null;
let currentUser = null;
let conversations = [];
let messages = [];
let isTyping = false;
let typingTimeout = null;
let lastTypingEmit = 0;

// DOM elements - we'll cache these on load
let conversationsList = null;
let messageContainer = null;
let messageInput = null;
let sendButton = null;
let searchInput = null;
let userInfo = null;
let unreadBadge = null;

// Make troubleshooting function available globally
window.fixChatMessageDirections = function() {
  console.log("Starting chat message direction fix...");
  
  if (messages && messages.length > 0) {
    console.log(`Rebuilding ${messages.length} messages from scratch`);
    renderMessages(messages);
    return `Rebuilt ${messages.length} messages with correct directions.`;
  } else {
    return "No messages to fix. Try loading a conversation first.";
  }
};

// Add this function for emergency clearing and reloading
window.nukeAndRebuildChat = function() {
  console.log("🧨 EMERGENCY CHAT RESET 🧨");
  
  // Clear the DOM
  if (messageContainer) {
    messageContainer.innerHTML = '';
  }
  
  // Reset all variables
  messages = [];
  
  // Force reload the current conversation if available
  if (currentConversation && currentConversation.otherUser && currentConversation.otherUser._id) {
    console.log("Reloading conversation with user:", currentConversation.otherUser._id);
    loadMessages(currentConversation.otherUser._id);
    return "Chat has been reset and is reloading...";
  } else {
    return "Chat has been reset. Please select a conversation to reload.";
  }
};

// Add function to refresh chat state - this is called when socket reconnects
window.refreshChatState = function() {
  console.log("🔄 Refreshing chat state after reconnection...");
  
  // Check if we're in simplified mode
  const useSimplifiedMode = sessionStorage.getItem('useSimplifiedChatMode') === 'true';
  
  // If we were in simplified mode but now have a socket connection, we can switch back to real-time
  if (useSimplifiedMode && window.chatSocket && window.chatSocket.isConnected && window.chatSocket.isConnected()) {
    console.log("💡 Socket is now connected - attempting to disable simplified mode");
    
    // Remove simplified mode flag
    sessionStorage.removeItem('useSimplifiedChatMode');
    
    // If we have a simplified mode indicator, update it
    const indicator = document.getElementById('simplified-mode-indicator');
    if (indicator) {
      indicator.innerHTML = `
        <small>
          <i class="ti ti-check-circle me-1"></i>
          Real-time chat connection restored! Messages will now update automatically.
          <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
        </small>
      `;
      indicator.className = 'alert alert-success alert-dismissible fade show m-2';
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        indicator.classList.remove('show');
        setTimeout(() => indicator.remove(), 300);
      }, 5000);
    }
    
    // Setup real-time listeners
    setupRealtimeListeners();
  }
  
  // Refresh the current conversation
  if (currentConversation && currentConversation.otherUser && currentConversation.otherUser._id) {
    console.log("Reloading current conversation after reconnection");
    loadMessages(currentConversation.otherUser._id);
  }
  
  return "Chat state refreshed after reconnection";
};

// Initialize the chat interface
async function initChatInterface() {
  try {
    console.log('Initializing chat interface...');
    
    // Get current user
    currentUser = {
      id: localStorage.getItem('userId') || sessionStorage.getItem('userId'),
      username: localStorage.getItem('username') || sessionStorage.getItem('username'),
      fullName: localStorage.getItem('fullName') || sessionStorage.getItem('username')
    };
    
    if (!currentUser.id) {
      console.warn('User ID not found in storage, attempting to fetch from server...');
      
      try {
        // Get token from storage
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
        
        if (!token || !sessionId) {
          console.error('No authentication credentials found');
          showError('You must be logged in to use chat. Please log in and try again.');
          return;
        }
        
        // Attempt to fetch user data from server
        const response = await fetch('https://blazeplatform.onrender.com/api/auth/me', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Session-ID': sessionId
          }
        });
        
        if (response.ok) {
          const userData = await response.json();
          
          if (userData && userData._id) {
            // Store the retrieved user ID
            localStorage.setItem('userId', userData._id);
            
            if (userData.username) {
              localStorage.setItem('username', userData.username);
            }
            
            if (userData.full_name) {
              localStorage.setItem('fullName', userData.full_name);
            }
            
            // Update current user object
            currentUser = {
              id: userData._id,
              username: userData.username || 'Unknown',
              fullName: userData.full_name || userData.username || 'Unknown'
            };
            
            console.log('Successfully retrieved user data from server');
          } else {
            throw new Error('Invalid user data received from server');
          }
        } else {
          throw new Error('Failed to fetch user data from server');
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        showError('Failed to retrieve your user information. Please refresh the page or try logging in again.');
        return;
      }
    }
    
    // Cache DOM elements
    conversationsList = document.querySelector('.list-group.list-group-flush');
    messageContainer = document.querySelector('.scroll-block.chat-message .card-body');
    messageInput = document.querySelector('.card-footer textarea');
    sendButton = document.querySelector('.card-footer .ti-send').closest('a');
    searchInput = document.querySelector('.form-search input');
    userInfo = document.querySelector('.card-header .media');
    unreadBadge = document.querySelector('h5.mb-4 .badge');
    
    // Set default initial state for header
    resetConversationHeader();
    
    // Disable message input until conversation is selected
    if (messageInput) {
      messageInput.disabled = true;
      messageInput.placeholder = "Select a conversation to start chatting";
    }
    
    if (sendButton) {
      sendButton.classList.add('disabled');
    }
    
    // Initialize the chat API (AJAX-based functionality)
    await window.chatAPI.initialize();
    console.log('Chat API initialized successfully');
    
    // Load conversations
    await loadConversations();
    
    // Set up event handlers
    setupEventHandlers();
    
    // Remove simplified mode flags since we're not using encryption
    sessionStorage.removeItem('useSimplifiedChatMode');
    sessionStorage.removeItem('wsRetryAttempt');
    sessionStorage.removeItem('encryptionFailCount');
    
    // Initialize WebSocket connection for real-time updates
    try {
      console.log('Initializing WebSocket for real-time messaging...');
      const socketResult = await window.chatSocket.connectChatSocket();
      
      if (socketResult.status === 'connected' || socketResult.status === 'already-connected') {
        console.log('WebSocket connected successfully! Setting up real-time listeners');
        setupRealtimeListeners();
      } else {
        console.warn('WebSocket connection failed:', socketResult);
        showSimplifiedModeIndicator();
        setupAutoRefresh(true);
      }
    } catch (socketError) {
      console.error('Error with WebSocket initialization:', socketError);
      showSimplifiedModeIndicator();
      setupAutoRefresh(true);
    }
  } catch (error) {
    console.error('Error initializing chat interface:', error);
    showError('Failed to initialize chat interface: ' + error.message);
  }
}

// Show indicator that simplified mode is active
function showSimplifiedModeIndicator() {
  // Set simplified mode flag
  sessionStorage.setItem('useSimplifiedChatMode', 'true');
  
  // Start auto-refresh mechanism for simplified mode
  setupAutoRefresh(true);
  
  // Create indicator element if not exists
  if (!document.getElementById('simplified-mode-indicator')) {
    const indicator = document.createElement('div');
    indicator.id = 'simplified-mode-indicator';
    indicator.className = 'alert alert-warning alert-dismissible fade show m-2';
    indicator.innerHTML = `
      <small>
        <i class="ti ti-alert-circle me-1"></i>
        Chat is operating in simplified mode with auto-refresh (every 10 seconds). Real-time updates are disabled.
        <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
      </small>
    `;
    
    // Add to top of chat area
    const chatArea = document.querySelector('.scroll-block.chat-message');
    if (chatArea) {
      chatArea.parentNode.insertBefore(indicator, chatArea);
    }
    
    // Add enable real-time button and manual refresh button
    const buttonGroup = document.createElement('div');
    buttonGroup.className = 'btn-group ms-2';
    
    // Enable real-time button
    const enableRealTimeButton = document.createElement('button');
    enableRealTimeButton.className = 'btn btn-sm btn-primary';
    enableRealTimeButton.innerHTML = '<i class="ti ti-rocket me-1"></i> Enable Real-time';
    enableRealTimeButton.addEventListener('click', async () => {
      try {
        enableRealTimeButton.disabled = true;
        enableRealTimeButton.innerHTML = '<i class="ti ti-loader ti-spin me-1"></i> Connecting...';
        
        // Disable auto-refresh when switching to real-time mode
        setupAutoRefresh(false);
        
        // Clear the simplified mode flag
        sessionStorage.removeItem('useSimplifiedChatMode');
        sessionStorage.removeItem('wsRetryAttempt');
        sessionStorage.removeItem('encryptionFailCount');
        
        // Try to connect to the socket
        await tryEnableRealTimeMode();
      } catch (error) {
        console.error('Failed to enable real-time mode:', error);
        enableRealTimeButton.disabled = false;
        enableRealTimeButton.innerHTML = '<i class="ti ti-rocket me-1"></i> Try Again';
        
        // Re-enable auto-refresh as fallback if real-time connection failed
        setupAutoRefresh(true);
      }
    });
    
    // Add reset encryption button
    const resetEncryptionButton = document.createElement('button');
    resetEncryptionButton.className = 'btn btn-sm btn-warning ms-2';
    resetEncryptionButton.innerHTML = '<i class="ti ti-key me-1"></i> Reset Encryption';
    resetEncryptionButton.addEventListener('click', async () => {
      if (confirm('This will reset your encryption keys. Continue?')) {
        resetEncryptionButton.disabled = true;
        resetEncryptionButton.innerHTML = '<i class="ti ti-loader ti-spin me-1"></i> Resetting...';
        
        try {
          await window.resetChatEncryption();
        } catch (error) {
          console.error('Failed to reset encryption via UI button:', error);
          resetEncryptionButton.disabled = false;
          resetEncryptionButton.innerHTML = '<i class="ti ti-key me-1"></i> Try Again';
        }
      }
    });
    
    // Add regular refresh button too
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-sm btn-outline-secondary ms-2';
    refreshButton.innerHTML = '<i class="ti ti-refresh me-1"></i> Refresh Messages';
    refreshButton.addEventListener('click', () => {
      refreshCurrentConversation();
    });
    
    // Add all buttons
    indicator.querySelector('small').appendChild(enableRealTimeButton);
    indicator.querySelector('small').appendChild(resetEncryptionButton);
    indicator.querySelector('small').appendChild(refreshButton);
    
    // Add auto-refresh notification to the indicator
    const autoRefreshNotice = document.createElement('div');
    autoRefreshNotice.className = 'mt-2 small';
    autoRefreshNotice.innerHTML = '<i class="ti ti-refresh me-1"></i> Auto-refresh enabled: Messages will update every 10 seconds';
    indicator.appendChild(autoRefreshNotice);
  }
  
  // Start auto-refresh
  setupAutoRefresh(true);
}

// Function to attempt enabling real-time mode without page refresh
async function tryEnableRealTimeMode() {
  try {
    console.log('Attempting to enable real-time chat mode...');
    
    // First try to establish socket connection
    const socketResult = await window.chatSocket.connectChatSocket();
    
    if (socketResult.status === 'connected' || socketResult.status === 'already-connected') {
      console.log('Successfully established WebSocket connection!');
      
      // Set up real-time listeners
      setupRealtimeListeners();
      
      // Disable auto-refresh since we don't need it with real-time mode
      setupAutoRefresh(false);
      
      // Remove simplified mode indicator
      const indicator = document.getElementById('simplified-mode-indicator');
      if (indicator) {
        // Remove with animation
        indicator.classList.remove('show');
        setTimeout(() => indicator.remove(), 300);
      }
      
      // Show success message
      const successAlert = document.createElement('div');
      successAlert.className = 'alert alert-success alert-dismissible fade show m-2';
      successAlert.innerHTML = `
        <small>
          <i class="ti ti-check-circle me-1"></i>
          Real-time chat enabled! New messages will appear automatically.
          <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
        </small>
      `;
      
      const chatArea = document.querySelector('.scroll-block.chat-message');
      if (chatArea) {
        chatArea.parentNode.insertBefore(successAlert, chatArea);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
          successAlert.classList.remove('show');
          setTimeout(() => successAlert.remove(), 300);
        }, 5000);
      }
      
      // Refresh current conversation to get latest messages
      refreshCurrentConversation();
      
      return true;
    } else {
      console.error('Failed to establish WebSocket connection:', socketResult);
      throw new Error(`WebSocket connection failed: ${socketResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error('Error enabling real-time mode:', error);
    
    // Show error message
    const errorToast = document.createElement('div');
    errorToast.className = 'alert alert-danger m-2';
    errorToast.innerHTML = `
      <small>
        <i class="ti ti-alert-circle me-1"></i>
        Failed to enable real-time chat: ${error.message}
      </small>
    `;
    
    const chatArea = document.querySelector('.scroll-block.chat-message');
    if (chatArea) {
      chatArea.parentNode.insertBefore(errorToast, chatArea);
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorToast.classList.remove('show');
        setTimeout(() => errorToast.remove(), 300);
      }, 5000);
    }
    
    throw error;
  }
}

// Function to refresh current conversation
function refreshCurrentConversation(silentRefresh = false) {
  if (currentConversation && currentConversation.otherUser && currentConversation.otherUser._id) {
    // Show loading indicator only if not silent refresh
    if (!silentRefresh) {
      const loadingIndicator = document.createElement('div');
      loadingIndicator.id = 'refresh-loading-indicator';
      loadingIndicator.className = 'text-center p-2';
      loadingIndicator.innerHTML = '<i class="ti ti-refresh ti-spin me-1"></i> Refreshing messages...';
      
      // Add to bottom of chat area
      const chatArea = document.querySelector('.scroll-block.chat-message');
      if (chatArea) {
        chatArea.appendChild(loadingIndicator);
        // Scroll to the loading indicator
        loadingIndicator.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
    // Try to reconnect WebSocket if simplified mode isn't active
    if (sessionStorage.getItem('useSimplifiedChatMode') !== 'true') {
      // Try to fix WebSocket connection if it's broken
      if (window.chatSocket && typeof window.chatSocket.isConnected === 'function' && !window.chatSocket.isConnected()) {
        console.log('WebSocket disconnected, attempting to reconnect...');
        
        // Try to reconnect but don't wait for it
        window.chatSocket.connectChatSocket().catch(err => {
          console.warn('Failed to reconnect WebSocket during refresh:', err);
        });
      }
    }
    
    // Load messages with a slight delay to allow UI updates
    setTimeout(() => {
      loadMessages(currentConversation.otherUser._id, silentRefresh)
        .then(() => {
          console.log('Successfully refreshed messages');
          // Remove loading indicator if not silent refresh
          if (!silentRefresh) {
            const indicator = document.getElementById('refresh-loading-indicator');
            if (indicator) indicator.remove();
          }
          
          // If we're currently in simplified mode, check if encryption is working
          if (sessionStorage.getItem('useSimplifiedChatMode') === 'true' && 
              window.chatEncryption && 
              typeof window.chatEncryption.testEncryptionHealth === 'function') {
            
            // Check if encryption might be working now
            window.chatEncryption.testEncryptionHealth()
              .then(healthResult => {
                if (healthResult.healthy) {
                  console.log('Encryption appears healthy now - could switch back from simplified mode');
                  
                  // Update the indicator to show encryption could work
                  const simplifiedIndicator = document.getElementById('simplified-mode-indicator');
                  if (simplifiedIndicator) {
                    const tryRegularButton = document.createElement('button');
                    tryRegularButton.className = 'btn btn-sm btn-success ms-2';
                    tryRegularButton.innerHTML = '<i class="ti ti-shield-lock me-1"></i> Enable Real-time';
                    tryRegularButton.addEventListener('click', () => {
                      // Reset simplified mode and reload
                      sessionStorage.removeItem('useSimplifiedChatMode'); 
                      location.reload();
                    });
                    
                    // Only add if not already there
                    if (!simplifiedIndicator.querySelector('.btn-success')) {
                      simplifiedIndicator.querySelector('small').appendChild(tryRegularButton);
                    }
                  }
                }
              })
              .catch(err => {
                console.warn('Failed to check encryption health during refresh:', err);
              });
          }
        })
        .catch(err => {
          console.error('Error refreshing messages:', err);
          // Change loading indicator to error
          const indicator = document.getElementById('refresh-loading-indicator');
          if (indicator) {
            indicator.className = 'text-center p-2 text-danger';
            indicator.innerHTML = '<i class="ti ti-alert-circle me-1"></i> Failed to refresh messages';
            // Auto-remove after 3 seconds
            setTimeout(() => indicator.remove(), 3000);
          }
        });
    }, 200);
  } else {
    console.warn('No active conversation to refresh');
  }
}

// Reset conversation header to default state (no selected conversation)
function resetConversationHeader() {
  if (!userInfo) return;
  
  // Set default placeholder values
  userInfo.innerHTML = `
    <div class="chat-avtar">
      <img class="rounded-circle img-fluid wid-40" src="/assets/images/user/blank-avatar.png" alt="User image">
    </div>
    <div class="media-body mx-3">
      <h5 class="mb-0">Select a conversation</h5>
      <span class="text-sm text-muted">Choose a friend to start chatting</span>
    </div>
  `;
  
  // Clear the message area
  if (messageContainer) {
    messageContainer.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">No conversation selected</p>
        <p class="text-muted small">Select a conversation from the list or search for users to chat with</p>
      </div>
    `;
  }
}

// Display an error message to the user
function showError(message) {
  // Handle in message container if available
  if (messageContainer) {
    messageContainer.innerHTML = `
      <div class="alert alert-danger">
        <h5>Error</h5>
        <p>${message}</p>
        <div class="d-flex flex-column mt-3">
          <button class="btn btn-primary mb-2" onclick="location.reload()">
            <i class="ti ti-refresh"></i> Refresh Page
          </button>
          <button class="btn btn-outline-secondary" onclick="clearChatSessionData()">
            <i class="ti ti-eraser"></i> Clear Session Data & Refresh
          </button>
        </div>
      </div>
    `;
  } else {
    // Fallback to alert if container not found
    alert(message);
  }
}

// Clear all chat session data and refresh
function clearChatSessionData() {
  console.log('Clearing all chat session data');
  // Clear encryption keys
  sessionStorage.removeItem('chatPrivateKey');
  sessionStorage.removeItem('chatPublicKey');
  
  // Clear any cached conversation data
  sessionStorage.removeItem('chatConversations');
  sessionStorage.removeItem('chatMessages');
  
  // Reload the page
  location.reload();
}

// Set up basic event handlers (for when encryption fails)
function setupBasicEventHandlers() {
  // Add event listener to the real-time button
  const realTimeBtn = document.getElementById('enable-realtime-btn');
  if (realTimeBtn) {
    realTimeBtn.addEventListener('click', () => {
      window.forceEnableRealTimeChat();
    });
  }
  
  // Check real-time status on page load
  setTimeout(checkRealTimeStatus, 2000);
  
  // Add search functionality without encryption
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      searchUsersWithoutEncryption(query);
    });
  }
  
  // Notify user about encryption when trying to send a message
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      showError('Secure messaging is currently unavailable. Please try again later.');
    });
  }

  // Add a refresh button 
  if (messageContainer) {
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-primary mt-3';
    refreshButton.textContent = 'Refresh & Try Again';
    refreshButton.addEventListener('click', () => {
      // Clear any session storage to force key regeneration
      sessionStorage.removeItem('chatPrivateKey');
      sessionStorage.removeItem('chatPublicKey');
      location.reload();
    });
    
    const errorDiv = messageContainer.querySelector('.alert');
    if (errorDiv) {
      errorDiv.appendChild(refreshButton);
    }
  }
}

// Function to check real-time status and update status indicator
function checkRealTimeStatus() {
  const statusContainer = document.getElementById('chat-mode-status');
  const statusMessage = document.getElementById('chat-mode-message');
  
  if (!statusContainer || !statusMessage) return;
  
  const isSimplifiedMode = sessionStorage.getItem('useSimplifiedChatMode') === 'true';
  const isSocketConnected = window.chatSocket && 
                            typeof window.chatSocket.isConnected === 'function' && 
                            window.chatSocket.isConnected();
  
  if (isSimplifiedMode || !isSocketConnected) {
    // Show warning that real-time is not enabled
    statusContainer.style.display = 'block';
    statusContainer.className = 'alert alert-warning mb-2 mx-3';
    statusMessage.innerHTML = `
      Chat is in simplified mode without live updates. 
      Messages won't appear in real-time until refreshed.
    `;
  } else {
    // Show success that real-time is working
    statusContainer.style.display = 'block';
    statusContainer.className = 'alert alert-success mb-2 mx-3';
    statusMessage.innerHTML = `
      Real-time messaging is active! Messages will appear instantly.
    `;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      statusContainer.style.display = 'none';
    }, 5000);
  }
}

// Load user conversations
async function loadConversations() {
  try {
    const result = await window.chatAPI.getConversations();
    
    if (result.success) {
      conversations = result.data;
      renderConversations(conversations);
      
      // Count total unread messages
      const totalUnread = conversations.reduce((total, conv) => total + conv.unreadCount, 0);
      updateUnreadBadge(totalUnread);
    }
  } catch (error) {
    console.error('Error loading conversations:', error);
  }
}

// Render conversations in the sidebar
function renderConversations(conversationsToRender) {
  if (!conversationsList) return;
  
  // Clear existing conversations
  conversationsList.innerHTML = '';
  
  // FILTER: Only show conversations that have at least one message
  const filteredConversations = conversationsToRender.filter(conversation => {
    // Check if there's a lastMessage object with actual content
    return conversation.lastMessage && 
           conversation.lastMessage.content && 
           conversation.lastMessage.content.trim() !== '';
  });
  
  console.log(`Filtered out ${conversationsToRender.length - filteredConversations.length} empty conversations`);
  
  // Update the conversation count badge
  const countBadge = document.getElementById('conversation-count');
  if (countBadge) {
    countBadge.textContent = filteredConversations.length;
    // Optionally hide the badge if zero
    countBadge.style.display = filteredConversations.length > 0 ? 'inline-block' : 'none';
  }
  
  if (filteredConversations.length === 0) {
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">No conversations yet</p>
        <p class="text-muted small">Search for users to start chatting</p>
      </div>
    `;
    return;
  }
  
  // Default avatar as fallback
  const defaultAvatar = '/assets/images/user/blank-avatar.png';
  
  // Add each conversation to the list
  filteredConversations.forEach(conversation => {
    // Skip conversations with no messages
    if (!conversation.lastMessage || !conversation.lastMessage.content) {
      return; // Skip this conversation
    }
    
    const lastMessageTime = formatMessageTime(conversation.lastMessage.timestamp);
    
    const conversationElement = document.createElement('a');
    conversationElement.href = "#";
    conversationElement.className = "list-group-item list-group-item-action p-3";
    conversationElement.dataset.conversationId = conversation.conversationId;
    conversationElement.dataset.userId = conversation.otherUser._id;
    
    // Get avatar URL with proper fallbacks
    const avatarSrc = conversation.otherUser.profilePicture || 
                     conversation.otherUser.avatar || 
                     conversation.otherUser.profile_picture || 
                     defaultAvatar;
    
    // Truncate long names and messages for display
    const displayName = (conversation.otherUser.fullName || '').length > 20 ? 
                       (conversation.otherUser.fullName || '').substring(0, 20) + '...' : 
                       conversation.otherUser.fullName;
                       
    const lastMessage = conversation.lastMessage.content ? 
                       conversation.lastMessage.content.substring(0, 30) + 
                       (conversation.lastMessage.content.length > 30 ? '...' : '') : '';
    
    conversationElement.innerHTML = `
      <div class="media align-items-center">
        <div class="chat-avtar" style="width: 40px; height: 40px; flex-shrink: 0;">
          <img class="rounded-circle img-fluid conversation-avatar" 
               src="${avatarSrc}" 
               alt="${conversation.otherUser.fullName}'s profile picture"
               style="width: 40px; height: 40px; object-fit: cover; background-color: #f0f0f0; transition: opacity 0.2s ease-in-out;"
               onerror="this.onerror=null; this.src='${defaultAvatar}'; this.style.opacity='1';"
               onload="this.style.opacity='1';"
          >
        </div>
        <div class="media-body mx-2" style="min-width: 0; width: calc(100% - 50px);">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0 text-truncate" style="max-width: calc(100% - 80px);">
            ${displayName}
            ${conversation.unreadCount > 0 ? 
              `<span class="badge bg-primary rounded-pill ms-1">${conversation.unreadCount}</span>` : 
              ''}
          </h5>
            <span class="text-sm text-muted">${lastMessageTime}</span>
          </div>
          <span class="text-sm text-muted text-truncate d-block">${lastMessage}</span>
        </div>
      </div>
    `;
    
    conversationsList.appendChild(conversationElement);

    // Initialize avatar with loading state
    const newAvatar = conversationElement.querySelector('.conversation-avatar');
    if (newAvatar) {
      newAvatar.style.opacity = '0.6';
    }
  });
}

// Search for users to start a conversation
async function searchUsers(query) {
  if (!query || query.length < 2) {
    // If search is cleared, show conversations again
    renderConversations(conversations);
    return;
  }
  
  try {
    // Show loading indicator
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">Searching...</p>
      </div>
    `;
    
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token') || sessionStorage.getItem('token')}`,
        'X-Session-ID': localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId')
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Search results:', data.data);
      
      if (data.data.length === 0) {
        conversationsList.innerHTML = `
          <div class="text-center p-4">
            <p class="text-muted">No users found matching "${query}"</p>
          </div>
        `;
        return;
      }
      
      // Render users as potential conversations
      renderSearchResults(data.data);
    } else {
      // Handle API error
      console.error('API returned error:', data.message);
      conversationsList.innerHTML = `
        <div class="text-center p-4">
          <p class="text-muted">Error searching: ${data.message || 'Unknown error'}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error searching users:', error);
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">Error searching users. Please try again.</p>
      </div>
    `;
  }
}

// Render search results
function renderSearchResults(users) {
  if (!conversationsList) return;
  
  // Clear existing conversations
  conversationsList.innerHTML = '';
  
  if (users.length === 0) {
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">No users found</p>
      </div>
    `;
    return;
  }
  
  // Add each user to the list
  users.forEach(user => {
    const userElement = document.createElement('a');
    userElement.href = "#";
    userElement.className = "list-group-item list-group-item-action p-3";
    userElement.dataset.userId = user._id;
    userElement.dataset.isSearchResult = "true";
    
    // Check if this user already has a conversation with us
    const existingConversation = conversations.find(conv => conv.otherUser._id === user._id);
    const conversationStatus = existingConversation ? 
      `<span class="text-success">Continue conversation</span>` : 
      `<span class="text-muted">Start new conversation</span>`;
    
    // Use the correct field names from the User model
    userElement.innerHTML = `
      <div class="media align-items-center">
        <div class="chat-avtar" style="width: 40px; height: 40px; flex-shrink: 0;">
          <img class="rounded-circle img-fluid wid-40" 
               src="${user.profile_picture || '/assets/images/user/blank-avatar.png'}" 
               alt="User image"
               style="width: 40px; height: 40px; object-fit: cover; background-color: #f0f0f0;"
          >
        </div>
        <div class="media-body mx-2" style="min-width: 0; width: calc(100% - 50px);">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0 text-truncate" style="max-width: calc(100% - 80px);">${user.full_name || user.username}</h5>
            ${conversationStatus}
          </div>
          <span class="text-sm text-muted text-truncate d-block">${user.email || ""}</span>
        </div>
      </div>
    `;
    
    // If this is an existing conversation, add that data
    if (existingConversation) {
      userElement.dataset.conversationId = existingConversation.conversationId;
    }
    
    conversationsList.appendChild(userElement);
  });
}

// Load and display messages for a conversation (updated)
async function loadMessages(userId, silentRefresh = false) {
  try {
    // Show loading indicator and clear existing messages (only if not silent)
    if (messageContainer && !silentRefresh) {
      messageContainer.innerHTML = `
        <div class="text-center p-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="mt-2 text-muted">Loading messages...</p>
        </div>
      `;
    }
    
    // Get messages
    const result = await window.chatAPI.getMessages(userId);
    
    if (result.success) {
      messages = result.data;
      
      // Debug check to log message timestamps in order
      console.log('Message timestamps order check:');
      messages.slice().sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .forEach((msg, i) => {
          console.log(`Message ${i+1}: ${new Date(msg.createdAt).toLocaleString()}`);
        });
        
      // Call the regular render function
      renderMessages(messages, silentRefresh);
      
      // Force scroll after a small delay - this runs regardless of silentRefresh flag
      setTimeout(() => {
        forceScrollToBottom();
      }, 100);
      
      // Force scroll AGAIN after a longer delay to catch any late-loading content
      setTimeout(() => {
        forceScrollToBottom();
        
        // Extra check - if we're still not at the bottom, make one final attempt
        const scrollContainer = messageContainer.closest('.scroll-block');
        if (scrollContainer && scrollContainer._sbInstance) {
          const scrollElem = scrollContainer._sbInstance.getScrollElement();
          const distanceFromBottom = scrollElem.scrollHeight - scrollElem.scrollTop - scrollElem.clientHeight;
          
          console.log(`Distance from bottom after attempts: ${distanceFromBottom}px`);
          if (distanceFromBottom > 20) {
            console.log('⚠️ Still not at bottom, making final attempt');
            forceScrollToBottom();
          }
        }
      }, 500);
      
      // Mark as read after rendering (existing code)
      await window.chatAPI.markMessagesAsRead(userId);
      
      // Also try to mark as read via socket (existing code)
      if (currentConversation) {
        try {
          window.chatSocket.markMessagesAsRead(currentConversation.conversationId, userId)
            .catch(err => console.warn('Socket markMessagesAsRead failed:', err));
        } catch (socketError) {
          console.warn('Error with socket markMessagesAsRead:', socketError);
        }
      }
    } else {
      // Handle error (existing code)
      if (messageContainer) {
        messageContainer.innerHTML = `
          <div class="text-center p-4">
            <p class="text-danger">Failed to load messages</p>
            <button class="btn btn-sm btn-primary mt-2" onclick="window.nukeAndRebuildChat()">
              Try Again
            </button>
          </div>
        `;
      }
    }
  } catch (error) {
    console.error('Error loading messages:', error);
    
    // Display error message (existing code)
    if (messageContainer) {
      messageContainer.innerHTML = `
        <div class="text-center p-4">
          <p class="text-danger">Error: ${error.message || 'Failed to load messages'}</p>
          <button class="btn btn-sm btn-primary mt-2" onclick="window.nukeAndRebuildChat()">
            Try Again
          </button>
        </div>
      `;
    }
  }
}

// Get the current user ID from localStorage/sessionStorage
function getCurrentUserId() {
  return localStorage.getItem('userId') || sessionStorage.getItem('userId');
}

// Check if a message is outgoing (sent by current user)
function isOutgoingMessage(message) {
  if (!message || !message.senderId) {
    console.error('Invalid message or missing senderId:', message);
    return false;
  }

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    console.error('No current user ID found in storage');
    return false;
  }

  console.log('📊 MESSAGE DIRECTION VERBOSE CHECK:');
  console.log(`Message ID: ${message._id || 'unknown'}`);
  console.log(`Message sender ID: "${message.senderId}"`);
  console.log(`Current user ID: "${currentUserId}"`);
  
  // Convert IDs to strings and clean up any whitespace or special chars
  const senderIdClean = String(message.senderId).trim().replace(/["']/g, '');
  const currentUserIdClean = String(currentUserId).trim().replace(/["']/g, '');
  
  console.log(`Clean sender ID: "${senderIdClean}"`);
  console.log(`Clean current user ID: "${currentUserIdClean}"`);
  
  // Check both exact match and if one contains the other (to handle ID format differences)
  const exactMatch = senderIdClean === currentUserIdClean;
  const isSubstring = senderIdClean.includes(currentUserIdClean) || 
                     currentUserIdClean.includes(senderIdClean);
  
  console.log(`Exact match: ${exactMatch}, Substring match: ${isSubstring}`);
  
  // If exact match, use that, otherwise fall back to substring match as a heuristic
  const isOutgoing = exactMatch || isSubstring;
  console.log(`Final direction determination: ${isOutgoing ? "OUTGOING" : "INCOMING"}`);
  
  return isOutgoing;
}

// Get message content from the message object
function getMessageContent(message) {
  try {
    // If message is a string, return it directly
    if (typeof message === 'string') {
      return message;
    }

    // First, check message type to render appropriately
    const messageType = message.messageType || message.type || 'text';
    
    // Get content directly - try all possible properties where content might be stored
    let content = '';
    
    if (message.content !== undefined) {
      content = message.content;
    } else if (message.text) {
      content = message.text;
    } else if (message.message) {
      content = message.message; 
    } else if (message.encryptedContent) {
      // For compatibility with messages stored with encryption structure
      content = message.encryptedContent;
    } else if (message.data && typeof message.data === 'object') {
      // Try to get content from nested data object
      content = message.data.content || message.data.text || message.data.message || message.data.encryptedContent || '';
    }
    
    // If content is still empty, try parsing message as JSON
    if (!content && typeof message === 'object') {
      try {
        content = JSON.stringify(message);
      } catch (e) {
        content = 'No message content';
      }
    }
    
    console.log(`Getting message content for type ${messageType}:`, content);
    
    // Render content based on message type
    if (messageType === 'image') {
      // Get image URL from different possible locations
      let imageUrl = '';
      
      if (message.fileMetadata && message.fileMetadata.filePath) {
        imageUrl = message.fileMetadata.filePath;
      } else if (message.filePath) {
        imageUrl = message.filePath;
      } else if (message.fileUrl) {
        imageUrl = message.fileUrl;
      } else if (message.url) {
        imageUrl = message.url;
      } else {
        imageUrl = content;
      }
      
      // Fix file:// URLs by removing them - they're not allowed by browsers
      if (imageUrl.startsWith('file://')) {
        imageUrl = imageUrl.replace('file://', '');
      }
      
      // Ensure URL starts with server path or is a full URL
      if (!imageUrl.startsWith('http') && !imageUrl.startsWith('/')) {
        imageUrl = '/' + imageUrl;
      }
      
      console.log('Rendering image with URL:', imageUrl);
      
      // Apply better styling for the image with modal view
      const imageId = `image-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const modalId = `modal-${imageId}`;
      
      return `
        <div style="background-color: #dc2626; border-radius: 8px; padding: 4px; display: inline-block; cursor: pointer;" 
             onclick="openImageModal('${modalId}', '${imageUrl}')">
          <img 
            src="${imageUrl}" 
            alt="Image" 
            style="max-width: 200px; max-height: 200px; border-radius: 6px; display: block;"
            onerror="this.onerror=null; this.src='/assets/images/user/image-placeholder.jpg'; this.style.width='100px'; this.style.height='100px'"
          >
        </div>
        
        <!-- Hidden Modal for image preview -->
        <div id="${modalId}" class="image-preview-modal" style="display: none; position: fixed; z-index: 10000000 !important; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
          <div class="modal-content" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border-radius: 8px; max-width: 90%; max-height: 90%; overflow: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0;">Image Preview</h3>
              <button onclick="closeImageModal('${modalId}')" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="image-content" style="text-align: center;">
              <img src="${imageUrl}" alt="Full size image" style="max-width: 100%; max-height: 70vh;">
            </div>
            <div style="margin-top: 15px; text-align: right;">
              <a href="${imageUrl}" download class="btn btn-primary" style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none;">Download</a>
            </div>
          </div>
        </div>
      `;
    } else if (messageType === 'file') {
      // Get file URL from different possible locations
      let fileUrl = '';
      let fileName = 'File';
      
      if (message.fileMetadata) {
        fileUrl = message.fileMetadata.filePath || '';
        fileName = message.fileMetadata.fileName || message.fileMetadata.originalName || 'File';
      } else if (message.filePath) {
        fileUrl = message.filePath;
        fileName = message.fileName || message.originalName || 'File';
      } else {
        fileUrl = message.fileUrl || message.url || content;
        fileName = message.fileName || message.originalName || 'File';
      }
      
      // Fix file:// URLs by removing them
      if (fileUrl.startsWith('file://')) {
        fileUrl = fileUrl.replace('file://', '');
      }
      
      // Ensure URL starts with server path or is a full URL
      if (!fileUrl.startsWith('http') && !fileUrl.startsWith('/')) {
        fileUrl = '/' + fileUrl;
      }
      
      // Better styled file attachment with modal view
      const fileId = `file-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const modalId = `modal-${fileId}`;
      
      return `
        <div style="display: flex; align-items: center; background-color: #dc2626; padding: 8px 12px; border-radius: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px; min-width: 24px;">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="9" y1="15" x2="15" y2="15"></line>
          </svg>
          <a href="#" onclick="openFileModal('${modalId}', '${fileUrl}', '${fileName}'); return false;" 
             style="color: white; text-decoration: none; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</a>
          <a href="${fileUrl}" target="_blank" download style="color: white; margin-left: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
          </a>
        </div>
        
        <!-- Hidden Modal for file preview -->
        <div id="${modalId}" class="file-preview-modal" style="display: none; position: fixed; z-index: 10000000 !important; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.7);">
          <div class="modal-content" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background-color: white; padding: 20px; border-radius: 8px; max-width: 90%; max-height: 90%; overflow: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 style="margin: 0;">${fileName}</h3>
              <button onclick="closeFileModal('${modalId}')" style="background: none; border: none; font-size: 24px; cursor: pointer;">&times;</button>
            </div>
            <div class="file-content" style="min-height: 300px;">
              <iframe src="${fileUrl}" style="width: 100%; height: 500px; border: 1px solid #ddd;"></iframe>
            </div>
            <div style="margin-top: 15px; text-align: right;">
              <a href="${fileUrl}" download class="btn btn-primary" style="background-color: #dc2626; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none;">Download</a>
            </div>
          </div>
        </div>
      `;
    } else if (messageType === 'emoji') {
      // Emoji handling
      return `<span style="font-size: 2.5rem; line-height: 1; display: block;">${content}</span>`;
    }

    // Check if content is empty or null, and provide a default message
    if (!content) {
      return '<span class="text-muted">(No message content)</span>';
    }

    // Regular text - let's ensure links are clickable
    const textWithLinks = String(content).replace(
      /(https?:\/\/[^\s]+)/g, 
      '<a href="$1" target="_blank" style="color: inherit; text-decoration: underline;">$1</a>'
    );
    
    return textWithLinks;
  } catch (error) {
    console.error('Error getting message content:', error);
    return '<span class="text-danger">(Error displaying message)</span>';
  }
}

// Format message time
function formatMessageTime(timestamp) {
  if (!timestamp) return '';
  
  try {
    const date = new Date(timestamp);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    // Format as HH:MM AM/PM
    return `${hours % 12 || 12}:${minutes.toString().padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
  } catch (error) {
    console.error('Error formatting time:', error);
    return '';
  }
}

// Render messages in the conversation view (updated)
async function renderMessages(messagesToRender, silentRefresh = false) {
  if (!messageContainer) return;
  
  // Clear existing messages
  messageContainer.innerHTML = '';
  
  if (!messagesToRender || messagesToRender.length === 0) {
    messageContainer.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">No messages yet</p>
        <p class="text-muted small">Start the conversation by sending a message!</p>
      </div>
    `;
    return;
  }
  
  // Sort messages by time (OLDEST FIRST, NEWEST LAST)
  const sortedMessages = [...messagesToRender].sort((a, b) => {
    const dateA = new Date(a.createdAt);
    const dateB = new Date(b.createdAt);
    return dateA - dateB;
  });
  
  console.log(`🔄 Rendering ${sortedMessages.length} messages - sorted by timestamp (oldest to newest)`);
  
  // Get current user ID for determining message direction
  const currentUserId = getCurrentUserId();
  
  // Add each message to the container
  for (const message of sortedMessages) {
    // Skip messages without sender info
    if (!message.senderId) {
      console.warn('Message missing senderId:', message);
      continue;
    }
    
    // FORCE FIX FOR MESSAGE DIRECTION: Use both exact and substring matching
    const senderIdStr = String(message.senderId).trim();
    const userIdStr = String(currentUserId).trim();
    
    // Check if sender ID matches current user ID or contains it
    const isFromCurrentUser = senderIdStr === userIdStr || 
                             senderIdStr.includes(userIdStr) || 
                             userIdStr.includes(senderIdStr);
    
    renderSingleMessage(message, isFromCurrentUser);
  }
  
  // Add a small attribution data tag to the last message so we can find it later
  const allMessages = messageContainer.querySelectorAll('.force-message-in, .force-message-out');
  if (allMessages.length > 0) {
    const lastMessage = allMessages[allMessages.length - 1];
    lastMessage.dataset.isLastMessage = 'true';
    console.log(`✓ Marked message with ID ${lastMessage.dataset.messageId} as the last message`);
  }
  
  // Scroll is handled by the loadMessages function with multiple attempts
}

// Render a single message with the correct direction
function renderSingleMessage(message, isFromCurrentUser) {
  if (!messageContainer) return;
  
  // Double-check the isFromCurrentUser parameter using our function to ensure consistency
  if (isFromCurrentUser === undefined) {
    isFromCurrentUser = isOutgoingMessage(message);
    console.log(`Direction check from message data: message ID ${message._id} is from current user: ${isFromCurrentUser}`);
  }
  
  const messageTime = formatMessageTime(message.createdAt);
  const messageContent = getMessageContent(message);
  
  // Create message element
  const messageDiv = document.createElement('div');
  
  // Set proper direction class and styles
  messageDiv.className = isFromCurrentUser ? 'force-message-out' : 'force-message-in';
  messageDiv.dataset.messageId = message._id || '';
  messageDiv.dataset.senderId = message.senderId || '';
  if (message.clientMessageId) {
    messageDiv.dataset.clientMessageId = message.clientMessageId;
  }
  messageDiv.style.marginBottom = '20px';
  messageDiv.style.width = '100%';
  
  // Default avatar as fallback
  const defaultAvatar = '/assets/images/user/blank-avatar.png';
  
  // Get avatar URL with proper fallbacks
  const getAvatarUrl = (user) => {
    if (!user) return defaultAvatar;
    return user.profilePicture || user.avatar || user.profile_picture || defaultAvatar;
  };

  // Get avatar URLs for both users
  const currentUserAvatar = getAvatarUrl(currentUser);
  const otherUserAvatar = getAvatarUrl(currentConversation?.otherUser);
  
  // Use the correct avatar based on message direction
  const avatarSrc = isFromCurrentUser ? currentUserAvatar : otherUserAvatar;
  
  // Common avatar HTML with loading state and error handling
  const avatarHtml = `
    <div class="chat-avatar-wrapper" style="width: 40px; height: 40px; flex-shrink: 0;">
      <img class="rounded-circle user-avatar" 
           src="${avatarSrc}" 
           alt="User profile picture"
           style="width: 40px; height: 40px; object-fit: cover; background-color: #f0f0f0; transition: opacity 0.2s ease-in-out;"
           onerror="this.onerror=null; this.src='${defaultAvatar}'; this.style.opacity='1';"
           onload="this.style.opacity='1';"
      >
    </div>
  `;
  
  // Three dots menu for outgoing messages
  const threeDotMenuHtml = isFromCurrentUser ? `
    <div class="message-actions" style="position: relative;">
      <button class="message-actions-toggle btn btn-link text-secondary p-0" style="font-size: 18px;" data-message-id="${message._id || ''}">
        <i class="ti ti-dots-vertical"></i>
      </button>
      <div class="message-actions-menu" style="display: none; position: absolute; right: 0; background-color: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15); border-radius: 4px; z-index: 100; min-width: 120px;">
        <ul class="list-unstyled m-0">
          <li>
            <button class="btn btn-link text-secondary w-100 text-start p-2 edit-message-btn" data-message-id="${message._id || ''}">
              <i class="ti ti-pencil me-1"></i> Edit
            </button>
          </li>
          <li>
            <button class="btn btn-link text-danger w-100 text-start p-2 delete-message-btn" data-message-id="${message._id || ''}">
              <i class="ti ti-trash me-1"></i> Delete
            </button>
          </li>
        </ul>
      </div>
    </div>
  ` : '';

  // For outgoing (my messages): content and avatar on right
  if (isFromCurrentUser) {
    messageDiv.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: flex-end; width: 100%; gap: 12px;">
        ${threeDotMenuHtml}
        <div style="max-width: 70%;">
          <div style="background-color: #dc2626; color: white; border-radius: 10px; padding: 10px 15px; display: inline-block; text-align: left; word-break: break-word;">${messageContent || 'No message content'}</div>
          <div style="text-align: right; font-size: 0.8rem; color: #999; margin-top: 4px;">${messageTime}</div>
        </div>
        ${avatarHtml}
      </div>
    `;
  } else {
    // For incoming (their messages): avatar and content on left
    messageDiv.innerHTML = `
      <div style="display: flex; align-items: flex-start; justify-content: flex-start; width: 100%; gap: 12px;">
        ${avatarHtml}
        <div style="max-width: 70%;">
          <div style="background-color: #f3f3f3; color: #333; border-radius: 10px; padding: 10px 15px; display: inline-block; text-align: left; word-break: break-word;">${messageContent || 'No message content'}</div>
          <div style="font-size: 0.8rem; color: #999; margin-top: 4px;">${messageTime}</div>
        </div>
      </div>
    `;
  }
  
  messageContainer.appendChild(messageDiv);

  // Initialize all new avatar images with a loading state
  const newAvatar = messageDiv.querySelector('.user-avatar');
  if (newAvatar) {
    newAvatar.style.opacity = '0.6';
  }
  
  // Add event listeners for three-dot menu
  if (isFromCurrentUser) {
    const toggleBtn = messageDiv.querySelector('.message-actions-toggle');
    const menu = messageDiv.querySelector('.message-actions-menu');
    const editBtn = messageDiv.querySelector('.edit-message-btn');
    const deleteBtn = messageDiv.querySelector('.delete-message-btn');
    
    // Toggle menu on button click
    if (toggleBtn && menu) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
      });
    }
    
    // Handle edit button click
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        handleEditMessage(message);
      });
    }
    
    // Handle delete button click
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menu.style.display = 'none';
        handleDeleteMessage(message);
      });
    }
    
    // Close menu when clicking elsewhere
    document.addEventListener('click', () => {
      if (menu) {
        menu.style.display = 'none';
      }
    });
  }
}

// Handle the edit message action
function handleEditMessage(message) {
  // Create a modal for editing the message
  const modal = document.createElement('div');
  modal.className = 'modal fade';
  modal.id = 'editMessageModal';
  modal.tabIndex = '-1';
  modal.setAttribute('aria-labelledby', 'editMessageModalLabel');
  modal.setAttribute('aria-hidden', 'true');
  
  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title" id="editMessageModalLabel">Edit Message</h5>
          <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <textarea class="form-control" id="editMessageContent" rows="4">${getMessageContent(message)}</textarea>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
          <button type="button" class="btn btn-primary" id="saveEditBtn">Save changes</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Initialize the modal and show it
  const bsModal = new bootstrap.Modal(modal);
  bsModal.show();
  
  // Handle save button
  const saveBtn = document.getElementById('saveEditBtn');
  saveBtn.addEventListener('click', async () => {
    const newContent = document.getElementById('editMessageContent').value.trim();
    if (newContent) {
      try {
        // Update message in the database
        if (window.chatAPI && typeof window.chatAPI.updateMessage === 'function') {
          const result = await window.chatAPI.updateMessage(message._id, newContent);
          if (result && result.success) {
            // Update message in the UI
            const messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
            if (messageElement) {
              // Try multiple selectors to find the content element
              const contentElement = messageElement.querySelector('.msg-content') || 
                                    messageElement.querySelector('[style*="background-color: #dc2626"]') ||
                                    messageElement.querySelector('[style*="word-break: break-word"]');
              
              if (contentElement) {
                // Update the content
                contentElement.innerHTML = newContent;
                
                // Add an "edited" indicator if not already present
                const timeElement = messageElement.querySelector('[style*="font-size: 0.8rem"]');
                if (timeElement && !timeElement.textContent.includes('(edited)')) {
                  timeElement.textContent += ' (edited)';
                }
              } else {
                console.error('Could not find content element to update');
              }
            } else {
              console.error('Could not find message element with ID:', message._id);
            }
            
            // Update message in array
            const msgIndex = messages.findIndex(m => m._id === message._id);
            if (msgIndex !== -1) {
              messages[msgIndex].content = newContent;
              messages[msgIndex].isEdited = true;
            }
            
            // Show success toast
            const toast = document.createElement('div');
            toast.className = 'toast position-fixed bottom-0 end-0 m-3';
            toast.style.zIndex = '9999';
            toast.innerHTML = `
              <div class="toast-header bg-success text-white">
                <strong class="me-auto">Success</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
              </div>
              <div class="toast-body">
                Message updated successfully!
              </div>
            `;
            document.body.appendChild(toast);
            // Initialize toast with Bootstrap
            let bsToast;
            if (window.bootstrap && window.bootstrap.Toast) {
              bsToast = new bootstrap.Toast(toast, { delay: 2000 });
              bsToast.show();
            } else {
              // Fallback if Bootstrap Toast is not available
              toast.style.display = 'block';
              setTimeout(() => {
                toast.style.display = 'none';
                if (document.body.contains(toast)) {
                  document.body.removeChild(toast);
                }
              }, 2000);
            }
            
            // Remove toast after it's hidden
            toast.addEventListener('hidden.bs.toast', () => {
              document.body.removeChild(toast);
            });
          } else {
            throw new Error(result?.message || 'Unknown error updating message');
          }
        } else {
          console.warn('Message update API not available');
        }
      } catch (error) {
        console.error('Error updating message:', error);
        alert('Failed to update message. Please try again.');
      }
    }
    bsModal.hide();
    
    // Remove modal after hiding
    modal.addEventListener('hidden.bs.modal', function () {
      document.body.removeChild(modal);
    });
  });
  
  // Clean up modal when closed
  modal.addEventListener('hidden.bs.modal', function () {
    if (document.body.contains(modal)) {
      document.body.removeChild(modal);
    }
  });
}

// Handle the delete message action
function handleDeleteMessage(message) {
  if (confirm('Are you sure you want to delete this message?')) {
    try {
      // Delete message from the database
      if (window.chatAPI && typeof window.chatAPI.deleteMessage === 'function') {
        window.chatAPI.deleteMessage(message._id)
          .then(result => {
            if (result && result.success) {
              // Remove message from the UI
              const messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
              if (messageElement) {
                messageElement.remove();
              }
              
              // Remove message from array
              const msgIndex = messages.findIndex(m => m._id === message._id);
              if (msgIndex !== -1) {
                messages.splice(msgIndex, 1);
              }
            }
          })
          .catch(error => {
            console.error('Error deleting message:', error);
            alert('Failed to delete message. Please try again.');
          });
      } else {
        console.warn('Message delete API not available');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Failed to delete message. Please try again.');
    }
  }
}

// Send a text message
async function sendMessage() {
  if (!messageInput || !currentConversation) return;
  
  const message = messageInput.value.trim();
  if (!message) return;
  
  try {
    // Clear the input immediately for better UX
    messageInput.value = '';
    
    // Check if this is an emoji-only message (for special rendering)
    const isEmojiOnly = /^(\p{Emoji}|\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(message);
    const messageType = isEmojiOnly ? 'emoji' : 'text';
    
    // Generate proper IDs - clientMessageId should be unique
    const tempId = 'temp-' + Date.now();
    const clientMessageId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    console.log('🔵 Creating temporary message with tempId:', tempId, 'and clientMessageId:', clientMessageId);
    
    // Create and display temporary message immediately
    const tempMessage = {
      _id: tempId,
      senderId: getCurrentUserId(),
      content: message,
      messageType,
      createdAt: new Date(),
      clientMessageId,
      conversationId: currentConversation.conversationId
    };
    
    // Add to messages array before rendering so it gets tracked
    messages.push(tempMessage);
    
    // Add to UI immediately - use renderSingleMessage directly to ensure proper rendering
    const isFromCurrentUser = true; // This is definitely our own message
    renderSingleMessage(tempMessage, isFromCurrentUser);
    
    // Make sure we scroll to the new message
    scrollToBottom();
    
    console.log('⚡ SENDING MESSAGE via socket:', message);
    
    // Send via socket for real-time delivery
    try {
      await window.chatSocket.sendMessage(
        currentConversation.otherUser._id,
        message,
        messageType
      );
    } catch (socketError) {
      console.warn('Socket message send failed, continuing with API send:', socketError);
    }
    
    console.log('⚡ SENDING MESSAGE via API:', message);
    
    // Also send via REST API as backup
    const apiResult = await window.chatAPI.sendMessage(
      currentConversation.otherUser._id,
      message,
      messageType
    );
    
    if (apiResult && apiResult.success) {
      console.log('✅ API message sent successfully:', apiResult.data);
      
      // Update the temporary message with confirmed details
      const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
      if (tempElement) {
        // Update with the real message ID from the server response
        tempElement.dataset.messageId = apiResult.data.messageId || apiResult.data._id;
        tempElement.dataset.clientMessageId = apiResult.data.clientMessageId || clientMessageId;
        console.log('✅ Updated temp message with confirmed ID:', apiResult.data.messageId || apiResult.data._id);
        
        // Check if the message content is displaying correctly
        setTimeout(() => {
          console.log("Checking if sent message is displaying correctly");
          if (window.checkSentMessage && typeof window.checkSentMessage === 'function') {
            window.checkSentMessage(apiResult.data);
          }
        }, 500);
      } else {
        console.warn('⚠️ Could not find temporary message element to update:', tempId);
      }
    }
    
    // Clear typing indicator
    clearTimeout(typingTimeout);
    sendTypingState(false);
    
    // Focus back on input
    messageInput.focus();
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

// Update conversation with current user
function updateConversationHeader() {
  if (!userInfo || !currentConversation) return;
  
  userInfo.querySelector('h5.mb-0').textContent = currentConversation.otherUser.fullName;
  userInfo.querySelector('.chat-avtar img').src = currentConversation.otherUser.profilePicture;
  
  // Display Year of Study in the header
  const statusText = userInfo.querySelector('span.text-sm');
  if (statusText) {
    // Remove status dot if present
    const existingDot = document.querySelector('.user-status-dot');
    if (existingDot) {
      existingDot.remove();
    }
    
        // Set default value to show immediately (will be updated with more accurate data)
    statusText.textContent = 'Year of Study: Loading...';
    
    // Define the valid study year values 
    const validStudyYears = [
      "Freshman",
      "Sophomore",
      "Junior", 
      "Senior",
      "Graduate",
      "Post Graduate"
    ];
    
    // Dynamically look for year of study in the user object
    const userObj = currentConversation.otherUser;
    const yearFields = [
      'yearOfStudy', 'year_of_study', 'studyYear', 'study_year', 
      'year', 'level', 'academicYear', 'academic_year',
      'education.yearOfStudy', 'education.year', 'education.level',
      'profile.yearOfStudy', 'profile.year'
    ];
    
    let foundYear = null;
    
    // Try each field name
    for (const field of yearFields) {
      // Handle dot notation for nested fields
      let value = null;
      if (field.includes('.')) {
        const parts = field.split('.');
        let obj = userObj;
        for (const part of parts) {
          if (obj && obj[part] !== undefined) {
            obj = obj[part];
          } else {
            obj = null;
            break;
          }
        }
        value = obj;
      } else {
        value = userObj[field];
      }
      
      if (value !== null && value !== undefined && value !== '') {
        console.log(`Found year value in field ${field}:`, value);
        
        // Handle objects with a value property (common API format)
        if (typeof value === 'object' && value !== null) {
          console.log('Header: Detected object with potential value property:', value);
          
          // Check for value property which is common in form data
          if (value.value !== undefined) {
            console.log(`Header: Found 'value' property:`, value.value);
            // Set the value to the inner value property for further processing
            value = value.value;
          } else if (value.custom !== undefined && value.custom !== null) {
            // Try custom value if provided
            console.log(`Header: Found 'custom' property:`, value.custom);
            value = value.custom;
          } else if (value.name !== undefined) {
            // Also check for name property
            console.log(`Header: Found 'name' property:`, value.name);
            value = value.name;
          } else if (value.label !== undefined) {
            // Also check for label property
            console.log(`Header: Found 'label' property:`, value.label);
            value = value.label;
          }
        }
        
        // If the value is already one of our valid types, use it directly
        if (typeof value === 'string' && validStudyYears.includes(value)) {
          console.log(`Found exact match for ${value} in valid study years`);
          foundYear = value;
          break;
        }
        
        // Try to map numeric values to standard terms
        if (!isNaN(Number(value)) && Number(value) >= 1 && Number(value) <= 4) {
          const num = Number(value);
          const yearMapping = {
            1: 'Freshman',
            2: 'Sophomore',
            3: 'Junior',
            4: 'Senior'
          };
          
          if (yearMapping[num]) {
            console.log(`Mapped numeric value ${num} to ${yearMapping[num]}`);
            foundYear = yearMapping[num];
            break;
          }
        }
      }
    }
    
    // If we found a valid year value, display it
    if (foundYear) {
      console.log(`Using dynamically found year: ${foundYear}`);
      statusText.textContent = `Year of Study: ${foundYear}`;
      return; // Skip the rest of the function
    }
    
    // Let the fetchAndUpdateYearOfStudy function handle it if we didn't find anything
    fetchAndUpdateYearOfStudy(currentConversation.otherUser._id);
  }
  
  // Also update the user info sidebar
  updateUserProfileInfo(currentConversation.otherUser);
}

// Update user profile sidebar and modal with user details
function updateUserProfileInfo(user) {
  if (!user) return;
  
  // Helper function to extract value from nested objects
  function getValueFromObject(obj) {
    if (!obj) return 'N/A';
    if (typeof obj === 'string') return obj;
    
    // Special handling for date fields - format if it's a valid date string
if (typeof obj === 'string') {
  // Check for ISO date format (contains T and Z)
  if (obj.includes('T') && !isNaN(new Date(obj).getTime())) {
    const date = new Date(obj);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }
  
  // Check for other date formats with dashes or slashes
  if ((obj.includes('-') || obj.includes('/')) && !isNaN(new Date(obj).getTime())) {
    const date = new Date(obj);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  }
  
  return obj; // Return the string as is if it's not a date
}
    
    // Handle timestamp number as date
    if (typeof obj === 'number' && obj > 1000000000 && obj < 9999999999999) {
      const date = new Date(obj);
      if (!isNaN(date.getTime())) {
        return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      }
    }
    
    if (typeof obj === 'object') {
      // Check for the specific {"custom":null} object format causing issues
      if (obj.hasOwnProperty('custom') && obj.custom === null && Object.keys(obj).length === 1) {
        return 'N/A';
      }
      
      // First try to get the value property which is common in our API responses
      if (obj.value !== undefined) return obj.value;
      // Try other common properties
      if (obj.name !== undefined) return obj.name;
      if (obj.label !== undefined) return obj.label;
      if (obj.text !== undefined) return obj.text;
      // Special checks for date fields
      if (obj.date !== undefined) return getValueFromObject(obj.date);
      if (obj.formatted !== undefined) return obj.formatted;
      // Try the custom field only if it's not null
      if (obj.custom !== undefined && obj.custom !== null) return obj.custom;
      
      // Handle arrays - common for skills, interests, etc.
      if (Array.isArray(obj)) {
        if (obj.length === 0) return 'N/A';
        // If array contains objects, try to extract values
        if (typeof obj[0] === 'object') {
          return obj.map(item => getValueFromObject(item)).join(', ');
        }
        // If array contains strings, join them
        return obj.join(', ');
      }
      
      // Check if object might be empty
      if (Object.keys(obj).length === 0) return 'N/A';
      
      // Deep inspection for nested data
      // Check for specific structures we've seen in the API
      if (obj._id && (obj.name || obj.label || obj.value)) {
        return obj.name || obj.label || obj.value;
      }
      
      // For location objects that might have city/state structure
      if (obj.city || obj.state) {
        const city = obj.city ? getValueFromObject(obj.city) : '';
        const state = obj.state ? getValueFromObject(obj.state) : '';
        if (city && state) return `${city}, ${state}`;
        return city || state;
      }
      
      // Date object handling with multiple potential formats
      if (obj.day || obj.month || obj.year) {
        const day = obj.day || '';
        const month = obj.month || '';
        const year = obj.year || '';
        
        if (day && month && year) {
          return `${month}/${day}/${year}`;
        } else if (month && year) {
          return `${month}/${year}`;
        } else if (year) {
          return year;
        }
      }
      
      // As a last resort, try to extract some meaningful value
      const firstValue = Object.values(obj)[0];
      if (firstValue === null) return 'N/A';
      if (typeof firstValue === 'string') return firstValue;
      if (typeof firstValue === 'object') return getValueFromObject(firstValue);
    }
    return 'N/A';
  }
  
  // Get elements from sidebar
  const userFullname = document.querySelector('.user-fullname');
  const userUsername = document.querySelector('.user-username');
  const userAvatar = document.querySelector('.chat-avtar img.wid-100');
  const userEmail = document.querySelector('.user-email');
  const userYearOfStudy = document.querySelector('.user-year-of-study');
  
  // Get elements from modal
  const modalUserName = document.querySelector('.modal-user-name');
  const modalUserUsername = document.querySelector('.modal-user-username');
  const modalUserUsernameDetail = document.querySelector('.modal-user-username-detail');
  const modalUserFullname = document.querySelector('.modal-user-fullname');
  const modalUserAvatar = document.querySelector('.modal-user-avatar');
  const modalUserBio = document.querySelector('.modal-user-bio');
  const modalUserLocation = document.querySelector('.modal-user-location');
  
  // Education fields
  const modalUserStudyYear = document.querySelector('.modal-user-study-year');
  const modalUserInstitute = document.querySelector('.modal-user-institute');
  const modalUserStudyArea = document.querySelector('.modal-user-study-area');
  const modalUserMajorType = document.querySelector('.modal-user-major-type');
  const modalUserMajor = document.querySelector('.modal-user-major');
  
  // Personal details
  const modalUserDob = document.querySelector('.modal-user-dob');
  const modalUserGender = document.querySelector('.modal-user-gender');
  const modalUserState = document.querySelector('.modal-user-state');
  const modalUserCity = document.querySelector('.modal-user-city');
  const modalUserZipcode = document.querySelector('.modal-user-zipcode');
  const modalUserAddress = document.querySelector('.modal-user-address');
  const modalUserPronouns = document.querySelector('.modal-user-pronouns');
  
  // Interest fields
  const modalUserInterests = document.querySelector('.modal-user-interests');
  const modalUserLookingFor = document.querySelector('.modal-user-looking-for');
  
  // Skills
  const modalUserHardSkills = document.querySelector('.modal-user-hard-skills');
  const modalUserSoftSkills = document.querySelector('.modal-user-soft-skills');
  
  // Co-founders
  const modalCoFoundersCount = document.querySelector('.modal-cofounders-count');
  
  // Default values
  const defaultAvatar = '/assets/images/user/blank-avatar.png';
  
  // Handle nested profile structures
  // Try multiple paths where profile data might be located
  const profileData = user.profile || user.userData || user.user_data || user;
  
  // Get the email using multiple possible paths
  const email = user.email || profileData.email || user.contact?.email || profileData.contact?.email || 'N/A';
  
  // Extract additional user details (checking both root and profile object)
  const bio = user.bio || profileData.bio || user.about || profileData.about || 'No bio available';
  
  // Get location properly - start with complete location object if available
  let locationValue = 'Location not specified';
  
  // Try to get location from multiple possible structures
  if (user.location || profileData.location) {
    const locationObj = user.location || profileData.location;
    if (typeof locationObj === 'string') {
      locationValue = locationObj;
    } else if (typeof locationObj === 'object') {
      const extractedLocation = getValueFromObject(locationObj);
      if (extractedLocation !== 'N/A') {
        locationValue = extractedLocation;
      }
    }
  } else {
    // Try individual city/state fields
    const cityValue = getValueFromObject(user.city || profileData.city);
    const stateValue = getValueFromObject(user.state || profileData.state);
    
    if (cityValue !== 'N/A' && stateValue !== 'N/A') {
      locationValue = `${cityValue}, ${stateValue}`;
    } else if (cityValue !== 'N/A') {
      locationValue = cityValue;
    } else if (stateValue !== 'N/A') {
      locationValue = stateValue;
    } else {
      // Try institution as fallback
      const institutionValue = getValueFromObject(user.institution || profileData.institution);
      if (institutionValue !== 'N/A') {
        locationValue = institutionValue;
      }
    }
  }
  
  // Get skills (checking multiple possible paths)
  let hardSkills = '';
  // Look in multiple locations for hard skills
  const hardSkillsData = user.technical_skills || user.hardSkills || user.hard_skills || 
                         profileData.technical_skills || profileData.hardSkills || profileData.hard_skills || 
                         user.skills?.technical || profileData.skills?.technical;
  
  if (hardSkillsData) {
    if (Array.isArray(hardSkillsData)) {
      // Handle array of strings or objects
      hardSkills = hardSkillsData.map(skill => 
        typeof skill === 'string' ? skill : getValueFromObject(skill)
      ).join(', ');
    } else if (typeof hardSkillsData === 'string') {
      hardSkills = hardSkillsData;
    } else if (typeof hardSkillsData === 'object') {
      hardSkills = getValueFromObject(hardSkillsData);
    }
  }
  
  let softSkills = '';
  // Look in multiple locations for soft skills
  const softSkillsData = user.soft_skills || user.softSkills || 
                         profileData.soft_skills || profileData.softSkills || 
                         user.skills?.soft || profileData.skills?.soft;
  
  if (softSkillsData) {
    if (Array.isArray(softSkillsData)) {
      // Handle array of strings or objects
      softSkills = softSkillsData.map(skill => 
        typeof skill === 'string' ? skill : getValueFromObject(skill)
      ).join(', ');
    } else if (typeof softSkillsData === 'string') {
      softSkills = softSkillsData;
    } else if (typeof softSkillsData === 'object') {
      softSkills = getValueFromObject(softSkillsData);
    }
  }
  
  // Get interests using the same pattern as skills
  let interests = '';
  const interestsData = user.my_interests || user.interests || 
                       profileData.my_interests || profileData.interests;
  
  if (interestsData) {
    if (Array.isArray(interestsData)) {
      interests = interestsData.map(interest => 
        typeof interest === 'string' ? interest : getValueFromObject(interest)
      ).join(', ');
    } else if (typeof interestsData === 'string') {
      interests = interestsData;
    } else if (typeof interestsData === 'object') {
      interests = getValueFromObject(interestsData);
    }
  }
  
  // Get looking for interests
  let lookingFor = '';
  const lookingForData = user.interests_looking_in_others || user.lookingFor || 
                        profileData.interests_looking_in_others || profileData.lookingFor;
  
  if (lookingForData) {
    if (Array.isArray(lookingForData)) {
      lookingFor = lookingForData.map(interest => 
        typeof interest === 'string' ? interest : getValueFromObject(interest)
      ).join(', ');
    } else if (typeof lookingForData === 'string') {
      lookingFor = lookingForData;
    } else if (typeof lookingForData === 'object') {
      lookingFor = getValueFromObject(lookingForData);
    }
  }
  
  // Personal details with proper object handling
// Get DOB from various possible fields
const dobValue = user.dob || profileData.dob || user.dateOfBirth || profileData.dateOfBirth || 
                 user.date_of_birth || profileData.date_of_birth || user.birth_date || 
                 profileData.birth_date || user.birthDate || profileData.birthDate || 
                 user.personal?.dob || profileData.personal?.dob || user.personal?.dateOfBirth || 
                 profileData.personal?.dateOfBirth;

// Special direct handling for ISO date strings in DOB
let dob = 'N/A';
if (typeof dobValue === 'string' && dobValue.includes('T')) {
  try {
    const date = new Date(dobValue);
    if (!isNaN(date.getTime())) {
      dob = `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
    } else {
      dob = getValueFromObject(dobValue);
    }
  } catch (e) {
    dob = getValueFromObject(dobValue);
  }
} else {
  dob = getValueFromObject(dobValue);
}
  const gender = getValueFromObject(user.gender || profileData.gender);
  const state = getValueFromObject(user.state || profileData.state);
  const city = getValueFromObject(user.city || profileData.city);
  const zipcode = getValueFromObject(user.zipcode || profileData.zipcode || user.zip || profileData.zip);
  const address = getValueFromObject(user.address || profileData.address);
  const pronouns = getValueFromObject(user.pronoun || profileData.pronoun || user.pronouns || profileData.pronouns);
  
  // Education details with proper object handling - this block is replaced by the enhanced version below
  
  const instituteObj = user.institution || profileData.institution || user.institute || profileData.institute || 
                       user.education?.institution || profileData.education?.institution;
  const institute = getValueFromObject(instituteObj);
  
  // Enhanced year of study detection
  const yearOfStudyObj = user.yearOfStudy || profileData.yearOfStudy || 
                         user.year_of_study || profileData.year_of_study || 
                         user.studyYear || profileData.studyYear ||
                         user.study_year || profileData.study_year ||
                         user.academic_year || profileData.academic_year ||
                         user.year || profileData.year ||
                         user.education?.yearOfStudy || profileData.education?.yearOfStudy ||
                         user.education?.year_of_study || profileData.education?.year_of_study ||
                         user.education?.studyYear || profileData.education?.studyYear ||
                         user.education?.study_year || profileData.education?.study_year ||
                         user.education?.year || profileData.education?.year;
  const studyYear = getValueFromObject(yearOfStudyObj);
  
  const majorCategoryObj = user.major_category || profileData.major_category || user.areaOfStudy || profileData.areaOfStudy || 
                          user.education?.areaOfStudy || profileData.education?.areaOfStudy;
  const studyArea = getValueFromObject(majorCategoryObj);
  
  const majorTypeObj = user.major_type || profileData.major_type || user.majorType || profileData.majorType || 
                      user.education?.majorType || profileData.education?.majorType;
  const majorType = getValueFromObject(majorTypeObj);
  
  const majorSubCategoryObj = user.major_sub_category || profileData.major_sub_category || user.major || profileData.major || 
                             user.education?.major || profileData.education?.major;
  const major = getValueFromObject(majorSubCategoryObj);
  
  // Co-founders - look in multiple places
  const coFoundersCount = user.coFoundersCount || profileData.coFoundersCount || 
                         user.cofounders || profileData.cofounders || 
                         user.co_founders || profileData.co_founders || 1;
  
  // Get full name with proper fallbacks
  const fullName = user.fullName || profileData.fullName || user.full_name || profileData.full_name || 
                  user.name || profileData.name || user.username || profileData.username || 'Unknown';
  
  const username = user.username || profileData.username || 'unknown';
  
  // Process profile picture properly
  let avatarSrc = defaultAvatar;
  const profilePicture = user.profilePicture || profileData.profilePicture || 
                        user.profile_picture || profileData.profile_picture || 
                        user.avatar || profileData.avatar;
  
  if (profilePicture) {
    // Process the path to make sure it works
    if (typeof profilePicture === 'string') {
      if (profilePicture.startsWith('http')) {
        // If it's already a full URL
        avatarSrc = profilePicture;
      } else if (profilePicture.includes('blank-avatar')) {
        // If it's the default avatar
        avatarSrc = defaultAvatar;
      } else if (profilePicture.includes('uploads/')) {
        // If it already has the uploads prefix
        avatarSrc = profilePicture;
      } else if (profilePicture.includes('profile_pics/')) {
        // If it already has profile_pics prefix but needs uploads
        avatarSrc = `/uploads/${profilePicture}`;
      } else {
        // Create a consistent path based on user ID
        const userId = user._id || user.id;
        if (userId) {
          // Clean up the path by extracting just the filename
          const filename = profilePicture.split(/[\/\\]/).pop();
          // Create standard path
          avatarSrc = `/uploads/profile_pics/${userId}/${filename}`;
        }
      }
    }
  }
  
  // Now set all the values in the UI
  if (userFullname) userFullname.textContent = fullName;
  if (userUsername) userUsername.textContent = '@' + username;
  if (userAvatar) userAvatar.src = avatarSrc;
  if (userEmail) userEmail.textContent = email;
  if (userYearOfStudy) userYearOfStudy.textContent = studyYear;
  
  // Update modal elements - Basic info
  if (modalUserName) modalUserName.textContent = fullName;
  if (modalUserFullname) modalUserFullname.textContent = fullName;
  if (modalUserUsername) modalUserUsername.textContent = '@' + username;
  if (modalUserUsernameDetail) modalUserUsernameDetail.textContent = username;
  if (modalUserAvatar) {
    console.log('Setting avatar image to: ' + avatarSrc);
    modalUserAvatar.src = avatarSrc;
  }
  if (modalUserBio) modalUserBio.textContent = bio;
  if (modalUserLocation) modalUserLocation.textContent = locationValue;
  
  // Set education details
  if (modalUserStudyYear) modalUserStudyYear.textContent = studyYear;
  if (modalUserInstitute) modalUserInstitute.textContent = institute;
  if (modalUserStudyArea) modalUserStudyArea.textContent = studyArea;
  if (modalUserMajorType) modalUserMajorType.textContent = majorType;
  if (modalUserMajor) modalUserMajor.textContent = major;
  
  // Set personal details
  if (modalUserDob) modalUserDob.textContent = dob;
  if (modalUserGender) modalUserGender.textContent = gender;
  if (modalUserState) modalUserState.textContent = state;
  if (modalUserCity) modalUserCity.textContent = city;
  if (modalUserZipcode) modalUserZipcode.textContent = zipcode;
  if (modalUserAddress) modalUserAddress.textContent = address;
  if (modalUserPronouns) modalUserPronouns.textContent = pronouns;
  
  // Set interests
  if (modalUserInterests) modalUserInterests.textContent = interests;
  if (modalUserLookingFor) modalUserLookingFor.textContent = lookingFor;
  
  // Set skills
  if (modalUserHardSkills) modalUserHardSkills.textContent = hardSkills;
  if (modalUserSoftSkills) modalUserSoftSkills.textContent = softSkills;
  
  // Set co-founders count
  if (modalCoFoundersCount) modalCoFoundersCount.textContent = coFoundersCount;
}

// Update the unread badge count
function updateUnreadBadge(count) {
  if (!unreadBadge) return;
  
  if (count > 0) {
    unreadBadge.textContent = count;
    unreadBadge.style.display = 'inline-block';
  } else {
    unreadBadge.style.display = 'none';
  }
  
  // Store the message count in localStorage for dashboard to use
  localStorage.setItem('unreadMessagesCount', count.toString());
  
  // If dashboard page has a function to update its message count, call it
  if (window.parent && window.parent.updateDashboardMessageCount) {
    window.parent.updateDashboardMessageCount(count);
  }
  
  // Also update any dashboard in the current window
  if (window.updateDashboardMessageCount) {
    window.updateDashboardMessageCount(count);
  }
}

// Force scroll to show latest messages - enhanced version
function scrollToBottom(force = false) {
  if (!messageContainer) return;
  
  console.log('Attempting to scroll to bottom of chat...');
  
  // Try multiple times with increasing delays to ensure scroll happens after all rendering
  // This addresses issues with images, attachments, or slow rendering
  const attemptScroll = (attempt = 1) => {
    console.log(`Scroll attempt ${attempt}/3`);
    
    const scrollContainer = messageContainer.closest('.scroll-block');
    const simpleBar = scrollContainer && scrollContainer._sbInstance;
    
    if (simpleBar) {
      const scrollElement = simpleBar.getScrollElement();
      scrollElement.scrollTop = scrollElement.scrollHeight;
    } else if (messageContainer) {
      messageContainer.scrollTop = messageContainer.scrollHeight;
    }
    
    // Try additional times if forced
    if (force && attempt < 3) {
      setTimeout(() => attemptScroll(attempt + 1), attempt * 100); // Increasing delays
    }
  };
  
  // Initial immediate scroll
  attemptScroll();
  
  // Add a "Scroll to Latest" button if not already present
  if (!document.getElementById('scroll-to-latest-btn')) {
    const scrollButton = document.createElement('button');
    scrollButton.id = 'scroll-to-latest-btn';
    scrollButton.className = 'btn btn-primary position-absolute';
    scrollButton.innerHTML = '<i class="ti ti-chevron-down me-1"></i> Latest Messages';
    scrollButton.style.cssText = 'bottom: 80px; right: 20px; z-index: 1000; display: none; opacity: 0.9;';
    
    scrollButton.addEventListener('click', () => {
      scrollToBottom(true); // Force scroll when button is clicked
      scrollButton.style.display = 'none'; // Hide after clicking
    });
    
    document.body.appendChild(scrollButton);
    
    // Show/hide the button based on scroll position
    const checkScrollPosition = () => {
      const scrollContainer = messageContainer.closest('.scroll-block');
      
      if (scrollContainer && scrollContainer._sbInstance) {
        const scrollElem = scrollContainer._sbInstance.getScrollElement();
        const isNearBottom = scrollElem.scrollHeight - scrollElem.scrollTop - scrollElem.clientHeight < 100;
        
        scrollButton.style.display = !isNearBottom && messages.length > 0 ? 'block' : 'none';
      }
    };
    
    // Check scroll position on message container scroll
    const scrollContainer = messageContainer.closest('.scroll-block');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', checkScrollPosition);
    }
  }
}

// Send typing indicator
function sendTypingState(isTyping) {
  if (!currentConversation) return;
  
  // Throttle sending typing events to avoid spamming
  const now = Date.now();
  if (now - lastTypingEmit < 1000) return;
  
  window.chatSocket.sendTypingIndicator(currentConversation.conversationId, isTyping);
  lastTypingEmit = now;
}

// Set up event handlers for UI elements
function setupEventHandlers() {
  // Conversation selection
  if (conversationsList) {
    conversationsList.addEventListener('click', async (e) => {
      e.preventDefault();
      
      const conversationItem = e.target.closest('a.list-group-item');
      if (!conversationItem) return;
      
      // Get the user ID from the clicked item
      const userId = conversationItem.dataset.userId;
      if (!userId) return;
      
      // Check if there's already a conversation ID (from search results)
      const conversationId = conversationItem.dataset.conversationId;
      
      try {
        // If we already have a conversation ID, use that conversation
        if (conversationId) {
          currentConversation = conversations.find(c => c.conversationId === conversationId);
        } 
        // Otherwise, if it's a search result without a conversation ID, create a new conversation
        else if (conversationItem.dataset.isSearchResult === 'true') {
          console.log('Creating new conversation with user:', userId);
          const result = await window.chatAPI.createConversation(userId);
          if (result.success) {
            currentConversation = result.data;
            // Reload all conversations to include the new one
            await loadConversations();
          } else {
            throw new Error(result.message || 'Failed to create conversation');
          }
        } 
        // Regular conversation selection
        else {
          currentConversation = conversations.find(c => c.otherUser._id === userId);
        }
        
        if (!currentConversation) {
          console.error('Could not find or create conversation');
          return;
        }
        
        // Join the WebSocket room for real-time updates if socket is available
        if (window.chatSocket && typeof window.chatSocket.joinConversation === 'function' && 
            currentConversation.conversationId) {
          console.log('Joining WebSocket room for conversation:', currentConversation.conversationId);
          try {
            await window.chatSocket.joinConversation(currentConversation.conversationId);
          } catch (socketError) {
            console.warn('Failed to join WebSocket room:', socketError);
            // Continue anyway - we'll fall back to REST API
          }
        }
        
        // Highlight selected conversation
        document.querySelectorAll('a.list-group-item').forEach(item => {
          item.classList.remove('active');
        });
        conversationItem.classList.add('active');
        
              // Update conversation UI
      updateConversationHeader();
      
      // Also try to fetch fresh data for year of study
      if (currentConversation && currentConversation.otherUser && currentConversation.otherUser._id) {
        fetchAndUpdateYearOfStudy(currentConversation.otherUser._id)
          .catch(err => console.error('Error updating year of study:', err));
      }
      
      // Enable message input and send button
      if (messageInput) {
        messageInput.disabled = false;
        messageInput.placeholder = "Type a message...";
      }
        
        if (sendButton) {
          sendButton.classList.remove('disabled');
        }
        
        // Load messages
        await loadMessages(currentConversation.otherUser._id);
      } catch (error) {
        console.error('Error selecting conversation:', error);
        alert('There was an error selecting this conversation. Please try again.');
      }
    });
  }
  
  // Search functionality
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      searchUsers(query);
    });
  }
  
  // Send message on button click
  if (sendButton) {
    sendButton.addEventListener('click', (e) => {
      e.preventDefault();
      sendMessage();
    });
  }
  
  // Send message on Enter key (without shift)
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Typing indicator
    messageInput.addEventListener('input', () => {
      if (!isTyping) {
        isTyping = true;
        sendTypingState(true);
      }
      
      // Clear previous timeout
      clearTimeout(typingTimeout);
      
      // Set new timeout to clear typing indicator
      typingTimeout = setTimeout(() => {
        isTyping = false;
        sendTypingState(false);
      }, 3000);
    });
  }
  
  // File upload handlers
  const fileButton = document.querySelector('.ti-paperclip').closest('a');
  const imageButton = document.querySelector('.ti-photo').closest('a');
  const emojiButton = document.querySelector('.ti-mood-smile').closest('a');
  
  if (fileButton) {
    fileButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (!currentConversation) {
        alert('Please select a conversation first');
        return;
      }
      
      // Create a file input and trigger it
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt';
      fileInput.click();
      
      fileInput.addEventListener('change', async () => {
        if (fileInput.files.length === 0) return;
        
        // Generate unique temp ID for this upload
        const tempId = 'temp-' + Date.now();
        
        try {
          // Show uploading indicator
          const tempMsg = {
            _id: tempId,
            senderId: currentUser.id,
            content: `Uploading file: ${fileInput.files[0].name}...`,
            createdAt: new Date()
          };
          addMessageToChat(tempMsg);
          
          // Verify we have the necessary data
          if (!currentConversation.otherUser || !currentConversation.otherUser._id) {
            throw new Error('Invalid conversation data. Please refresh and try again.');
          }
          
          console.log('Uploading file to user:', currentConversation.otherUser._id);
          
          const result = await window.chatAPI.sendFileMessage(
            currentConversation.otherUser._id,
            fileInput.files[0]
          );
          
          // Remove temp message once file is uploaded
          const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
          if (tempElement) {
            tempElement.remove();
          }
          
          // Check if result is valid
          if (!result || !result.success) {
            throw new Error(result?.message || 'Unknown error uploading file');
          }
          
          // Display the real file message from the response
          if (result.data) {
            addMessageToChat(result.data);
          } else {
            console.warn('File uploaded but no message data returned');
          }
        } catch (error) {
          console.error('Error sending file:', error);
          
          // Remove temp message
          const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
          if (tempElement) {
            // Update the temp message to show the error
            tempElement.querySelector('.msg-content p').innerHTML = 
              `<span style="color: red;">❌ File upload failed: ${error.message}</span>`;
          } else {
            // Show alert if temp message was already removed
            alert(`Failed to send file: ${error.message}`);
          }
        }
      });
    });
  }
  
  if (imageButton) {
    imageButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (!currentConversation) {
        alert('Please select a conversation first');
        return;
      }
      
      // Create a file input and trigger it
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.click();
      
      fileInput.addEventListener('change', async () => {
        if (fileInput.files.length === 0) return;
        
        // Generate unique temp ID for this upload
        const tempId = 'temp-' + Date.now();
        
        try {
          // Show uploading indicator
          const tempMsg = {
            _id: tempId,
            senderId: currentUser.id,
            content: `Uploading image...`,
            createdAt: new Date()
          };
          addMessageToChat(tempMsg);
          
          // Verify we have the necessary data
          if (!currentConversation.otherUser || !currentConversation.otherUser._id) {
            throw new Error('Invalid conversation data. Please refresh and try again.');
          }
          
          console.log('Uploading image to user:', currentConversation.otherUser._id);
          
          const result = await window.chatAPI.sendFileMessage(
            currentConversation.otherUser._id,
            fileInput.files[0]
          );
          
          // Remove temp message once image is uploaded
          const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
          if (tempElement) {
            tempElement.remove();
          }
          
          // Check if result is valid
          if (!result || !result.success) {
            throw new Error(result?.message || 'Unknown error uploading image');
          }
          
          // Display the real image message from the response
          if (result.data) {
            addMessageToChat(result.data);
          } else {
            console.warn('Image uploaded but no message data returned');
          }
        } catch (error) {
          console.error('Error sending image:', error);
          
          // Remove temp message
          const tempElement = document.querySelector(`[data-message-id="${tempId}"]`);
          if (tempElement) {
            // Update the temp message to show the error
            tempElement.querySelector('.msg-content p').innerHTML = 
              `<span style="color: red;">❌ Image upload failed: ${error.message}</span>`;
          } else {
            // Show alert if temp message was already removed
            alert(`Failed to send image: ${error.message}`);
          }
        }
      });
    });
  }

  // Simple emoji picker for the chat
  if (emojiButton) {
    emojiButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (!currentConversation) {
        alert('Please select a conversation first');
        return;
      }
      
      // Common emojis
      const commonEmojis = [
        '😊', '😂', '👍', '❤️', '👋', '👏', '🙏', '🎉', 
        '😎', '🤔', '😢', '😍', '🤣', '🥳', '🙌', '✅',
        '🔥', '⭐', '💯', '👀'
      ];
      
      // Create emoji picker
      const emojiPicker = document.createElement('div');
      emojiPicker.className = 'emoji-picker';
      emojiPicker.style.position = 'absolute';
      emojiPicker.style.bottom = '70px';
      emojiPicker.style.left = '20px';
      emojiPicker.style.backgroundColor = '#fff';
      emojiPicker.style.border = '1px solid #ddd';
      emojiPicker.style.borderRadius = '5px';
      emojiPicker.style.padding = '10px';
      emojiPicker.style.display = 'grid';
      emojiPicker.style.gridTemplateColumns = 'repeat(5, 1fr)';
      emojiPicker.style.gap = '5px';
      emojiPicker.style.zIndex = '1000';
      emojiPicker.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
      
      // Add emojis to picker
      commonEmojis.forEach(emoji => {
        const emojiButton = document.createElement('button');
        emojiButton.textContent = emoji;
        emojiButton.style.background = 'none';
        emojiButton.style.border = 'none';
        emojiButton.style.fontSize = '1.5rem';
        emojiButton.style.cursor = 'pointer';
        emojiButton.style.padding = '5px';
        emojiButton.style.borderRadius = '3px';
        emojiButton.style.transition = 'background-color 0.2s';
        
        emojiButton.addEventListener('mouseover', () => {
          emojiButton.style.backgroundColor = '#f0f0f0';
        });
        
        emojiButton.addEventListener('mouseout', () => {
          emojiButton.style.backgroundColor = 'transparent';
        });
        
        emojiButton.addEventListener('click', () => {
          // Add emoji to message input
          if (messageInput) {
            messageInput.value += emoji;
            messageInput.focus();
          }
          
          // Remove picker after selection
          document.body.removeChild(emojiPicker);
        });
        
        emojiPicker.appendChild(emojiButton);
      });
      
      // Close button
      const closeButton = document.createElement('button');
      closeButton.textContent = '✕';
      closeButton.style.position = 'absolute';
      closeButton.style.top = '5px';
      closeButton.style.right = '5px';
      closeButton.style.background = 'none';
      closeButton.style.border = 'none';
      closeButton.style.cursor = 'pointer';
      closeButton.style.fontSize = '1rem';
      closeButton.style.color = '#666';
      
      closeButton.addEventListener('click', () => {
        document.body.removeChild(emojiPicker);
      });
      
      emojiPicker.appendChild(closeButton);
      
      // Add click outside to close
      document.addEventListener('click', function closeEmojiPicker(e) {
        if (!emojiPicker.contains(e.target) && e.target !== emojiButton) {
          if (document.body.contains(emojiPicker)) {
            document.body.removeChild(emojiPicker);
          }
          document.removeEventListener('click', closeEmojiPicker);
        }
      });
      
      // Add picker to body
      document.body.appendChild(emojiPicker);
      
      // Position it near the emoji button
      const buttonRect = emojiButton.getBoundingClientRect();
      emojiPicker.style.left = `${buttonRect.left}px`;
      emojiPicker.style.bottom = `${window.innerHeight - buttonRect.top + 10}px`;
    });
  }
}

// Set up real-time event listeners for WebSocket events
function setupRealtimeListeners() {
  // New message received
  document.addEventListener('newChatMessage', async (e) => {
    const message = e.detail;
    console.log('📢 REAL-TIME EVENT: New chat message received:', message);
    
    // Make sure the message has all required fields
    if (!message || !message.conversationId || !message.senderId) {
      console.warn('⚠️ Received invalid message in newChatMessage event:', message);
      return;
    }
    
    // If this is for the current conversation, add it directly to the UI
    if (currentConversation && message.conversationId === currentConversation.conversationId) {
      // Prevent duplicates - check if we already have this message
      const existingMessage = messages.find(m => m._id === message._id);
      const existingElement = document.querySelector(`[data-message-id="${message._id}"]`);
      
      if (existingElement) {
        console.log('⚠️ Message already exists in DOM, not adding duplicate:', message._id);
        return;
      }
      
      if (existingMessage) {
        console.log('⚠️ Message already exists in array but not in DOM:', message._id);
      } else {
        console.log('✅ Adding new message to messages array:', message._id);
        messages.push(message);
      }
      
      console.log('🟢 Rendering new real-time message in UI');
      
      // Determine message direction (from me or from the other person)
      const isFromCurrentUser = String(message.senderId).trim() === String(getCurrentUserId()).trim();
      
      // Use renderSingleMessage to ensure consistent rendering
      renderSingleMessage(message, isFromCurrentUser);
      
      // Make sure we scroll to show the new message
      scrollToBottom();
      
      // Mark as read if it's not our own message
      if (!isFromCurrentUser) {
        try {
          console.log('📬 Marking real-time message as read from sender:', message.senderId);
          // Always use the other user's ID (not the conversation ID) for marking as read
          await window.chatAPI.markMessagesAsRead(message.senderId);
          
          // For the socket call, we need both conversation ID and sender ID
          window.chatSocket.markMessagesAsRead(currentConversation.conversationId, message.senderId)
            .catch(err => console.warn('Socket markMessagesAsRead failed:', err));
        } catch (error) {
          console.warn('Error marking messages as read:', error);
        }
      }
    } else {
      console.log('📱 Message is for a different conversation, updating conversation list');
      // Update the conversations list to show new messages
      await loadConversations();
    }
  });
  
  // Message sent confirmation
  document.addEventListener('messageSent', (e) => {
    const message = e.detail;
    console.log('🔵 MESSAGE SENT CONFIRMATION:', message);
    
    // If this is for the current conversation
    if (currentConversation && message.conversationId === currentConversation.conversationId) {
      // Find any temp message with the same client ID so we can update it
      // Note: there might be multiple selectors to try since the IDs might be in different formats
      const possibleSelectors = [
        `[data-client-message-id="${message.clientMessageId}"]`,
        `[data-message-id="temp-${message.clientMessageId.split('-')[1]}"]`,
        `[data-message-id="${message.clientMessageId}"]`
      ];
      
      let tempMessage = null;
      for (const selector of possibleSelectors) {
        tempMessage = document.querySelector(selector);
        if (tempMessage) {
          console.log('✅ Found temp message to update using selector:', selector);
          break;
        }
      }
      
      if (tempMessage) {
        console.log('✅ Updating temp message with server-confirmed data', message._id);
        // Update the ID with the confirmed one from the server
        tempMessage.dataset.messageId = message._id;
        // Keep the client ID for future reference
        if (!tempMessage.dataset.clientMessageId) {
          tempMessage.dataset.clientMessageId = message.clientMessageId;
        }
      } else {
        console.log('⚠️ No temporary message found, adding new message to UI');
        // If no temp message exists (might happen if connection was lost/restored),
        // add the message directly
        const isFromCurrentUser = true; // This is definitely our own message
        renderSingleMessage(message, isFromCurrentUser);
        scrollToBottom();
      }
    }
  });
  
  // Messages read by other user
  document.addEventListener('messagesRead', (e) => {
    const data = e.detail;
    
    // Update UI to show messages as read if needed
    // This would update the "read" indicators
  });
  
  // User typing indicator
  document.addEventListener('userTyping', (e) => {
    const data = e.detail;
    
    // Only show typing for current conversation
    if (!currentConversation || data.conversationId !== currentConversation.conversationId) {
      return;
    }
    
    const statusText = userInfo?.querySelector('span.text-sm');
    if (!statusText) return;
    
    // Don't change Year of Study text with typing status
    console.log('User typing detected, but not changing Year of Study display');
  });
  
  // User presence updates - DISABLED, replaced with Year of Study
  document.addEventListener('userPresence', (e) => {
    // Functionality removed as requested
    console.log('User presence updates disabled - using Year of Study instead');
  });

  // WebSocket error handling
  document.addEventListener('chatError', (e) => {
    const error = e.detail;
    console.warn('Chat WebSocket error event:', error);
    
    // Don't disrupt the user experience, just log it
    // We'll still have the REST API fallback for messaging
    
    // Show a discreet notification if in a conversation
    if (currentConversation && messageContainer) {
      const errorNotice = document.createElement('div');
      errorNotice.className = 'text-center my-2';
      errorNotice.innerHTML = `
        <small class="text-muted">
          <i class="ti ti-alert-circle me-1"></i>
          Real-time updates temporarily unavailable
        </small>
      `;
      
      // Add to the message container if it doesn't already exist
      if (!messageContainer.querySelector('.text-center.my-2')) {
        messageContainer.appendChild(errorNotice);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
          if (errorNotice.parentNode === messageContainer) {
            messageContainer.removeChild(errorNotice);
          }
        }, 5000);
      }
    }
  });
}

// Fallback search function that doesn't require encryption
async function searchUsersWithoutEncryption(query) {
  if (!conversationsList) return;
  
  if (!query || query.length < 2) {
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">Start typing to search for users</p>
        <p class="text-muted small">Note: Messaging functionality is limited until encryption is available</p>
      </div>
    `;
    return;
  }
  
  try {
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">Searching...</p>
      </div>
    `;
    
    // Use regular user search API instead of the chat-specific one
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Search request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.success) {
      if (data.data.length === 0) {
        conversationsList.innerHTML = `
          <div class="text-center p-4">
            <p class="text-muted">No users found matching "${query}"</p>
          </div>
        `;
        return;
      }
      
      renderBasicSearchResults(data.data);
    } else {
      conversationsList.innerHTML = `
        <div class="text-center p-4">
          <p class="text-muted">Error searching: ${data.message || 'Unknown error'}</p>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error searching users without encryption:', error);
    conversationsList.innerHTML = `
      <div class="text-center p-4">
        <p class="text-muted">Error searching users. Please try again.</p>
      </div>
    `;
  }
}

// Render search results without encryption functionality
function renderBasicSearchResults(users) {
  if (!conversationsList) return;
  
  // Clear existing content
  conversationsList.innerHTML = '';
  
  // Create a header that explains the limited functionality
  const headerElem = document.createElement('div');
  headerElem.className = 'alert alert-warning m-2 p-2';
  headerElem.innerHTML = `
    <p class="mb-0 small"><strong>Note:</strong> Messaging is unavailable until encryption is working.</p>
    <p class="mb-0 small">Please refresh the page to try again.</p>
  `;
  conversationsList.appendChild(headerElem);
  
  // Add each user to the list
  users.forEach(user => {
    const userElement = document.createElement('a');
    userElement.href = "#";
    userElement.className = "list-group-item list-group-item-action p-3";
    userElement.dataset.userId = user._id;
    
    // Use the correct field names from the User model
    userElement.innerHTML = `
      <div class="media align-items-center">
        <div class="chat-avtar" style="width: 40px; height: 40px; flex-shrink: 0;">
          <img class="rounded-circle img-fluid wid-40" 
               src="${user.profile_picture || '/assets/images/user/blank-avatar.png'}" 
               alt="User image"
               style="width: 40px; height: 40px; object-fit: cover; background-color: #f0f0f0;"
          >
        </div>
        <div class="media-body mx-2" style="min-width: 0; width: calc(100% - 50px);">
          <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0 text-truncate" style="max-width: calc(100% - 80px);">${user.full_name || user.username}</h5>
            ${conversationStatus}
          </div>
          <span class="text-sm text-muted text-truncate d-block">${user.email || ""}</span>
        </div>
      </div>
    `;
    
    // When clicked, show encryption error
    userElement.addEventListener('click', (e) => {
      e.preventDefault();
      showError('Secure messaging is unavailable. Please refresh the page to try again.');
    });
    
    conversationsList.appendChild(userElement);
  });
}

// Add a new message to the chat container
function addMessageToChat(message) {
  if (!messageContainer) return;
  
  // Check if message has valid sender information
  if (!message.senderId) {
    console.warn('New message missing senderId:', message);
    return;
  }
  
  // Check if this is a duplicate message
  const existingMessage = document.querySelector(`[data-message-id="${message._id}"]`);
  if (existingMessage) {
    console.log('Duplicate message detected, not adding again.');
    return;
  }
  
  // Get current user ID - we'll use this to determine message direction
  const currentUserId = getCurrentUserId();
  
  // Simplified direction check - directly compare as strings
  const isFromCurrentUser = String(message.senderId).trim() === String(currentUserId).trim();
  console.log(`New message from ${message.senderId} - from current user? ${isFromCurrentUser}`);
  
  // Use our new single message renderer
  renderSingleMessage(message, isFromCurrentUser);
  
  scrollToBottom();
}

// Modal functions for file and image preview
window.openFileModal = function(modalId, fileUrl, fileName) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block !important';
    modal.style.setProperty('display', 'block', 'important');
    document.body.style.overflow = 'hidden'; // Prevent scrolling while modal is open
    
    // Ensure z-index is applied
    modal.style.setProperty('z-index', '10000000', 'important');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.setProperty('z-index', '10000001', 'important');
    }
    
    // Move modal to document body to avoid containment issues
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }
};

window.closeFileModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
};

window.openImageModal = function(modalId, imageUrl) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block !important';
    modal.style.setProperty('display', 'block', 'important');
    document.body.style.overflow = 'hidden'; // Prevent scrolling while modal is open
    
    // Ensure z-index is applied
    modal.style.setProperty('z-index', '10000000', 'important');
    const modalContent = modal.querySelector('.modal-content');
    if (modalContent) {
      modalContent.style.setProperty('z-index', '10000001', 'important');
    }
    
    // Move modal to document body to avoid containment issues
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
  }
};

window.closeImageModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = ''; // Restore scrolling
  }
};

// Close modals when clicking outside the content
document.addEventListener('click', function(event) {
  if (event.target.classList.contains('file-preview-modal') || 
      event.target.classList.contains('image-preview-modal')) {
    event.target.style.display = 'none';
    event.target.style.setProperty('display', 'none', 'important');
    document.body.style.overflow = ''; // Restore scrolling
  }
});

// Start the chat interface when DOM is loaded
document.addEventListener('DOMContentLoaded', initChatInterface);

function renderMessage(message, isCurrentUser) {
    const messageClass = isCurrentUser ? 'message-out' : 'message-in';
    const avatarSrc = isCurrentUser ? '../assets/images/user/avatar-5.jpg' : '../assets/images/user/avatar-3.jpg';
    const timestamp = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    return `
        <div class="${messageClass}">
            <div class="d-flex">
                ${!isCurrentUser ? `
                    <div class="flex-shrink-0">
                        <div class="chat-avtar">
                            <img class="rounded-circle img-fluid wid-40" src="${avatarSrc}" alt="User image">
                        </div>
                    </div>
                ` : ''}
                <div class="flex-grow-1 mx-3">
                    <div class="msg-content ${isCurrentUser ? 'bg-primary' : ''}">
                        <p class="mb-0">${message.content}</p>
                    </div>
                    <p class="mb-0 text-muted text-sm">${timestamp}</p>
                </div>
                ${isCurrentUser ? `
                    <div class="flex-shrink-0">
                        <div class="chat-avtar">
                            <img class="rounded-circle img-fluid wid-40" src="${avatarSrc}" alt="User image">
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function appendMessage(message, isCurrentUser = false) {
    const messageHtml = renderMessage(message, isCurrentUser);
    chatMessages.insertAdjacentHTML('beforeend', messageHtml);
    scrollToBottom();
}

// Add this function at a suitable location in the file
function troubleshootMessageDirections() {
  console.log("===== MESSAGE DIRECTION TROUBLESHOOTING =====");
  
  // Check current user information
  const userId = getCurrentUserId();
  console.log("Current user details:", {
    userId: userId,
    username: localStorage.getItem('username') || sessionStorage.getItem('username'),
    storage: {
      localStorage: localStorage.getItem('userId'),
      sessionStorage: sessionStorage.getItem('userId')
    }
  });
  
  // Check existing messages in the DOM
  const allMessages = document.querySelectorAll('.message-in, .message-out');
  console.log(`Found ${allMessages.length} messages in the DOM`);
  
  allMessages.forEach((elem, index) => {
    const isOutgoing = elem.classList.contains('message-out');
    const senderId = elem.dataset.senderId;
    
    console.log(`Message ${index + 1}:`, {
      senderId: senderId,
      direction: isOutgoing ? 'outgoing (right)' : 'incoming (left)',
      matchesCurrentUser: senderId === userId,
      element: elem
    });
  });
  
  console.log("===========================================");
  return {
    fix: fixMessageDirections
  };
}

// Function to fix incorrectly positioned messages
function fixMessageDirections() {
  const userId = getCurrentUserId();
  const allMessages = document.querySelectorAll('.message-in, .message-out');
  
  console.log(`Fixing ${allMessages.length} messages`);
  
  allMessages.forEach((elem) => {
    const senderId = elem.dataset.senderId;
    const shouldBeOutgoing = String(senderId).trim() === String(userId).trim();
    
    // Fix direction if incorrect
    if (shouldBeOutgoing && !elem.classList.contains('message-out')) {
      elem.classList.remove('message-in');
      elem.classList.add('message-out');
      console.log(`Fixed: Changed message from incoming to outgoing`);
      
      // Fix content alignment
      const flexContainer = elem.querySelector('.d-flex');
      if (flexContainer) {
        flexContainer.classList.add('justify-content-end');
      }
      
      const contentContainer = elem.querySelector('.flex-grow-1');
      if (contentContainer) {
        contentContainer.classList.add('text-end');
      }
      
      // Move avatar to right side
      reorganizeMessageLayout(elem, true);
    } 
    else if (!shouldBeOutgoing && !elem.classList.contains('message-in')) {
      elem.classList.remove('message-out');
      elem.classList.add('message-in');
      console.log(`Fixed: Changed message from outgoing to incoming`);
      
      // Fix content alignment
      const flexContainer = elem.querySelector('.d-flex');
      if (flexContainer) {
        flexContainer.classList.remove('justify-content-end');
      }
      
      const contentContainer = elem.querySelector('.flex-grow-1');
      if (contentContainer) {
        contentContainer.classList.remove('text-end');
      }
      
      // Move avatar to left side
      reorganizeMessageLayout(elem, false);
    }
  });
  
  console.log("Message directions fixed.");
}

// Helper to reorganize message layout
function reorganizeMessageLayout(messageElement, isOutgoing) {
  const flexContainer = messageElement.querySelector('.d-flex');
  if (!flexContainer) return;
  
  // Get avatar and content elements
  const avatar = flexContainer.querySelector('.flex-shrink-0');
  const content = flexContainer.querySelector('.flex-grow-1');
  
  if (!avatar || !content) return;
  
  // Remove existing elements
  flexContainer.innerHTML = '';
  
  // Recreate layout in correct order
  if (isOutgoing) {
    // For outgoing: content on left, avatar on right
    flexContainer.appendChild(content);
    flexContainer.appendChild(avatar);
  } else {
    // For incoming: avatar on left, content on right
    flexContainer.appendChild(avatar);
    flexContainer.appendChild(content);
  }
}

// Function to directly append a message to the chat
function appendDirectMessage(message) {
  if (!messageContainer || !message) {
    console.warn("📛 appendDirectMessage: Missing messageContainer or message", {
      hasContainer: !!messageContainer,
      message: message
    });
    return;
  }
  
  console.log("🟢 DIRECTLY APPENDING MESSAGE TO CHAT:", message);
  
  // Check if this message already exists in the DOM to avoid duplicates
  const existingMsg = document.querySelector(`[data-message-id="${message._id}"]`);
  if (existingMsg) {
    console.log("🟡 Message already exists in DOM, not appending duplicate");
    return;
  }
  
  // Add to messages array if not already there
  const existingInArray = messages.find(m => m._id === message._id);
  if (!existingInArray) {
    console.log("🔷 Adding message to messages array:", message._id);
    messages.push(message);
  } else {
    console.log("🔶 Message already in messages array:", message._id);
  }
  
  // Determine direction
  const currentUserId = getCurrentUserId();
  const isFromCurrentUser = String(message.senderId).trim() === String(currentUserId).trim();
  
  console.log("🔷 Message direction check:", {
    messageSenderId: message.senderId,
    currentUserId: currentUserId,
    isFromCurrentUser: isFromCurrentUser
  });
  
  // Render the message
  renderSingleMessage(message, isFromCurrentUser);
  
  // Scroll to the new message
  scrollToBottom();
  
  console.log("✅ Message appended successfully:", message._id);
}

// Function to check connection health and recover if needed
window.checkChatConnectionHealth = function() {
  console.log('🔍 Checking chat connection health...');
  
  // Check if we're supposed to be using simplified mode
  const useSimplifiedMode = sessionStorage.getItem('useSimplifiedChatMode') === 'true';
  
  // If we're not in simplified mode, we should have a working socket
  if (!useSimplifiedMode) {
    // Check if socket is connected using our helper function
    const isSocketActive = window.chatSocket && typeof window.chatSocket.isConnected === 'function' && window.chatSocket.isConnected();
    
    if (!isSocketActive) {
      console.warn('⚠️ Socket connection appears to be down but we are not in simplified mode');
      
      // Try to reconnect the socket
      if (window.chatSocket && typeof window.chatSocket.connectChatSocket === 'function') {
        console.log('🔄 Attempting to reconnect socket...');
        
        window.chatSocket.connectChatSocket()
          .then(result => {
            if (result.status === 'connected' || result.status === 'already-connected') {
              console.log('✅ Successfully reconnected socket!');
              
              // If we have a refreshChatState function, call it
              if (typeof window.refreshChatState === 'function') {
                window.refreshChatState();
              }
            } else {
              console.error('❌ Failed to reconnect socket:', result);
              
              // Show a notification to the user that real-time updates aren't working
              if (!document.getElementById('connection-health-warning')) {
                const warning = document.createElement('div');
                warning.id = 'connection-health-warning';
                warning.className = 'alert alert-warning alert-dismissible fade show m-2';
                warning.innerHTML = `
                  <small>
                    <i class="ti ti-wifi-off me-1"></i>
                    Real-time connection appears to be down. 
                    <button class="btn btn-sm btn-link p-0 ms-2" id="try-reconnect-btn">Reconnect</button>
                    <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
                  </small>
                `;
                
                // Add to top of page
                const chatArea = document.querySelector('.scroll-block.chat-message');
                if (chatArea) {
                  chatArea.parentNode.insertBefore(warning, chatArea);
                  
                  // Add click handler for reconnect button
                  document.getElementById('try-reconnect-btn').addEventListener('click', function() {
                    this.innerHTML = '<i class="ti ti-loader ti-spin me-1"></i> Connecting...';
                    this.disabled = true;
                    
                    // Try to enable real-time mode
                    tryEnableRealTimeMode()
                      .catch(err => {
                        console.error('Failed to reconnect:', err);
                        this.innerHTML = 'Try Again';
                        this.disabled = false;
                      });
                  });
                }
              }
            }
          })
          .catch(err => {
            console.error('❌ Error reconnecting socket:', err);
          });
      }
    }
  }
  
  return "Connection health check complete";
};

// Set up a periodic connection health check (every 2 minutes)
setInterval(function() {
  // Only run if the user is active on the page
  if (document.visibilityState === 'visible') {
    window.checkChatConnectionHealth();
  }
}, 120000); // 2 minutes

// Function to reset encryption and fix issues
window.resetChatEncryption = async function() {
  try {
    console.log('🔄 Resetting chat encryption state...');
    
    // Show loader in UI
    const existingIndicator = document.getElementById('simplified-mode-indicator');
    if (existingIndicator) {
      existingIndicator.innerHTML = `
        <small>
          <i class="ti ti-loader ti-spin me-1"></i>
          Resetting encryption system, please wait...
        </small>
      `;
    } else {
      // Create new indicator
      const indicator = document.createElement('div');
      indicator.id = 'encryption-reset-indicator';
      indicator.className = 'alert alert-info alert-dismissible fade show m-2';
      indicator.innerHTML = `
        <small>
          <i class="ti ti-loader ti-spin me-1"></i>
          Resetting encryption system, please wait...
        </small>
      `;
      
      // Add to top of chat area
      const chatArea = document.querySelector('.scroll-block.chat-message');
      if (chatArea) {
        chatArea.parentNode.insertBefore(indicator, chatArea);
      }
    }
    
    // Reset encryption state using the new function we added
    if (window.chatEncryption && typeof window.chatEncryption.resetEncryptionState === 'function') {
      await window.chatEncryption.resetEncryptionState();
    } else {
      // Fallback for older versions that don't have the function
      console.log('resetEncryptionState function not available, using manual reset');
      
      // Clear storage
      localStorage.removeItem('chatPrivateKey');
      localStorage.removeItem('chatPublicKey');
      sessionStorage.removeItem('chatPrivateKey');
      sessionStorage.removeItem('chatPublicKey');
      sessionStorage.removeItem('useSimplifiedChatMode');
      
      // Reinitialize chat
      await window.chatAPI.initialize();
    }
    
    // Re-enable real-time mode
    await tryEnableRealTimeMode();
    
    // Show success message
    const existingMsg = document.getElementById('simplified-mode-indicator') || 
                       document.getElementById('encryption-reset-indicator');
    
    if (existingMsg) {
      existingMsg.className = 'alert alert-success alert-dismissible fade show m-2';
      existingMsg.innerHTML = `
        <small>
          <i class="ti ti-check-circle me-1"></i>
          Encryption system has been reset successfully. Real-time messaging is now enabled.
          <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
        </small>
      `;
      
      // Auto-hide after 5 seconds
      setTimeout(() => {
        existingMsg.classList.remove('show');
        setTimeout(() => existingMsg.remove(), 300);
      }, 5000);
    }
    
    // Refresh the current conversation
    refreshCurrentConversation();
    
    return "Encryption reset successful";
  } catch (error) {
    console.error('Failed to reset encryption:', error);
    
    // Show error in UI
    const existingMsg = document.getElementById('simplified-mode-indicator') || 
                        document.getElementById('encryption-reset-indicator');
    
    if (existingMsg) {
      existingMsg.className = 'alert alert-danger alert-dismissible fade show m-2';
      existingMsg.innerHTML = `
        <small>
          <i class="ti ti-alert-circle me-1"></i>
          Failed to reset encryption: ${error.message}
          <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
        </small>
      `;
      
      // Add retry button
      const retryButton = document.createElement('button');
      retryButton.className = 'btn btn-sm btn-outline-primary ms-2';
      retryButton.innerHTML = '<i class="ti ti-refresh me-1"></i> Try Again';
      retryButton.addEventListener('click', () => window.resetChatEncryption());
      existingMsg.querySelector('small').appendChild(retryButton);
    }
    
    return "Encryption reset failed";
  }
};

// Try to enable real-time messaging mode
async function tryEnableRealTimeMode(withRetry = true) {
  console.log('Attempting to enable real-time messaging mode...');
  
  // Check if WebSocket client is available
  if (!window.chatSocket || typeof window.chatSocket.connectChatSocket !== 'function') {
    console.error('WebSocket client not available');
    return { success: false, error: 'WebSocket client not available' };
  }

  try {
    // Update UI to show we're connecting
    const simplifiedIndicator = document.getElementById('simplified-mode-indicator');
    if (simplifiedIndicator) {
      simplifiedIndicator.innerHTML = `
        <small>
          <i class="ti ti-loader ti-spin me-1"></i>
          Connecting to real-time messaging...
        </small>
      `;
    }
    
    // Clear simplified mode flag
    sessionStorage.removeItem('useSimplifiedChatMode');
    sessionStorage.removeItem('wsRetryAttempt');
    sessionStorage.removeItem('encryptionFailCount');
    
    // Try connecting to the WebSocket
    console.log('Connecting to chat WebSocket...');
    const socketResult = await window.chatSocket.connectChatSocket();
    console.log('Socket connection result:', socketResult);
    
    if (socketResult.status === 'connected' || socketResult.status === 'already-connected') {
      console.log('WebSocket connected successfully!');
      
      // If current conversation is loaded, join it
      if (currentConversation && currentConversation.conversationId) {
        console.log('Joining current conversation via WebSocket:', currentConversation.conversationId);
        await window.chatSocket.joinConversation(currentConversation.conversationId);
      }
      
      // Remove the simplified mode indicator
      if (simplifiedIndicator) {
        simplifiedIndicator.remove();
      }
      
      // Refresh chat to make sure we have the latest messages
      refreshCurrentConversation();
      
      return { success: true };
    } else {
      console.warn('Failed to connect to WebSocket:', socketResult);
      
      if (withRetry && socketResult.status !== 'auth-missing') {
        console.log('Attempting one more connection try with fresh settings...');
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Clear potential problematic session data
        sessionStorage.removeItem('wsRetryAttempt');
        
        // Second attempt
        return tryEnableRealTimeMode(false);
      }
      
      // Show error in the UI
      if (simplifiedIndicator) {
        simplifiedIndicator.className = 'alert alert-warning alert-dismissible fade show m-2';
        simplifiedIndicator.innerHTML = `
          <small>
            <i class="ti ti-alert-circle me-1"></i>
            Chat is operating in simplified mode without live updates. Messages will not update in real-time.
            <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
            <button class="btn btn-sm btn-primary ms-2" id="retry-realtime-btn">
              <i class="ti ti-rocket me-1"></i> Try Again
            </button>
            <button class="btn btn-sm btn-outline-secondary ms-2" id="refresh-msgs-btn">
              <i class="ti ti-refresh me-1"></i> Refresh Messages
            </button>
          </small>
        `;
        
        // Add event listeners to the buttons
        document.getElementById('retry-realtime-btn').addEventListener('click', () => {
          tryEnableRealTimeMode();
        });
        
        document.getElementById('refresh-msgs-btn').addEventListener('click', () => {
          refreshCurrentConversation();
        });
      }
      
      // Set simplified mode flag
      sessionStorage.setItem('useSimplifiedChatMode', 'true');
      
      return { 
        success: false, 
        error: socketResult.error || 'Failed to connect to real-time messaging'
      };
    }
  } catch (error) {
    console.error('Error enabling real-time mode:', error);
    
    // Update UI to show the error
    const simplifiedIndicator = document.getElementById('simplified-mode-indicator');
    if (simplifiedIndicator) {
      simplifiedIndicator.className = 'alert alert-danger alert-dismissible fade show m-2';
      simplifiedIndicator.innerHTML = `
        <small>
          <i class="ti ti-alert-circle me-1"></i>
          Failed to connect to real-time messaging: ${error.message}
          <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
          <button class="btn btn-sm btn-primary ms-2" id="retry-realtime-btn2">
            <i class="ti ti-rocket me-1"></i> Try Again
          </button>
          <button class="btn btn-sm btn-outline-secondary ms-2" id="manual-refresh-btn">
            <i class="ti ti-refresh me-1"></i> Refresh Messages
          </button>
        </small>
      `;
      
      // Add event listeners to the buttons
      document.getElementById('retry-realtime-btn2').addEventListener('click', () => {
        tryEnableRealTimeMode();
      });
      
      document.getElementById('manual-refresh-btn').addEventListener('click', () => {
        refreshCurrentConversation();
      });
    }
    
    // Set simplified mode flag
    sessionStorage.setItem('useSimplifiedChatMode', 'true');
    
    return { success: false, error: error.message };
  }
}

// Set up auto-refresh polling for simplified mode
let autoRefreshInterval = null;

function setupAutoRefresh(enable = true) {
  // Clear any existing interval
  if (autoRefreshInterval) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
  
  if (!enable) {
    console.log('Auto-refresh disabled');
    return;
  }
  
  // Don't auto-refresh if socket is connected
  if (window.chatSocket && 
      typeof window.chatSocket.isConnected === 'function' && 
      window.chatSocket.isConnected()) {
    console.log('WebSocket is connected, skipping auto-refresh setup');
    return;
  }
  
  // Don't auto-refresh if not in simplified mode
  if (sessionStorage.getItem('useSimplifiedChatMode') !== 'true') {
    console.log('Not in simplified mode, skipping auto-refresh setup');
    return;
  }
  
  console.log('Setting up auto-refresh polling for messages');
  
  // Poll for new messages every 5 seconds (reduced from 10)
  autoRefreshInterval = setInterval(() => {
    if (!currentConversation || !currentConversation.otherUser) {
      return; // No active conversation
    }
    
    // Don't refresh if user is typing to avoid disruption
    const messageInput = document.getElementById('message-input');
    if (messageInput && messageInput === document.activeElement && messageInput.value.trim() !== '') {
      console.log('User is typing, skipping auto-refresh');
      return;
    }
    
    // Check if socket is now connected
    if (window.chatSocket && 
        typeof window.chatSocket.isConnected === 'function' && 
        window.chatSocket.isConnected()) {
      console.log('WebSocket is now connected, disabling auto-refresh');
      clearInterval(autoRefreshInterval);
      autoRefreshInterval = null;
      return;
    }
    
    console.log('Auto-refreshing current conversation silently...');
    refreshCurrentConversation(true); // Use true for silentRefresh
  }, 5000); // 5 seconds (reduced from 10)
  
  console.log('Auto-refresh enabled with 5-second interval');
}

// Add function to force real-time mode
window.forceEnableRealTimeChat = async function() {
  console.log("🔄 Attempting to force enable real-time chat mode without encryption...");
  
  // Clear all flags that might prevent real-time mode
  sessionStorage.removeItem('useSimplifiedChatMode');
  sessionStorage.removeItem('wsRetryAttempt');
  sessionStorage.removeItem('encryptionFailCount');
  
  // Close any existing socket connection
  if (window.chatSocket && typeof window.chatSocket.disconnectChatSocket === 'function') {
    window.chatSocket.disconnectChatSocket();
  }
  
  // Wait a moment for cleanup
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Try to connect with a fresh socket
  try {
    console.log("Creating fresh WebSocket connection...");
    const socketResult = await window.chatSocket.connectChatSocket();
    
    if (socketResult.status === 'connected' || socketResult.status === 'already-connected') {
      console.log("✅ WebSocket connected successfully!");
      
      // Set up real-time listeners
      setupRealtimeListeners();
      
      // If in a conversation, join it
      if (currentConversation && currentConversation.conversationId) {
        console.log("Joining current conversation on new socket:", currentConversation.conversationId);
        await window.chatSocket.joinConversation(currentConversation.conversationId);
      }
      
      // Remove simplified mode indicator if present
      const indicator = document.getElementById('simplified-mode-indicator');
      if (indicator) indicator.remove();
      
      // Success indicator removed
      
      // Disable auto-refresh since we don't need it with real-time mode
      setupAutoRefresh(false);
      
      // Refresh current conversation
      refreshCurrentConversation();
      
      return "✅ Real-time chat enabled successfully!";
    } else {
      throw new Error(`WebSocket connection failed: ${socketResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error("Failed to force enable real-time chat:", error);
    
    // Show error message
    const errorToast = document.createElement('div');
    errorToast.className = 'alert alert-danger alert-dismissible fade show m-2';
    errorToast.innerHTML = `
      <small>
        <i class="ti ti-alert-circle me-1"></i>
        Failed to enable real-time chat: ${error.message}
        <button type="button" class="btn-close small" data-bs-dismiss="alert" aria-label="Close"></button>
      </small>
    `;
    
    const chatArea = document.querySelector('.scroll-block.chat-message');
    if (chatArea) {
      chatArea.parentNode.insertBefore(errorToast, chatArea);
    }
    
    return "❌ Failed to enable real-time chat: " + error.message;
  }
};

// Add this function to fix message display issues on demand
window.fixChatDisplayIssues = function() {
  console.log("🛠️ Fixing chat display issues");
  
  // 1. Clear any problematic cached data
  sessionStorage.removeItem('useSimplifiedChatMode');
  sessionStorage.removeItem('wsRetryAttempt');
  
  // 2. Fix specific issue with message content if necessary
  if (messages && messages.length > 0) {
    // First backup the current messages array
    const messagesBackup = [...messages];
    
    // Fix any content issues in the messages
    messagesBackup.forEach(message => {
      // Ensure plain content is used if we have it in any format
      if (!message.content && message.encryptedContent) {
        message.content = message.encryptedContent;
        console.log(`Fixed message ${message._id}: Moving encryptedContent to content`);
      }
    });
    
    // Re-render all messages with the fixed content
    console.log(`Re-rendering ${messagesBackup.length} messages with fixes applied`);
    messages = messagesBackup;
    renderMessages(messages);
    return `Fixed ${messagesBackup.length} messages`;
  } else {
    return "No messages to fix. Try loading a conversation first.";
  }
};

// Run this after message send to ensure content is properly shown
window.checkSentMessage = function(message) {
  console.log("Checking sent message:", message);
  
  if (!message || !message._id) {
    console.warn("Invalid message object to check");
    return false;
  }
  
  // Find the message element in the DOM
  const messageElement = document.querySelector(`[data-message-id="${message._id}"]`);
  if (!messageElement) {
    console.warn(`Message element with ID ${message._id} not found in DOM`);
    return false;
  }
  
  // Check if the message shows "No message content"
  const contentElement = messageElement.querySelector('div[style*="word-break: break-word"]');
  if (contentElement && contentElement.textContent.includes('No message content')) {
    console.log("Found message with 'No message content', attempting to fix");
    
    // Try to extract content from the message object
    let content = '';
    if (message.content) {
      content = message.content;
    } else if (message.encryptedContent) {
      content = message.encryptedContent;
    } else if (message.text) {
      content = message.text;
    }
    
    if (content) {
      console.log("Found content to use:", content);
      contentElement.textContent = content;
      return true;
    }
  }
  
  return false;
};

// Function to filter users to only show accepted friends
function filterOnlyAcceptedFriends(users) {
  if (!Array.isArray(users)) return [];
  
  console.log(`Filtering ${users.length} users to show only accepted friends`);
  
  return users.filter(user => {
    // Check if this user is an accepted friend
    return user.isFriend === true || 
           user.status === 'accepted' || 
           user.friendStatus === 'accepted' ||
           user.connectionStatus === 'accepted';
  });
}

// Apply the filter to the search results and user list display
function applyFriendsOnlyFilter() {
  // Find the original loadUserList or renderUserList function
  const originalLoadUserList = window.loadUserList || window.renderUserList;
  
  if (typeof originalLoadUserList === 'function') {
    // Override the function to apply our filter
    window.loadUserList = function(users, ...args) {
      const filteredUsers = filterOnlyAcceptedFriends(users);
      console.log(`Filtered ${users.length} users to ${filteredUsers.length} accepted friends`);
      return originalLoadUserList(filteredUsers, ...args);
    };
    
    // Also override window.renderUserList if it exists
    if (window.renderUserList && window.renderUserList !== window.loadUserList) {
      window.renderUserList = function(users, ...args) {
        const filteredUsers = filterOnlyAcceptedFriends(users);
        return originalLoadUserList(filteredUsers, ...args);
      };
    }
  }
  
  // Find and override the search function if it exists
  const originalSearchUsers = window.searchUsers || window.filterUsers;
  if (typeof originalSearchUsers === 'function') {
    window.searchUsers = function(query, users, ...args) {
      // First apply the friends-only filter
      const friendsOnly = filterOnlyAcceptedFriends(users);
      // Then apply the original search logic
      return originalSearchUsers(query, friendsOnly, ...args);
    };
    
    // Also override window.filterUsers if it exists
    if (window.filterUsers && window.filterUsers !== window.searchUsers) {
      window.filterUsers = function(query, users, ...args) {
        const friendsOnly = filterOnlyAcceptedFriends(users);
        return originalSearchUsers(query, friendsOnly, ...args);
      };
    }
  }
  
  // Apply the filter to any existing search input
  const searchInput = document.querySelector('.form-search input[type="search"]');
  if (searchInput) {
    const originalHandler = searchInput.oninput;
    searchInput.oninput = function(event) {
      // Call the original handler if it exists
      if (typeof originalHandler === 'function') {
        originalHandler.call(this, event);
      }
      
      // Force re-filter the results to only show friends
      const searchTerm = this.value.trim().toLowerCase();
      if (typeof window.performSearch === 'function') {
        window.performSearch(searchTerm, true); // true flag to force friends-only filter
      }
    };
  }
}

// Initialize the friends-only filter when the page loads
document.addEventListener('DOMContentLoaded', function() {
  console.log('Initializing friends-only filter for chat contacts');
  setTimeout(applyFriendsOnlyFilter, 1000);
});

// Force scroll to absolute bottom - guaranteed approach
function forceScrollToBottom() {
  console.log('🔽 FORCE SCROLL: Attempting guaranteed scroll to bottom');
  
  if (!messageContainer) {
    console.warn('No message container found for scrolling');
    return;
  }
  
  // Method 1: Try SimpleBar API if available
  const scrollContainer = messageContainer.closest('.scroll-block');
  let simpleBar = scrollContainer ? scrollContainer._sbInstance : null;
  
  if (simpleBar && simpleBar.getScrollElement) {
    const scrollElement = simpleBar.getScrollElement();
    console.log(`SimpleBar scroll element found, height: ${scrollElement.scrollHeight}px`);
    
    // Force scroll to absolute bottom
    scrollElement.scrollTop = 999999; // Use a large value to ensure we reach bottom
  }
  
  // Method 2: Direct manipulation of the container
  if (messageContainer) {
    messageContainer.scrollTop = 999999; // Use a large value to ensure we reach bottom
  }
  
  // Method 3: Find any scrollable parent and force scroll it
  let parent = messageContainer.parentElement;
  while (parent) {
    if (parent.scrollHeight > parent.clientHeight) {
      console.log(`Found scrollable parent element: ${parent.className || parent.tagName}`);
      parent.scrollTop = 999999;
    }
    parent = parent.parentElement;
  }
  
  // Method 4: Force using scrollIntoView on the last message element
  const allMessages = messageContainer.querySelectorAll('.force-message-in, .force-message-out');
  if (allMessages.length > 0) {
    const lastMessage = allMessages[allMessages.length - 1];
    console.log(`Forcing last message (${lastMessage.dataset.messageId}) into view`);
    lastMessage.scrollIntoView({ behavior: 'auto', block: 'end' });
  }
  
  // Schedule another attempt after a delay to handle late-rendering content
  setTimeout(() => {
    console.log('🔄 FORCE SCROLL: Secondary attempt after delay');
    
    if (simpleBar && simpleBar.getScrollElement) {
      simpleBar.getScrollElement().scrollTop = 999999;
    }
    
    if (messageContainer) {
      messageContainer.scrollTop = 999999;
    }
    
    // Try scrollIntoView again
    const allMessages = messageContainer.querySelectorAll('.force-message-in, .force-message-out');
    if (allMessages.length > 0) {
      allMessages[allMessages.length - 1].scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, 300);
}

// Online/offline status functionality removed - replaced with Year of Study

// Listen for user presence events from server - DISABLED, replaced with Year of Study
function setupPresenceTracking() {
  console.log('User presence tracking disabled - using Year of Study instead');
  // Functionality removed as requested
}

// Update user study year indicator - replaced online status functionality
function updateUserStatusIndicators(userId) {
  console.log('Online/offline indicators disabled - using Year of Study instead');
  // Functionality removed as requested
}

// This function is disabled - replaced with Year of Study functionality
async function fetchUserPresence(userId) {
  console.log('User presence/online status feature disabled - using Year of Study instead');
  // Functionality removed as requested
}

// Initialize presence tracking
document.addEventListener('DOMContentLoaded', function() {
  // Set up presence tracking
  setupPresenceTracking();
});

// Add this function to directly fetch and update the year of study
async function fetchAndUpdateYearOfStudy(userId) {
  if (!userId) return;
  
  try {
    console.log('Fetching fresh user data for year of study, userId:', userId);
    
    // Valid study year values from the select element
    const validStudyYears = [
      "Freshman",
      "Sophomore",
      "Junior", 
      "Senior",
      "Graduate",
      "Post Graduate"
    ];
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    // Fetch the user data directly from API
    console.log(`Making API call to /api/users/${userId}`);
    const response = await fetch(`/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    console.log('API Response status:', response.status, response.statusText);
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    
    const result = await response.json();
    const userData = result.data || result;
    
    console.log('Full API response:', result);
    console.log('Fresh user data for year of study:', userData);
    
    // Try to find the year of study in this fresh data
    let yearOfStudy = 'N/A';
    
        // Extract valid year of study values dynamically from API data
    if (userData) {
      console.log('Attempting to extract year of study dynamically');
      
      // Try all standard field names for year of study
      const yearFields = [
        'yearOfStudy', 'year_of_study', 'studyYear', 'study_year', 
        'year', 'level', 'academicYear', 'academic_year',
        'education.yearOfStudy', 'education.year', 'education.level',
        'profile.yearOfStudy', 'profile.year'
      ];
      
      for (const field of yearFields) {
        // Handle dot notation for nested fields
        let value = null;
        if (field.includes('.')) {
          const parts = field.split('.');
          let obj = userData;
          for (const part of parts) {
            if (obj && obj[part] !== undefined) {
              obj = obj[part];
            } else {
              obj = null;
              break;
            }
          }
          value = obj;
        } else {
          value = userData[field];
        }
        
              if (value !== null && value !== undefined && value !== '') {
        console.log(`Found year value in field ${field}:`, value);
        
        // Handle objects with a value property (common API format)
        if (typeof value === 'object' && value !== null) {
          console.log('Detected object with potential value property:', value);
            
            // Special check for {"custom":null} case
            if (value.hasOwnProperty('custom') && value.custom === null && Object.keys(value).length === 1) {
              console.log('Found {"custom":null} object, treating as N/A');
              continue; // Skip this value and try next field
            }
          
          // Check for value property which is common in form data
          if (value.value !== undefined) {
            console.log(`Found 'value' property:`, value.value);
            // Set the value to the inner value property for further processing
            value = value.value;
          } else if (value.custom !== undefined && value.custom !== null) {
            // Try custom value if provided
            console.log(`Found 'custom' property:`, value.custom);
            value = value.custom;
          } else if (value.name !== undefined) {
            // Also check for name property
            console.log(`Found 'name' property:`, value.name);
            value = value.name;
          } else if (value.label !== undefined) {
            // Also check for label property
            console.log(`Found 'label' property:`, value.label);
            value = value.label;
          }
        }
        
        // If the value is already one of our valid types, use it directly
        if (typeof value === 'string' && validStudyYears.includes(value)) {
          console.log(`Found exact match for ${value} in valid study years`);
          yearOfStudy = value;
          break;
        }
        
        // Try to map numeric values to standard terms
        if (!isNaN(Number(value)) && Number(value) >= 1 && Number(value) <= 4) {
          const num = Number(value);
          const yearMapping = {
            1: 'Freshman',
            2: 'Sophomore',
            3: 'Junior',
            4: 'Senior'
          };
          
          if (yearMapping[num]) {
            console.log(`Mapped numeric value ${num} to ${yearMapping[num]}`);
            yearOfStudy = yearMapping[num];
            break;
          }
        }
        }
      }
    }
    
    // Update the UI with the found value
    const statusText = document.querySelector('.media-body span.text-sm');
    if (statusText) {
      console.log('API function: Updating year of study in UI to:', yearOfStudy);
      
      // Handle any special object formatting if needed
      let displayValue = yearOfStudy;
      if (typeof yearOfStudy === 'object' && yearOfStudy !== null) {
        console.log('Final year value is an object, extracting proper value:', yearOfStudy);
        
        if (yearOfStudy.value !== undefined) {
          displayValue = yearOfStudy.value;
        } else if (yearOfStudy.custom !== undefined && yearOfStudy.custom !== null) {
          displayValue = yearOfStudy.custom;
        } else if (yearOfStudy.name !== undefined) {
          displayValue = yearOfStudy.name;
        } else if (yearOfStudy.label !== undefined) {
          displayValue = yearOfStudy.label;
        } else {
          // If we can't extract a value, convert to string for display
          displayValue = 'N/A';
        }
      }
      
      // Update only the chat header - use a more specific selector
      console.log('Final display value after processing:', displayValue);
      
      // Get the header specifically (not any conversation list entries)
      const headerStatusText = document.querySelector('.card-header .media-body span.text-sm');
      if (headerStatusText) {
        headerStatusText.textContent = `Year of Study: ${displayValue}`;
      } else {
        // Last resort - just update the original element
        statusText.textContent = `Year of Study: ${displayValue}`;
      }
    }
    
    return yearOfStudy;
  } catch (error) {
    console.error('Error fetching user data for year of study:', error);
    return 'N/A';
  }
}