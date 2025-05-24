/**
 * Chat WebSocket Client
 * Handles real-time messaging using Socket.IO
 */

// Initialize the exports object immediately
window.chatSocket = {};

// Debug function to check if WebSocket functions are correctly exported
window.debugChatSocket = function() {
  console.log("=== Chat Socket Debug Info ===");
  console.log("connectChatSocket function exists:", typeof connectChatSocket === 'function');
  console.log("Window chatSocket object:", window.chatSocket);
  console.log("chatSocket methods:", Object.keys(window.chatSocket));
  console.log("connectChatSocket method type:", typeof window.chatSocket.connectChatSocket);
  console.log("=== End Debug Info ===");
  return "Debug info logged to console";
};

// Socket connection
let chatSocket = null;
let isConnected = false;
let userId = null;
let currentConversationId = null;
let messageQueue = []; // Store messages if socket is disconnected

// Heartbeat mechanism to keep connection alive
let heartbeatInterval = null;

function startHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }
  
  // Send a ping every 30 seconds to keep the connection alive
  heartbeatInterval = setInterval(() => {
    if (isConnected && chatSocket) {
      console.log('Sending heartbeat ping to keep connection alive');
      chatSocket.emit('heartbeat', { timestamp: Date.now() });
    } else {
      console.warn('Socket disconnected - attempting to reconnect');
      // Try to reconnect if the connection was lost
      reconnectWithBackoff().catch(err => {
        console.error('Failed to reconnect socket during heartbeat:', err);
      });
    }
  }, 30000); // 30 seconds
}

// Exponential backoff retry mechanism
let reconnectAttempts = 0;
const maxReconnectAttempts = 5;
const baseReconnectDelay = 1000; // 1 second

function reconnectWithBackoff() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.warn(`Maximum reconnection attempts (${maxReconnectAttempts}) reached. Giving up.`);
    return Promise.resolve({ status: 'max-retries-reached' });
  }
  
  // Calculate delay with exponential backoff
  const delay = baseReconnectDelay * Math.pow(2, reconnectAttempts);
  reconnectAttempts++;
  
  console.log(`Reconnection attempt ${reconnectAttempts}/${maxReconnectAttempts} in ${delay}ms`);
  
  return new Promise(resolve => {
    setTimeout(() => {
      connectChatSocket()
        .then(result => {
          if (result.status === 'connected' || result.status === 'already-connected') {
            // Success! Reset the counter
            reconnectAttempts = 0;
            resolve(result);
          } else {
            // Try again with backoff
            reconnectWithBackoff().then(resolve);
          }
        })
        .catch(() => {
          // Try again with backoff
          reconnectWithBackoff().then(resolve);
        });
    }, delay);
  });
}

// Connect to chat socket
function connectChatSocket() {
  if (isConnected && chatSocket) {
    console.log('Chat socket already connected');
    return Promise.resolve({ status: 'already-connected' });
  }
  
  return new Promise((resolve) => {
    try {
      // Get stored auth data
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
      
      if (!token || !userId || !sessionId) {
        console.error('Auth data missing - token, userId, or sessionId not found');
        resolve({ status: 'auth-missing' });
        return;
      }
      
      console.log('Connecting to chat WebSocket with user ID:', userId);
      
      // Different connection options to try
      // First: auto-detect from current URL (most reliable)
      const host = window.location.hostname || 'localhost';
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      
      // Try to detect Socket.IO path from the page
      let socketPath = '/socket.io';
      
      // Create a connection timeout to ensure we don't hang indefinitely
      let connectionTimeoutId = setTimeout(() => {
        console.warn('Chat socket connection timeout after 10 seconds');
        resolve({ status: 'timeout' });
      }, 10000);
      
      console.log(`Attempting to connect to WebSocket at ${protocol}//${host}${window.location.port ? ':' + window.location.port : ''}${socketPath}`);
      
      try {
        // Simplify connection attempt - just use the current URL's domain and same port
        const socketUrl = `${window.location.origin}`;
        
        // Initialize socket.io client library with proper options
        chatSocket = io(socketUrl, {
          path: socketPath,
          reconnection: true,
          reconnectionAttempts: 10,       // Increased from 5 to 10
          reconnectionDelay: 1000,       // Start with 1 second delay
          reconnectionDelayMax: 5000,    // Maximum 5 second delay
          timeout: 20000,                // Increased from 15 to 20 seconds
          transports: ['websocket', 'polling'], // Try both transport methods
          autoConnect: true,             // Always try to connect immediately
          forceNew: true,                // Force a new connection on each attempt
          auth: {
            token,
            userId,
            sessionId
          }
        });
        
        // Handle connection success
        chatSocket.on('connect', () => {
          console.log(`✅ Connected to WebSocket at ${socketUrl}!`);
          clearTimeout(connectionTimeoutId);
          isConnected = true;
          
          // Reset reconnect counter on successful connection
          reconnectAttempts = 0;
          
          // Set up message handlers now that we're connected
          setupMessageHandlers();
          
          // Set presence to online
          setPresence('online');
          
          // Process any queued messages
          processMessageQueue();
          
          // Start heartbeat mechanism
          startHeartbeat();
          
          // Start connection health monitoring
          startConnectionMonitoring();
          
          // Log debug info
          console.log('Chat socket connected with ID:', chatSocket.id);
          
          // Send a ping to test the connection
          console.log('Sending ping to verify connection...');
          chatSocket.emit('ping', { timestamp: Date.now() }, (response) => {
            console.log('Ping response received:', response);
          });
          
          // Resolve the promise
          resolve({ status: 'connected', socketUrl });
        });
        
        // Handle connection error
        chatSocket.on('connect_error', (error) => {
          console.warn(`WebSocket connection error:`, error.message);
          
          // First check if we should keep trying
          const maxRetryAttempts = 5; // Increased from 3 to 5
          const currentRetryAttempt = parseInt(sessionStorage.getItem('wsRetryAttempt') || '0');
          
          if (currentRetryAttempt < maxRetryAttempts) {
            // We'll try again
            sessionStorage.setItem('wsRetryAttempt', (currentRetryAttempt + 1).toString());
            
            console.log(`Connection attempt ${currentRetryAttempt + 1}/${maxRetryAttempts} failed, will retry automatically`);
            
            // Don't resolve yet as Socket.IO will retry automatically based on its reconnection settings
            return;
          }
          
          // If we've reached max retries
          console.warn(`WebSocket connection failed after ${maxRetryAttempts} attempts`);
          isConnected = false;
          clearTimeout(connectionTimeoutId);
          
          // Resolve with error status but don't throw exception
          resolve({ 
            status: 'connect-error', 
            error: error.message,
            suggestion: 'Simplified mode without real-time updates will be used'
          });
        });
        
        // Handle reconnection event
        chatSocket.on('reconnect', (attemptNumber) => {
          console.log(`✅ Successfully reconnected to WebSocket after ${attemptNumber} attempts`);
          isConnected = true;
          
          // Reset retry counter on successful reconnection
          sessionStorage.removeItem('wsRetryAttempt');
          
          // Let's force a refresh of the chat state
          if (window.refreshChatState && typeof window.refreshChatState === 'function') {
            window.refreshChatState();
          }
        });
        
        // Handle reconnection attempt
        chatSocket.on('reconnect_attempt', (attempt) => {
          console.log(`Reconnection attempt ${attempt}...`);
        });
        
        // Handle reconnection error
        chatSocket.on('reconnect_error', (error) => {
          console.warn(`WebSocket reconnection error:`, error.message);
          
          // If we have multiple errors, try to create a brand new connection
          const currentAttempt = parseInt(sessionStorage.getItem('wsRetryAttempt') || '0');
          if (currentAttempt > 3) {
            console.log('Multiple reconnection errors, trying to create a new connection...');
            chatSocket.close();
            setTimeout(() => {
              connectChatSocket();
            }, 1000);
          }
        });
        
        // Handle disconnection
        chatSocket.on('disconnect', (reason) => {
          console.warn(`WebSocket disconnected:`, reason);
          isConnected = false;
          
          // Check if the connection can be recovered automatically
          if (reason === 'io server disconnect') {
            // The server has forcefully disconnected, need to reconnect manually
            console.log('Server forcefully disconnected, attempting manual reconnection...');
            chatSocket.connect();
          } else if (reason === 'transport close') {
            // Transport was closed, attempt reconnection after a delay
            console.log('Transport closed, will automatically try to reconnect...');
          }
          // For other disconnect reasons, Socket.IO will automatically try to reconnect
        });
      } catch (error) {
        console.error(`Error setting up socket:`, error);
        clearTimeout(connectionTimeoutId);
        resolve({ status: 'error', error: error.message });
      }
    } catch (error) {
      console.error('Error setting up WebSocket connection:', error);
      resolve({ status: 'error', error: error.message });
    }
  });
}

// Set up message event handlers
function setupMessageHandlers() {
  // Received a new message
  chatSocket.on('new_message', (message) => {
    console.log('🌟 WebSocket: New message received:', message);
    
    // Check if the message has the necessary fields
    if (!message || !message.conversationId || !message.senderId) {
      console.warn('🚨 WebSocket: Received invalid message:', message);
      return;
    }
    
    // Add clientId if missing (needed for UI updates)
    if (!message.clientMessageId) {
      message.clientMessageId = 'socket-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
      console.log('🔄 WebSocket: Added missing clientMessageId:', message.clientMessageId);
    }
    
    // If this is our own message coming back from the server, treat it as a message_sent event
    const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    if (String(message.senderId).trim() === String(currentUserId).trim()) {
      console.log('🔄 WebSocket: This is our own message coming back, handling as message_sent');
      // Trigger message_sent event
      const sentEvent = new CustomEvent('messageSent', { detail: message });
      document.dispatchEvent(sentEvent);
      return;
    }
    
    // Trigger custom event for the UI to handle
    console.log('📨 WebSocket: Dispatching newChatMessage event to UI');
    const event = new CustomEvent('newChatMessage', { detail: message });
    document.dispatchEvent(event);
    
    // If the message is for the current conversation, mark as read
    if (currentConversationId === message.conversationId) {
      console.log('📬 WebSocket: Auto-marking message as read for current conversation');
      markMessagesAsRead(message.conversationId, message.senderId);
    }
  });
  
  // Message sent confirmation
  chatSocket.on('message_sent', (message) => {
    console.log('✅ WebSocket: Message sent confirmation:', message);
    
    // Ensure the message has a clientId
    if (!message.clientMessageId && message._id) {
      message.clientMessageId = 'server-' + message._id;
      console.log('🔄 WebSocket: Added missing clientMessageId for sent message:', message.clientMessageId);
    }
    
    // Trigger custom event for the UI to handle
    console.log('📣 WebSocket: Dispatching messageSent event to UI');
    const event = new CustomEvent('messageSent', { detail: message });
    document.dispatchEvent(event);
    
    // Reset any simplified mode indicators if we received a successful WebSocket message
    // This indicates the WebSocket is working properly again
    if (sessionStorage.getItem('useSimplifiedChatMode') === 'true') {
      console.log('WebSocket appears to be working again despite simplified mode');
      
      // Check if we should exit simplified mode
      if (window.chatEncryption && typeof window.chatEncryption.testEncryptionHealth === 'function') {
        window.chatEncryption.testEncryptionHealth().then(healthResult => {
          if (healthResult.healthy) {
            console.log('Both WebSocket and encryption appear healthy now');
            
            // Update any UI indicators to show that real-time mode is available
            const simplifiedIndicator = document.getElementById('simplified-mode-indicator');
            if (simplifiedIndicator) {
              // Add a button to enable real-time mode if not already there
              if (!simplifiedIndicator.querySelector('.btn-success')) {
                const enableRealTimeButton = document.createElement('button');
                enableRealTimeButton.className = 'btn btn-sm btn-success ms-2';
                enableRealTimeButton.innerHTML = '<i class="ti ti-rocket me-1"></i> Enable Real-time';
                enableRealTimeButton.onclick = function() {
                  sessionStorage.removeItem('useSimplifiedChatMode');
                  location.reload();
                };
                simplifiedIndicator.querySelector('small').appendChild(enableRealTimeButton);
              }
            }
          }
        }).catch(err => {
          console.warn('Error checking encryption health after WebSocket message:', err);
        });
      }
    }
  });
  
  // Messages read by recipient
  chatSocket.on('messages_read', (data) => {
    console.log('Messages read:', data);
    
    // Trigger custom event for the UI to handle
    const event = new CustomEvent('messagesRead', { detail: data });
    document.dispatchEvent(event);
  });
  
  // User typing indicator
  chatSocket.on('user_typing', (data) => {
    console.log('User typing:', data);
    
    // Trigger custom event for the UI to handle
    const event = new CustomEvent('userTyping', { detail: data });
    document.dispatchEvent(event);
  });
  
  // User presence update
  chatSocket.on('user_presence', (data) => {
    console.log('User presence update:', data);
    
    // Trigger custom event for the UI to handle
    const event = new CustomEvent('userPresence', { detail: data });
    document.dispatchEvent(event);
  });
  
  // Error handling
  chatSocket.on('error', (error) => {
    console.error('Chat WebSocket error:', error);
    
    // Trigger custom event for the UI to handle
    const event = new CustomEvent('chatError', { detail: error });
    document.dispatchEvent(event);
  });
}

// Join a specific conversation
function joinConversation(conversationId) {
  // Set current conversation ID immediately to avoid race conditions
  currentConversationId = conversationId;
  
  if (!isConnected || !chatSocket) {
    console.log('Socket not connected yet, will try to connect first');
    
    // Try to connect first, then join the conversation
    return connectChatSocket()
      .then(() => {
        console.log('Socket connected, now joining conversation');
        return _joinConversationFlow(conversationId);
      })
      .catch(err => {
        console.error('Failed to connect socket before joining conversation:', err);
        // Still return a resolved promise so the UI can continue
        return Promise.resolve({ 
          conversationId, 
          status: 'connection-failed-but-continuing',
          error: err.message
        });
      });
  }
  
  // If already connected, join directly
  return _joinConversationFlow(conversationId);
}

// Helper function to handle the actual join flow
function _joinConversationFlow(conversationId) {
  // Double check user ID
  if (!userId) {
    userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    
    if (!userId) {
      console.error('User ID missing, cannot join conversation');
      return Promise.resolve({ 
        conversationId, 
        status: 'user-data-missing'
      });
    }
    
    // Update socket auth if needed
    if (chatSocket && chatSocket.auth) {
      chatSocket.auth.userId = userId;
    }
  }
  
  console.log(`Joining conversation: ${conversationId} with user ID: ${userId}`);
  
  return new Promise((resolve) => {
    try {
      // Now emit the join event with explicit user ID
      chatSocket.emit('join_conversation', {
        conversationId,
        userId: userId
      });
      
      console.log('Emitted join_conversation event for:', conversationId);
      
      // Resolve immediately since we're already setting conversationId
      // This prevents waiting for server response which may not come
      resolve({ 
        conversationId, 
        status: 'join-requested',
        userId: userId
      });
    } catch (emitError) {
      console.error('Error emitting join event:', emitError);
      // Still resolve but with error info
      resolve({ 
        conversationId, 
        status: 'join-emit-error',
        error: emitError.message
      });
    }
  });
}

// Send a message via socket
async function sendSocketMessage(receiverId, message, messageType = 'text') {
  try {
    // Generate a client message ID for tracking
    const clientMessageId = 'client-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    
    // Use basic format without encryption
    const messageData = {
      receiverId,
      content: message,
      messageType,
      simplified: true,
      clientMessageId
    };
    
    // If socket is connected, send immediately
    if (isConnected && chatSocket) {
      try {
        console.log('Sending message via WebSocket');
        chatSocket.emit('send_message', messageData);
      } catch (socketError) {
        console.warn('Socket emit failed:', socketError);
        // Will fall back to queue or REST API
      }
    } else {
      // Queue the message for later if there's a chance we could reconnect
      console.log('Socket not connected, queuing message');
      messageQueue.push(messageData);
      
      // Try to connect socket, but don't wait for it
      connectChatSocket().catch(error => {
        console.warn('Failed to connect socket for queued message:', error);
        // The REST API will handle sending in this case
      });
    }
    
    return messageData.clientMessageId;
  } catch (error) {
    console.error('Error in socket message function:', error);
    // Return a generated ID anyway so the UI can continue
    return 'error-' + Date.now();
  }
}

// Process any queued messages
function processMessageQueue() {
  if (messageQueue.length === 0 || !isConnected) return;
  
  console.log(`Processing ${messageQueue.length} queued messages`);
  
  // Send all queued messages
  messageQueue.forEach(message => {
    chatSocket.emit('send_message', message);
  });
  
  // Clear the queue
  messageQueue = [];
}

// Send typing indicator
function sendTypingIndicator(conversationId, isTyping) {
  if (!isConnected || !chatSocket) {
    return;
  }
  
  chatSocket.emit('typing', {
    conversationId,
    isTyping
  });
}

// Mark messages as read
function markMessagesAsRead(conversationId, senderId) {
  if (!isConnected || !chatSocket) {
    return Promise.reject(new Error('Socket not connected'));
  }
  
  return new Promise((resolve) => {
    chatSocket.emit('mark_read', {
      conversationId,
      senderId
    });
    
    // Assume success (the server doesn't send a specific response)
    resolve();
  });
}

// Set user online/offline status
function setPresence(status) {
  if (!isConnected || !chatSocket) {
    return;
  }
  
  chatSocket.emit('set_presence', status);
}

// Disconnect from the chat socket
function disconnectChatSocket() {
  if (chatSocket) {
    // Set offline status before disconnecting
    setPresence('offline');
    
    // Clear heartbeat interval
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
    
    chatSocket.disconnect();
    chatSocket = null;
    isConnected = false;
    currentConversationId = null;
  }
}

// Define the refreshAuthToken function if it doesn't exist
function refreshAuthToken() {
  return new Promise((resolve, reject) => {
    // Try to refresh the token - just return the current token for now
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (token) {
      console.log('Using existing token');
      resolve(token);
    } else {
      reject(new Error('No token available'));
    }
  });
}

// Helper function to check if socket is connected
function isSocketConnected() {
  return isConnected && chatSocket && chatSocket.connected;
}

// Helper function to check encryption health
async function checkEncryptionHealth() {
  // We're not using encryption anymore, so always return healthy
  return { healthy: true, message: 'Encryption disabled' };
}

// Setup periodic connection health checks
let healthCheckInterval = null;

function setupConnectionHealthCheck() {
  // Clear any existing interval
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
  }
  
  // Check connection health every 30 seconds
  healthCheckInterval = setInterval(() => {
    if (!isConnected || !chatSocket) {
      console.warn('Connection health check: Socket is disconnected');
      
      // Try to reconnect the socket
      console.log('Attempting to reconnect socket from health check...');
      reconnectWithBackoff().catch(err => {
        console.error('Failed to reconnect socket during health check:', err);
      });
    } else {
      // Connection appears active, send a ping to verify
      console.log('Connection health check: Sending ping to verify connection...');
      
      // Use a Promise with timeout to detect ping failures
      new Promise((resolve, reject) => {
        // Set a timeout
        const timeoutId = setTimeout(() => {
          reject(new Error('Ping timeout'));
        }, 5000);
        
        // Send a ping and wait for response
        chatSocket.emit('ping', { timestamp: Date.now() }, (response) => {
          clearTimeout(timeoutId);
          if (response && response.success) {
            resolve(response);
          } else {
            reject(new Error('Invalid ping response'));
          }
        });
      })
      .then(response => {
        console.log('Connection health check: Ping successful', response);
        // Connection is healthy
      })
      .catch(error => {
        console.warn('Connection health check: Ping failed', error);
        
        // Socket seems to be in a bad state despite appearing connected
        console.log('Socket appears to be in a bad state, reconnecting...');
        isConnected = false; // Force reconnection
        
        reconnectWithBackoff().catch(err => {
          console.error('Failed to reconnect socket after ping failure:', err);
        });
      });
    }
  }, 30000); // Check every 30 seconds
}

// Start the health check when the socket connects
function startConnectionMonitoring() {
  // Setup the health check
  setupConnectionHealthCheck();
  
  // Also listen for window online/offline events
  window.addEventListener('online', () => {
    console.log('Browser reports network is online, checking connection...');
    
    if (!isConnected || !chatSocket) {
      console.log('Attempting to reconnect socket after network came online...');
      reconnectWithBackoff().catch(err => {
        console.error('Failed to reconnect after network came online:', err);
      });
    }
  });
  
  window.addEventListener('offline', () => {
    console.warn('Browser reports network is offline, socket may disconnect');
    // We'll let the socket handle this on its own
  });
}

// Update the exports at the end of the file
function updateExports() {
  window.chatSocket.connectChatSocket = connectChatSocket;
  window.chatSocket.connect = connectChatSocket; // For backward compatibility
  window.chatSocket.disconnect = disconnectChatSocket;
  window.chatSocket.joinConversation = joinConversation;
  window.chatSocket.sendMessage = sendSocketMessage;
  window.chatSocket.markMessagesAsRead = markMessagesAsRead;
  window.chatSocket.sendTypingIndicator = sendTypingIndicator;
  window.chatSocket.setPresence = setPresence;
  window.chatSocket.isConnected = isSocketConnected; // Use the helper function
  window.chatSocket.getSocket = () => chatSocket;
}

// Call this immediately to set up the exports
updateExports();

// Add an event to ensure the scripts are properly loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Chat socket script loaded and ready');
  updateExports(); // Update exports again when DOM is ready
});