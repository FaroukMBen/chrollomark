const express = require('express');
const Collection = require('../models/Collection');
const Story = require('../models/Story');
const auth = require('../middleware/auth');
const { emitToFriends } = require('../socket');

const router = express.Router();

// @route   POST /api/collections
// @desc    Create a new collection
router.post('/', auth, async (req, res) => {
    try {
        const { name, description, coverImage, isPublic, color } = req.body;

        const collection = new Collection({
            user: req.user._id,
            name,
            description,
            coverImage,
            isPublic,
            color,
        });

        await collection.save();
        await collection.populate('user', 'username avatar');

        if (collection.isPublic) {
            emitToFriends(req.user._id, 'collection_update', {
                collectionId: collection._id,
                name: collection.name,
                user: collection.user,
                isNew: true
            });
        }

        res.status(201).json(collection);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/collections
// @desc    Get user's collections
router.get('/', auth, async (req, res) => {
    try {
        const collections = await Collection.find({ user: req.user._id })
            .sort('-updatedAt')
            .populate('stories', 'title coverImage type');

        res.json(collections);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/collections/:id
// @desc    Get a single collection
router.get('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findById(req.params.id)
            .populate('stories', 'title coverImage type author averageRating totalChapters')
            .populate('user', 'username avatar');

        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        // Check access
        if (
            !collection.isPublic &&
            collection.user._id.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: 'This collection is private' });
        }

        res.json(collection);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/collections/:id
// @desc    Update a collection
router.put('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        const { name, description, coverImage, isPublic, color } = req.body;

        if (name) collection.name = name;
        if (description !== undefined) collection.description = description;
        if (coverImage !== undefined) collection.coverImage = coverImage;
        if (isPublic !== undefined) collection.isPublic = isPublic;
        if (color) collection.color = color;

        await collection.save();
        await collection.populate('user', 'username avatar');

        if (collection.isPublic) {
            emitToFriends(req.user._id, 'collection_update', {
                collectionId: collection._id,
                name: collection.name,
                user: collection.user,
                isNew: false
            });
        }

        res.json(collection);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/collections/:id/stories
// @desc    Add a story to a collection
router.put('/:id/stories', auth, async (req, res) => {
    try {
        const { storyId } = req.body;
        const collection = await Collection.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        if (collection.stories.includes(storyId)) {
            return res.status(400).json({ message: 'Story already in collection' });
        }

        collection.stories.push(storyId);
        await collection.save();

        // Popularity: Centralized recalculation
        const story = await Story.findById(storyId);
        if (story) await story.calculatePopularity();

        await collection.populate('stories', 'title coverImage type');

        res.json(collection);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/collections/:id/stories/:storyId
// @desc    Remove a story from a collection
router.delete('/:id/stories/:storyId', auth, async (req, res) => {
    try {
        const collection = await Collection.findOne({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        collection.stories = collection.stories.filter(
            (s) => s.toString() !== req.params.storyId
        );
        await collection.save();

        // Popularity: Centralized recalculation
        const story = await Story.findById(req.params.storyId);
        if (story) await story.calculatePopularity();

        res.json(collection);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/collections/:id
// @desc    Delete a collection
router.delete('/:id', auth, async (req, res) => {
    try {
        const collection = await Collection.findOneAndDelete({
            _id: req.params.id,
            user: req.user._id,
        });

        if (!collection) return res.status(404).json({ message: 'Collection not found' });

        res.json({ message: 'Collection deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/collections/:id/clone
// @desc    Clone another user's public collection
router.post('/:id/clone', auth, async (req, res) => {
    try {
        const sourceCollection = await Collection.findById(req.params.id);
        if (!sourceCollection) return res.status(404).json({ message: 'Collection not found' });

        if (!sourceCollection.isPublic && sourceCollection.user.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'This collection is private' });
        }

        const newCollection = new Collection({
            user: req.user._id,
            name: `${sourceCollection.name} (Clone)`,
            description: sourceCollection.description,
            color: sourceCollection.color,
            isPublic: false,
            stories: sourceCollection.stories,
        });

        await newCollection.save();
        res.status(201).json(newCollection);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/collections/user/:userId
// @desc    Get another user's public collections
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const query = { user: req.params.userId };

        // Only show public collections for other users
        if (req.params.userId !== req.user._id.toString()) {
            query.isPublic = true;
        }

        const collections = await Collection.find(query)
            .sort('-updatedAt')
            .populate('stories', 'title coverImage type')
            .populate('user', 'username avatar');

        res.json(collections);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
