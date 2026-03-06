const express = require('express');
const ReadingProgress = require('../models/ReadingProgress');
const Story = require('../models/Story');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/progress
// @desc    Add or update reading progress
router.post('/', auth, async (req, res) => {
    try {
        const { storyId, currentChapter, status, notes, isFavorite, rating } = req.body;

        // Verify story exists
        const story = await Story.findById(storyId);
        if (!story) return res.status(404).json({ message: 'Story not found' });

        let progress = await ReadingProgress.findOne({
            user: req.user._id,
            story: storyId,
        });

        if (progress) {
            // Update existing
            if (currentChapter !== undefined) progress.currentChapter = currentChapter;
            if (status) progress.status = status;
            if (notes !== undefined) progress.notes = notes;
            if (isFavorite !== undefined) progress.isFavorite = isFavorite;
            if (rating !== undefined) progress.rating = rating;
            progress.lastReadDate = Date.now();

            // Auto-set dates
            if (status === 'Reading' && !progress.startDate) {
                progress.startDate = Date.now();
            }
            if (status === 'Completed') {
                progress.completedDate = Date.now();
            }
        } else {
            // Create new
            progress = new ReadingProgress({
                user: req.user._id,
                story: storyId,
                currentChapter: currentChapter || 0,
                status: status || 'Plan to Read',
                notes,
                isFavorite,
                rating,
                startDate: status === 'Reading' ? Date.now() : null,
            });

            // Increment readers count
            await Story.findByIdAndUpdate(storyId, { $inc: { totalReaders: 1 } });
        }

        await progress.save();
        await progress.populate('story', 'title coverImage type totalChapters');

        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/progress
// @desc    Get user's reading progress (all stories)
router.get('/', auth, async (req, res) => {
    try {
        const { status, sort = '-lastReadDate' } = req.query;
        const query = { user: req.user._id };

        if (status) query.status = status;

        const progress = await ReadingProgress.find(query)
            .sort(sort)
            .populate('story', 'title coverImage type totalChapters author status genres averageRating');

        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/progress/stats
// @desc    Get reading statistics
router.get('/stats', auth, async (req, res) => {
    try {
        const allProgress = await ReadingProgress.find({ user: req.user._id });

        const stats = {
            totalStories: allProgress.length,
            reading: allProgress.filter((p) => p.status === 'Reading').length,
            completed: allProgress.filter((p) => p.status === 'Completed').length,
            planToRead: allProgress.filter((p) => p.status === 'Plan to Read').length,
            onHold: allProgress.filter((p) => p.status === 'On Hold').length,
            dropped: allProgress.filter((p) => p.status === 'Dropped').length,
            totalChaptersRead: allProgress.reduce((sum, p) => sum + p.currentChapter, 0),
            favorites: allProgress.filter((p) => p.isFavorite).length,
        };

        // Recent activity (last 7 days)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        stats.readThisWeek = allProgress.filter(
            (p) => p.lastReadDate && p.lastReadDate >= weekAgo
        ).length;

        res.json(stats);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/progress/:id/increment
// @desc    Quick increment chapter by 1
router.put('/:id/increment', auth, async (req, res) => {
    try {
        const progress = await ReadingProgress.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!progress) return res.status(404).json({ message: 'Progress not found' });

        progress.currentChapter += 1;
        progress.lastReadDate = Date.now();

        if (progress.status === 'Plan to Read') {
            progress.status = 'Reading';
            progress.startDate = Date.now();
        }

        // Check if completed
        const story = await Story.findById(progress.story);
        if (story.totalChapters && progress.currentChapter >= story.totalChapters) {
            progress.status = 'Completed';
            progress.completedDate = Date.now();
        }

        await progress.save();
        await progress.populate('story', 'title coverImage type totalChapters');

        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/progress/:storyId
// @desc    Remove story from library
router.delete('/:storyId', auth, async (req, res) => {
    try {
        const progress = await ReadingProgress.findOneAndDelete({
            story: req.params.storyId,
            user: req.user._id,
        });

        if (!progress) return res.status(404).json({ message: 'Progress not found' });

        await Story.findByIdAndUpdate(req.params.storyId, { $inc: { totalReaders: -1 } });

        res.json({ message: 'Removed from library' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/progress/user/:userId
// @desc    Get another user's reading progress (for friends)
router.get('/user/:userId', auth, async (req, res) => {
    try {
        // Check if they are friends
        const isFriend = req.user.friends.some(
            (f) => f.toString() === req.params.userId
        );

        if (!isFriend && req.params.userId !== req.user._id.toString()) {
            return res.status(403).json({ message: 'You need to be friends to see their progress' });
        }

        const progress = await ReadingProgress.find({ user: req.params.userId })
            .sort('-lastReadDate')
            .populate('story', 'title coverImage type totalChapters author');

        res.json(progress);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
