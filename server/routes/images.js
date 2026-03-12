const express = require('express');
const { getBucket } = require('../config/db');
const mongoose = require('mongoose');

const router = express.Router();

// @route   GET /api/images/:id
// @desc    Get image from GridFS by ID
router.get('/:id', async (req, res) => {
    try {
        const bucket = getBucket();
        const id = new mongoose.Types.ObjectId(req.params.id);
        
        const files = await bucket.find({ _id: id }).toArray();
        if (!files || files.length === 0) {
            return res.status(404).json({ message: 'Image not found' });
        }

        res.set('Content-Type', files[0].contentType);
        const downloadStream = bucket.openDownloadStream(id);
        
        downloadStream.on('error', (err) => {
            res.status(404).json({ message: 'Error retrieving image' });
        });

        downloadStream.pipe(res);
    } catch (error) {
        if (error.kind === 'ObjectId') {
            return res.status(404).json({ message: 'Image not found' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
