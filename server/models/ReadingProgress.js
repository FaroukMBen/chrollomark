const mongoose = require('mongoose');

const readingProgressSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        story: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Story',
            required: true,
        },
        currentChapter: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        status: {
            type: String,
            enum: ['Reading', 'Completed', 'Plan to Read', 'On Hold', 'Dropped'],
            default: 'Plan to Read',
        },
        startDate: {
            type: Date,
            default: null,
        },
        completedDate: {
            type: Date,
            default: null,
        },
        lastReadDate: {
            type: Date,
            default: Date.now,
        },
        notes: {
            type: String,
            maxlength: [500, 'Notes cannot exceed 500 characters'],
            default: '',
        },
        isFavorite: {
            type: Boolean,
            default: false,
        },
        rating: {
            type: Number,
            min: 0,
            max: 5,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index: one progress entry per user per story
readingProgressSchema.index({ user: 1, story: 1 }, { unique: true });

module.exports = mongoose.model('ReadingProgress', readingProgressSchema);
