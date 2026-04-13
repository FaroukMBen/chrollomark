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

        // Order mapping
        const mdOrder = order === 'popularity' ? 'followedCount' : order;
        if (mdOrder) {
            url.searchParams.append(`order[${mdOrder}]`, orderDir);
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

        // Tags filter (AND logic)
        if (tags) {
            tags.split(',').forEach(t => url.searchParams.append('includedTags[]', t));
            url.searchParams.append('includedTagsMode', 'AND');
        }

        const response = await fetch(url.toString());
        const data = await response.json();

        const mongoose = require('mongoose');
        const Story = mongoose.model('Story');

        let results = (data.data || []).map(normalizeManga);

        // Fusion logic: Match titles with our local DB
        const titles = results.map(r => r.title);
        const localMatches = await Story.find({
            title: { $in: titles }
        });

        const matchMap = {};
        const syncStatusMap = {};

        localMatches.forEach(s => {
            const key = s.title.toLowerCase();

            const result = results.find(r => {
                if (r.title.toLowerCase() !== key) return false;
                return s.type !== 'Anime';
            });

            if (result) {
                matchMap[key] = s._id;

                const extGenres = result.tags || [];
                const locGenres = s.genres || [];
                const hasNewGenres = extGenres.some(g => !locGenres.includes(g));
                const isDescLonger = (result.description?.length || 0) > (s.description?.length || 0);
                const isChaptersBetter = (result.lastChapter || 0) > (s.totalChapters || 0);
                const isAuthorDifferent = result.author && s.author && !s.author.includes(result.author);
                const isIdMissing = !s.mangadexId;

                syncStatusMap[key] = !hasNewGenres && !isDescLonger && !isChaptersBetter && !isAuthorDifferent && !isIdMissing;
            }
        });

        results = results.map(r => ({
            ...r,
            chrollomarkId: matchMap[r.title.toLowerCase()] || null,
            alreadyInSync: syncStatusMap[r.title.toLowerCase()] || false
        }));

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

// @route   GET /api/mangadex/manga/:id/chapters
// @desc    Get chapters for a manga
router.get('/manga/:id/chapters', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const { limit = '100', offset = '0', translatedLanguage = 'en' } = req.query;

        const url = new URL(`${MANGADEX_BASE}/manga/${id}/feed`);
        url.searchParams.append('limit', limit);
        url.searchParams.append('offset', offset);

        if (translatedLanguage && translatedLanguage !== 'all') {
            translatedLanguage.split(',').forEach(lang => url.searchParams.append('translatedLanguage[]', lang));
        }

        url.searchParams.append('order[chapter]', 'asc');
        url.searchParams.append('includes[]', 'scanlation_group');

        const response = await fetch(url.toString());
        if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);
        const data = await response.json();

        const chapters = (data.data || []).map(ch => ({
            id: ch.id,
            chapter: ch.attributes?.chapter,
            title: ch.attributes?.title,
            volume: ch.attributes?.volume,
            pages: ch.attributes?.pages,
            translatedLanguage: ch.attributes?.translatedLanguage,
            publishAt: ch.attributes?.publishAt,
            scanlationGroup: ch.relationships?.find(r => r.type === 'scanlation_group')?.attributes?.name || 'Unknown',
        }));

        res.json({
            chapters,
            total: data.total || 0,
            limit: Number.parseInt(limit),
            offset: Number.parseInt(offset),
        });
    } catch (error) {
        console.error('MangaDex chapters error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

// @route   GET /api/mangadex/chapter/:id/pages
// @desc    Get image URLs for a chapter
router.get('/chapter/:id/pages', auth, async (req, res) => {
    try {
        const { id } = req.params;

        // 1. Get the at-home node URL
        const response = await fetch(`${MANGADEX_BASE}/at-home/server/${id}`);
        if (!response.ok) throw new Error(`MangaDex API error: ${response.status}`);
        const data = await response.json();

        // 2. Construct the URLs for the frontend
        const baseUrl = data.baseUrl;
        const hash = data.chapter.hash;
        const pages = data.chapter.data.map(filename => `${baseUrl}/data/${hash}/${filename}`);
        const dataSaverPages = data.chapter.dataSaver.map(filename => `${baseUrl}/data-saver/${hash}/${filename}`);

        res.json({
            pages,
            dataSaverPages,
            hash
        });
    } catch (error) {
        console.error('MangaDex pages error:', error.message);
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;
