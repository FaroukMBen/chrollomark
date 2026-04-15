const express = require('express');
const { getBucket } = require('../config/db');
const mongoose = require('mongoose');

const router = express.Router();

// @route   GET /api/images/proxy?url=...
// @desc    Proxy an external image to bypass CORS or IP blocks
router.get('/proxy', async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ message: 'URL is required' });

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://mangadex.org/'
            }
        });

        if (!response.ok) throw new Error('Failed to fetch external image');

        const contentType = response.headers.get('content-type');
        if (contentType) res.set('Content-Type', contentType);
        
        // Cache images for 24 hours
        res.set('Cache-Control', 'public, max-age=86400');

        const arrayBuffer = await response.arrayBuffer();
        res.send(Buffer.from(arrayBuffer));
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({ message: 'Image proxy failed' });
    }
});

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
        res.set('Content-Length', files[0].length);
        res.set('Cache-Control', 'public, max-age=31536000'); // Cache locally for 1 year
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
