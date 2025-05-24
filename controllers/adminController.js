const User = require('../models/User');
const bcrypt = require('bcryptjs');

/**
 * Creates a default admin user if one doesn't exist
 * This should be called when the application starts
 */
const createDefaultAdmin = async () => {
    try {
        // Check if any admin user exists
        const adminExists = await User.findOne({ user_type: 'admin' });
        
        if (!adminExists) {
            console.log('No admin user found. Creating default admin user...');
            
            const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin@123';
            
            // Create a new admin user
            const admin = new User({
                full_name: 'System Administrator',
                username: 'admin',
                email: process.env.DEFAULT_ADMIN_EMAIL || 'admin@blazeapp.com',
                password_hash: password,
                user_type: 'admin',
                verification_status: 'active',
                email_verified: true
            });
            
            await admin.save();
            console.log('Default admin user created successfully.');
        } else {
            console.log('Admin user already exists. Skipping default admin creation.');
        }
    } catch (error) {
        console.error('Error creating default admin user:', error);
    }
};

/**
 * Get admin dashboard stats
 */
const getDashboardStats = async (req, res) => {
    try {
        const totalUsers = await User.countDocuments({ user_type: 'user' });
        const activeUsers = await User.countDocuments({ 
            user_type: 'user', 
            verification_status: 'active' 
        });
        const inactiveUsers = await User.countDocuments({ 
            user_type: 'user', 
            verification_status: 'inactive' 
        });
        
        res.json({
            totalUsers,
            activeUsers,
            inactiveUsers
        });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching admin stats' });
    }
};

module.exports = {
    createDefaultAdmin,
    getDashboardStats
}; 