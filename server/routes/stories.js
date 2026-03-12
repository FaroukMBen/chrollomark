const express = require('express');
const Story = require('../models/Story');
const ReadingProgress = require('../models/ReadingProgress');
const Review = require('../models/Review');
const Recommendation = require('../models/Recommendation');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @route   POST /api/stories
// @desc    Create a new story
router.post('/', [auth, upload.single('coverImage')], async (req, res) => {
    try {
        const { title, description, type, genres, author, status, totalChapters, contentRating, year } = req.body;

        let coverImageUrl = req.body.coverImage; // Allow string URL fallback
        if (req.file) {
            coverImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        const story = new Story({
            title,
            coverImage: coverImageUrl,
            description,
            type,
            genres,
            author,
            status,
            totalChapters,
            contentRating: contentRating || 'safe',
            year: year || null,
            addedBy: req.user._id,
        });

        await story.save();
        await story.populate('addedBy', 'username avatar');

        res.status(201).json(story);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/stories
// @desc    Get all stories (with pagination, search, filters)
router.get('/', auth, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, type, genre, contentRating, sort = '-createdAt' } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
            ];
        }
        if (type) query.type = type;
        if (genre) query.genres = { $in: [genre] };
        if (contentRating) {
            query.contentRating = { $in: contentRating.split(',') };
        }

        const stories = await Story.find(query)
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .populate('addedBy', 'username avatar');

        const total = await Story.countDocuments(query);

        res.json({
            stories,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/stories/:id
// @desc    Get a single story
router.get('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id).populate('addedBy', 'username avatar');

        if (!story) {
            return res.status(404).json({ message: 'Story not found' });
        }

        // Increment views
        story.views += 1;
        await story.save();

        // Get user's progress for this story
        const progress = await ReadingProgress.findOne({
            user: req.user._id,
            story: story._id,
        });

        // Get reviews
        const reviews = await Review.find({ story: story._id })
            .populate('user', 'username avatar')
            .sort('-createdAt')
            .limit(10);

        // Check if recommended by current user
        const isRecommended = await Recommendation.exists({
            user: req.user._id,
            story: story._id,
        });

        // Get friends' progress for this story
        const friendsProgress = await ReadingProgress.find({
            user: { $in: req.user.friends },
            story: story._id,
        }).populate('user', 'username avatar');

        res.json({
            story,
            userProgress: progress,
            friendsProgress,
            reviews,
            isRecommended: !!isRecommended,
            likesCount: story.likes?.length || 0,
            dislikesCount: story.dislikes?.length || 0,
            isLiked: story.likes?.some(id => id.toString() === req.user._id.toString()),
            isDisliked: story.dislikes?.some(id => id.toString() === req.user._id.toString()),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/stories/:id
// @desc    Update a story
router.put('/:id', [auth, upload.single('coverImage')], async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        // Only the creator or admin can update
        if (story.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to update this story' });
        }
        const { title, description, type, genres, author, status, totalChapters } = req.body;

        let coverImageUrl = req.body.coverImage;
        if (req.file) {
            coverImageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        if (title) story.title = title;
        if (coverImageUrl !== undefined) story.coverImage = coverImageUrl;
        if (description !== undefined) story.description = description;
        if (type) story.type = type;
        if (genres) story.genres = genres;
        if (author) story.author = author;
        if (status) story.status = status;
        if (totalChapters !== undefined) story.totalChapters = totalChapters;
        if (req.body.contentRating !== undefined) story.contentRating = req.body.contentRating;
        if (req.body.year !== undefined) story.year = req.body.year;

        await story.save();
        await story.populate('addedBy', 'username avatar');

        res.json(story);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/stories/:id/like
// @desc    Toggle like for a story
router.post('/:id/like', auth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        const userId = req.user._id.toString();
        const isLiked = story.likes.some(id => id.toString() === userId);
        const isDisliked = story.dislikes.some(id => id.toString() === userId);

        if (isLiked) {
            story.likes = story.likes.filter((id) => id.toString() !== userId);
        } else {
            story.likes.push(req.user._id);
            // If it was disliked, remove it
            if (isDisliked) {
                story.dislikes = story.dislikes.filter((id) => id.toString() !== userId);
            }
        }

        await story.save();
        res.json({ isLiked: !isLiked, isDisliked: false, likesCount: story.likes.length, dislikesCount: story.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/stories/:id/dislike
// @desc    Toggle dislike for a story
router.post('/:id/dislike', auth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        const userId = req.user._id.toString();
        const isLiked = story.likes.some(id => id.toString() === userId);
        const isDisliked = story.dislikes.some(id => id.toString() === userId);

        if (isDisliked) {
            story.dislikes = story.dislikes.filter((id) => id.toString() !== userId);
        } else {
            story.dislikes.push(req.user._id);
            // If it was liked, remove it
            if (isLiked) {
                story.likes = story.likes.filter((id) => id.toString() !== userId);
            }
        }

        await story.save();
        res.json({ isLiked: false, isDisliked: !isDisliked, likesCount: story.likes.length, dislikesCount: story.dislikes.length });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/stories/:id
// @desc    Delete a story (only creator)
router.delete('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        if (story.addedBy.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Not authorized to delete this story' });
        }

        // Clean up related data
        await ReadingProgress.deleteMany({ story: story._id });
        await Review.deleteMany({ story: story._id });
        await story.deleteOne();

        res.json({ message: 'Story deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});
// @route   POST /api/stories/clone-mangadex
// @desc    Clone a manga from MangaDex into local DB (or update if exists)
router.post('/clone-mangadex', auth, async (req, res) => {
    try {
        const { mangadexId, title, description, coverImage, author, status, totalChapters, genres, year, contentRating } = req.body;

        if (!mangadexId || !title) {
            return res.status(400).json({ message: 'mangadexId and title are required' });
        }

        // Map MangaDex status to our status format
        const statusMap = { ongoing: 'Ongoing', completed: 'Completed', hiatus: 'Hiatus', cancelled: 'Cancelled' };
        const mappedStatus = statusMap[status] || 'Ongoing';

        // Check if already exists
        let story = await Story.findOne({ mangadexId });

        if (story) {
            // Update fields that may have changed
            let updated = false;
            if (totalChapters && totalChapters !== story.totalChapters) {
                story.totalChapters = totalChapters;
                updated = true;
            }
            if (mappedStatus !== story.status) {
                story.status = mappedStatus;
                updated = true;
            }
            if (coverImage && coverImage !== story.coverImage) {
                story.coverImage = coverImage;
                updated = true;
            }
            if (description && description !== story.description) {
                story.description = description;
                updated = true;
            }
            if (updated) await story.save();

            return res.json({ story, created: false, updated });
        }

        // Create new
        story = new Story({
            title,
            coverImage: coverImage || '',
            description: description || '',
            type: 'Manga',
            genres: genres || [],
            author: author || 'Unknown',
            status: mappedStatus,
            totalChapters: totalChapters ? Number.parseInt(totalChapters, 10) : null,
            addedBy: req.user._id,
            mangadexId,
            year: year || null,
            contentRating: contentRating || 'safe',
        });

        await story.save();
        res.status(201).json({ story, created: true, updated: false });
    } catch (error) {
        console.error('Clone MangaDex error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
