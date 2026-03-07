const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// @route   POST /api/auth/register
// @desc    Register a new user
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }],
        });

        if (existingUser) {
            const field = existingUser.email === email ? 'email' : 'username';
            return res.status(400).json({ message: `This ${field} is already taken` });
        }

        // Create user
        const user = new User({ username, email, password });
        await user.save();

        // Generate token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.status(201).json({
            token,
            user: user.toJSON(),
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/auth/login
// @desc    Login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(400).json({ message: 'Invalid credentials' });
        }

        // Update last active
        user.lastActive = Date.now();
        user.isOnline = true;
        await user.save();

        // Generate token
        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '30d',
        });

        res.json({
            token,
            user: user.toJSON(),
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
            .select('-password')
            .populate('friends', 'username avatar isOnline lastActive');
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
router.put('/profile', [auth, upload.single('avatar')], async (req, res) => {
    try {
        const { username, bio, favoriteGenres } = req.body;
        const updates = {};

        let avatarUrl = req.body.avatar;
        if (req.file) {
            avatarUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        }

        if (username) {
            const existing = await User.findOne({ username, _id: { $ne: req.user._id } });
            if (existing) return res.status(400).json({ message: 'Username already taken' });
            updates.username = username;
        }
        if (bio !== undefined) updates.bio = bio;
        if (avatarUrl !== undefined) updates.avatar = avatarUrl;
        if (favoriteGenres) updates.favoriteGenres = favoriteGenres;

        const user = await User.findByIdAndUpdate(req.user._id, updates, {
            new: true,
            runValidators: true,
        }).select('-password');

        res.json(user);
    } catch (error) {
        if (error.name === 'ValidationError') {
            const messages = Object.values(error.errors).map((e) => e.message);
            return res.status(400).json({ message: messages.join(', ') });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
