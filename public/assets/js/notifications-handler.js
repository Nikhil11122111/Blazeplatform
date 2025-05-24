/**
 * Notifications Handler
 * Handles loading and displaying notifications in the header dropdown
 */

// Initialize notification system when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing notifications system');
    initNotifications();
    
    // Make debug functions available globally
    window.debugNotifications = debugNotifications;
    window.testMarkAllRead = testMarkAllRead;
    
    // Set up real-time notifications if socket.io is available
    initNotificationSocket();
});

// Global variables
let notificationsLoaded = false;
let notificationSocket = null;
let notificationCount = 0;
let lastNotificationCheck = 0;
const NOTIFICATION_CHECK_INTERVAL = 30000; // 30 seconds

// Initialize notifications
function initNotifications() {
    // Get notification elements
    const notificationBadge = document.getElementById('notification-badge');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationContainer = document.querySelector('.dropdown-body.header-notification-scroll');
    const markAllReadBtn = document.getElementById('mark-all-read');
    const clearAllBtn = document.getElementById('clear-all-notifications');
    
    if (!notificationBadge || !notificationContainer) {
        console.error('Notification elements not found in the DOM');
        return;
    }
    
    // Set up notification dropdown click handler to load notifications
    notificationDropdown.addEventListener('click', function(e) {
        console.log('Notification icon clicked - loading notifications');
        e.preventDefault(); // Prevent default dropdown behavior initially
        
        // Force reload notifications
        loadNotifications(true);
        
        // Let the dropdown open after a short delay
        setTimeout(() => {
            // Re-trigger the dropdown using Bootstrap's API
            const dropdown = new bootstrap.Dropdown(notificationDropdown);
            dropdown.show();
        }, 100);
    });
    
    // Mark all as read button
    if (markAllReadBtn) {
        markAllReadBtn.addEventListener('click', function(e) {
            e.preventDefault();
            markAllNotificationsAsRead();
        });
    }
    
    // Clear all notifications button
    if (clearAllBtn) {
        clearAllBtn.addEventListener('click', function(e) {
            e.preventDefault();
            clearAllNotifications();
        });
    }
    
    // Initialize Socket.IO connection
    initSocketConnection();
    
    // Load notifications initially
    loadNotifications(false);
    
    // Set interval to periodically check for new notifications
    setInterval(function() {
        // Only check if enough time has passed since last check
        const now = Date.now();
        if (now - lastNotificationCheck >= NOTIFICATION_CHECK_INTERVAL) {
            loadNotifications(false);
            lastNotificationCheck = now;
        }
    }, NOTIFICATION_CHECK_INTERVAL);
}

// Initialize Socket.IO connection
function initSocketConnection() {
    try {
        console.log('Initializing Socket.IO connection for notifications');
        
        // Get authentication tokens
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
        
        if (!token || !userId) {
            console.warn('Authentication tokens not found, skipping socket connection');
            return;
        }
        
        // Create socket connection with auth data
        notificationSocket = io('/', {
            query: {
                token: token,
                userId: userId
            }
        });
        
        // Handle connection events
        notificationSocket.on('connect', function() {
            console.log('Socket.IO connected for notifications');
        });
        
        notificationSocket.on('disconnect', function() {
            console.warn('Socket.IO disconnected');
        });
        
        notificationSocket.on('error', function(error) {
            console.error('Socket.IO error:', error);
        });
        
        // Listen for notification events
        notificationSocket.on('notification', function(data) {
            console.log('Received notification via Socket.IO:', data);
            // Reload notifications when a new one arrives
            loadNotifications(false);
            
            // Show toast notification if not already in notifications dropdown
            if (!document.querySelector('.dropdown-notification.show')) {
                showToastNotification(data);
            }
        });
    } catch (error) {
        console.error('Error initializing Socket.IO:', error);
    }
}

// Load notifications from the server
function loadNotifications(isUserAction = false) {
    const notificationContainer = document.querySelector('.dropdown-body.header-notification-scroll');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (!notificationContainer || !notificationBadge) {
        console.error('Notification elements not found');
        return;
    }
    
    console.log('Loading notifications, isUserAction:', isUserAction);
    
    // Show loading state if this is first load or user clicked on icon
    if (!notificationsLoaded || isUserAction) {
        notificationContainer.innerHTML = `
            <p class="text-span">Today</p>
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Loading notifications...</span>
                </div>
                <p class="text-muted mb-0 mt-2">Loading notifications...</p>
            </div>
        `;
    }
    
    // Get authentication tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token) {
        console.error('Auth token not found, cannot load notifications');
        notificationContainer.innerHTML = `
            <p class="text-span">Not Logged In</p>
            <div class="text-center py-3">
                <p class="text-muted mb-0">Please log in to view notifications</p>
                <a href="/login.html" class="btn btn-sm btn-primary mt-2">Log In</a>
            </div>
        `;
        return;
    }
    
    // Set last check time
    lastNotificationCheck = Date.now();
    
    console.log('Fetching notifications from API...');
    
    // Fetch notifications from the server
    fetch('/api/notifications', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Session-ID': sessionId || ''
        }
    })
    .then(response => {
        console.log('Notifications API response status:', response.status);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                throw new Error('Unauthorized: Please log in again');
            } else {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }
        }
        return response.json();
    })
    .then(data => {
        console.log('Loaded notifications:', data);
        notificationsLoaded = true;
        
        // Check for unread notifications, looking at both the status and read fields
        let unreadNotifications = [];
        if (Array.isArray(data)) {
            unreadNotifications = data.filter(notification => {
                // Consider a notification unread if either field indicates unread
                const isUnreadByStatus = notification.status === 'unread';
                const isUnreadByFlag = notification.read === false;
                
                return isUnreadByStatus || isUnreadByFlag;
            });
        }
        
        const unreadCount = unreadNotifications.length;
        console.log(`Found ${unreadCount} unread notifications out of ${data.length} total`);
        
        // Update local tracking variable
        notificationCount = unreadCount;
        
        // Always show badge if there are unread notifications
        if (unreadCount > 0) {
            notificationBadge.textContent = unreadCount > 99 ? '99+' : unreadCount;
            notificationBadge.style.display = 'block';
            // Add a subtle animation to draw attention to the badge
            notificationBadge.classList.add('badge-pulse');
            setTimeout(() => {
                notificationBadge.classList.remove('badge-pulse');
            }, 1000);
        } else {
            notificationBadge.textContent = '0';
            notificationBadge.style.display = 'none';
        }
        
        // Render notifications or "no notifications" message
        renderNotifications(data, notificationContainer);
    })
    .catch(error => {
        console.error('Error loading notifications:', error);
        notificationContainer.innerHTML = `
            <p class="text-span">Error</p>
            <div class="text-center py-3">
                <i class="ti ti-alert-circle text-danger fs-4"></i>
                <p class="text-muted mb-0 mt-2">Failed to load notifications: ${error.message}</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadNotifications(true)">
                    <i class="ti ti-refresh"></i> Retry
                </button>
                <div class="mt-3">
                    <small class="text-muted">Debug info: ${error.toString()}</small>
                </div>
            </div>
        `;
    });
}

// Render notifications in the container
function renderNotifications(notifications, container) {
    if (!container) {
        console.error('No container to render notifications');
        return;
    }
    
    console.log('Rendering notifications:', notifications);
    
    // Clear the container first
    container.innerHTML = '';
    
    // Add the "Today" header
    const header = document.createElement('p');
    header.className = 'text-span';
    header.textContent = 'Today';
    container.appendChild(header);
    
    // Check if there are any notifications
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
        console.log('No notifications to display');
        
        // Show no notifications message
        const noNotificationsDiv = document.createElement('div');
        noNotificationsDiv.className = 'text-center py-3';
        noNotificationsDiv.innerHTML = `
            <i class="ti ti-bell-off fs-4 text-muted"></i>
            <p class="text-muted mb-0 mt-2">No notifications</p>
        `;
        container.appendChild(noNotificationsDiv);
        return;
    }
    
    // Group notifications by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // Create notification elements and add to container
    let lastGroupDate = null;
    
    // Sort notifications by date (newest first)
    notifications.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || a.timestamp || 0);
        const dateB = new Date(b.createdAt || b.created_at || b.timestamp || 0);
        return dateB - dateA;
    });
    
    // Track if we've shown any unread notifications
    let hasUnreadNotifications = false;
    
    // Add notifications to the container
    notifications.forEach(notification => {
        const notifDate = new Date(notification.createdAt || notification.created_at || notification.timestamp || 0);
        notifDate.setHours(0, 0, 0, 0);
        
        // Check if this is unread
        if (notification.status === 'unread' || !notification.read) {
            hasUnreadNotifications = true;
        }
        
        // Add date separator if needed
        if (lastGroupDate === null || notifDate.getTime() !== lastGroupDate.getTime()) {
            // Don't add a date header for the first group (Today)
            if (lastGroupDate !== null) {
                const dateHeader = document.createElement('p');
                dateHeader.className = 'text-span mt-4';
                
                if (notifDate.getTime() === today.getTime()) {
                    dateHeader.textContent = 'Today';
                } else if (notifDate.getTime() === yesterday.getTime()) {
                    dateHeader.textContent = 'Yesterday';
                } else if (notifDate > lastWeek) {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    dateHeader.textContent = days[notifDate.getDay()];
                } else {
                    dateHeader.textContent = notifDate.toLocaleDateString();
                }
                
                container.appendChild(dateHeader);
            }
            
            lastGroupDate = notifDate;
        }
        
        // Create and add notification card
        const notifElement = createNotificationElement(notification);
        container.appendChild(notifElement);
    });
    
    // If no unread notifications found, update the badge
    if (!hasUnreadNotifications) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
        notificationCount = 0;
    }
}

// Create a notification element
function createNotificationElement(notification) {
    console.log('Creating notification element:', notification);
    
    const notifItem = document.createElement('div');
    notifItem.className = 'card mb-2';
    notifItem.setAttribute('data-notification-id', notification._id);
    
    // Check both status and read flag for consistent handling
    const isUnread = notification.status === 'unread' || notification.read === false;
    
    if (isUnread) {
        notifItem.classList.add('bg-light-primary');
    }
    
    // Process notification based on type
    let iconClass = 'ti-bell';
    let notifTitle = 'Notification';
    let notifLink = '#';
    let notifAction = '';
    
    // Format the notification time
    const notifTime = formatTimeAgo(notification.createdAt || notification.created_at || notification.timestamp || Date.now());
    
    // Enhanced sender extraction
    let senderName = notification.senderName || 'Someone';
    
    // Extract sender data - check all possible places where sender info might be
    if (notification.sender) {
        if (typeof notification.sender === 'object') {
            // Populated User object
            senderName = notification.sender.full_name || 
                         notification.sender.username || 
                         notification.sender.name || 
                         senderName;
        } else if (typeof notification.sender === 'string') {
            // Just the sender ID or name as string
            senderName = notification.sender || senderName;
        }
    } 
    // If still no name, check other possible fields
    else if (notification.data && notification.data.sender) {
        if (typeof notification.data.sender === 'object') {
            senderName = notification.data.sender.full_name || 
                         notification.data.sender.username || 
                         notification.data.sender.name || 
                         senderName;
        } else if (typeof notification.data.sender === 'string') {
            senderName = notification.data.sender || senderName;
        }
    }
    
    console.log(`Notification ${notification._id} processed sender name:`, senderName);
    
    // Handle different notification types
    const notificationType = notification.type || 
                            (notification.data && notification.data.type) || 
                            '';
    
    if (notificationType.includes('connection_request') || 
        (notification.message && notification.message.toLowerCase().includes('connection request'))) {
        iconClass = 'ti-user-plus';
        notifTitle = 'Connection Request';
        notifLink = '/connections.html';
        notifAction = `<strong>${senderName}</strong> sent you a connection request`;
    }
    else if (notificationType.includes('connection_accepted') || 
             notificationType.includes('connection_approved') || 
             (notification.message && notification.message.toLowerCase().includes('accepted your connection'))) {
        iconClass = 'ti-users';
        notifTitle = 'Connection Accepted';
        notifLink = '/connections.html';
        notifAction = `<strong>${senderName}</strong> accepted your connection request`;
    }
    else if (notificationType.includes('message') || 
             (notification.message && notification.message.toLowerCase().includes('sent you a message'))) {
        iconClass = 'ti-messages';
        notifTitle = 'New Message';
        notifLink = '/messages.html';
        notifAction = `<strong>${senderName}</strong> sent you a message`;
    }
    else {
        // Generic notification - use notification.message directly
        notifAction = notification.message || 'You have a new notification';
    }
    
    // Create notification HTML
    notifItem.innerHTML = `
        <div class="card-body py-2 px-3">
            <div class="d-flex align-items-center">
                <div class="flex-shrink-0">
                    <div class="avtar avtar-xs bg-light-primary">
                        <i class="ti ${iconClass}"></i>
                    </div>
                </div>
                <div class="flex-grow-1 ms-2">
                    <div>
                        <div class="d-flex align-items-center justify-content-between">
                            <span class="text-dark f-12">${notifTitle}</span>
                            <small class="text-muted">${notifTime}</small>
                        </div>
                        <p class="mb-0 text-muted f-12">${notifAction}</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Add click handler to mark as read and navigate
    notifItem.addEventListener('click', function(e) {
        e.preventDefault();
        
        console.log('Notification clicked, ID:', notification._id);
        
        // Mark notification as read
        markNotificationAsRead(notification._id)
            .then(() => {
                // Navigate to the link
                if (notifLink && notifLink !== '#') {
                    window.location.href = notifLink;
                }
            })
            .catch(error => {
                console.error('Error marking notification as read:', error);
                // Navigate anyway
                if (notifLink && notifLink !== '#') {
                    window.location.href = notifLink;
                }
            });
    });
    
    return notifItem;
}

// Format time ago string (e.g. "5m ago", "2h ago")
function formatTimeAgo(timestamp) {
    const now = new Date();
    const notifDate = new Date(timestamp);
    const diffMs = now - notifDate;
    
    // Convert to seconds
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
        return 'Just now';
    }
    
    // Convert to minutes
    const diffMinutes = Math.floor(diffSeconds / 60);
    
    if (diffMinutes < 60) {
        return `${diffMinutes}m ago`;
    }
    
    // Convert to hours
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffHours < 24) {
        return `${diffHours}h ago`;
    }
    
    // Convert to days
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays < 7) {
        return `${diffDays}d ago`;
    }
    
    // Just return the date for older notifications
    return notifDate.toLocaleDateString();
}

// Mark a single notification as read
function markNotificationAsRead(notificationId) {
    return new Promise((resolve, reject) => {
        if (!notificationId) {
            reject(new Error('No notification ID provided'));
            return;
        }
        
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        
        if (!token) {
            reject(new Error('Not authenticated'));
            return;
        }
        
        fetch(`/api/notifications/${notificationId}/read`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server returned ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            // Update notification count
            notificationCount--;
            if (notificationCount < 0) notificationCount = 0;
            
            // Update badge
            const badge = document.getElementById('notification-badge');
            if (badge) {
                if (notificationCount > 0) {
                    badge.textContent = notificationCount > 99 ? '99+' : notificationCount;
                    badge.style.display = 'block';
                } else {
                    badge.textContent = '0';
                    badge.style.display = 'none';
                }
            }
            
            // Update UI - remove highlight
            const notifElement = document.querySelector(`[data-notification-id="${notificationId}"]`);
            if (notifElement) {
                notifElement.classList.remove('bg-light-primary');
            }
            
            resolve(data);
        })
        .catch(error => {
            console.error('Error marking notification as read:', error);
            reject(error);
        });
    });
}

// Mark all notifications as read
function markAllNotificationsAsRead() {
    console.log('Mark all notifications as read called');
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token) {
        console.error('Not authenticated');
        return;
    }
    
    // Show loading state
    const container = document.querySelector('.dropdown-body.header-notification-scroll');
    if (container) {
        container.innerHTML = `
            <p class="text-span">Today</p>
            <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary" role="status">
                    <span class="visually-hidden">Marking notifications as read...</span>
                </div>
                <p class="text-muted mb-0 mt-2">Marking all as read...</p>
            </div>
        `;
    }
    
    // Update badge immediately for better UX
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.classList.remove('badge-pulse');
        badge.textContent = '0';
        badge.style.display = 'none';
    }
    
    // Reset notification count in local tracking variable
    notificationCount = 0;
    
    // Try the first endpoint (index 0)
    tryMarkAllRead(0, token, sessionId);
}

// Helper function to try marking all as read with multiple endpoints
function tryMarkAllRead(index, token, sessionId) {
    // Define endpoint configs with URL and method
    const endpointConfigs = [
        { url: '/api/notifications/read-all', method: 'PUT' },
        { url: '/api/notifications/read/all', method: 'PUT' },
        { url: '/api/notifications/mark-read', method: 'POST', body: JSON.stringify({ notificationIds: "all" }) },
        { url: '/api/notifications/mark-all-read', method: 'POST' }
    ];
    
    if (index >= endpointConfigs.length) {
        console.error('All endpoints failed for marking notifications as read');
        
        // Show error message in the container
        const container = document.querySelector('.dropdown-body.header-notification-scroll');
        if (container) {
            container.innerHTML = `
                <p class="text-span">Today</p>
                <div class="text-center py-3">
                    <i class="ti ti-alert-triangle text-danger fs-3"></i>
                    <p class="text-danger mb-0 mt-2">Error: Failed to mark notifications as read</p>
                    <p class="text-muted small">All endpoints failed. Please try again later.</p>
                </div>
            `;
        }
        return;
    }
    
    // Get current endpoint config
    const config = endpointConfigs[index];
    console.log(`Trying to mark all as read with endpoint: ${config.url} (${config.method}) - attempt ${index + 1}/${endpointConfigs.length}`);
    
    // Request options
    const options = {
        method: config.method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Session-ID': sessionId || ''
        }
    };
    
    // Add body for POST requests if provided
    if (config.body) {
        options.body = config.body;
    }
    
    fetch(config.url, options)
    .then(response => {
        if (!response.ok) {
            console.log(`Endpoint ${config.url} (${config.method}) returned ${response.status}, trying next...`);
            throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log(`Successfully marked all notifications as read with endpoint: ${config.url} (${config.method})`, data);
        
        // Clear all unread indicators from notification items
        const notifElements = document.querySelectorAll('.card.bg-light-primary');
        notifElements.forEach(el => {
            el.classList.remove('bg-light-primary');
        });
        
        // Show success message
        const container = document.querySelector('.dropdown-body.header-notification-scroll');
        if (container) {
            container.innerHTML = `
                <p class="text-span">Today</p>
                <div class="text-center py-3">
                    <i class="ti ti-check text-success fs-3"></i>
                    <p class="text-success mb-0 mt-2">All notifications marked as read</p>
                </div>
            `;
            
            // After a short delay, reload notifications with a special flag 
            // that indicates we've just marked all as read
            setTimeout(() => {
                notificationsLoaded = false; // Reset to force a fresh load
                loadNotificationsAfterMarkRead();
            }, 1500);
        }
        
        // Trigger a toast notification if available
        if (typeof showToast === 'function') {
            showToast('All notifications marked as read', 'success');
        }
    })
    .catch(error => {
        console.error(`Error with endpoint ${config.url} (${config.method}):`, error);
        
        // Try the next endpoint
        tryMarkAllRead(index + 1, token, sessionId);
    });
}

// Make the function globally accessible
window.markAllNotificationsAsRead = markAllNotificationsAsRead;

// Special function to load notifications after marking all as read
function loadNotificationsAfterMarkRead() {
    const notificationContainer = document.querySelector('.dropdown-body.header-notification-scroll');
    const notificationBadge = document.getElementById('notification-badge');
    
    if (!notificationContainer || !notificationBadge) {
        console.error('Notification elements not found');
        return;
    }
    
    console.log('Loading notifications after marking all as read');
    
    // Get authentication tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token) {
        console.error('Auth token not found, cannot load notifications');
        notificationContainer.innerHTML = `
            <p class="text-span">Not Logged In</p>
            <div class="text-center py-3">
                <p class="text-muted mb-0">Please log in to view notifications</p>
                <a href="/login.html" class="btn btn-sm btn-primary mt-2">Log In</a>
            </div>
        `;
        return;
    }
    
    // Set last check time
    lastNotificationCheck = Date.now();
    
    // Show loading state temporarily
    notificationContainer.innerHTML = `
        <p class="text-span">Today</p>
        <div class="text-center py-3">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Loading notifications...</span>
            </div>
            <p class="text-muted mb-0 mt-2">Loading notifications...</p>
        </div>
    `;
    
    // Fetch notifications from the server
    fetch('/api/notifications', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Session-ID': sessionId || ''
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Loaded notifications after mark all read:', data);
        notificationsLoaded = true;
        
        // All notifications should be read at this point, force unread count to 0
        notificationCount = 0;
        
        // Ensure badge stays hidden
        if (notificationBadge) {
            notificationBadge.textContent = '0';
            notificationBadge.style.display = 'none';
        }
        
        // If there are no notifications, show a message
        if (!data || !Array.isArray(data) || data.length === 0) {
            notificationContainer.innerHTML = `
                <p class="text-span">Today</p>
                <div class="text-center py-3">
                    <i class="ti ti-bell-off fs-4 text-muted"></i>
                    <p class="text-muted mb-0 mt-2">No notifications</p>
                </div>
            `;
            return;
        }
        
        // Render notifications, but force them all to appear as read
        renderNotificationsAsRead(data, notificationContainer);
    })
    .catch(error => {
        console.error('Error loading notifications after mark all read:', error);
        notificationContainer.innerHTML = `
            <p class="text-span">Error</p>
            <div class="text-center py-3">
                <i class="ti ti-alert-circle text-danger fs-4"></i>
                <p class="text-muted mb-0 mt-2">Failed to load notifications: ${error.message}</p>
                <button class="btn btn-sm btn-outline-primary mt-2" onclick="loadNotifications(true)">
                    <i class="ti ti-refresh"></i> Retry
                </button>
            </div>
        `;
    });
}

// Render notifications but force them all to be marked as read
function renderNotificationsAsRead(notifications, container) {
    if (!container) {
        console.error('No container to render notifications as read');
        return;
    }
    
    console.log('Rendering notifications as read:', notifications);
    
    // Clear the container first
    container.innerHTML = '';
    
    // Add the "Today" header
    const header = document.createElement('p');
    header.className = 'text-span';
    header.textContent = 'Today';
    container.appendChild(header);
    
    // Check if there are any notifications
    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
        console.log('No notifications to display');
        
        // Show no notifications message
        const noNotificationsDiv = document.createElement('div');
        noNotificationsDiv.className = 'text-center py-3';
        noNotificationsDiv.innerHTML = `
            <i class="ti ti-bell-off fs-4 text-muted"></i>
            <p class="text-muted mb-0 mt-2">No notifications</p>
        `;
        container.appendChild(noNotificationsDiv);
        return;
    }
    
    // Group notifications by date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);
    
    // Create notification elements and add to container
    let lastGroupDate = null;
    
    // Sort notifications by date (newest first)
    notifications.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.created_at || a.timestamp || 0);
        const dateB = new Date(b.createdAt || b.created_at || b.timestamp || 0);
        return dateB - dateA;
    });
    
    // Add notifications to the container
    notifications.forEach(notification => {
        // Force notification to be read
        notification.read = true;
        notification.status = 'read';
        
        const notifDate = new Date(notification.createdAt || notification.created_at || notification.timestamp || 0);
        notifDate.setHours(0, 0, 0, 0);
        
        // Add date separator if needed
        if (lastGroupDate === null || notifDate.getTime() !== lastGroupDate.getTime()) {
            // Don't add a date header for the first group (Today)
            if (lastGroupDate !== null) {
                const dateHeader = document.createElement('p');
                dateHeader.className = 'text-span mt-4';
                
                if (notifDate.getTime() === today.getTime()) {
                    dateHeader.textContent = 'Today';
                } else if (notifDate.getTime() === yesterday.getTime()) {
                    dateHeader.textContent = 'Yesterday';
                } else if (notifDate > lastWeek) {
                    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                    dateHeader.textContent = days[notifDate.getDay()];
                } else {
                    dateHeader.textContent = notifDate.toLocaleDateString();
                }
                
                container.appendChild(dateHeader);
            }
            
            lastGroupDate = notifDate;
        }
        
        // Create and add notification card
        const notifElement = createNotificationElement(notification);
        container.appendChild(notifElement);
    });
}

// Clear all notifications
function clearAllNotifications() {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    
    if (!token) {
        console.error('Not authenticated');
        return;
    }
    
    fetch('/api/notifications/clear-all', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Cleared all notifications:', data);
        
        // Update badge
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.textContent = '0';
            badge.style.display = 'none';
        }
        
        notificationCount = 0;
        
        // Update UI - show no notifications message
        const container = document.querySelector('.dropdown-body.header-notification-scroll');
        if (container) {
            container.innerHTML = `
                <p class="text-span">Today</p>
                <div class="text-center py-3">
                    <i class="ti ti-bell-off fs-4 text-muted"></i>
                    <p class="text-muted mb-0 mt-2">No notifications</p>
                </div>
            `;
        }
    })
    .catch(error => {
        console.error('Error clearing all notifications:', error);
    });
}

// Show a toast notification
function showToast(message, type = 'info') {
    try {
        // Create toast container if it doesn't exist
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
            toastContainer.style.zIndex = '1080';
            document.body.appendChild(toastContainer);
        }
        
        // Set color class based on type
        const bgClass = type === 'success' ? 'bg-success' : 
                       type === 'error' ? 'bg-danger' : 
                       type === 'warning' ? 'bg-warning' :
                       'bg-info';
        
        // Create toast ID
        const toastId = `toast-${Date.now()}`;
        
        // Create toast element
        const toastEl = document.createElement('div');
        toastEl.id = toastId;
        toastEl.className = 'toast';
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        
        toastEl.innerHTML = `
            <div class="toast-header">
                <div class="rounded me-2 ${bgClass}" style="width:20px; height:20px;"></div>
                <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
                <small>Just now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        `;
        
        // Add to container
        toastContainer.appendChild(toastEl);
        
        // Initialize and show toast using Bootstrap
        if (typeof bootstrap !== 'undefined' && bootstrap.Toast) {
            const toast = new bootstrap.Toast(toastEl, {
                autohide: true,
                delay: 5000
            });
            
            toast.show();
            
            // Remove after hide
            toastEl.addEventListener('hidden.bs.toast', function() {
                toastEl.remove();
            });
        } else {
            // Fallback if Bootstrap toast is not available
            toastEl.style.display = 'block';
            toastEl.style.opacity = '1';
            toastEl.style.backgroundColor = 'white';
            toastEl.style.border = '1px solid #ddd';
            toastEl.style.borderRadius = '4px';
            toastEl.style.boxShadow = '0 0.5rem 1rem rgba(0, 0, 0, 0.15)';
            toastEl.style.maxWidth = '350px';
            toastEl.style.margin = '10px';
            
            // Auto remove after 5 seconds
            setTimeout(() => {
                toastEl.remove();
            }, 5000);
        }
    } catch (error) {
        console.error('Error showing toast notification:', error);
        // Use alert as fallback
        alert(message);
    }
}

// Debug notifications system
function debugNotifications() {
    console.log('======= NOTIFICATIONS DEBUG =======');
    
    // Create debug container
    let debugOutput = document.createElement('div');
    debugOutput.style.position = 'fixed';
    debugOutput.style.top = '50px';
    debugOutput.style.right = '20px';
    debugOutput.style.width = '400px';
    debugOutput.style.maxHeight = '80vh';
    debugOutput.style.overflowY = 'auto';
    debugOutput.style.backgroundColor = 'white';
    debugOutput.style.border = '1px solid #ccc';
    debugOutput.style.borderRadius = '5px';
    debugOutput.style.padding = '15px';
    debugOutput.style.boxShadow = '0 0 10px rgba(0,0,0,0.2)';
    debugOutput.style.zIndex = '9999';
    
    // Add close button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Close';
    closeBtn.className = 'btn btn-sm btn-danger float-end';
    closeBtn.onclick = function() {
        document.body.removeChild(debugOutput);
    };
    
    // Add refresh button
    const refreshBtn = document.createElement('button');
    refreshBtn.textContent = 'Refresh Data';
    refreshBtn.className = 'btn btn-sm btn-primary me-2 float-end';
    refreshBtn.onclick = function() {
        document.body.removeChild(debugOutput);
        debugNotifications(); 
    };
    
    // Header
    const header = document.createElement('h4');
    header.textContent = 'Notifications Debug';
    header.className = 'mb-3';
    
    debugOutput.appendChild(closeBtn);
    debugOutput.appendChild(refreshBtn);
    debugOutput.appendChild(header);
    
    // Add notification elements status
    const notificationBadge = document.getElementById('notification-badge');
    const notificationDropdown = document.getElementById('notificationDropdown');
    const notificationContainer = document.querySelector('.dropdown-body.header-notification-scroll');
    
    const elementsSection = document.createElement('div');
    elementsSection.innerHTML = `
        <h5>Notification Elements</h5>
        <table class="table table-sm">
            <tr>
                <td>Badge Element</td>
                <td>${notificationBadge ? 'Found' : 'Missing'}</td>
            </tr>
            <tr>
                <td>Dropdown Element</td>
                <td>${notificationDropdown ? 'Found' : 'Missing'}</td>
            </tr>
            <tr>
                <td>Container Element</td>
                <td>${notificationContainer ? 'Found' : 'Missing'}</td>
            </tr>
            <tr>
                <td>Badge Count</td>
                <td>${notificationBadge ? notificationBadge.textContent : 'N/A'}</td>
            </tr>
            <tr>
                <td>Badge Display</td>
                <td>${notificationBadge ? notificationBadge.style.display : 'N/A'}</td>
            </tr>
            <tr>
                <td>Notifications Loaded</td>
                <td>${notificationsLoaded ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
                <td>Socket.IO Connected</td>
                <td>${notificationSocket && notificationSocket.connected ? 'Yes' : 'No'}</td>
            </tr>
        </table>
    `;
    debugOutput.appendChild(elementsSection);
    
    // Authentication status
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    const userId = localStorage.getItem('userId') || sessionStorage.getItem('userId');
    
    const authSection = document.createElement('div');
    authSection.innerHTML = `
        <h5 class="mt-3">Authentication</h5>
        <table class="table table-sm">
            <tr>
                <td>Token Available</td>
                <td>${token ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
                <td>Session ID Available</td>
                <td>${sessionId ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
                <td>User ID Available</td>
                <td>${userId ? 'Yes' : 'No'}</td>
            </tr>
        </table>
    `;
    debugOutput.appendChild(authSection);
    
    // Add notifications API test
    const apiTestSection = document.createElement('div');
    apiTestSection.innerHTML = `
        <h5 class="mt-3">API Test</h5>
        <div id="api-test-result">
            <div class="spinner-border spinner-border-sm text-primary" role="status">
                <span class="visually-hidden">Loading...</span>
            </div>
            <span class="ms-2">Testing notifications API...</span>
        </div>
    `;
    debugOutput.appendChild(apiTestSection);
    
    // Add manual refresh button
    const actionsSection = document.createElement('div');
    actionsSection.innerHTML = `
        <h5 class="mt-3">Actions</h5>
        <button id="force-load-btn" class="btn btn-sm btn-success">Force Load Notifications</button>
        <button id="reset-count-btn" class="btn btn-sm btn-warning ms-2">Reset Notification Count</button>
        <button id="test-toast-btn" class="btn btn-sm btn-info ms-2">Test Toast Notification</button>
        <button id="fix-notifications-btn" class="btn btn-sm btn-danger ms-2">Fix Broken Notifications</button>
        <button id="fix-status-btn" class="btn btn-sm btn-danger ms-2">Fix Inconsistent Status</button>
    `;
    debugOutput.appendChild(actionsSection);
    
    // Add to DOM
    document.body.appendChild(debugOutput);
    
    // Add event listeners
    document.getElementById('force-load-btn').addEventListener('click', function() {
        loadNotifications(true);
    });
    
    document.getElementById('reset-count-btn').addEventListener('click', function() {
        if (notificationBadge) {
            notificationBadge.textContent = '0';
            notificationBadge.style.display = 'none';
        }
        notificationCount = 0;
    });
    
    document.getElementById('test-toast-btn').addEventListener('click', function() {
        const testNotification = {
            _id: 'test-' + Date.now(),
            type: 'connection_request',
            data: {
                sender: {
                    full_name: 'Test User'
                }
            },
            message: 'This is a test notification',
            read: false,
            createdAt: new Date()
        };
        showToastNotification(testNotification);
    });
    
    document.getElementById('fix-notifications-btn').addEventListener('click', function() {
        fixNotifications();
    });
    
    document.getElementById('fix-status-btn').addEventListener('click', function() {
        fixInconsistentStatus();
    });
    
    // Perform API test
    const apiResultElement = document.getElementById('api-test-result');
    fetch('/api/notifications', {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token ? `Bearer ${token}` : '',
            'X-Session-ID': sessionId || ''
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`API returned ${response.status} ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('API test successful:', data);
        
        apiResultElement.innerHTML = `
            <div class="alert alert-success py-2">
                <i class="ti ti-check"></i> API returned ${Array.isArray(data) ? data.length : 0} notifications
            </div>
            <div class="mt-2">
                <small class="text-muted">First few notifications:</small>
                <pre style="max-height: 150px; overflow: auto; font-size: 10px;">${JSON.stringify(Array.isArray(data) ? data.slice(0, 3) : data, null, 2)}</pre>
            </div>
        `;
    })
    .catch(error => {
        console.error('API test failed:', error);
        
        apiResultElement.innerHTML = `
            <div class="alert alert-danger py-2">
                <i class="ti ti-alert-triangle"></i> API test failed: ${error.message}
            </div>
        `;
    });
    
    console.log('Debug panel opened');
}

// Fix notifications issue
function fixNotifications() {
    console.log('Running notification fix procedure');
    
    // Reset the notifications system
    notificationsLoaded = false;
    notificationCount = 0;
    
    // Clear any pending timeouts or intervals
    if (notificationCheckInterval) {
        clearInterval(notificationCheckInterval);
    }
    
    // Try to reinitialize
    initNotifications();
    
    // Force reload after a second to ensure reinitialize completed
    setTimeout(() => {
        loadNotifications(true);
    }, 1000);
}

// Fix inconsistent notification status in database
function fixInconsistentStatus() {
    console.log('Fixing inconsistent notification status fields in database');
    
    // Get authentication tokens
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId') || sessionStorage.getItem('sessionId');
    
    if (!token) {
        console.error('Auth token not found, cannot fix notification status');
        alert('Not authenticated. Please log in first.');
        return;
    }
    
    // Show toast to indicate we're fixing
    if (typeof showToast === 'function') {
        showToast('Fixing notification status inconsistencies...', 'info');
    }
    
    // Call the fix-status endpoint
    fetch('/api/notifications/fix-status', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Session-ID': sessionId || ''
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Server returned ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        console.log('Fixed notification statuses:', data);
        
        const fixedCount = data.readFixed + data.unreadFixed + 
            data.missingReadFixed + data.missingStatusFixed;
            
        // Show success message with count
        if (typeof showToast === 'function') {
            if (fixedCount > 0) {
                showToast(`Fixed ${fixedCount} notification status issues`, 'success');
            } else {
                showToast('No notification status issues found', 'info');
            }
        }
        
        // Reload notifications after fixing
        setTimeout(() => {
            loadNotifications(true);
        }, 1000);
    })
    .catch(error => {
        console.error('Error fixing notification statuses:', error);
        
        // Show error
        if (typeof showToast === 'function') {
            showToast(`Error: ${error.message}`, 'error');
        }
    });
}

// Add an accessible debug function
window.testMarkAllRead = function() {
    console.log('Testing mark all read functionality');
    markAllNotificationsAsRead();
};