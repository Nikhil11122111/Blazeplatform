const express = require('express');
const router = express.Router();
const UserPreference = require('../models/UserPreference');

// Save user theme preference
router.post('/theme', async (req, res) => {
    try {
        const { userId, theme } = req.body;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        // Validate theme value
        if (theme && !['light', 'dark'].includes(theme)) {
            return res.status(400).json({ error: 'Invalid theme value. Must be either "light" or "dark"' });
        }

        // Find existing preference or create new one
        let preference = await UserPreference.findOne({ user_id: userId });

        if (!preference) {
            // Create new preference with default light theme
            preference = await UserPreference.create({
                user_id: userId,
                theme: 'light',
                is_default: true
            });
        } else if (!preference.theme || preference.theme === '') {
            // Update existing preference if theme is empty
            preference = await UserPreference.findOneAndUpdate(
                { user_id: userId },
                { 
                    theme: 'light',
                    is_default: true
                },
                { new: true }
            );
        }

        // Only update if theme is provided and different from current
        if (theme && preference.theme !== theme) {
            preference = await UserPreference.findOneAndUpdate(
                { user_id: userId },
                { 
                    theme: theme,
                    is_default: false
                },
                { new: true }
            );
        }

        res.json({ 
            success: true, 
            preference,
            message: preference.is_default ? 'Using default light theme' : 'Theme updated successfully'
        });
    } catch (error) {
        console.error('Error saving theme preference:', error);
        res.status(500).json({ error: 'Failed to save theme preference' });
    }
});

// Get user theme preference
router.get('/theme/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        let preference = await UserPreference.findOne({ user_id: userId });

        if (!preference) {
            // Create new preference with default light theme
            preference = await UserPreference.create({
                user_id: userId,
                theme: 'light',
                is_default: true
            });
        } else if (!preference.theme || preference.theme === '') {
            // Update existing preference if theme is empty
            preference = await UserPreference.findOneAndUpdate(
                { user_id: userId },
                { 
                    theme: 'light',
                    is_default: true
                },
                { new: true }
            );
        }

        res.json({ 
            theme: preference.theme,
            is_default: preference.is_default,
            message: preference.is_default ? 'Using default light theme' : 'Using user preference'
        });
    } catch (error) {
        console.error('Error getting theme preference:', error);
        res.status(500).json({ error: 'Failed to get theme preference' });
    }
});

// Reset user theme to default
router.post('/theme/:userId/reset', async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const preference = await UserPreference.findOneAndUpdate(
            { user_id: userId },
            { 
                theme: 'light',
                is_default: true
            },
            { 
                new: true,
                upsert: true
            }
        );

        res.json({ 
            success: true, 
            preference,
            message: 'Theme reset to default light theme'
        });
    } catch (error) {
        console.error('Error resetting theme preference:', error);
        res.status(500).json({ error: 'Failed to reset theme preference' });
    }
});

module.exports = router; 