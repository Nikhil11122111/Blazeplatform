const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { auth } = require('./middleware/auth');
const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Notification = require('./models/Notification');
const fs = require('fs');
const socketHandler = require('./socket');
const cookieParser = require('cookie-parser');

// Load environment variables
dotenv.config();

// Verify environment variables
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'Set' : 'Not Set');
console.log('MONGODB_URI:', process.env.MONGODB_URI ? 'Set' : 'Not Set');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: [
      'https://blaze-266099623138.asia-east1.run.app',
      'http://localhost:3000',
      'http://https://blaze-266099623138.asia-east1.run.app'
    ],
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
  }
});

// Initialize socket handlers
socketHandler(io);

// Make io accessible to routes
app.set('io', io);

// Middleware
// Configure CORS to accept requests from the deployed frontend
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://blaze-266099623138.asia-east1.run.app',
      'http://localhost:3000',
      'http://https://blaze-266099623138.asia-east1.run.app'
    ];
    
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id'],
  exposedHeaders: ['set-cookie']
};

app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add CSP middleware
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://*.onrender.com;"
  );
  next();
});

// Add root route handler to redirect to login BEFORE static middleware
app.get('/', (req, res) => {
    console.log('Root route accessed, redirecting to login');
    return res.redirect('/login');
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res, path) => {
    // Set Cache-Control header for better performance
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    // Set proper Content-Type for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    } else if (path.endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
    }
  }
}));

// Special handling for profile_pics folder (without the uploads prefix)
// This addresses paths like /profile_pics/[userId]/filename.jpg
app.use('/profile_pics', express.static(path.join(__dirname, 'uploads', 'profile_pics'), {
  setHeaders: (res, path) => {
    // No caching for profile pics to ensure latest image is always shown
    res.setHeader('Cache-Control', 'no-cache');
    console.log('Serving profile pic directly from:', path);
    
    // Set proper Content-Type for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (path.endsWith('.gif')) {
      res.setHeader('Content-Type', 'image/gif');
    } else if (path.endsWith('.webp')) {
      res.setHeader('Content-Type', 'image/webp');
    }
  }
}));

// Log all requests to /uploads directory
app.use('/uploads', (req, res, next) => {
  console.log('Upload request path:', req.path);
  next();
});

// Add an additional route to handle legacy paths for profile pictures
app.get('/profile_pics/:userId/:filename', (req, res) => {
  const { userId, filename } = req.params;
  const filePath = path.join(__dirname, 'uploads', 'profile_pics', userId, filename);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } else {
    // Try alternate path structures
    const alternatePath = path.join(__dirname, 'uploads', 'profile_pics', filename);
    if (fs.existsSync(alternatePath)) {
      return res.sendFile(alternatePath);
    }
    
    // Try one more structure (without profile_pics folder)
    const directPath = path.join(__dirname, 'uploads', userId, filename);
    if (fs.existsSync(directPath)) {
      return res.sendFile(directPath);
    }
    
    console.log(`Profile picture not found: ${filePath}`);
    return res.status(404).sendFile(path.join(__dirname, 'public', 'assets', 'images', 'user', 'blank-avatar.png'));
  }
});

// Add a route to handle double path issues where profile_pics appears twice in URL
app.get('/profile_pics/:userId/profile_pics/:userId2/:filename', (req, res) => {
  const { userId, userId2, filename } = req.params;
  
  // Use the last userId in the path
  const effectiveUserId = userId2 || userId;
  const filePath = path.join(__dirname, 'uploads', 'profile_pics', effectiveUserId, filename);
  
  // Check if file exists
  if (fs.existsSync(filePath)) {
    return res.sendFile(filePath);
  } else {
    console.log(`Profile picture not found: ${filePath}`);
    return res.status(404).sendFile(path.join(__dirname, 'public', 'assets', 'images', 'user', 'blank-avatar.png'));
  }
});

// Route handlers for main pages without .html extension
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'register.html'));
});

app.get('/forgot-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'forgot-password.html'));
});

app.get('/reset-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'reset-password.html'));
});

app.get('/verify-email-success', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify-email-success.html'));
});

app.get('/verify-otp', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'verify-otp.html'));
});

// Route handlers for protected pages without .html extension
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'profile.html'));
});

app.get('/change-password', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'change-password.html'));
});

app.get('/magic-suggest', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'magic-suggest.html'));
});

app.get('/connections', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'connections.html'));
});

app.get('/messages', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'messages.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'settings.html'));
});

app.get('/notifications', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'notifications.html'));
});

app.get('/search', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'search.html'));
});

app.get('/matches', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'matches.html'));
});

app.get('/chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Middleware to protect HTML pages
app.use(async (req, res, next) => {
    const url = req.url;
    const protectedPages = [
        '/dashboard.html', '/dashboard',
        '/profile.html', '/profile',
        '/change-password.html', '/change-password',
        '/magic-suggest.html', '/magic-suggest',
        '/connections.html', '/connections',
        '/messages.html', '/messages',
        '/settings.html', '/settings',
        '/notifications.html', '/notifications',
        '/search.html', '/search',
        '/matches.html', '/matches',
        '/chat.html', '/chat',
        '/admin-panel.html', '/admin-panel'
    ];

    const authPages = [
        '/login.html', '/login',
        '/register.html', '/register',
        '/forgot-password.html', '/forgot-password',
        '/reset-password.html', '/reset-password',
        '/verify-email.html', '/verify-email',
        '/verify-email-success.html', '/verify-email-success',
        '/admin-login.html', '/admin-login'
    ];

    // Check if the request is for a protected page
    if (protectedPages.includes(url)) {
        // Try to get token from cookies, headers or query params
        const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '') || req.query.token;
        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'] || req.query.sessionId;
        
        console.log('Auth Check for:', url);
        console.log('Token:', token ? 'Present' : 'Missing');
        console.log('SessionId:', sessionId ? 'Present' : 'Missing');
        
        if (!token || !sessionId) {
            // Clear any existing cookies
            res.clearCookie('token');
            res.clearCookie('sessionId');
            
            // Check if this is admin panel
            if (url.includes('admin')) {
                console.log('Redirecting to admin login - no credentials');
                return res.redirect('/admin-login');
            }
            return res.redirect('/login');
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Verify session with database
            const user = await User.findOne({ _id: decoded.userId });
            if (!user) {
                console.log('User not found');
                res.clearCookie('token');
                res.clearCookie('sessionId');
                if (url.includes('admin')) {
                    return res.redirect('/admin-login');
                }
                return res.redirect('/login');
            }
            
            // Compare session IDs case-insensitively
            const userSessionId = user.sessionId?.toLowerCase();
            const requestSessionId = sessionId?.toLowerCase();
            
            if (userSessionId !== requestSessionId) {
                console.log('Session mismatch:');
                console.log('- User sessionId:', user.sessionId);
                console.log('- Request sessionId:', sessionId);
                
                res.clearCookie('token');
                res.clearCookie('sessionId');
                if (url.includes('admin')) {
                    return res.redirect('/admin-login');
                }
                return res.redirect('/login');
            }
            
            // If accessing admin panel, check if user is admin
            if (url.includes('admin') && user.user_type !== 'admin') {
                console.log('Access denied - not admin');
                return res.status(403).send('Access denied. Admin privileges required.');
            }
            
            console.log('User authenticated successfully:', user.username);
            req.user = user;
            next();
        } catch (error) {
            console.error('Auth error:', error.message);
            res.clearCookie('token');
            res.clearCookie('sessionId');
            if (url.includes('admin')) {
                return res.redirect('/admin-login');
            }
            return res.redirect('/login');
        }
    }
    // Check if the request is for an auth page
    else if (authPages.includes(url)) {
        // Try to get token from cookies, headers or query params
        const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
        const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
        
        console.log('Auth page access check:', url);
        console.log('- Token:', token ? 'Present' : 'Missing');
        console.log('- SessionId:', sessionId ? 'Present' : 'Missing');
        
        if (token && sessionId) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                
                // Verify session with database
                const user = await User.findOne({ _id: decoded.userId });
                if (!user) {
                    console.log('User not found');
                    res.clearCookie('token');
                    res.clearCookie('sessionId');
                    return next();
                }
                
                // Compare session IDs case-insensitively
                const userSessionId = user.sessionId?.toLowerCase();
                const requestSessionId = sessionId?.toLowerCase();
                
                if (userSessionId === requestSessionId) {
                    console.log('User already logged in:', user.username);
                    // If admin login and user is admin, redirect to admin panel
                    if (url.includes('admin-login') && user.user_type === 'admin') {
                        console.log('Redirecting to admin panel');
                        return res.redirect('/admin-panel');
                    }
                    // Otherwise redirect to dashboard
                    return res.redirect('/dashboard');
                }
            } catch (error) {
                console.error('Auth error:', error.message);
                // Invalid token, clear cookies and allow access to auth page
                res.clearCookie('token');
                res.clearCookie('sessionId');
            }
        }
        next();
    } else {
        next();
    }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/blaze', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => {
  console.log('Connected to MongoDB');
  
  // Create default admin user
  const { createDefaultAdmin } = require('./controllers/adminController');
  createDefaultAdmin();
})
.catch(err => console.error('MongoDB connection error:', err));

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const matchesRoutes = require('./routes/matches');
const chatRoutes = require('./routes/chat');
const profileRoutes = require('./routes/profile');
const connectionRoutes = require('./routes/connections');
const notificationsRoutes = require('./routes/notifications');
const preferencesRoutes = require('./routes/preferences');
const adminRoutes = require('./routes/admin');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/matches', matchesRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/user/preferences', preferencesRoutes);
app.use('/admin', adminRoutes);

// Direct route for email verification
app.get('/verify-email', (req, res) => {
  const token = req.query.token;
  if (!token) {
    return res.status(400).send('Verification token is required');
  }
  res.redirect(`/api/auth/verify-email?token=${token}`);
});

// Add routes to check if a profile picture exists and return the correct path
app.get('/api/profile-picture-check', async (req, res) => {
  const { userId, filePath } = req.query;
  
  if (!userId || !filePath) {
    return res.status(400).json({ error: 'Missing userId or filePath' });
  }
  
  // Try different possible paths
  const possiblePaths = [
    path.join(__dirname, 'uploads', 'profile_pics', userId, filePath),
    path.join(__dirname, 'uploads', 'profile_pics', filePath),
    path.join(__dirname, 'uploads', userId, filePath),
    path.join(__dirname, 'uploads', filePath)
  ];
  
  for (const tryPath of possiblePaths) {
    if (fs.existsSync(tryPath)) {
      return res.json({ exists: true, path: tryPath.replace(__dirname, '').replace(/\\/g, '/') });
    }
  }
  
  // If no path works, return the default avatar
  return res.json({ exists: false, path: '/assets/images/user/blank-avatar.png' });
});

// Debug route to show all uploads directories
app.get('/debug/uploads', (req, res) => {
  const uploadsPath = path.join(__dirname, 'uploads');
  
  // Check if uploads directory exists
  if (!fs.existsSync(uploadsPath)) {
    return res.json({ error: 'Uploads directory does not exist' });
  }
  
  // List all directories in uploads
  const dirs = fs.readdirSync(uploadsPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);
  
  // Get profile_pics directories if exists
  let profilePicsDirs = [];
  const profilePicsPath = path.join(uploadsPath, 'profile_pics');
  
  if (fs.existsSync(profilePicsPath)) {
    profilePicsDirs = fs.readdirSync(profilePicsPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => `profile_pics/${dirent.name}`);
  }
  
  res.json({
    uploadsRoot: dirs,
    profilePics: profilePicsDirs
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// Debug route to show all registered routes
app.get('/debug/routes', (req, res) => {
    console.log('Accessed debug routes endpoint');
    const routes = [];
    
    // Get all registered routes
    app._router.stack.forEach((middleware) => {
        if (middleware.route) {
            // Routes registered directly on the app
            routes.push({
                path: middleware.route.path,
                methods: Object.keys(middleware.route.methods)
            });
        } else if (middleware.name === 'router') {
            // Router middleware
            middleware.handle.stack.forEach((handler) => {
                if (handler.route) {
                    const path = handler.route.path;
                    const basePath = middleware.regexp.toString()
                                    .replace('\\^', '')
                                    .replace('\\/?(?=\\/|$)', '')
                                    .replace(/\\\//g, '/');
                    
                    let fullPath = basePath;
                    if (fullPath.endsWith('/$')) {
                        fullPath = fullPath.slice(0, -2);
                    }
                    if (fullPath !== '/' && path !== '/') {
                        fullPath += path;
                    } else if (path !== '/') {
                        fullPath = path;
                    }
                    
                    routes.push({
                        path: fullPath,
                        methods: Object.keys(handler.route.methods)
                    });
                }
            });
        }
    });
    
    res.json({ routes });
});

// Update the server start code to only use port 5001
const PORT = 5001; // Fixed port 5001 only
let activePort = null; // Store the active port for use in the app

// Function to start server with only port 5001
function startServer(port) {
  // Only use port 5001
  port = 5001;
  
  console.log('Attempting to start server on fixed port 5001...');
  
  server.listen(port, () => {
    activePort = port; // Store the active port
    console.log(`Server running on port ${port}`);
    console.log(`Visit http://localhost:${port} in your browser`);
    
    // Make the port available to the rest of the app
    app.set('port', activePort);
    
    // Add a route to expose the active port to clients
    app.get('/api/server-info', (req, res) => {
      res.json({
        port: activePort,
        host: req.hostname,
        protocol: req.protocol
      });
    });
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error('ERROR: Port 5001 is already in use. Please stop any other instances of the server first.');
      process.exit(1); // Exit with error
    } else if (err.code === 'ERR_SERVER_ALREADY_LISTEN') {
      console.error('ERROR: Server is already listening. This is likely a bug in the server code.');
      process.exit(1); // Exit with error
    } else {
      console.error('Server error:', err);
      process.exit(1); // Exit with error
    }
  });
}

// Start the server with fallback
startServer(PORT); 

// Add admin page route
app.get('/admin-login', async (req, res) => {
    // Check if user is already logged in as admin
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');
    const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
    
    if (token && sessionId) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            const user = await User.findOne({ _id: decoded.userId });
            
            // If logged-in user is admin, redirect to admin panel
            if (user && user.user_type === 'admin') {
                const userSessionId = user.sessionId?.toLowerCase();
                const requestSessionId = sessionId?.toLowerCase();
                
                if (userSessionId === requestSessionId) {
                    console.log('Admin already logged in, redirecting to admin panel');
                    return res.redirect('/admin-panel');
                }
            }
        } catch (error) {
            console.error('Token verification error:', error.message);
            // Clear any invalid cookies
            res.clearCookie('token');
            res.clearCookie('sessionId');
        }
    }
    
    // Not logged in, serve the login page
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/admin-panel', (req, res) => {
    // This route will be protected by the isAdmin middleware in admin.js
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Add admin login test page
app.get('/admin-login-test', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login-test.html'));
}); 