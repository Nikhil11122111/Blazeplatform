/**
 * Chat API Client
 * Provides functions to interact with the chat REST API endpoints
 */

// Use fixed port 5001 only
const SERVER_PORT = '5001'; 
const SERVER_HOST = window.location.hostname || 'localhost';
const SERVER_PROTOCOL = window.location.protocol || 'http:';
const SERVER_BASE = `${SERVER_PROTOCOL}//${SERVER_HOST}:${SERVER_PORT}`;

// API base URL
const API_BASE = `${SERVER_BASE}/api/chat`;

// Log the connection details
console.log('Chat API connecting to fixed port:', SERVER_PORT);

// Helper to handle auth headers
function getAuthHeaders() {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
  
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'X-Session-ID': sessionId
  };
}

// API error handler
function handleApiError(response) {
  if (!response.ok) {
    return response.json().then(errorData => {
      throw new Error(errorData.message || 'API request failed');
    });
  }
  return response.json();
}

// Get all conversations
async function getConversations() {
  try {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error getting conversations:', error);
    throw error;
  }
}

// Get a specific conversation
async function getConversation(conversationId) {
  try {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error getting conversation ${conversationId}:`, error);
    throw error;
  }
}

// Create a new conversation with another user
async function createConversation(userId) {
  try {
    const response = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId })
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
}

// Delete a conversation
async function deleteConversation(conversationId) {
  try {
    const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error deleting conversation ${conversationId}:`, error);
    throw error;
  }
}

// Get unread message counts
async function getUnreadCounts() {
  try {
    const response = await fetch(`${API_BASE}/conversations/unread/count`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error getting unread counts:', error);
    throw error;
  }
}

// Get messages from a conversation
async function getMessages(userId, limit = 50, offset = 0) {
  try {
    const response = await fetch(`${API_BASE}/messages/user/${userId}?limit=${limit}&offset=${offset}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error getting messages for user ${userId}:`, error);
    throw error;
  }
}

// Initialize the chat client
async function initializeChat() {
  try {
    console.log('Initializing chat client with encryption disabled...');
    
    // Check for authentication
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      console.error('Authentication missing - token or sessionId not found');
      throw new Error('Authentication required. Please log in again.');
    }
    
    // Check if the chat server is accessible on port 5001
    try {
      console.log('Checking chat server availability on port 5001...');
      const healthResponse = await fetch(`${API_BASE}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!healthResponse.ok) {
        throw new Error(`Chat server health check failed with status: ${healthResponse.status}`);
      }
      
      const healthData = await healthResponse.json();
      console.log('Chat server health check passed:', healthData);
    } catch (healthError) {
      console.error('Chat server health check failed:', healthError);
      throw new Error('Chat server is not available on port 5001. Please ensure the server is running.');
    }
    
    // Clear any flags that would enable encryption
    sessionStorage.removeItem('useSimplifiedChatMode');
    sessionStorage.removeItem('wsRetryAttempt');
    sessionStorage.removeItem('encryptionFailCount');
    
    // Connect to socket for real-time messaging
    console.log('Connecting to chat socket with encryption disabled...');
    await window.chatSocket.connectChatSocket()
      .catch(error => {
        console.error('Socket connection failed:', error);
        // Continue even if socket fails - we can still use REST API
        console.log('Continuing without real-time updates...');
      });
    
    console.log('Chat client initialization complete - encryption disabled');
    
    return { simplified: true };
  } catch (error) {
    console.error('Error initializing chat:', error);
    throw new Error(`Chat initialization failed: ${error.message}`);
  }
}

// Send a text message via REST API (with or without encryption)
async function sendMessage(receiverId, message, messageType = 'text') {
  try {
    // Always use plaintext mode
    const requestBody = {
      receiverId,
      content: message,
      messageType,
      simplified: true
    };
    
    const response = await fetch(`${API_BASE}/messages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(requestBody)
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
}

// Send a file message
async function sendFileMessage(receiverId, file) {
  try {
    if (!receiverId) {
      throw new Error('Receiver ID is required');
    }
    
    if (!file || !(file instanceof File)) {
      throw new Error('Valid file is required');
    }
    
    console.log('Sending file message:', { 
      receiverId, 
      fileName: file.name, 
      fileType: file.type, 
      fileSize: file.size 
    });
    
    // Create FormData and append file
    const formData = new FormData();
    formData.append('file', file);
    formData.append('receiverId', receiverId);
    
    // Add additional metadata that might be required by server
    formData.append('messageType', file.type.startsWith('image/') ? 'image' : 'file');
    formData.append('fileName', file.name);
    formData.append('fileSize', file.size);
    
    // Get authentication headers (without Content-Type which is set by FormData)
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    
    if (!token || !sessionId || !userId) {
      throw new Error('Authentication missing');
    }
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'X-Session-ID': sessionId,
      'X-User-ID': userId
    };
    
    // Using the new direct upload endpoint that bypasses the message controller completely
    console.log('Uploading file with URL:', `${API_BASE}/upload-file`);
    console.log('Form data has file:', formData.has('file'));
    console.log('Form data has receiverId:', formData.has('receiverId'));
    
    const response = await fetch(`${API_BASE}/upload-file`, {
      method: 'POST',
      headers: headers,
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('File upload failed with status:', response.status, errorText);
      throw new Error(`Upload failed: ${response.status} ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error sending file message:', error);
    throw error;
  }
}

// Mark messages as read
async function markMessagesAsRead(userId) {
  try {
    // Check if this is a conversation ID (contains underscore) or user ID
    const isConversationId = userId && userId.includes('_');
    
    // If it's a conversation ID, extract the other user's ID
    if (isConversationId) {
      console.warn('Received conversationId instead of userId for markMessagesAsRead. Extracting user ID...');
      const currentUserId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
      const parts = userId.split('_');
      userId = parts[0] === currentUserId ? parts[1] : parts[0];
      console.log('Extracted userId for marking messages as read:', userId);
    }
    
    console.log(`Marking messages as read for user ${userId}`);
    const response = await fetch(`${API_BASE}/messages/read/${userId}`, {
      method: 'PUT',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error marking messages as read for user ${userId}:`, error);
    throw error;
  }
}

// Delete a message
async function deleteMessage(messageId) {
  try {
    const response = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error deleting message ${messageId}:`, error);
    throw error;
  }
}

// Update a message
async function updateMessage(messageId, newContent) {
  try {
    const response = await fetch(`${API_BASE}/messages/${messageId}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ content: newContent })
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error updating message ${messageId}:`, error);
    throw error;
  }
}

// Register a public key
async function registerPublicKey(publicKey) {
  try {
    const response = await fetch(`${API_BASE}/keys/register`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ publicKey })
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error registering public key:', error);
    throw error;
  }
}

// Get a user's public key
async function getUserPublicKey(userId) {
  try {
    const response = await fetch(`${API_BASE}/keys/${userId}`, {
      method: 'GET',
      headers: getAuthHeaders()
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error(`Error getting public key for user ${userId}:`, error);
    throw error;
  }
}

// Verify a fingerprint
async function verifyFingerprint(userId, fingerprint) {
  try {
    const response = await fetch(`${API_BASE}/keys/verify`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, fingerprint })
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error verifying fingerprint:', error);
    throw error;
  }
}

// Rotate (update) public key
async function rotatePublicKey(publicKey) {
  try {
    const response = await fetch(`${API_BASE}/keys/rotate`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ publicKey })
    });
    
    return handleApiError(response);
  } catch (error) {
    console.error('Error rotating public key:', error);
    throw error;
  }
}

// Add a filter to ensure only accepted friends are returned from API calls
function filterOnlyAcceptedFriends(users) {
  if (!Array.isArray(users)) return [];
  
  return users.filter(user => {
    // Check if this user is an accepted friend
    return user.isFriend === true || 
           user.status === 'accepted' || 
           user.friendStatus === 'accepted' ||
           user.connectionStatus === 'accepted';
  });
}

// Override the fetchUsers or getUsers function to apply our filter
const originalFetchUsers = window.fetchUsers || window.getUsers;
if (typeof originalFetchUsers === 'function') {
  window.fetchUsers = async function(...args) {
    // Call the original function
    const result = await originalFetchUsers(...args);
    
    // If the result is an array of users, filter it
    if (Array.isArray(result)) {
      console.log(`API returned ${result.length} users, filtering to accepted friends only`);
      return filterOnlyAcceptedFriends(result);
    }
    
    // If the result is an object with a users property, filter that
    if (result && Array.isArray(result.users)) {
      console.log(`API returned ${result.users.length} users, filtering to accepted friends only`);
      result.users = filterOnlyAcceptedFriends(result.users);
      return result;
    }
    
    return result;
  };
  
  // Also override getUsers if it exists and is different
  if (window.getUsers && window.getUsers !== window.fetchUsers) {
    window.getUsers = window.fetchUsers;
  }
}

// Override the searchUsers API function if it exists
const originalSearchUsersAPI = window.searchUsersAPI;
if (typeof originalSearchUsersAPI === 'function') {
  window.searchUsersAPI = async function(query, ...args) {
    // Call the original function
    const result = await originalSearchUsersAPI(query, ...args);
    
    // Apply our filter to the results
    if (Array.isArray(result)) {
      return filterOnlyAcceptedFriends(result);
    }
    
    if (result && Array.isArray(result.users)) {
      result.users = filterOnlyAcceptedFriends(result.users);
    }
    
    return result;
  };
}

// Exports
window.chatAPI = {
  // Initialization
  initialize: initializeChat,
  
  // Conversations
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  getUnreadCounts,
  
  // Messages
  getMessages,
  sendMessage,
  sendFileMessage,
  markMessagesAsRead,
  deleteMessage,
  updateMessage,
  
  // Key management
  registerPublicKey,
  getUserPublicKey,
  verifyFingerprint,
  rotatePublicKey
};