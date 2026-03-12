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

// @route   PATCH /api/support/feedback/:id
// @desc    Update feedback status/notes (Admin only)
router.patch('/feedback/:id', [auth, admin], async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const feedback = await Feedback.findByIdAndUpdate(
            req.params.id,
            { status, adminNotes },
            { new: true }
        ).populate('user', 'username avatar email');
        
        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
        res.json(feedback);
    } catch (error) {
        console.error('Update Feedback Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/support/feedback/:id
// @desc    Delete feedback (Admin only)
router.delete('/feedback/:id', [auth, admin], async (req, res) => {
    try {
        const feedback = await Feedback.findByIdAndDelete(req.params.id);
        if (!feedback) return res.status(404).json({ message: 'Feedback not found' });
        res.json({ message: 'Feedback deleted' });
    } catch (error) {
        console.error('Delete Feedback Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PATCH /api/support/bug-reports/:id
// @desc    Update bug report status/notes (Admin only)
router.patch('/bug-reports/:id', [auth, admin], async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const bugReport = await BugReport.findByIdAndUpdate(
            req.params.id,
            { status, adminNotes },
            { new: true }
        ).populate('user', 'username avatar email');
        
        if (!bugReport) return res.status(404).json({ message: 'Bug report not found' });
        res.json(bugReport);
    } catch (error) {
        console.error('Update Bug Report Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/support/bug-reports/:id
// @desc    Delete bug report (Admin only)
router.delete('/bug-reports/:id', [auth, admin], async (req, res) => {
    try {
        const bugReport = await BugReport.findByIdAndDelete(req.params.id);
        if (!bugReport) return res.status(404).json({ message: 'Bug report not found' });
        res.json({ message: 'Bug report deleted' });
    } catch (error) {
        console.error('Delete Bug Report Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
