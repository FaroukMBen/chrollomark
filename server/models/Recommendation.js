const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
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
        message: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    {
        timestamps: true,
    }
);

// A user can only recommend a story once
recommendationSchema.index({ user: 1, story: 1 }, { unique: true });

module.exports = mongoose.model('Recommendation', recommendationSchema);
