// API Configuration
// Update this URL when your backend is deployed
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001' 
    : 'https://your-backend-name.onrender.com'; // TODO: Replace with your deployed backend URL

// For now, since backend is not deployed, use a placeholder
// This will need to be updated once you deploy your backend
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