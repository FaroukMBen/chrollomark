const { getBucket } = require('../config/db');
const path = require('path');
const { Readable } = require('stream');

/**
 * Uploads a file buffer to GridFSBucket
 * @param {Buffer} buffer - The file buffer from multer memoryStorage
 * @param {Object} file - The file object from multer
 * @returns {Promise<string>} - The ID of the uploaded file as a string
 */
const uploadToGridFS = (buffer, file) => {
    return new Promise((resolve, reject) => {
        const bucket = getBucket();
        const filename = Date.now() + '-' + file.originalname;
        
        const uploadStream = bucket.openUploadStream(filename, {
            contentType: file.mimetype,
            metadata: {
                originalName: file.originalname,
                extension: path.extname(file.originalname).toLowerCase()
            }
        });

        const readableStream = new Readable();
        readableStream.push(buffer);
        readableStream.push(null);

        readableStream.pipe(uploadStream);

        uploadStream.on('finish', () => {
            resolve(uploadStream.id.toString());
        });

        uploadStream.on('error', (error) => {
            reject(error);
        });
    });
};

/**
 * Deletes a file from GridFSBucket
 * @param {string} fileId - The ID of the file to delete
 */
const deleteFromGridFS = async (fileId) => {
    if (!fileId) return;
    try {
        const bucket = getBucket();
        const { ObjectId } = require('mongoose').Types;
        await bucket.delete(new ObjectId(fileId));
    } catch (error) {
        console.error('Error deleting image from GridFS:', error);
    }
};

module.exports = {
    uploadToGridFS,
    deleteFromGridFS
};
