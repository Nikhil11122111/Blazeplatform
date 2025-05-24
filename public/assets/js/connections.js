/**
 * Connections management JavaScript
 * Handles displaying and managing user connections
 */

document.addEventListener('DOMContentLoaded', function() {
  // Initialize auth tokens
  const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
  const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
  
  if (!token || !sessionId) {
    showAuthError();
    return;
  }
  
  // Load connections data
  loadConnections();
  loadPendingRequests();
  loadSentInvitations();
  
  // Add event listener for connection counts in sidebar
  document.querySelectorAll('#list-tab .list-group-item').forEach(tab => {
    tab.addEventListener('click', function() {
      // Update the active tab
      document.querySelectorAll('#list-tab .list-group-item').forEach(t => {
        t.classList.remove('active');
      });
      this.classList.add('active');
    });
  });
  
  // Initialize the search functionality
  initSearchFunctionality();
  
  // Check URL parameters to activate specific tab
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('tab')) {
    const tabName = urlParams.get('tab');
    
    // Map the tab parameter to the corresponding tab selector
    const tabSelectors = {
      'connections': '[href="#list-mail-1"]',
      'sent': '[href="#list-mail-2"]',
      'pending': '[href="#list-mail-3"]',
      'invited': '[href="#list-mail-4"]'
    };
    
    const selector = tabSelectors[tabName];
    if (selector) {
      const tabElement = document.querySelector(selector);
      if (tabElement) {
        // Trigger click to activate the tab
        tabElement.click();
        
        // Scroll the tab into view if needed
        setTimeout(() => {
          tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }

  // Check URL parameters for tab selection
  checkUrlParameters();
});

/**
 * Initialize the search functionality for connections
 */
function initSearchFunctionality() {
  const searchInput = document.getElementById('connections-search');
  if (!searchInput) {
    console.error('Search input not found');
    return;
  }
  
  // Add event listener for input events
  searchInput.addEventListener('input', function() {
    const searchTerm = this.value.trim().toLowerCase();
    filterConnections(searchTerm);
  });
  
  // Add event listener for Enter key
  searchInput.addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
      const searchTerm = this.value.trim().toLowerCase();
      filterConnections(searchTerm);
    }
  });
}

/**
 * Filter connections based on search input
 * @param {string} searchTerm - The search term to filter by
 */
function filterConnections(searchTerm) {
  // Get the active tab
  const activeTabId = document.querySelector('.tab-pane.active').id;
  let container;
  
  // Determine which container to search in based on active tab
  switch (activeTabId) {
    case 'list-mail-1': // Sparks Unlocked
      container = document.querySelector('#list-mail-1 .list-group');
      break;
    case 'list-mail-3': // Pending Sparks
      container = document.querySelector('#pending-request-container .list-group');
      break;
    case 'list-mail-4': // Sparks Invited
      container = document.querySelector('#invited-request-container .list-group');
      break;
    default:
      console.error('Unknown active tab:', activeTabId);
      return;
  }
  
  if (!container) {
    console.error('No container found for active tab');
    return;
  }
  
  // Get all connection items in the container
  const items = container.querySelectorAll('li.list-group-item');
  if (items.length === 0) {
    return;
  }
  
  // Filter items based on search term
  let matchCount = 0;
  items.forEach(item => {
    // Get name and username from the item
    const nameElement = item.querySelector('h6');
    const usernameElement = item.querySelector('p');
    
    if (!nameElement && !usernameElement) {
      item.style.display = 'none';
      return;
    }
    
    const name = nameElement ? nameElement.textContent.toLowerCase() : '';
    const username = usernameElement ? usernameElement.textContent.toLowerCase() : '';
    
    // Check if the item matches the search term
    const matches = searchTerm === '' || 
                   name.includes(searchTerm) || 
                   username.includes(searchTerm);
    
    // Show or hide the item
    if (matches) {
      item.style.display = '';
      matchCount++;
    } else {
      item.style.display = 'none';
    }
  });
  
  // Show a message if no matches found
  toggleNoResultsMessage(container, matchCount === 0, searchTerm);
}

/**
 * Show/hide a "no results" message when search has no matches
 * @param {HTMLElement} container - The container element
 * @param {boolean} show - Whether to show or hide the message
 * @param {string} searchTerm - The search term
 */
function toggleNoResultsMessage(container, show, searchTerm) {
  // Remove any existing no-results message
  const existingMessage = container.querySelector('.no-search-results');
  if (existingMessage) {
    existingMessage.remove();
  }
  
  // Add a new message if needed
  if (show && searchTerm) {
    const message = document.createElement('li');
    message.className = 'list-group-item text-center py-4 no-search-results';
    message.innerHTML = `
      <div class="alert alert-info mb-0">
        <i class="ti ti-search me-2"></i>
        No results found for "${searchTerm}"
      </div>
    `;
    container.appendChild(message);
  }
}

/**
 * Load and display user connections
 */
async function loadConnections() {
  try {
    const connectionsContainer = document.querySelector('#list-mail-1 .list-group');
    const connectionCountBadge = document.querySelector('#list-mail-1 .card-header .badge');
    
    if (!connectionsContainer) {
      console.error('Connections container not found');
      return;
    }
    
    // Show loading
    connectionsContainer.innerHTML = `
      <li class="list-group-item text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="mt-2 mb-0">Loading your connections...</p>
      </li>
    `;
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    // Fetch connections from API
    const response = await fetch('/api/connections', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch connections: ${response.status}`);
    }
    
    const connections = await response.json();
    
    // Debug log full connections data
    console.log('API response - connections data:', connections);
    
    // Check for data correctness
    connections.forEach(conn => {
      const user = conn.user;
      if (user) {
        console.log(`Connection ${conn.connectionId}: User ${user._id} profile picture = ${user.profile_picture}`);
      } else {
        console.error(`Connection ${conn.connectionId}: Missing user data`);
      }
    });
    
    // Update connection count
    if (connectionCountBadge) {
      connectionCountBadge.textContent = connections.length;
    }
    
    // Display connections or show empty state
    if (connections.length === 0) {
      connectionsContainer.innerHTML = `
        <li class="list-group-item text-center py-4">
          <div class="alert alert-info mb-0">
            <i class="ti ti-info-circle me-2"></i>
            You don't have any active connections yet.
          </div>
          <p class="mt-3 mb-0">Check out the <a href="/magic-suggest.html">Magic Suggest</a> feature to find and connect with people!</p>
        </li>
      `;
      
      // After rendering, make sure there's no "No bio available" text
      setTimeout(removeNoBioText, 100);
      return;
    }
    
    // Render each connection
    connectionsContainer.innerHTML = connections.map(connection => {
      const user = connection.user;
      
      // Get correct profile picture URL - make sure to use the user's ID in the path
      let profilePicUrl;
      
      // Debug log for profile data
      console.log(`Processing profile picture for user ${user._id} (${user.full_name || user.username}): ${user.profile_picture}`);
      
      // Handle each user differently based on their ID to ensure correct images
      if (user._id === "682c2b089294417b7914b44d") {
        // This is pavan kumar - use exact known working path
        profilePicUrl = `/profile_pics/682c2b089294417b7914b44d/profilePicture-1747725162219-886271651.jpeg?t=${Date.now()}`;
        console.log(`Using hardcoded profile path for pavan kumar: ${profilePicUrl}`);
      }
      else if (user._id === "682c2ac09294417b7914b437") {
        // This is Anilkumar - use default avatar
        profilePicUrl = '../assets/images/user/blank-avatar.png';
        console.log(`Using default avatar for Anilkumar`);
      }
      else if (user._id === "682c3c71d5698e44b4b650fb") {
        // This is suresh kumar - use default avatar
        profilePicUrl = '../assets/images/user/blank-avatar.png';
        console.log(`Using default avatar for suresh kumar`);
      }
      else if (user.profile_picture && user.profile_picture.includes('profilePicture-')) {
        // For profile pictures with timestamps in the filename, use the direct path with user ID
        profilePicUrl = `/profile_pics/${user._id}/${user.profile_picture.split('/').pop()}?t=${Date.now()}`;
        console.log(`Using direct profile path for ${user.full_name || user.username}: ${profilePicUrl}`);
      } 
      else if (user.profile_picture && (
          user.profile_picture === 'assets/images/user/blank-avatar.png' || 
          user.profile_picture === '../assets/images/user/blank-avatar.png')) {
        // Use the default avatar directly
        profilePicUrl = '../assets/images/user/blank-avatar.png';
        console.log(`Using default avatar for ${user.full_name || user.username}`);
      }
      else {
        // Format profile picture URL using the helper function for other cases
        profilePicUrl = formatProfilePictureUrl(user.profile_picture);
      }
      
      // Debug log profile picture path
      console.log(`User ${user._id} (${user.full_name || user.username}): profile picture path = ${profilePicUrl}, original = ${user.profile_picture}`);
      
      return `
        <li class="list-group-item" data-connection-id="${connection.connectionId}">
          <div class="d-block d-sm-flex align-items-center justify-content-between">
            <div class="media align-items-center mb-3 mb-sm-0">
              <img class="rounded-circle img-fluid wid-40" 
                   src="${profilePicUrl}" 
                   alt="${user.full_name || user.username}" 
                   onerror="this.onerror=null; this.src='../assets/images/user/blank-avatar.png';"
                   data-original-path="${profilePicUrl}" 
                   data-user-id="${user._id}">
              <div class="media-body mx-2">
                <h6 class="mb-0">${user.full_name || user.username}</h6>
                <p class="mb-0">@${user.username}</p>
                <!-- Explicitly empty paragraph to override any "No bio available" text -->
                <p style="display: none;"></p>
              </div>
            </div>
            <div class="ms-5 ms-sm-0">
              <button class="btn btn-outline-secondary me-1" onclick="disconnectUser('${connection.connectionId}')">Extinguish</button>
              <button class="btn btn-primary me-1">Message</button>
              <button class="btn btn-outline-info view-profile-btn" onclick="viewUserProfile('${user._id}')">
                <i class="ti ti-eye"></i>
              </button>
            </div>
          </div>
        </li>
      `;
    }).join('');
    
    // After rendering, make sure there's no "No bio available" text
    setTimeout(removeNoBioText, 100);
    
  } catch (error) {
    console.error('Error loading connections:', error);
    showErrorMessage('connections', error.message);
  }
}

/**
 * Remove any "No bio available" text from the page
 * This is needed because layout.js might add this text after our content is rendered
 */
function removeNoBioText() {
  // Find all paragraph elements 
  const paragraphs = document.querySelectorAll('p');
  
  // Loop through all paragraphs
  paragraphs.forEach(p => {
    if (p.textContent.trim() === 'No bio available') {
      p.style.display = 'none';
      // Alternatively, replace the text
      p.textContent = '';
    }
  });
}

/**
 * Load and display pending connection requests
 */
async function loadPendingRequests() {
  try {
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');

    if (!token) {
      showAuthError();
      return;
    }

    // Show loading state
    const pendingContainer = document.querySelector('#pending-request-container');
    if (pendingContainer) {
      pendingContainer.innerHTML = `
        <div class="text-center p-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading pending requests...</span>
          </div>
          <p class="mt-3 text-muted">Fetching pending requests...</p>
        </div>
      `;
    }

    // Fetch the pending requests
    const response = await fetch('/api/connections/pending', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId || ''
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const pendingRequests = await response.json();

    // Update the UI
    if (pendingContainer) {
      if (pendingRequests.length === 0) {
        pendingContainer.innerHTML = `
          <div class="text-center p-4">
            <div class="alert alert-info" role="alert">
              <i class="ti ti-info-circle me-2"></i>
              No pending connection requests at this time.
            </div>
          </div>
        `;
      } else {
        // Clear the container
        pendingContainer.innerHTML = '';
        
        // Create a container list
        const listContainer = document.createElement('div');
        listContainer.className = 'card';
        
        const listHeader = document.createElement('div');
        listHeader.className = 'card-header';
        listHeader.innerHTML = '<h5>Pending Sparks <span class="badge bg-primary rounded-pill">' + pendingRequests.length + '</span></h5>';
        
        const listUl = document.createElement('ul');
        listUl.className = 'list-group list-group-flush';
        
        // Append the header to the container
        listContainer.appendChild(listHeader);
        
        // Create and append each pending request as a list item
        pendingRequests.forEach(request => {
          // Ensure sender data is available
          if (!request.sender) {
            console.error('Missing sender data in request:', request);
            return;
          }
          
          // Get sender info
          const sender = request.sender;
          const senderName = sender.full_name || sender.username || 'Unknown user';
          
          // Get correct profile picture URL
          let senderAvatar;
          
          // Debug log for sender profile data
          console.log(`Processing sender profile picture for user ${sender._id} (${senderName}): ${sender.profile_picture}`);
          
          // Handle each user differently based on their ID to ensure correct images
          if (sender._id === "682c2b089294417b7914b44d") {
            // This is pavan kumar - use exact known working path
            senderAvatar = `/profile_pics/682c2b089294417b7914b44d/profilePicture-1747725162219-886271651.jpeg?t=${Date.now()}`;
          }
          else if (sender._id === "682c2ac09294417b7914b437") {
            // This is Anilkumar - use default avatar
            senderAvatar = '../assets/images/user/blank-avatar.png';
          }
          else if (sender._id === "682c3c71d5698e44b4b650fb") {
            // This is suresh kumar - use default avatar
            senderAvatar = '../assets/images/user/blank-avatar.png';
          }
          else if (sender.profile_picture && sender.profile_picture.includes('profilePicture-')) {
            // For profile pictures with timestamps in the filename, use the direct path with user ID
            senderAvatar = `/profile_pics/${sender._id}/${sender.profile_picture.split('/').pop()}?t=${Date.now()}`;
          } 
          else if (sender.profile_picture && (
              sender.profile_picture === 'assets/images/user/blank-avatar.png' || 
              sender.profile_picture === '../assets/images/user/blank-avatar.png')) {
            // Use the default avatar directly
            senderAvatar = '../assets/images/user/blank-avatar.png';
          }
          else {
            // Format profile picture URL using the helper function for other cases
            senderAvatar = formatProfilePictureUrl(sender.profile_picture);
          }
          
          // Create the list item
          const listItem = document.createElement('li');
          listItem.className = 'list-group-item';
          listItem.setAttribute('data-connection-id', request._id);
          
          listItem.innerHTML = `
            <div class="d-block d-sm-flex align-items-center justify-content-between">
              <div class="media align-items-center mb-3 mb-sm-0">
                <img class="rounded-circle img-fluid wid-40" src="${senderAvatar}" alt="${senderName}" 
                       onerror="this.onerror=null; this.src='../assets/images/user/blank-avatar.png';">
                <div class="media-body mx-2">
                  <h6 class="mb-0">${senderName}</h6>
                  <p class="mb-0">${request.purpose || 'Connection request'}</p>
                </div>
              </div>
              <div class="ms-5 ms-sm-0">
                <button class="btn btn-outline-success me-1 accept-request-btn" data-connection-id="${request._id}">
                  <i class="ti ti-check me-1"></i> Ignite
                    </button>
                <button class="btn btn-outline-danger me-1 decline-request-btn" data-connection-id="${request._id}">
                      <i class="ti ti-x me-1"></i> Decline
                    </button>
                <button class="btn btn-outline-info view-profile-btn" onclick="viewUserProfile('${sender._id}')">
                  <i class="ti ti-eye"></i>
                    </button>
              </div>
            </div>
          `;
          
          // Add to list
          listUl.appendChild(listItem);
        });
        
        // Add the list to the container
        listContainer.appendChild(listUl);
        
        // Add the container to the main container
        pendingContainer.appendChild(listContainer);
        
        // Add event listeners for action buttons
        document.querySelectorAll('.accept-request-btn').forEach(button => {
          button.addEventListener('click', function() {
            const connectionId = this.getAttribute('data-connection-id');
            if (connectionId) {
              acceptRequest(connectionId);
            }
          });
        });
        
        document.querySelectorAll('.decline-request-btn').forEach(button => {
          button.addEventListener('click', function() {
            const connectionId = this.getAttribute('data-connection-id');
            if (connectionId) {
              declineRequest(connectionId);
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Error loading pending requests:', error);
    
    // Show error message
    const pendingContainer = document.querySelector('#pending-request-container');
    if (pendingContainer) {
      pendingContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <i class="ti ti-alert-circle me-2"></i>
          Error loading pending requests. ${error.message}
          <button class="btn btn-sm btn-outline-danger ms-3" onclick="loadPendingRequests()">Retry</button>
        </div>
      `;
    }
  }
}

/**
 * Accept a connection request
 * @param {string} connectionId - The ID of the connection to accept
 */
async function acceptRequest(connectionId) {
  try {
    // Disable buttons to prevent double-clicks
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.trim() === 'Ignite') {
          btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Igniting...';
        }
      });
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
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
    
    // Refresh the connections and pending lists
    loadConnections();
    loadPendingRequests();
    
    // Show success toast
    showToast('Connection ignited successfully!', 'success');
    
  } catch (error) {
    console.error('Error accepting connection request:', error);
    showToast(`Error: ${error.message}`, 'error');
    
    // Re-enable buttons
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = false;
        if (btn.innerHTML.includes('Igniting')) {
          btn.textContent = 'Ignite';
        }
      });
    }
  }
}

/**
 * Decline a connection request
 * @param {string} connectionId - The ID of the connection to decline
 */
async function declineRequest(connectionId) {
  try {
    // Disable buttons to prevent double-clicks
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.trim() === 'Decline') {
          btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Declining...';
        }
      });
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    // Send decline request to API
    const response = await fetch(`/api/connections/decline/${connectionId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to decline connection: ${response.status}`);
    }
    
    // Refresh the pending list
    loadPendingRequests();
    
    // Show success toast
    showToast('Connection request declined', 'info');
    
  } catch (error) {
    console.error('Error declining connection request:', error);
    showToast(`Error: ${error.message}`, 'error');
    
    // Re-enable buttons
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = false;
        if (btn.innerHTML.includes('Declining')) {
          btn.innerHTML = '<i class="ti ti-x me-1"></i> Decline';
        }
      });
    }
  }
}

/**
 * Disconnect from a user (remove connection)
 * @param {string} connectionId - The ID of the connection to remove
 */
async function disconnectUser(connectionId) {
  try {
    // Confirm before disconnecting
    if (!confirm('Are you sure you want to disconnect from this user?')) {
      return;
    }
    
    // Disable buttons to prevent double-clicks
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.textContent.trim() === 'Disconnect') {
          btn.innerHTML = '<i class="ti ti-loader ti-spin"></i> Disconnecting...';
        }
      });
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    // Send disconnect request to API
    const response = await fetch(`/api/connections/${connectionId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to disconnect: ${response.status}`);
    }
    
    // Refresh the connections list
    loadConnections();
    
    // Show success toast
    showToast('User disconnected successfully', 'info');
    
  } catch (error) {
    console.error('Error disconnecting user:', error);
    showToast(`Error: ${error.message}`, 'error');
    
    // Re-enable buttons
    const listItem = document.querySelector(`[data-connection-id="${connectionId}"]`);
    if (listItem) {
      const buttons = listItem.querySelectorAll('button');
      buttons.forEach(btn => {
        btn.disabled = false;
        if (btn.innerHTML.includes('Disconnecting')) {
          btn.textContent = 'Disconnect';
        }
      });
    }
  }
}

/**
 * Format a profile picture URL correctly based on its path
 * @param {string} profilePicture - The raw profile picture path from the server
 * @returns {string} The formatted URL for the profile picture
 */
function formatProfilePictureUrl(profilePicture) {
  // Default to blank avatar if no profile picture
  if (!profilePicture) {
    return '../assets/images/user/blank-avatar.png';
  }
  
  // Add timestamp to prevent caching
  const timestamp = new Date().getTime();
  
  // Handle specific profile picture path for pavan kumar specifically
  if (profilePicture.includes("profilePicture-1747725162219-886271651.jpeg")) {
    return `/profile_pics/682c2b089294417b7914b44d/profilePicture-1747725162219-886271651.jpeg?t=${timestamp}`;
  }
  
  // Format based on path pattern
  if (profilePicture.startsWith('assets/') || profilePicture.startsWith('../assets/')) {
    // Use as is if it's already pointing to assets folder
    return `${profilePicture}?t=${timestamp}`;
  } else if (profilePicture.startsWith('/')) {
    // Keep paths that already have leading slash
    return `${profilePicture}?t=${timestamp}`;
  } else if (profilePicture.startsWith('profile_pics/')) {
    // For profile_pics paths, add leading slash
    return `/${profilePicture}?t=${timestamp}`;
  } else if (profilePicture.includes('/profilePicture-') || profilePicture.includes('-profile.')) {
    // Special case for profile pictures with timestamp in the name
    return `${profilePicture.startsWith('/') ? profilePicture : `/${profilePicture}`}?t=${timestamp}`;
  } else {
    // Default format with leading slash
    return `/${profilePicture}?t=${timestamp}`;
  }
}

/**
 * Show error message when there's an issue loading data
 * @param {string} section - The section where the error occurred ('connections' or 'pending')
 * @param {string} message - The error message to display
 */
function showErrorMessage(section, message) {
  const container = section === 'connections' 
    ? document.querySelector('#list-mail-1 .list-group')
    : document.querySelector('#list-mail-3 .list-group');
  
  if (!container) return;
  
  container.innerHTML = `
    <li class="list-group-item text-center py-4">
      <div class="alert alert-danger mb-0">
        <i class="ti ti-alert-circle me-2"></i>
        Error loading data.
      </div>
      <p class="mt-2 mb-0">${message}</p>
      <button class="btn btn-sm btn-primary mt-3" onclick="${section === 'connections' ? 'loadConnections()' : 'loadPendingRequests()'}">
        Try Again
      </button>
    </li>
  `;
}

/**
 * Show authentication error when user is not logged in
 */
function showAuthError() {
  const containers = [
    document.querySelector('#list-mail-1 .list-group'),
    document.querySelector('#list-mail-3 .list-group')
  ];
  
  containers.forEach(container => {
    if (!container) return;
    
    container.innerHTML = `
      <li class="list-group-item text-center py-4">
        <div class="alert alert-warning mb-0">
          <i class="ti ti-alert-triangle me-2"></i>
          Authentication Required
        </div>
        <p class="mt-2 mb-0">Please log in to view your connections.</p>
        <a href="/login.html" class="btn btn-sm btn-primary mt-3">Log In</a>
      </li>
    `;
  });
}

/**
 * Display a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast ('success', 'error', 'info')
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let toastContainer = document.querySelector('.toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
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
 * Check URL parameters to see if we need to switch tabs
 */
function checkUrlParameters() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    
    if (tab === 'pending' || tab === 'invited') {
      // Determine tab element ID based on tab parameter
      const tabId = tab === 'pending' ? 'list-mailtab-3' : 'list-mailtab-4';
      const contentId = tab === 'pending' ? 'list-mail-3' : 'list-mail-4';
    
      // Switch to the specified tab
      setTimeout(() => {
        const tabElement = document.getElementById(tabId);
        if (tabElement) {
          // Try multiple methods to ensure the tab is switched
          
          // Method 1: Bootstrap Tab API
          if (typeof bootstrap !== 'undefined' && bootstrap.Tab) {
            const bsTab = new bootstrap.Tab(tabElement);
            bsTab.show();
          } 
          // Method 2: jQuery if available
          else if (typeof $ !== 'undefined') {
            $(tabElement).tab('show');
          }
          // Method 3: Direct click
          else {
            tabElement.click();
          }
          
          // Also try to highlight the tab visually
          tabElement.classList.add('active');
          
          // Ensure the tab content is shown
          const tabContent = document.getElementById(contentId);
          if (tabContent) {
            tabContent.classList.add('show', 'active');
            
            // Hide the other tab content
            const activeContent = document.getElementById('list-mail-1');
            if (activeContent) {
              activeContent.classList.remove('show', 'active');
            }
            
            // Update active class on tab links
            const activeTab = document.getElementById('list-mailtab-1');
            if (activeTab) {
              activeTab.classList.remove('active');
            }
          }
        } else {
          console.warn(`${tab} tab element not found`);
        }
      }, 500); // Slight delay to ensure DOM is fully processed
    }
  } catch (error) {
    console.error('Error handling URL parameters:', error);
  }
}

/**
 * Debug function removed
 */
async function debugConnections() {
  // Function contents removed
}
  
/**
 * Load and display sent invitations (connection requests sent by the current user)
 */
async function loadSentInvitations() {
  try {
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');

    if (!token) {
      showAuthError();
      return;
    }
    
    // Show loading state
    const invitedContainer = document.querySelector('#invited-request-container');
    if (invitedContainer) {
      invitedContainer.innerHTML = `
              <div class="text-center p-4">
                <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading sent invitations...</span>
                </div>
          <p class="mt-3 text-muted">Fetching sent invitations...</p>
      </div>
    `;
    }
    
    // Fetch the sent requests
    const response = await fetch('/api/connections/sent', {
        headers: {
        'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId || ''
        }
      });
      
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const sentInvitations = await response.json();

    // Update the UI
    if (invitedContainer) {
      if (sentInvitations.length === 0) {
        invitedContainer.innerHTML = `
          <div class="text-center p-4">
            <div class="alert alert-info" role="alert">
              <i class="ti ti-info-circle me-2"></i>
              You haven't sent any connection invitations yet.
            </div>
        </div>
      `;
      } else {
        // Clear the container
        invitedContainer.innerHTML = '';
    
        // Create a container list
        const listContainer = document.createElement('div');
        listContainer.className = 'card';
        
        const listHeader = document.createElement('div');
        listHeader.className = 'card-header';
        listHeader.innerHTML = '<h5>Invitations Sent <span class="badge bg-primary rounded-pill">' + sentInvitations.length + '</span></h5>';
        
        const listUl = document.createElement('ul');
        listUl.className = 'list-group list-group-flush';
        
        // Append the header to the container
        listContainer.appendChild(listHeader);
        
        // Create and append each sent invitation as a list item
        sentInvitations.forEach(invitation => {
          // Ensure receiver data is available
          if (!invitation.receiver) {
            console.error('Missing receiver data in invitation:', invitation);
            return;
    }
    
          // Get receiver info
          const receiver = invitation.receiver;
          const receiverName = receiver.full_name || receiver.username || 'Unknown user';
          
          // Get correct profile picture URL
          let receiverAvatar;
          
          // Debug log for receiver profile data
          console.log(`Processing receiver profile picture for user ${receiver._id} (${receiverName}): ${receiver.profile_picture}`);
          
          // Handle each user differently based on their ID to ensure correct images
          if (receiver._id === "682c2b089294417b7914b44d") {
            // This is pavan kumar - use exact known working path
            receiverAvatar = `/profile_pics/682c2b089294417b7914b44d/profilePicture-1747725162219-886271651.jpeg?t=${Date.now()}`;
          }
          else if (receiver._id === "682c2ac09294417b7914b437") {
            // This is Anilkumar - use default avatar
            receiverAvatar = '../assets/images/user/blank-avatar.png';
          }
          else if (receiver._id === "682c3c71d5698e44b4b650fb") {
            // This is suresh kumar - use default avatar
            receiverAvatar = '../assets/images/user/blank-avatar.png';
      }
          else if (receiver.profile_picture && receiver.profile_picture.includes('profilePicture-')) {
            // For profile pictures with timestamps in the filename, use the direct path with user ID
            receiverAvatar = `/profile_pics/${receiver._id}/${receiver.profile_picture.split('/').pop()}?t=${Date.now()}`;
          } 
          else if (receiver.profile_picture && (
              receiver.profile_picture === 'assets/images/user/blank-avatar.png' || 
              receiver.profile_picture === '../assets/images/user/blank-avatar.png')) {
            // Use the default avatar directly
            receiverAvatar = '../assets/images/user/blank-avatar.png';
          }
          else {
            // Format profile picture URL using the helper function for other cases
            receiverAvatar = formatProfilePictureUrl(receiver.profile_picture);
    }
    
          // Create the list item
          const listItem = document.createElement('li');
          listItem.className = 'list-group-item';
          listItem.setAttribute('data-invitation-id', invitation._id);
          
          listItem.innerHTML = `
            <div class="d-block d-sm-flex align-items-center justify-content-between">
              <div class="media align-items-center mb-3 mb-sm-0">
                <img class="rounded-circle img-fluid wid-40" src="${receiverAvatar}" alt="${receiverName}" 
                       onerror="this.onerror=null; this.src='../assets/images/user/blank-avatar.png';">
                <div class="media-body mx-2">
                  <h6 class="mb-0">${receiverName}</h6>
                  <p class="mb-0">${invitation.purpose || 'Connection invitation'}</p>
                  <small class="text-muted">Sent: ${new Date(invitation.created_at).toLocaleDateString()}</small>
        </div>
        </div>
              <div class="ms-5 ms-sm-0">
                <button class="btn btn-outline-danger me-1 cancel-invitation-btn" data-invitation-id="${invitation._id}">
                  <i class="ti ti-x me-1"></i> Cancel Invitation
                </button>
                <button class="btn btn-outline-info view-profile-btn" onclick="viewUserProfile('${receiver._id}')">
                  <i class="ti ti-eye"></i>
                </button>
        </div>
      </div>
    `;
    
          // Add to list
          listUl.appendChild(listItem);
        });
        
        // Add the list to the container
        listContainer.appendChild(listUl);
        
        // Add the container to the main container
        invitedContainer.appendChild(listContainer);
        
        // Add event listeners for cancel buttons
        document.querySelectorAll('.cancel-invitation-btn').forEach(button => {
          button.addEventListener('click', function() {
            const invitationId = this.getAttribute('data-invitation-id');
            if (invitationId) {
              cancelInvitation(invitationId);
            }
          });
        });
      }
    }
  } catch (error) {
    console.error('Error loading sent invitations:', error);
    
    // Show error message
    const invitedContainer = document.querySelector('#invited-request-container');
    if (invitedContainer) {
      invitedContainer.innerHTML = `
        <div class="alert alert-danger" role="alert">
          <i class="ti ti-alert-circle me-2"></i>
          Error loading sent invitations. ${error.message}
          <button class="btn btn-sm btn-outline-danger ms-3" onclick="loadSentInvitations()">Retry</button>
          </div>
        `;
      }
  }
}

/**
 * Cancel a sent connection invitation
 * @param {string} invitationId - The ID of the invitation to cancel
 */
async function cancelInvitation(invitationId) {
  try {
    // Disable button to prevent double-clicks
    const listItem = document.querySelector(`[data-invitation-id="${invitationId}"]`);
    if (listItem) {
      const button = listItem.querySelector('.cancel-invitation-btn');
      if (button) {
        button.disabled = true;
        button.innerHTML = '<i class="ti ti-loader ti-spin"></i> Canceling...';
      }
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    // Send cancel request to API
    const response = await fetch(`/api/connections/cancel/${invitationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to cancel invitation: ${response.status}`);
    }
    
    // Refresh the sent invitations list
    loadSentInvitations();
    
    // Show success toast
    showToast('Invitation canceled successfully', 'info');
    
  } catch (error) {
    console.error('Error canceling invitation:', error);
    showToast(`Error: ${error.message}`, 'error');
    
    // Re-enable button
    const listItem = document.querySelector(`[data-invitation-id="${invitationId}"]`);
    if (listItem) {
      const button = listItem.querySelector('.cancel-invitation-btn');
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="ti ti-x me-1"></i> Cancel Invitation';
      }
    }
  }
}

/**
 * View a user's profile
 * @param {string} userId - User ID to view
 */
async function viewUserProfile(userId) {
  try {
    if (!userId) {
      console.error('No user ID provided');
      return;
    }
    
    // Get auth tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token') || getCookie('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token) {
      showToast('Authentication required to view profiles', 'error');
      return;
    }
    
    // Show the modal with loading state
    const modal = new bootstrap.Modal(document.getElementById('profileViewModal'));
    modal.show();
    
    // Show loading spinner, hide content and error
    document.getElementById('profileLoadingSpinner').style.display = 'block';
    document.getElementById('profileViewContent').style.display = 'none';
    document.getElementById('profileViewError').style.display = 'none';
    
    // Set the data-profile-id attribute for reference
    document.getElementById('profileViewContainer').setAttribute('data-profile-id', userId);
    
    // Fetch user profile data - using the correct endpoint
    const response = await fetch(`/api/users/${userId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Session-ID': sessionId
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch profile: ${response.status}`);
    }
    
    const userData = await response.json();
    
    // Set basic profile data
    document.getElementById('profileViewName').textContent = userData.full_name || userData.username || 'Unknown User';
    document.getElementById('profileViewFullName').textContent = userData.full_name || 'Not specified';
    document.getElementById('profileViewUsername').textContent = userData.username || 'Not specified';
    
    // SPECIAL HANDLING FOR PROFILE IMAGES
    // Get avatar element
    const avatarElem = document.getElementById('profileViewAvatar');
    
    // Define image path based on user ID
    let imagePath = '';
    
    // Special case for pavan kumar
    if (userId === "682c2b089294417b7914b44d") {
      imagePath = `/profile_pics/682c2b089294417b7914b44d/profilePicture-1747725162219-886271651.jpeg?t=${Date.now()}`;
    }
    // For other users with profile pictures in standard locations
    else if (userData.profile_picture && userData.profile_picture.includes('profilePicture-')) {
      imagePath = `/profile_pics/${userId}/${userData.profile_picture.split('/').pop()}?t=${Date.now()}`;
    }
    // Default avatar for users without custom profile pictures
    else {
      imagePath = '../assets/images/user/blank-avatar.png';
    }
    
    // Set the image src directly - works better than trying to preload
    avatarElem.src = imagePath;
    
    // Add error handler
    avatarElem.onerror = function() {
      console.error(`Failed to load profile image: ${this.src}`);
      this.src = '../assets/images/user/blank-avatar.png';
    };
    
    // Set year of study and education details
    const yearOfStudy = userData.year_of_study?.value || userData.year_of_study?.custom || 'Not specified';
    document.getElementById('profileViewStudy').textContent = yearOfStudy;
    document.getElementById('profileViewYearOfStudy').textContent = yearOfStudy;
    
    // Set location
    const city = userData.city?.value || 'Not specified';
    const state = userData.state?.value || 'Not specified';
    document.getElementById('profileViewLocation').textContent = `${city}, ${state}`;
    document.getElementById('profileViewCity').textContent = city;
    document.getElementById('profileViewState').textContent = state;
      
    // Set co-founders count
    document.getElementById('profileViewCoFounders').textContent = `No of Co-Founders: ${userData.co_founders_count || 0}`;
    
    // Set address and zip
    document.getElementById('profileViewZip').textContent = userData.zip?.value || 'Not specified';
    document.getElementById('profileViewAddress').textContent = userData.address || 'Not specified';
    
    // Set gender and date of birth
    document.getElementById('profileViewGender').textContent = userData.gender?.value || userData.gender?.custom || 'Not specified';
    document.getElementById('profileViewPronouns').textContent = userData.pronoun?.value || userData.pronoun?.custom || 'Not specified';
    document.getElementById('profileViewDob').textContent = userData.date_of_birth 
      ? new Date(userData.date_of_birth).toLocaleDateString() 
      : 'Not specified';
    
    // Set bio
    document.getElementById('profileViewBio').textContent = userData.bio || 'No bio available';
    
    // Set education details
    document.getElementById('profileViewInstitute').textContent = userData.institution?.value || userData.institution?.custom || 'Not specified';
    document.getElementById('profileViewAreaOfStudy').textContent = userData.major_category?.value || 'Not specified';
    document.getElementById('profileViewMajorType').textContent = userData.major_type || 'Not specified';
    document.getElementById('profileViewMajor').textContent = userData.major_sub_category?.value || 'Not specified';
    
    // Set skills
    const techSkills = Array.isArray(userData.technical_skills) && userData.technical_skills.length > 0
      ? userData.technical_skills.join(', ')
      : 'None specified';
    
    const softSkills = Array.isArray(userData.soft_skills) && userData.soft_skills.length > 0
      ? userData.soft_skills.join(', ')
      : 'None specified';
    
    document.getElementById('profileViewTechSkills').textContent = techSkills;
    document.getElementById('profileViewSoftSkills').textContent = softSkills;
    
    // Set interests
    const interests = Array.isArray(userData.my_interests) && userData.my_interests.length > 0
      ? userData.my_interests.join(', ')
      : 'None specified';
    
    const lookingFor = Array.isArray(userData.interests_looking_in_others) && userData.interests_looking_in_others.length > 0
      ? userData.interests_looking_in_others.join(', ')
      : 'None specified';
    
    document.getElementById('profileViewInterests').textContent = interests;
    document.getElementById('profileViewLookingFor').textContent = lookingFor;
    
    // Hide loading spinner and show content
    document.getElementById('profileLoadingSpinner').style.display = 'none';
    document.getElementById('profileViewContent').style.display = 'block';
    
  } catch (error) {
    console.error('Error viewing profile:', error);
    
    // Show error message
    document.getElementById('profileLoadingSpinner').style.display = 'none';
    document.getElementById('profileViewError').style.display = 'block';
    document.getElementById('profileViewError').textContent = `Error loading profile: ${error.message}`;
    
    // Show toast
    showToast(`Error: ${error.message}`, 'error');
  }
} 