const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
        rating: {
            type: Number,
            required: [true, 'Rating is required'],
            min: 1,
            max: 5,
        },
        title: {
            type: String,
            maxlength: [100, 'Review title cannot exceed 100 characters'],
            default: '',
        },
        text: {
            type: String,
            maxlength: [2000, 'Review cannot exceed 2000 characters'],
            default: '',
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            },
        ],
        spoiler: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// One review per user per story
reviewSchema.index({ user: 1, story: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
