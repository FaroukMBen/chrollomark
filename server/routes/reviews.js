const express = require('express');
const Review = require('../models/Review');
const Story = require('../models/Story');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/reviews
// @desc    Create or update a review
router.post('/', auth, async (req, res) => {
    try {
        const { storyId, rating, title, text, spoiler } = req.body;

        const story = await Story.findById(storyId);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        let review = await Review.findOne({ user: req.user._id, story: storyId });

        if (review) {
            // Update existing review
            review.rating = rating;
            if (title !== undefined) review.title = title;
            if (text !== undefined) review.text = text;
            if (spoiler !== undefined) review.spoiler = spoiler;
        } else {
            // Create new review
            review = new Review({
                user: req.user._id,
                story: storyId,
                rating,
                title,
                text,
                spoiler,
            });
            story.totalReviews += 1;
        }

        await review.save();

        // Recalculate average rating
        const allReviews = await Review.find({ story: storyId });
        const avgRating =
            allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
        story.averageRating = Math.round(avgRating * 10) / 10;
        await story.save();

        await review.populate('user', 'username avatar');

        res.status(201).json(review);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/reviews/story/:storyId
// @desc    Get reviews for a story
router.get('/story/:storyId', auth, async (req, res) => {
    try {
        const { page = 1, limit = 10, sort = '-createdAt' } = req.query;

        const reviews = await Review.find({ story: req.params.storyId })
            .sort(sort)
            .limit(parseInt(limit))
            .skip((parseInt(page) - 1) * parseInt(limit))
            .populate('user', 'username avatar');

        const total = await Review.countDocuments({ story: req.params.storyId });

        res.json({
            reviews,
            totalPages: Math.ceil(total / parseInt(limit)),
            currentPage: parseInt(page),
            total,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/reviews/:id/like
// @desc    Like/unlike a review
router.put('/:id/like', auth, async (req, res) => {
    try {
        const review = await Review.findById(req.params.id);
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const likeIndex = review.likes.indexOf(req.user._id);
        if (likeIndex > -1) {
            review.likes.splice(likeIndex, 1);
        } else {
            review.likes.push(req.user._id);
        }

        await review.save();
        res.json(review);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/reviews/:id
// @desc    Delete a review
router.delete('/:id', auth, async (req, res) => {
    try {
        const review = await Review.findOne({ _id: req.params.id, user: req.user._id });
        if (!review) return res.status(404).json({ message: 'Review not found' });

        const storyId = review.story;
        await review.deleteOne();

        // Recalculate average rating
        const allReviews = await Review.find({ story: storyId });
        const story = await Story.findById(storyId);
        if (allReviews.length > 0) {
            const avgRating =
                allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
            story.averageRating = Math.round(avgRating * 10) / 10;
        } else {
            story.averageRating = 0;
        }
        story.totalReviews = allReviews.length;
        await story.save();

        res.json({ message: 'Review deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
