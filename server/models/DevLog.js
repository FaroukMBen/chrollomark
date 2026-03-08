const mongoose = require('mongoose');

const devLogSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['small update', 'patch notes', 'news', 'regular update', 'planning for next update'],
        required: true
    },
    date: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('DevLog', devLogSchema);
