// API Configuration
// Since your backend is not deployed yet, you have two options:
// Option 1: Deploy your backend first, then update the URL below
// Option 2: For testing, temporarily allow localhost (not recommended for production)

// IMPORTANT: Replace 'your-backend-name' with your actual backend URL once deployed
const API_BASE_URL = 'https://blaze-266099623138.asia-east1.run.app'; // TODO: Replace with your deployed backend URL

// Temporary fallback for development (uncomment the line below if testing locally)
// const API_BASE_URL = window.location.hostname === 'localhost' ? 'http://https://blaze-266099623138.asia-east1.run.app' : 'https://your-backend-name.onrender.com';

const API_CONFIG = {
    baseUrl: API_BASE_URL,
    endpoints: {
        // Auth endpoints
        login: `${API_BASE_URL}/api/auth/login`,
        register: `${API_BASE_URL}/api/auth/register`,
        logout: `${API_BASE_URL}/api/auth/logout`,
        me: `${API_BASE_URL}/api/auth/me`,
        forgotPassword: `${API_BASE_URL}/api/auth/forgot-password`,
        resetPassword: `${API_BASE_URL}/api/auth/reset-password`,
        verifyEmail: `${API_BASE_URL}/api/auth/verify-email`,
        
        // Add other endpoints as needed
    }
};

// Export for use in other files
window.API_CONFIG = API_CONFIG; 