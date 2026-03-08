const express = require('express');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const ReadingProgress = require('../models/ReadingProgress');
const Review = require('../models/Review');
const Recommendation = require('../models/Recommendation');
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

// @route   DELETE /api/social/friend-request/:id
// @desc    Cancel or delete a friend request
router.delete('/friend-request/:id', auth, async (req, res) => {
    try {
        const request = await FriendRequest.findById(req.params.id);
        if (!request) return res.status(404).json({ message: 'Request not found' });

        // Party must be sender or receiver
        if (
            request.from.toString() !== req.user._id.toString() &&
            request.to.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({ message: 'Not authorized' });
        }

        await FriendRequest.findByIdAndDelete(req.params.id);
        res.json({ message: 'Friend request removed' });
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

        // Check for pending requests
        const pendingSentRequest = await FriendRequest.findOne({
            from: req.user._id,
            to: req.params.id,
            status: 'pending'
        });

        const pendingReceivedRequest = await FriendRequest.findOne({
            from: req.params.id,
            to: req.user._id,
            status: 'pending'
        });

        // Get mutual friends
        const currentUser = await User.findById(req.user._id);
        const targetUserFriends = user.friends.map(f => f.toString());
        const currentUserFriendsSet = new Set(currentUser.friends.map(f => f.toString()));

        const mutualFriendIds = targetUserFriends.filter(id => currentUserFriendsSet.has(id));
        const mutualFriends = await User.find({ _id: { $in: mutualFriendIds } }).select('username avatar bio');

        const requestStatus = {
            sent: !!pendingSentRequest,
            received: !!pendingReceivedRequest,
            requestId: pendingSentRequest?._id || pendingReceivedRequest?._id
        };

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
            requestStatus,
            mutualFriends,
            stats,
            friendCount: user.friends.length,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/social/activity
// @desc    Get friends' recent activity (reading updates)
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

// @route   GET /api/social/feed
// @desc    Get rich activity feed (reviews, progress, recommendations) — Steam-style
router.get('/feed', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        const friendIds = user.friends;

        if (friendIds.length === 0) {
            return res.json({ feed: [], recommendations: [] });
        }

        // 1) Friend reviews (last 30 days)
        const recentReviews = await Review.find({
            user: { $in: friendIds },
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        })
            .sort('-createdAt')
            .limit(20)
            .populate('user', 'username avatar')
            .populate('story', 'title coverImage type author');

        // 2) Friend progress updates (last 7 days)
        const recentProgress = await ReadingProgress.find({
            user: { $in: friendIds },
            lastReadDate: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        })
            .sort('-lastReadDate')
            .limit(30)
            .populate('user', 'username avatar')
            .populate('story', 'title coverImage type');

        // 3) Friend recommendations (last 30 days)
        const recentRecommendations = await Recommendation.find({
            user: { $in: friendIds },
            createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
        })
            .sort('-createdAt')
            .limit(20)
            .populate('user', 'username avatar')
            .populate('story', 'title coverImage type author');

        // Build unified feed sorted by date
        const feed = [];

        for (const review of recentReviews) {
            feed.push({
                type: 'review',
                id: `review-${review._id}`,
                user: review.user,
                story: review.story,
                rating: review.rating,
                text: review.text,
                title: review.title,
                likes: review.likes?.length || 0,
                timestamp: review.createdAt,
            });
        }

        for (const progress of recentProgress) {
            feed.push({
                type: 'progress',
                id: `progress-${progress._id}`,
                user: progress.user,
                story: progress.story,
                status: progress.status,
                currentChapter: progress.currentChapter,
                timestamp: progress.lastReadDate || progress.updatedAt,
            });
        }

        for (const rec of recentRecommendations) {
            feed.push({
                type: 'recommendation',
                id: `rec-${rec._id}`,
                user: rec.user,
                story: rec.story,
                message: rec.message || '',
                timestamp: rec.createdAt,
            });
        }

        // Sort by timestamp descending
        feed.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        // 3) Recommendations: stories that multiple friends have read and rated highly
        const friendProgress = await ReadingProgress.find({
            user: { $in: friendIds },
            status: { $in: ['Reading', 'Completed'] },
        }).populate('story', 'title coverImage type author averageRating totalReaders');

        // Group by story, count how many friends read it
        const storyMap = {};
        for (const p of friendProgress) {
            if (!p.story) continue;
            const sid = p.story._id.toString();
            if (!storyMap[sid]) {
                storyMap[sid] = { story: p.story, friendsReading: [], avgRating: 0 };
            }
            storyMap[sid].friendsReading.push(p.user);
        }

        // Check which of these the user already has in library
        const userProgress = await ReadingProgress.find({ user: req.user._id }).select('story');
        const userStoryIds = new Set(userProgress.map(p => p.story.toString()));

        const recommendations = Object.values(storyMap)
            .filter(item => !userStoryIds.has(item.story._id.toString())) // exclude stories user already reads
            .filter(item => item.friendsReading.length >= 1) // at least 1 friend reads it
            .sort((a, b) => b.friendsReading.length - a.friendsReading.length)
            .slice(0, 10)
            .map(item => ({
                story: item.story,
                friendsReading: item.friendsReading.slice(0, 3), // show first 3 friends
                friendCount: item.friendsReading.length,
            }));

        res.json({ feed: feed.slice(0, 50), recommendations });
    } catch (error) {
        console.error('Feed error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
// @route   POST /api/social/recommend
// @desc    Recommend a story to all friends
router.post('/recommend', auth, async (req, res) => {
    try {
        const { storyId, message } = req.body;
        if (!storyId) return res.status(400).json({ message: 'Story ID is required' });

        let recommendation = await Recommendation.findOne({ user: req.user._id, story: storyId });

        if (recommendation) {
            await Recommendation.deleteOne({ _id: recommendation._id });
            res.json({ message: 'Recommendation removed', isRecommended: false });
        } else {
            recommendation = new Recommendation({
                user: req.user._id,
                story: storyId,
                message: message || '',
            });
            await recommendation.save();
            res.json({ message: 'Story recommended to friends!', isRecommended: true });
        }
    } catch (error) {
        console.error('Recommend error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
