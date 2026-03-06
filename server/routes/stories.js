const express = require('express');
const Story = require('../models/Story');
const ReadingProgress = require('../models/ReadingProgress');
const Review = require('../models/Review');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/stories
// @desc    Create a new story
router.post('/', auth, async (req, res) => {
    try {
        const { title, coverImage, description, type, genres, author, status, totalChapters } =
            req.body;

        const story = new Story({
            title,
            coverImage,
            description,
            type,
            genres,
            author,
            status,
            totalChapters,
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
        const { page = 1, limit = 20, search, type, genre, sort = '-createdAt' } = req.query;

        const query = {};

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { author: { $regex: search, $options: 'i' } },
            ];
        }
        if (type) query.type = type;
        if (genre) query.genres = { $in: [genre] };

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

        res.json({
            story,
            userProgress: progress,
            reviews,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/stories/:id
// @desc    Update a story
router.put('/:id', auth, async (req, res) => {
    try {
        const story = await Story.findById(req.params.id);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        // Only the creator or anyone can update (community-driven)
        const { title, coverImage, description, type, genres, author, status, totalChapters } =
            req.body;

        if (title) story.title = title;
        if (coverImage !== undefined) story.coverImage = coverImage;
        if (description !== undefined) story.description = description;
        if (type) story.type = type;
        if (genres) story.genres = genres;
        if (author) story.author = author;
        if (status) story.status = status;
        if (totalChapters !== undefined) story.totalChapters = totalChapters;

        await story.save();
        await story.populate('addedBy', 'username avatar');

        res.json(story);
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

        if (story.addedBy.toString() !== req.user._id.toString()) {
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

module.exports = router;
