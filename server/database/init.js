const mongoose = require('mongoose');

async function initializeDatabase() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect('mongodb://localhost:27017/blaze', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB successfully');

        const UserPreference = require('../models/UserPreference');
        
        // Update all existing users to have light theme if not set
        const result = await UserPreference.updateMany(
            { 
                $or: [
                    { theme: { $exists: false } },
                    { theme: "" },
                    { theme: null }
                ]
            },
            { 
                $set: { 
                    theme: 'light',
                    is_default: true
                }
            }
        );
        
        console.log(`Updated ${result.nModified} users to have light theme`);

        // Test the connection with a simple operation
        const testUserId = 'test_user_' + Date.now();
        
        // Test create
        const testPreference = await UserPreference.create({
            user_id: testUserId,
            theme: 'light',
            is_default: true
        });
        console.log('Test create successful:', testPreference);

        // Test find
        const foundPreference = await UserPreference.findOne({ user_id: testUserId });
        console.log('Test find successful:', foundPreference);

        // Clean up test data
        await UserPreference.deleteOne({ user_id: testUserId });
        console.log('Test data cleaned up');

        console.log('Database initialization completed successfully');
    } catch (error) {
        console.error('Error during database initialization:', error);
        throw error;
    }
}

module.exports = initializeDatabase; 