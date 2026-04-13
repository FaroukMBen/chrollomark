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

/**
 * Downloads an external image from a URL and saves it to GridFS
 * @param {string} url - The external image URL
 * @returns {Promise<string|null>} - The ID of the saved file or null on failure
 */
const saveExternalImage = async (url) => {
    if (!url || !url.startsWith('http')) return null;

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://mangadex.org/'
            }
        });
        
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        
        const contentType = response.headers.get('content-type');
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        // Mock file object for GridFS
        const file = {
            originalname: url.split('/').pop()?.split('?')[0] || 'external-cover.jpg',
            mimetype: contentType || 'image/jpeg'
        };
        
        return await uploadToGridFS(buffer, file);
    } catch (error) {
        console.error('Error in saveExternalImage:', error.message);
        return null;
    }
};

module.exports = {
    uploadToGridFS,
    deleteFromGridFS,
    saveExternalImage
};
