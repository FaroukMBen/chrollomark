const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const { connectDB } = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const storyRoutes = require('./routes/stories');
const progressRoutes = require('./routes/progress');
const reviewRoutes = require('./routes/reviews');
const collectionRoutes = require('./routes/collections');
const socialRoutes = require('./routes/social');
const mangadexRoutes = require('./routes/mangadex');
const supportRoutes = require('./routes/support');
const devlogRoutes = require('./routes/devlog');
const imageRoutes = require('./routes/images');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/collections', collectionRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/mangadex', mangadexRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/devlog', devlogRoutes);
app.use('/api/images', imageRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: 'Something went wrong!' });
});

const PORT = process.env.PORT || 5000;

// Connect to DB and start server
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`\nChrolloMark API Server running on port ${PORT}`);
        console.log(`http://localhost:${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/api/health\n`);
    });
});