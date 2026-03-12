const mongoose = require('mongoose');
const ReadingProgress = require('./ReadingProgress');
const Review = require('./Review');
const Collection = require('./Collection');

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
            enum: ['Manga', 'Webtoon'],
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
        views: {
            type: Number,
            default: 0,
        },
        viewedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        mangadexId: { //in the futur we will compare using the title itself, for now and because it is esier :) we will do it using the mangadex id
            type: String,
            default: null,
            index: true,
        },
        year: {
            type: Number,
            default: null,
        },
        contentRating: {
            type: String,
            enum: ['safe', 'suggestive', 'erotica', 'pornographic'],
            default: 'safe',
        },
        likes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        dislikes: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User',
            }
        ],
        popularityScore: {
            type: Number,
            default: 0,
            index: true,
        },
    },
    {
        timestamps: true,
    }
);

// Text index for search
storySchema.index({ title: 'text', description: 'text', author: 'text' });

// Centralized Popularity Logic
storySchema.statics.getPopularityFormula = function () {
    return {
        VIEW: 2,
        LIKE: 3,
        DISLIKE: -3,
        READER: 3,
        COLLECTION: 5
    };
};

// Deep recalculation for a story
storySchema.methods.calculatePopularity = async function () {
    const formula = this.constructor.getPopularityFormula();

    // 1. Unique Views (from viewedBy array)
    const viewPoints = (this.viewedBy?.length || 0) * formula.VIEW;

    // 2. Reviews (Linear weighted: start -2, +2 per star)
    // 1★ = -2, 2★ = 0, 3★ = 2, 4★ = 4, 5★ = 6 -- at least for the moment :)
    const reviews = await mongoose.model('Review').find({ story: this._id });
    const reviewPoints = reviews.reduce((sum, r) => {
        return sum + (r.rating - 2) * 2;
    }, 0);
    const reviewCount = reviews.length;

    // 3. Readers (+3 each)
    const readerCount = await mongoose.model('ReadingProgress').countDocuments({ story: this._id });
    const readerPoints = readerCount * formula.READER;

    // 4. Collection (+5 once per user)
    const collectionUsers = await mongoose.model('Collection').distinct('user', { stories: this._id });
    const collectionPoints = collectionUsers.length * formula.COLLECTION;

    // 5. Likes and Dislikes
    const likePoints = (this.likes?.length || 0) * formula.LIKE;
    const dislikePoints = (this.dislikes?.length || 0) * formula.DISLIKE;

    this.popularityScore = viewPoints + reviewPoints + readerPoints + collectionPoints + likePoints + dislikePoints;
    this.totalReviews = reviewCount;
    this.totalReaders = readerCount;
    this.views = this.viewedBy?.length || 0; // Sync view count to unique users too

    return this.save();
};

module.exports = mongoose.model('Story', storySchema);
