/**
 * Follow-button.js - Manages connection requests in Magic Suggest
 * Handles sending, checking status, and updating connection buttons
 */

/**
 * Initialize the connection system by adding event listeners to connect buttons
 */
function initializeConnectionSystem() {
  console.log('Initializing connection system');
  
  // Make accept/connect buttons functional
  document.addEventListener('click', async function(event) {
    // Check if a connect button was clicked
    const actionBtn = event.target.closest('.action-btn.accept-btn');
    const gridBtn = event.target.closest('.btn-primary[onclick*="acceptProfile"]');
    const button = actionBtn || gridBtn;
    
    if (button) {
      console.log('Connection button clicked:', button);
      
      // Get profile ID using different methods
      let profileId = null;
      let profileIndex = null;
      
      // Method 1: Check onclick attribute
      const onclickAttr = button.getAttribute('onclick') || '';
      const indexMatch = onclickAttr.match(/acceptProfile\(event,\s*(\d+)\)/);
      if (indexMatch) {
        profileIndex = parseInt(indexMatch[1]);
        console.log('Found profile index from onclick:', profileIndex);
      }
      
      // Method 2: Check data attribute
      if (!profileIndex && button.hasAttribute('data-profile-id')) {
        profileId = button.getAttribute('data-profile-id');
        console.log('Found profile ID from data attribute:', profileId);
      }
      
      // Method 3: Check parent card for profile ID
      if (!profileId && !profileIndex) {
        const card = button.closest('.user-card');
        if (card) {
          const profileBtn = card.querySelector('[data-profile-id]');
          if (profileBtn) {
            profileId = profileBtn.getAttribute('data-profile-id');
            console.log('Found profile ID from parent card:', profileId);
          }
        }
      }
      
      // Method 4: If we're in the slider view, get the current profile
      if (!profileId && !profileIndex && window.currentProfileIndex !== undefined && window.profiles) {
        profileIndex = window.currentProfileIndex;
        console.log('Using current profile index from slider:', profileIndex);
      }
      
      // Get user ID from either direct ID or profiles array
      let userId = null;
      
      if (profileId) {
        userId = profileId;
      } else if (profileIndex !== null && window.profiles && profiles[profileIndex]) {
        userId = profiles[profileIndex].id || profiles[profileIndex]._id;
      }
      
      console.log('Resolved user ID for connection:', userId);
      
      if (userId) {
        // Prevent the default action
        event.preventDefault();
        event.stopPropagation();
        
        // Send actual connection request
        console.log('Sending connection request for:', userId);
        try {
          const result = await sendConnectionRequest(userId, button);
          console.log('Connection request result:', result);
          
          // Update button state based on result
          if (result && result.status === 'pending') {
            button.textContent = 'Request Sent';
            button.disabled = true;
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary', 'accept-btn');
          }
          
          // If it's in the profile card, animate swipe right
          if (event.target.closest('.profile-card') && typeof swipeRight === 'function') {
            swipeRight();
          }
        } catch (error) {
          console.error('Error in connection request:', error);
          
          // Show error toast
          if (typeof showToast === 'function') {
            showToast(`Error: ${error.message}`, 'error');
          }
        }
      } else {
        console.error('Could not resolve user ID for connection request');
      }
    }
  });
  
  // Add status check for connection buttons in grid view
  updateConnectionButtons();
}

/**
 * Check and update connection status for all user cards
 */
async function updateConnectionButtons() {
  // Get auth tokens
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
  const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
  
  if (!token || !sessionId) {
    console.warn('No auth tokens found, cannot update connection buttons');
    return;
  }
  
  // Only proceed if we have profiles loaded
  if (!window.profiles || !Array.isArray(window.profiles)) {
    console.warn('No profiles available to update connection buttons');
    return;
  }
  
  try {
    // Find all connect buttons in the grid view
    const gridConnectButtons = document.querySelectorAll('.user-card .btn-primary');
    
    // Process each button
    for (const button of gridConnectButtons) {
      // Find the closest card to get the profile ID
      const card = button.closest('.user-card');
      if (!card) continue;
      
      // Find the profile ID button which contains the profile ID
      const profileBtn = card.querySelector('[data-profile-id]');
      if (!profileBtn) continue;
      
      const profileId = profileBtn.getAttribute('data-profile-id');
      if (!profileId) continue;
      
      // Check the connection status for this profile
      try {
        const status = await checkConnectionStatus(profileId);
        updateButtonBasedOnStatus(button, status);
      } catch (error) {
        console.error(`Error checking status for profile ${profileId}:`, error);
      }
    }
    
    // Also update the main swipe card if it exists
    const mainCardButton = document.querySelector('.profile-card .action-btn.accept-btn');
    if (mainCardButton && window.currentProfileIndex !== undefined && window.profiles) {
      const currentProfile = profiles[currentProfileIndex];
      if (currentProfile && currentProfile.id) {
        try {
          const status = await checkConnectionStatus(currentProfile.id);
          updateButtonBasedOnStatus(mainCardButton, status);
        } catch (error) {
          console.error(`Error checking status for current profile:`, error);
        }
      }
    }
    
  } catch (error) {
    console.error('Error updating connection buttons:', error);
  }
}

/**
 * Check the connection status between current user and target user
 * @param {string} userId - The ID of the user to check connection with
 * @returns {Promise<Object>} Connection status information
 */
async function checkConnectionStatus(userId) {
  try {
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      return { status: 'none' };
    }
    
    // Request connection status from API
    const response = await fetch(`/api/connections/status/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to check connection status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error checking connection status:', error);
    return { status: 'error', message: error.message };
  }
}

/**
 * Update button appearance and behavior based on connection status
 * @param {HTMLElement} button - The button element to update
 * @param {Object} statusData - Connection status data from API
 */
function updateButtonBasedOnStatus(button, statusData) {
  if (!button) return;
  
  const { status, direction } = statusData;
  
  // Reset any previous state
  button.disabled = false;
  
  switch (status) {
    case 'pending':
      if (direction === 'outgoing') {
        // User already sent request
        button.textContent = 'Request Sent';
        button.classList.add('btn-secondary');
        button.classList.remove('btn-primary', 'accept-btn');
        button.disabled = true;
      } else {
        // User received request
        button.textContent = 'Accept Request';
        button.classList.add('btn-success');
        button.classList.remove('btn-primary', 'btn-secondary');
      }
      break;
      
    case 'accepted':
      // Already connected
      button.textContent = 'Connected';
      button.classList.add('btn-success');
      button.classList.remove('btn-primary', 'btn-secondary');
      button.disabled = true;
      break;
      
    case 'declined':
      // Previously declined
      button.textContent = 'Connect';
      button.classList.add('btn-outline-primary');
      button.classList.remove('btn-primary', 'btn-secondary', 'btn-success');
      break;
      
    case 'none':
    default:
      // No connection yet
      button.textContent = 'Connect';
      button.classList.add('btn-primary');
      button.classList.remove('btn-secondary', 'btn-success', 'btn-outline-primary');
      break;
  }
}

/**
 * Fix a declined connection and make it pending again
 * @param {string} userId - The ID of the user to fix connection with
 * @returns {Promise<Object>} The result of the fix operation
 */
async function fixDeclinedConnection(userId) {
  try {
    console.log(`Attempting to fix connection with user ${userId}...`);
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      console.error('No auth tokens found');
      throw new Error('Authentication required');
    }
    
    // Make request to the fix API
    const response = await fetch(`/api/connections/fix/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    const result = await response.json();
    console.log('Fix connection result:', result);
    
    return result;
  } catch (error) {
    console.error('Error fixing connection:', error);
    throw error;
  }
}

/**
 * Update the sendConnectionRequest function to handle declined connections
 * @param {string} userId - The ID of the user to connect with
 * @param {HTMLElement} button - The button element that was clicked
 * @param {string} purpose - Optional purpose label for the connection
 * @returns {Promise<Object>} The result of the connection request
 */
async function sendConnectionRequest(userId, button, purpose = 'general') {
  console.log(`Sending connection request to user ${userId} with purpose ${purpose}`);
  
  try {
    // Add debug logging
    console.log('Connection request details:', { userId, buttonId: button?.id, purpose });
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      console.error('No auth tokens found');
      showLoginModal();
      throw new Error('You must be logged in to connect with users');
    }
    
    // Show loading state on button
    const originalButtonText = button ? button.textContent : '';
    const originalButtonDisabled = button ? button.disabled : false;
    
    if (button) {
      button.textContent = 'Connecting...';
      button.disabled = true;
    }
    
    // Function to reset button state on error
    const resetButton = () => {
      if (button) {
        button.textContent = originalButtonText;
        button.disabled = originalButtonDisabled;
      }
    };
    
    // Add debugging information
    console.log(`Making request to /api/connections/request with userId: ${userId}, token: ${token?.substring(0, 10)}... and session: ${sessionId?.substring(0, 10)}...`);
    
    // Make request to API
    const response = await fetch(`/api/connections/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      },
      body: JSON.stringify({ userId, purpose })
    });
    
    const data = await response.json();
    console.log('Connection API response:', data);
    
    // Check if connection exists but is declined - if so, try to fix it
    if (response.status === 400 && data.status === 'declined') {
      console.log('Connection exists but is declined. Attempting to fix...');
      
      try {
        // Call the fix function
        const fixResult = await fixDeclinedConnection(userId);
        
        if (fixResult.success) {
          console.log('Successfully fixed declined connection:', fixResult);
          
          // Update button UI
          if (button) {
            button.textContent = 'Request Sent';
            button.disabled = true;
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary', 'accept-btn');
          }
          
          return { 
            success: true, 
            status: 'pending', 
            message: 'Connection request sent successfully after fixing declined connection',
            connectionId: fixResult.connectionId 
          };
        }
      } catch (fixError) {
        console.error('Failed to fix declined connection:', fixError);
      }
    }
    
    // Check if there was an API error
    if (!response.ok) {
      resetButton();
      
      // Special handling for common error cases
      if (response.status === 400 && data.connectionId) {
        console.log('Connection already exists with ID:', data.connectionId);
        
        // This is actually not an error for our UI - connection exists but pending
        if (data.status === 'pending' && data.direction === 'outgoing') {
          if (button) {
            button.textContent = 'Request Sent';
            button.disabled = true;
            button.classList.add('btn-secondary');
            button.classList.remove('btn-primary', 'accept-btn');
          }
          return { success: true, status: 'pending', connectionId: data.connectionId };
        }
        
        // Already accepted - show as connected
        if (data.status === 'accepted') {
          if (button) {
            button.textContent = 'Connected';
            button.disabled = true;
            button.classList.add('btn-success');
            button.classList.remove('btn-primary', 'btn-secondary', 'accept-btn');
          }
          return { success: true, status: 'accepted', connectionId: data.connectionId };
        }
      }
      
      // For other API errors, throw with the message
      throw new Error(data.message || `Error: ${response.status}`);
    }
    
    // Update button for pending state
    if (button) {
      button.textContent = 'Request Sent';
      button.disabled = true;
      button.classList.add('btn-secondary');
      button.classList.remove('btn-primary', 'accept-btn');
    }
    
    // Return the API response data
    return data;
  } catch (error) {
    console.error('Error in sendConnectionRequest:', error);
    
    // Attempt to parse error object
    let errorMessage = error.message || 'Unknown error occurred';
    
    // Specially handle connection-related errors that are actually success cases
    if (errorMessage.includes('already exists') || 
        errorMessage.includes('already sent') || 
        errorMessage.includes('already connected') || 
        errorMessage.includes('Duplicate connection') ||
        errorMessage.includes('already pending')) {
      
      console.log('Connection already exists (success case):', errorMessage);
      
      if (button) {
        button.textContent = 'Request Sent';
        button.disabled = true;
        button.classList.add('btn-secondary');
        button.classList.remove('btn-primary', 'accept-btn');
      }
      
      return { success: true, status: 'pending', message: errorMessage };
    }
    
    // Rethrow other errors
    throw error;
  }
}

/**
 * Accept an incoming connection request directly from the connect button
 * @param {string} connectionId - The ID of the connection to accept
 */
async function acceptIncomingRequest(connectionId) {
  try {
    console.log('Accepting incoming request:', connectionId);
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      showToast('Authentication required', 'error');
      return;
    }
    
    // Send accept request to API
    const response = await fetch(`/api/connections/accept/${connectionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to accept connection: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Accept connection result:', result);
    
    // Update button state to Connected
    const allButtons = document.querySelectorAll('.btn-primary, .action-btn.accept-btn');
    allButtons.forEach(btn => {
      if (btn.textContent === 'Accept Request') {
        btn.textContent = 'Connected';
        btn.disabled = true;
        btn.classList.add('btn-success');
        btn.classList.remove('btn-primary', 'btn-secondary');
      }
    });
    
    // Show success toast
    showToast('Connection accepted!', 'success');
    
  } catch (error) {
    console.error('Error accepting connection request:', error);
    showToast(`Error: ${error.message}`, 'error');
  }
}

/**
 * Show login modal or redirect to login page
 */
function showLoginModal() {
  // Redirect to login page
  window.location.href = '/login.html?redirect=' + encodeURIComponent(window.location.pathname);
}

/**
 * Display a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success', 'error', 'info')
 */
function showToast(message, type = 'info') {
  // If the page already has a showToast function, use that
  if (window.showToast && typeof window.showToast === 'function') {
    window.showToast(message, type);
    return;
  }
  
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    toastContainer.style.zIndex = '1080';
    document.body.appendChild(toastContainer);
  }
  
  // Set the appropriate color class based on type
  const bgClass = type === 'success' ? 'bg-success' : 
                 type === 'error' ? 'bg-danger' : 
                 'bg-info';
  
  // Create the toast element
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center ${bgClass} text-white border-0`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
  `;
  
  // Add the toast to the container
  toastContainer.appendChild(toastEl);
  
  // Initialize and show the toast
  const toast = new bootstrap.Toast(toastEl, {
    autohide: true,
    delay: 5000
  });
  toast.show();
  
  // Remove the toast after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

/**
 * Get cookie by name
 * @param {string} name - The cookie name
 * @returns {string|null} The cookie value or null if not found
 */
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
  return null;
}

/**
 * Debug function to check connection status with a user
 * @param {string} userId - User ID to check connection with
 * @param {string} [purpose] - Optional purpose filter
 * @returns {Promise<void>}
 */
async function checkConnectionDebug(userId, purpose) {
  try {
    if (!userId) {
      console.error('No user ID provided for debug');
      
      if (typeof showToast === 'function') {
        showToast('Error: No user ID provided', 'error');
      }
      return;
    }
    
    // Check if we should fix this connection instead of just debugging
    if (window.shouldFixNextDebugClick === userId) {
      console.log('Second debug click detected, fixing connection instead...');
      window.shouldFixNextDebugClick = null; // Clear the flag
      
      // Call fix function
      await fixConnection(userId, purpose);
      return;
    }
    
    console.log('Running connection debug for user ID:', userId, purpose ? `(purpose: ${purpose})` : '');
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      console.error('No authentication tokens available');
      if (typeof showToast === 'function') {
        showToast('Error: Not authenticated', 'error');
      }
      return;
    }
    
    // Check current user info first
    console.log('Getting current user info...');
    try {
      const meResponse = await fetch('/api/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (meResponse.ok) {
        const userData = await meResponse.json();
        console.log('Current user:', {
          id: userData._id,
          name: userData.full_name || userData.username,
          email: userData.email
        });
      } else {
        console.error('Failed to get current user data:', meResponse.status);
      }
    } catch (error) {
      console.error('Error fetching current user:', error);
    }
    
    // Check connection status
    console.log('Checking connection status...');
    try {
      const statusResponse = await fetch(`/api/connections/status/${userId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        console.log('Connection status result:', statusData);
        
        if (typeof showToast === 'function') {
          if (statusData.status === 'none') {
            showToast('No connection exists with this user', 'info');
          } else {
            showToast(`Connection status: ${statusData.status}, Direction: ${statusData.direction || 'N/A'}`, 'info');
          }
        }
      } else {
        console.error('Error checking connection status:', statusResponse.status);
        if (typeof showToast === 'function') {
          showToast(`Error checking status: ${statusResponse.status}`, 'error');
        }
      }
    } catch (error) {
      console.error('Error in status check:', error);
    }
    
    // Check pending requests
    console.log('Checking pending requests...');
    try {
      const pendingResponse = await fetch('/api/connections/pending', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        console.log('Pending requests total:', pendingData.length);
        
        // Find if this user has sent a request
        const matchingRequest = pendingData.find(req => 
          req.sender && req.sender._id === userId
        );
        
        if (matchingRequest) {
          console.log('Found pending request from this user:', matchingRequest);
          if (typeof showToast === 'function') {
            showToast('This user has sent you a pending request', 'info');
          }
        }
      } else {
        console.error('Error checking pending requests:', pendingResponse.status);
      }
    } catch (error) {
      console.error('Error in pending check:', error);
    }
    
    // Check sent requests
    console.log('Checking sent requests...');
    try {
      const sentResponse = await fetch('/api/connections/sent', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (sentResponse.ok) {
        const sentData = await sentResponse.json();
        console.log('Sent requests total:', sentData.length);
        
        // Find if user has sent a request to this user
        const matchingRequest = sentData.find(req => 
          req.receiver && req.receiver._id === userId
        );
        
        if (matchingRequest) {
          console.log('Found sent request to this user:', matchingRequest);
          if (typeof showToast === 'function') {
            showToast('You have sent a pending request to this user', 'info');
          }
        }
      } else {
        console.error('Error checking sent requests:', sentResponse.status);
      }
    } catch (error) {
      console.error('Error in sent check:', error);
    }
    
    // Check all connections
    console.log('Checking all connections...');
    try {
      const connectionsResponse = await fetch('/api/connections', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (connectionsResponse.ok) {
        const connectionsData = await connectionsResponse.json();
        console.log('Active connections total:', connectionsData.length);
        
        // Check if connected to this user
        const matchingConnection = connectionsData.find(conn => 
          conn.user && conn.user._id === userId
        );
        
        if (matchingConnection) {
          console.log('Found active connection with this user:', matchingConnection);
          if (typeof showToast === 'function') {
            showToast('You are already connected with this user', 'success');
          }
        }
      } else {
        console.error('Error checking connections:', connectionsResponse.status);
      }
    } catch (error) {
      console.error('Error in connections check:', error);
    }
    
    // Call the new diagnostic endpoint for detailed information
    console.log('Calling diagnostic endpoint...');
    try {
      // Build URL with purpose query param if provided
      let diagnosticUrl = `/api/connections/diagnostics/${userId}`;
      if (purpose) {
        diagnosticUrl += `?purpose=${encodeURIComponent(purpose)}`;
      }
      
      const diagnosticResponse = await fetch(diagnosticUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (diagnosticResponse.ok) {
        const diagnosticData = await diagnosticResponse.json();
        console.log('=== CONNECTION DIAGNOSTIC RESULTS ===');
        console.log('User information:', diagnosticData.userInfo);
        
        if (diagnosticData.directConnection) {
          console.log('Direct connection found:', diagnosticData.directConnection);
        } else {
          console.log('No direct connection found (current user → target user)');
        }
        
        if (diagnosticData.reverseConnection) {
          console.log('Reverse connection found:', diagnosticData.reverseConnection);
        } else {
          console.log('No reverse connection found (target user → current user)');
        }
        
        console.log('Relevant connections between these users:', diagnosticData.relevantConnections);
        console.log('Recommendation:', diagnosticData.recommendation);
        
        // Show diagnostic summary in toast
        if (typeof showToast === 'function') {
          if (diagnosticData.relevantConnections.length > 0) {
            const conn = diagnosticData.relevantConnections[0];
            showToast(`Diagnostic found connection: ${conn.status} (${conn.sender === userId ? 'incoming' : 'outgoing'})`, 'info');
          } else {
            // No connection exists, offer to fix it
            showToast(`No connection found. Click the debug button again to fix.`, 'warning');
            
            // Add a flag to indicate we should fix on next click
            window.shouldFixNextDebugClick = userId;
            
            // Add a timeout to clear the flag after 20 seconds
            setTimeout(() => {
              if (window.shouldFixNextDebugClick === userId) {
                window.shouldFixNextDebugClick = null;
              }
            }, 20000);
          }
        }
      } else {
        console.error('Error accessing diagnostic endpoint:', diagnosticResponse.status);
      }
    } catch (error) {
      console.error('Error in diagnostic check:', error);
    }
    
    // Try direct debug endpoint if available
    console.log('Checking debug endpoint...');
    try {
      const debugResponse = await fetch('/api/connections/debug', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });
      
      if (debugResponse.ok) {
        const debugData = await debugResponse.json();
        console.log('Debug data:', debugData);
        
        // Filter for connections with this user
        const relevantConnections = debugData.connections.filter(conn => 
          conn.sender.id === userId || conn.receiver.id === userId
        );
        
        if (relevantConnections.length > 0) {
          console.log('Found connections with this user in debug data:', relevantConnections);
        } else {
          console.log('No connections found with this user in debug data');
        }
      } else {
        console.log('Debug endpoint not available or access denied');
      }
    } catch (error) {
      console.log('Error accessing debug endpoint:', error);
    }
  } catch (error) {
    console.error('Connection debug error:', error);
    if (typeof showToast === 'function') {
      showToast('Error running connection debug', 'error');
    }
  }
}

/**
 * Fix connection with a user when there's an issue
 * @param {string} userId - User ID to fix connection with
 * @param {string} [purpose='general'] - Optional purpose for the connection
 * @returns {Promise<void>}
 */
async function fixConnection(userId, purpose = 'general') {
  try {
    if (!userId) {
      console.error('No user ID provided for fix');
      if (typeof showToast === 'function') {
        showToast('Error: No user ID provided', 'error');
      }
      return;
    }
    
    console.log('Attempting to fix connection with user:', userId, `(purpose: ${purpose})`);
    
    // Show fixing toast
    if (typeof showToast === 'function') {
      showToast('Fixing connection issue...', 'info');
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token || !sessionId) {
      console.error('No authentication tokens available');
      if (typeof showToast === 'function') {
        showToast('Error: Not authenticated', 'error');
      }
      return;
    }
    
    // Call the fix endpoint
    const response = await fetch(`/api/connections/fix/${userId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      },
      body: JSON.stringify({ purpose })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }
    
    const result = await response.json();
    console.log('Connection fix result:', result);
    
    // Show success message
    if (typeof showToast === 'function') {
      showToast(result.message || 'Connection fixed successfully!', 'success');
    }
    
    // Update any UI elements that show connection state
    if (result.success) {
      // Find any buttons for this user and update them
      const allButtons = document.querySelectorAll('.btn-primary, .action-btn.accept-btn');
      allButtons.forEach(btn => {
        const userCard = btn.closest('.user-card');
        const profileBtn = userCard ? userCard.querySelector('[data-profile-id]') : null;
        
        if (profileBtn && profileBtn.getAttribute('data-profile-id') === userId) {
          // Update the button based on connection status
          if (result.status === 'pending') {
            if (result.direction === 'outgoing') {
              btn.textContent = 'Request Sent';
              btn.disabled = true;
              btn.classList.add('btn-secondary');
              btn.classList.remove('btn-primary', 'accept-btn');
            } else {
              btn.textContent = 'Accept Request';
              btn.classList.add('btn-success');
              btn.classList.remove('btn-primary', 'btn-secondary');
            }
          } else if (result.status === 'accepted') {
            btn.textContent = 'Connected';
            btn.disabled = true;
            btn.classList.add('btn-success');
            btn.classList.remove('btn-primary', 'btn-secondary');
          }
        }
      });
      
      // If we're in Magic Suggest, refresh the page to update the card
      if (window.location.pathname.includes('magic-suggest')) {
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      }
    }
  } catch (error) {
    console.error('Error fixing connection:', error);
    if (typeof showToast === 'function') {
      showToast(`Error fixing connection: ${error.message}`, 'error');
    }
  }
}

// Initialize connection system when the page is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('follow-button.js loaded successfully, initializing connection system...');
  initializeConnectionSystem();
  
  // Periodically update connection buttons
  setInterval(updateConnectionButtons, 60000); // Update every minute
}); 

console.log('follow-button.js script loaded'); // This will run immediately when the script is loaded 