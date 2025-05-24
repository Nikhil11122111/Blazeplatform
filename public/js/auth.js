// Authentication utility functions

// Check if user is authenticated
async function checkAuth() {
    const token = localStorage.getItem('token');
    const sessionId = localStorage.getItem('sessionId');
    const currentPage = window.location.pathname.split('/').pop();
    
    // If we're on an auth page and have valid credentials, redirect to dashboard
    if (isAuthPage(currentPage) && token && sessionId) {
        try {
        const response = await fetch('https://blazeplatform.onrender.com/api/auth/me', {
            method: 'GET',
            headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Session-ID': sessionId
            }
        });

        if (response.ok) {
                window.location.href = 'dashboard.html';
            return true;
        }
    } catch (error) {
            console.error('Error checking auth status:', error);
        }
    }

    // If we're on a protected page without auth, redirect to login
    if (isProtectedPage(currentPage) && (!token || !sessionId)) {
        localStorage.clear();
            window.location.href = 'login.html';
        return false;
    }

    return true;
}

// Check if current page is an auth page
function isAuthPage(page) {
    const authPages = [
        'login.html',
        'register.html',
        'forgot-password.html',
        'reset-password.html',
        'verify-email.html',
        'verify-email-success.html'
    ];
    return authPages.includes(page);
}

// Check if current page is a protected page
function isProtectedPage(page) {
    const protectedPages = [
        'dashboard.html',
        'profile.html',
        'change-password.html',
        'magic-suggest.html',
        'connections.html',
        'messages.html',
        'settings.html',
        'notifications.html',
        'search.html',
        'matches.html',
        'chat.html'
    ];
    return protectedPages.includes(page);
}

// Logout function
async function logout() {
    try {
        const token = localStorage.getItem('token');
        const sessionId = localStorage.getItem('sessionId');
        
        if (token && sessionId) {
        await fetch('https://blazeplatform.onrender.com/api/auth/logout', {
            method: 'POST',
            headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Session-ID': sessionId
            }
        });
        }
        
        // Clear all stored data
        localStorage.clear();
        
        // Redirect to login page
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Error during logout:', error);
        // Still clear local storage and redirect even if logout fails
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// Run auth check immediately when script loads
checkAuth();

// Also run on DOMContentLoaded for additional safety
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
}); 

// Listen for route changes
window.addEventListener('popstate', function() {
    checkAuth();
});

// Override pushState to detect route changes
const originalPushState = history.pushState;
history.pushState = function() {
    originalPushState.apply(history, arguments);
    checkAuth();
}; 