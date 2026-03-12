const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        default: 'General'
    },
    status: {
        type: String,
        enum: ['pending', 'reviewed', 'implemented', 'closed'],
        default: 'pending'
    },
    adminNotes: {
        type: String
    }
}, { timestamps: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
