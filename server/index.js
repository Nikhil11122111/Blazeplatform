const express = require('express');
const cors = require('cors');
const initializeDatabase = require('./database/init');
const userPreferencesRouter = require('./routes/userPreferences');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// Initialize database
console.log('Starting MongoDB initialization...');
initializeDatabase()
    .then(() => {
        console.log('MongoDB initialization complete');
    })
    .catch(error => {
        console.error('MongoDB initialization failed:', error);
        process.exit(1);
    });

// Routes
app.use('/api/user/preferences', userPreferencesRouter);

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check available at http://localhost:${PORT}/health`);
    console.log(`API endpoints available at http://localhost:${PORT}/api/user/preferences`);
}); 