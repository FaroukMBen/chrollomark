const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const ReadingProgress = require('../models/ReadingProgress');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/social/search
// @desc    Search users by username
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.status(400).json({ message: 'Search query must be at least 2 characters' });
        }

        const users = await User.find({
            username: { $regex: q, $options: 'i' },
            _id: { $ne: req.user._id },
        })
            .select('username avatar bio')
            .limit(20);

        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/social/friend-request
// @desc    Send a friend request
router.post('/friend-request', auth, async (req, res) => {
    try {
        const { userId } = req.body;

        if (userId === req.user._id.toString()) {
            return res.status(400).json({ message: "You can't add yourself" });
        }

        const targetUser = await User.findById(userId);
        if (!targetUser) return res.status(404).json({ message: 'User not found' });

        // Check if already friends
        if (req.user.friends.includes(userId)) {
            return res.status(400).json({ message: 'Already friends' });
        }

        // Check for existing request (in either direction)
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { from: req.user._id, to: userId },
                { from: userId, to: req.user._id },
            ],
            status: 'pending',
        });

        if (existingRequest) {
            return res.status(400).json({ message: 'Friend request already exists' });
        }

        const request = new FriendRequest({
            from: req.user._id,
            to: userId,
        });

        await request.save();
        await request.populate('to', 'username avatar');

        res.status(201).json(request);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/friend-requests
// @desc    Get pending friend requests (received)
router.get('/friend-requests', auth, async (req, res) => {
    try {
        const requests = await FriendRequest.find({
            to: req.user._id,
            status: 'pending',
        })
            .populate('from', 'username avatar bio')
            .sort('-createdAt');

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/friend-requests/sent
// @desc    Get sent friend requests
router.get('/friend-requests/sent', auth, async (req, res) => {
    try {
        const requests = await FriendRequest.find({
            from: req.user._id,
            status: 'pending',
        })
            .populate('to', 'username avatar bio')
            .sort('-createdAt');

        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/social/friend-request/:id
// @desc    Accept or decline a friend request
router.put('/friend-request/:id', auth, async (req, res) => {
    try {
        const { action } = req.body; // 'accept' or 'decline'
        const request = await FriendRequest.findById(req.params.id);

        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (request.to.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        if (action === 'accept') {
            request.status = 'accepted';

            // Add each other as friends
            await User.findByIdAndUpdate(request.from, {
                $addToSet: { friends: request.to },
            });
            await User.findByIdAndUpdate(request.to, {
                $addToSet: { friends: request.from },
            });
        } else {
            request.status = 'declined';
        }

        await request.save();
        res.json({ message: `Friend request ${action}ed` });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/social/friend/:userId
// @desc    Remove a friend
router.delete('/friend/:userId', auth, async (req, res) => {
    try {
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { friends: req.params.userId },
        });
        await User.findByIdAndUpdate(req.params.userId, {
            $pull: { friends: req.user._id },
        });

        // Clean up friend request
        await FriendRequest.deleteMany({
            $or: [
                { from: req.user._id, to: req.params.userId },
                { from: req.params.userId, to: req.user._id },
            ],
        });

        res.json({ message: 'Friend removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/friends
// @desc    Get friends list
router.get('/friends', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).populate(
            'friends',
            'username avatar bio isOnline lastActive'
        );

        res.json(user.friends);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/user/:id
// @desc    Get user profile (public info)
router.get('/user/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select(
            'username avatar bio favoriteGenres friends createdAt'
        );

        if (!user) return res.status(404).json({ message: 'User not found' });

        const isFriend = req.user.friends.some(
            (f) => f.toString() === req.params.id
        );

        // Get reading stats
        const progressList = await ReadingProgress.find({ user: req.params.id });
        const stats = {
            totalStories: progressList.length,
            reading: progressList.filter((p) => p.status === 'Reading').length,
            completed: progressList.filter((p) => p.status === 'Completed').length,
            totalChaptersRead: progressList.reduce((sum, p) => sum + p.currentChapter, 0),
        };

        res.json({
            user,
            isFriend,
            stats,
            friendCount: user.friends.length,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/activity
// @desc    Get friends' recent activity
router.get('/activity', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const friendIds = user.friends;

        if (friendIds.length === 0) {
            return res.json([]);
        }

        // Get recent reading updates from friends
        const recentActivity = await ReadingProgress.find({
            user: { $in: friendIds },
            lastReadDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        })
            .sort('-lastReadDate')
            .limit(50)
            .populate('user', 'username avatar')
            .populate('story', 'title coverImage type');

        res.json(recentActivity);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
