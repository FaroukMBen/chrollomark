const express = require('express');
const Feedback = require('../models/Feedback');
const BugReport = require('../models/BugReport');
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');

const router = express.Router();

// @route   POST /api/support/feedback
// @desc    Submit feedback
router.post('/feedback', auth, async (req, res) => {
    try {
        const { content, category } = req.body;
        const feedback = new Feedback({
            user: req.user._id,
            content,
            category
        });
        await feedback.save();
        res.status(201).json(feedback);
    } catch (error) {
        console.error('Feedback Submit Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/support/bug-report
// @desc    Submit a bug report
router.post('/bug-report', auth, async (req, res) => {
    try {
        const { title, description, images, deviceInfo } = req.body;
        const bugReport = new BugReport({
            user: req.user._id,
            title,
            description,
            images,
            deviceInfo
        });
        await bugReport.save();
        res.status(201).json(bugReport);
    } catch (error) {
        console.error('Bug Report Submit Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/support/feedback
// @desc    Get all feedback (Admin only)
router.get('/feedback', [auth, admin], async (req, res) => {
    try {
        const feedback = await Feedback.find()
            .populate('user', 'username avatar email')
            .sort({ createdAt: -1 });
        res.json(feedback);
    } catch (error) {
        console.error('Get Feedback Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/support/bug-reports
// @desc    Get all bug reports (Admin only)
router.get('/bug-reports', [auth, admin], async (req, res) => {
    try {
        const bugReports = await BugReport.find()
            .populate('user', 'username avatar email')
            .sort({ createdAt: -1 });
        res.json(bugReports);
    } catch (error) {
        console.error('Get Bug Reports Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
