const mongoose = require('mongoose');

const bugReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: [{
        type: String
    }],
    deviceInfo: {
        type: String
    },
    status: {
        type: String,
        enum: ['pending', 'reproduced', 'fixed', 'closed'],
        default: 'pending'
    }
}, { timestamps: true });

module.exports = mongoose.model('BugReport', bugReportSchema);
