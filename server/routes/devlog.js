const express = require('express');
const DevLog = require('../models/DevLog');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/devlog
// @desc    Get all dev logs
router.get('/', auth, async (req, res) => {
    try {
        const logs = await DevLog.find().sort({ date: -1 });
        res.json(logs);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/devlog
// @desc    Create a dev log (Admin only - for now just protected by auth)
router.post('/', auth, async (req, res) => {
    try {
        const { title, content, category, date } = req.body;
        const log = new DevLog({
            title,
            content,
            category,
            date
        });
        await log.save();
        res.status(201).json(log);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
