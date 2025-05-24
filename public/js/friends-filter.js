/**
 * Friends Filter System
 * Currently disabled to ensure accepted users appear in search results
 */

(function() {
  // Disable all filtering by default because it's causing issues with accepted users
  window.disableAllSearchFiltering = false;
  
  // Track the connections we've seen from API responses
  const knownConnections = new Set();
  
  // Function to fetch and store accepted connections
  async function loadAcceptedConnections() {
    console.log('🤝 Loading accepted connections...');
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');

      if (!token || !sessionId) {
        console.warn('Auth token or session ID not found. Cannot load connections.');
        return;
      }

      const response = await fetch('/api/connections', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Session-ID': sessionId
        }
      });

      if (!response.ok) {
        console.error('Failed to fetch connections:', response.status, await response.text());
        return;
      }

      const connectionsData = await response.json();
      if (connectionsData && Array.isArray(connectionsData)) {
        let acceptedCount = 0;
        connectionsData.forEach(connection => {
          // The /api/connections endpoint returns an array of objects,
          // each containing the connection details and the 'user' object representing the other person.
          if (connection.status === 'accepted' && connection.user && connection.user._id) {
            console.log(`✅ Storing accepted connection with user: ${connection.user._id} (${connection.user.full_name || connection.user.username})`);
            knownConnections.add(connection.user._id);
            acceptedCount++;
          }
        });
        console.log(`Loaded ${acceptedCount} accepted connections into knownConnections.`);
      } else {
        console.warn('Connections data is not in the expected format or is empty:', connectionsData);
      }
    } catch (error) {
      console.error('Error loading accepted connections:', error);
    }
  }
  
  // Initialize the tracking of connected users
  function saveConnectedUser(userId, status) {
    if (!userId) return;
    
    if (status === 'accepted') {
      console.log(`✅ TRACKING ACCEPTED CONNECTION: ${userId}`);
      knownConnections.add(userId);
    }
  }
  
  // Function to setup the Messages page search
  function setupMessagesPageSearch() {
    // Only run this on the messages page
    if (!window.location.pathname.includes('/messages')) return;
    
    console.log('Setting up enhanced search for messages page');
    
    // Find the search input on messages page
    const searchInput = document.querySelector('.form-search input[type="search"]');
    if (!searchInput) return;
    
    // Update the placeholder
    searchInput.placeholder = "Search Connections";
    
    // Add badge if not present to indicate search filter is disabled
    const searchContainer = searchInput.closest('.form-search');
    if (searchContainer && !searchContainer.querySelector('.search-badge')) {
      // Remove the badge creation code to eliminate the "Connections Only" label
      // Keep the rest of functionality intact
    }
    
    console.log('Messages page search setup complete - Filtering enabled by default');
  }
  
  // DIRECT API OVERRIDE - But only log, don't filter out users
  const originalFetch = window.fetch;
  window.fetch = async function(url, options) {
    // Don't intercept for connections page
    if (window.location.pathname.includes('/connections')) {
      return originalFetch(url, options);
    }
    
    // Messages page search API
    if (typeof url === 'string' && url.includes('/api/users/search')) {
      console.log('🔍 INTERCEPT: Search API called with URL:', url);
      
      // Extract search query for logging
      const searchQuery = url.includes('?q=') ? decodeURIComponent(url.split('?q=')[1].split('&')[0]) : '';
      console.log(`🔍 Search query: "${searchQuery}"`);
      
      try {
        // Call original fetch
        const response = await originalFetch(url, options);
        
        // Clone response to inspect the data
        const originalResponse = response.clone();
        let data;
        
        try {
          data = await originalResponse.json();
        } catch (parseError) {
          console.error('Failed to parse search response as JSON:', parseError);
          return response; // Return original response if parsing fails
        }
        
        // Check if we have valid data
        if (data && data.success && Array.isArray(data.data)) {
          console.log(`📊 Search for "${searchQuery}" returned ${data.data.length} users originally`);
          
          // Process each user to log and track connections
          data.data.forEach(user => {
            const userId = user._id;
            const name = user.full_name || user.username || 'Unknown';
            
            // Log connection/status information for each user
            console.log(`👤 User: ${name} (${userId})`);
            
            // Check for admin role
            const isAdmin = 
              user.role === 'admin' || 
              user.roles?.includes('admin') || 
              (user.email && user.email.includes('admin'));
            
            if (isAdmin) {
              console.log(`   - 👑 Admin user detected`);
            }
            
            // Check for connection status in any field
            const connectionStatus = 
              user.connectionStatus ||
              (user.connection && user.connection.status) ||
              user.status ||
              'unknown';
            
            console.log(`   - 🔗 Connection status: ${connectionStatus}`);
            
            // For connections, save to our tracking list
            if (connectionStatus === 'accepted') {
              saveConnectedUser(userId, connectionStatus);
            }
          });
          
          // Since filtering is causing problems, return unfiltered results
          // Apply filtering if not disabled
          if (!window.disableAllSearchFiltering) {
            const filteredUsers = data.data.filter(user => {
              const userId = user._id;
              const isAdmin = 
                user.role === 'admin' || 
                user.roles?.includes('admin') || 
                (user.email && user.email.includes('admin'));

              if (isAdmin) {
                console.log(`🚫 Filtering out admin user: ${user.full_name || user.username}`);
                return false;
              }

              const connectionStatus = 
                user.connectionStatus ||
                (user.connection && user.connection.status) ||
                user.status ||
                'unknown';
              
              const isAcceptedConnection = connectionStatus === 'accepted' || knownConnections.has(userId);
              
              if (!isAcceptedConnection) {
                console.log(`🚫 Filtering out non-connected user: ${user.full_name || user.username} (Status: ${connectionStatus})`);
              }
              return isAcceptedConnection;
            });

            console.log(`🔍 Filtered results for "${searchQuery}": ${filteredUsers.length} users`);
            
            // Create a new response with the filtered data
            const newResponse = new Response(JSON.stringify({ ...data, data: filteredUsers }), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
            return newResponse;
          } else {
            console.log('ℹ️ Search filtering is currently disabled. Returning all users.');
          }
          
          return response;
        }
        
        return response;
      } catch (error) {
        console.error('Error in search API interception:', error);
        return originalFetch(url, options);
      }
    }
    
    // All other requests pass through unchanged
    return originalFetch(url, options);
  };
  
  // Apply when DOM is loaded
  document.addEventListener('DOMContentLoaded', async function() {
    console.log('🔄 Initializing search filter - Only connected users will be shown by default');
    
    // Load accepted connections first
    await loadAcceptedConnections();

    // Setup messages page search UI
    setTimeout(setupMessagesPageSearch, 500);
    
    // Debug log to console
    console.log('✅ Search filter is ENABLED by default. Only connected users will appear in search results.');
  });
})(); 