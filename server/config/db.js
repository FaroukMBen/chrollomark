const mongoose = require('mongoose');
require('dotenv').config();

let bucket;

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        
        // Initialize GridFS bucket
        const db = conn.connection.db;
        bucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'images'
        });
        
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        process.exit(1);
    }
};

const getBucket = () => {
    if (!bucket) {
        throw new Error('Database not connected. Bucket is not available.');
    }
    return bucket;
};

module.exports = { connectDB, getBucket };
