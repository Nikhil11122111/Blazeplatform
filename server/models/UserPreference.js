const mongoose = require('mongoose');

const userPreferenceSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    theme: {
        type: String,
        enum: ['light', 'dark'],
        default: 'light',
        required: true
    },
    is_default: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true // This will automatically add createdAt and updatedAt fields
});

// Create the model
const UserPreference = mongoose.model('UserPreference', userPreferenceSchema);

module.exports = UserPreference; 