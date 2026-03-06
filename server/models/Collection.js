const mongoose = require('mongoose');

const collectionSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        name: {
            type: String,
            required: [true, 'Collection name is required'],
            trim: true,
            maxlength: [100, 'Collection name cannot exceed 100 characters'],
        },
        description: {
            type: String,
            maxlength: [500, 'Description cannot exceed 500 characters'],
            default: '',
        },
        coverImage: {
            type: String,
            default: '',
        },
        stories: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Story',
            },
        ],
        isPublic: {
            type: Boolean,
            default: false,
        },
        color: {
            type: String,
            default: '#7C3AED',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Collection', collectionSchema);
