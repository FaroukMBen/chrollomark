const express = require('express');
const Feedback = require('../models/Feedback');
const BugReport = require('../models/BugReport');
const auth = require('../middleware/auth');

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
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
