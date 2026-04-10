const express = require('express');
const Bookmark = require('../models/Bookmark');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/bookmarks
// @desc    Get all user bookmarks
router.get('/', auth, async (req, res) => {
    try {
        const bookmarks = await Bookmark.find({ user: req.user._id }).sort('-createdAt');
        res.json(bookmarks);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/bookmarks
// @desc    Add a new bookmark
router.post('/', auth, async (req, res) => {
    try {
        const { title, url, icon } = req.body;

        if (!title || !url) {
            return res.status(400).json({ message: 'Title and URL are required' });
        }

        let bookmark = await Bookmark.findOne({ user: req.user._id, url });
        if (bookmark) {
            bookmark.title = title;
            if (icon) bookmark.icon = icon;
            await bookmark.save();
            return res.json(bookmark);
        }

        bookmark = new Bookmark({
            user: req.user._id,
            title,
            url,
            icon: icon || '',
        });

        await bookmark.save();
        res.status(201).json(bookmark);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/bookmarks/:id
// @desc    Remove a bookmark
router.delete('/:id', auth, async (req, res) => {
    try {
        const bookmark = await Bookmark.findById(req.params.id);

        if (!bookmark) {
            return res.status(404).json({ message: 'Bookmark not found' });
        }

        if (bookmark.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await bookmark.deleteOne();
        res.json({ message: 'Bookmark removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
