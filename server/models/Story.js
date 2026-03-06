const mongoose = require('mongoose');

const storySchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
            maxlength: [200, 'Title cannot exceed 200 characters'],
        },
        coverImage: {
            type: String,
            default: '',
        },
        description: {
            type: String,
            maxlength: [2000, 'Description cannot exceed 2000 characters'],
            default: '',
        },
        type: {
            type: String,
            enum: ['Manga', 'Webtoon', 'Manhwa', 'Manhua', 'Light Novel', 'Other'],
            default: 'Manga',
        },
        genres: [
            {
                type: String,
                trim: true,
            },
        ],
        author: {
            type: String,
            trim: true,
            default: 'Unknown',
        },
        status: {
            type: String,
            enum: ['Ongoing', 'Completed', 'Hiatus', 'Cancelled'],
            default: 'Ongoing',
        },
        totalChapters: {
            type: Number,
            default: null,
        },
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5,
        },
        totalReviews: {
            type: Number,
            default: 0,
        },
        totalReaders: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Text index for search
storySchema.index({ title: 'text', description: 'text', author: 'text' });

module.exports = mongoose.model('Story', storySchema);
