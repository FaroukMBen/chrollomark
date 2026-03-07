const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const MANGADEX_BASE = 'https://api.mangadex.org';
const COVERS_BASE = 'https://uploads.mangadex.org/covers';

// Helper to get cover URL from relationships
const getCoverUrl = (manga, size = '256') => {
    const coverRel = manga.relationships?.find(r => r.type === 'cover_art');
    if (!coverRel?.attributes?.fileName) return null;
    return `${COVERS_BASE}/${manga.id}/${coverRel.attributes.fileName}.${size}.jpg`;
};

// Helper to get author name from relationships
const getAuthorName = (manga) => {
    const authorRel = manga.relationships?.find(r => r.type === 'author');
    return authorRel?.attributes?.name || '';
};

// Helper to get english title
const getTitle = (attrs) => {
    if (attrs.title?.en) return attrs.title.en;
    // Try alt titles
    const enAlt = attrs.altTitles?.find(a => a.en);
    if (enAlt) return enAlt.en;
    // Fallback to first available title
    const firstKey = Object.keys(attrs.title || {})[0];
    return firstKey ? attrs.title[firstKey] : 'Untitled';
};

// Helper to get english description
const getDescription = (attrs) => {
    if (attrs.description?.en) {
        // Clean markdown links and limit length
        return attrs.description.en
            .replace(/---[\s\S]*$/m, '') // Remove everything after ---
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Remove markdown links
            .trim()
            .substring(0, 500);
    }
    // Try other languages
    const firstKey = Object.keys(attrs.description || {})[0];
    if (firstKey) return attrs.description[firstKey].substring(0, 500);
    return '';
};

// Normalize MangaDex manga to a clean shape
const normalizeManga = (manga) => {
    const attrs = manga.attributes;
    const tags = (attrs.tags || [])
        .filter(t => t.attributes?.group === 'genre' || t.attributes?.group === 'theme')
        .map(t => t.attributes?.name?.en)
        .filter(Boolean);

    return {
        id: manga.id,
        title: getTitle(attrs),
        description: getDescription(attrs),
        coverUrl: getCoverUrl(manga),
        coverUrlHQ: getCoverUrl(manga, '512'),
        author: getAuthorName(manga),
        status: attrs.status || 'unknown',
        year: attrs.year,
        contentRating: attrs.contentRating || 'safe',
        tags,
        originalLanguage: attrs.originalLanguage,
        lastChapter: attrs.lastChapter,
        lastVolume: attrs.lastVolume,
        demographic: attrs.publicationDemographic,
        updatedAt: attrs.updatedAt,
        createdAt: attrs.createdAt,
    };
};

// @route   GET /api/mangadex/manga
// @desc    Search/browse manga from MangaDex
router.get('/manga', auth, async (req, res) => {
    try {
        const {
            title,
            limit = '20',
            offset = '0',
            order = 'followedCount',
            orderDir = 'desc',
            status,        // ongoing, completed, hiatus, cancelled
            contentRating, // safe, suggestive, erotica
            tags,          // comma-separated tag IDs
        } = req.query;

        const url = new URL(`${MANGADEX_BASE}/manga`);
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', offset);
        url.searchParams.append('includes[]', 'cover_art');
        url.searchParams.append('includes[]', 'author');

        // Order
        if (order) {
            url.searchParams.append(`order[${order}]`, orderDir);
        }

        // Content rating (default: safe + suggestive)
        if (contentRating) {
            contentRating.split(',').forEach(cr => url.searchParams.append('contentRating[]', cr));
        } else {
            url.searchParams.append('contentRating[]', 'safe');
            url.searchParams.append('contentRating[]', 'suggestive');
        }

        // Title search
        if (title) {
            url.searchParams.append('title', title);
        }

        // Status filter
        if (status) {
            status.split(',').forEach(s => url.searchParams.append('status[]', s));
        }

        // Tags filter
        if (tags) {
            tags.split(',').forEach(t => url.searchParams.append('includedTags[]', t));
        }

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`MangaDex API error: ${response.status}`);
        }

        const data = await response.json();
        const results = (data.data || []).map(normalizeManga);

        res.json({
            results,
            total: data.total || 0,
            limit: Number.parseInt(limit),
            offset: Number.parseInt(offset),
        });
    } catch (error) {
        console.error('MangaDex manga error:', error.message);
        res.json({ results: [], total: 0, limit: 20, offset: 0, message: error.message });
    }
});

// @route   GET /api/mangadex/manga/:id
// @desc    Get manga details by ID
router.get('/manga/:id', auth, async (req, res) => {
    try {
        const url = `${MANGADEX_BASE}/manga/${req.params.id}?includes[]=cover_art&includes[]=author`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);
        const data = await response.json();
        res.json({ manga: normalizeManga(data.data) });
    } catch (error) {
        console.error('MangaDex detail error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/mangadex/tags
// @desc    Get all MangaDex genre/theme tags
router.get('/tags', auth, async (_req, res) => {
    try {
        const response = await fetch(`${MANGADEX_BASE}/manga/tag`);
        if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);
        const data = await response.json();

        const tags = (data.data || [])
            .filter(t => t.attributes?.group === 'genre' || t.attributes?.group === 'theme')
            .map(t => ({
                id: t.id,
                name: t.attributes?.name?.en || '',
                group: t.attributes?.group,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

        res.json({ tags });
    } catch (error) {
        console.error('MangaDex tags error:', error.message);
        res.json({ tags: [] });
    }
});

module.exports = router;
