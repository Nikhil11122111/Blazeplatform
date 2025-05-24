const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ message: 'No authentication token, access denied' });
        }

        // Get session ID from header (used by the client-side JavaScript)
        const headerSessionId = req.header('X-Session-ID');

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find user
        const user = await User.findOne({ _id: decoded.userId });
        
        if (!user) {
            return res.status(401).json({ message: 'User not found' });
        }

        // Check if session is valid - compare with both stored sessionId and header session ID
        // Use case-insensitive comparison to handle potential case issues
        const tokenSessionId = decoded.sessionId?.toLowerCase();
        const userSessionId = user.sessionId?.toLowerCase();
        const headerSessionIdLower = headerSessionId?.toLowerCase();
        
        // Check session validity against either the token's session ID or the header session ID
        const isValidSession = userSessionId && 
            (userSessionId === tokenSessionId || 
             (headerSessionIdLower && userSessionId === headerSessionIdLower));
        
        if (!isValidSession) {
            console.log('Session validation failed:');
            console.log('- User sessionId:', user.sessionId);
            console.log('- Token sessionId:', decoded.sessionId);
            console.log('- Header X-Session-ID:', headerSessionId);
            return res.status(401).json({ message: 'Session expired or invalid' });
        }

        // Check if user is verified
        if (user.verification_status === 'inactive') {
            return res.status(403).json({ message: 'Account not verified' });
        }

        // Add user to request
        req.user = user;
        req.token = token;
        
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        res.status(401).json({ message: 'Token is invalid or expired' });
    }
};

// Middleware to prevent authenticated users from accessing auth routes
const preventAuthAccess = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded.userId });
            
            // Only prevent access if the same user is trying to log in on the same device
            if (user && user.verification_status === 'active') {
                // Use case-insensitive comparison for session IDs
                const userSessionId = user.sessionId?.toLowerCase();
                const tokenSessionId = decoded.sessionId?.toLowerCase();
                
                if (userSessionId === tokenSessionId) {
                    // Check if this is a login attempt
                    if (req.path === '/login' && req.method === 'POST') {
                        // Allow login attempts to proceed
                        next();
                        return;
                    }
                    return res.status(403).json({ 
                        message: 'You are already logged in. Please logout first.' 
                    });
                }
            }
        }
        
        next();
    } catch (error) {
        next();
    }
};

module.exports = { auth, preventAuthAccess }; 