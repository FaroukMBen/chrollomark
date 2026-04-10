const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
        title: {
            type: String,
            required: [true, 'Title is required'],
            trim: true,
        },
        url: {
            type: String,
            required: [true, 'URL is required'],
            trim: true,
        },
        icon: {
            type: String,
            default: '',
        },
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model('Bookmark', bookmarkSchema);
