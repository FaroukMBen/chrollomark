const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const RAPIDAPI_HOST = 'webtoon.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

const fetchWebtoonAPI = async (endpoint, params = {}) => {
    const url = new URL(`https://${RAPIDAPI_HOST}${endpoint}`);
    Object.entries(params).forEach(([key, val]) => {
        if (val !== undefined && val !== null) url.searchParams.append(key, String(val));
    });

    // Always add language=en
    if (!url.searchParams.has('language')) {
        url.searchParams.append('language', 'en');
    }

    console.log(`[Webtoon API] Fetching: ${url.toString()}`);

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
            'x-rapidapi-host': RAPIDAPI_HOST,
            'x-rapidapi-key': RAPIDAPI_KEY,
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.error(`[Webtoon API] Error ${response.status}: ${text}`);
        throw new Error(`Webtoon API error: ${response.status}`);
    }

    return response.json();
};

// Normalize a webtoon title object into a consistent shape
const normalizeTitle = (raw) => ({
    titleNo: raw.titleNo,
    title: raw.title || raw.representTitle || '',
    thumbnail: raw.thumbnail || raw.thumbnailMobile || '',
    author: raw.writingAuthorName || raw.author || '',
    genre: raw.representGenre || '',
    readCount: raw.readCount || raw.totalServiceEpisodeReadCount || 0,
    likeCount: raw.likeitCount || raw.favoriteCount || 0,
    starScore: raw.starScoreAverage || raw.starScore || 0,
    totalEpisodes: raw.totalServiceEpisodeCount || 0,
    summary: raw.synopsis || raw.description || '',
});

// @route   GET /api/webtoon/canvas/titleList
// @desc    Get list of webtoon titles (normalized)
router.get('/canvas/titleList', auth, async (req, res) => {
    try {
        if (!RAPIDAPI_KEY) {
            return res.json({ titles: [], message: 'API key not configured' });
        }
        const { genre, sortOrder = 'READ_COUNT', startIndex = 0, pageSize = 20 } = req.query;
        const data = await fetchWebtoonAPI('/canvas/titles/list', {
            genre: genre || 'ALL',
            sortOrder,
            startIndex: String(startIndex),
            pageSize: String(pageSize),
        });

        // The API response structure varies; try to extract titles from common paths
        let rawTitles = [];
        if (data?.result?.titleList?.titles) {
            rawTitles = data.result.titleList.titles;
        } else if (data?.titleList?.titles) {
            rawTitles = data.titleList.titles;
        } else if (data?.result?.titles) {
            rawTitles = data.result.titles;
        } else if (Array.isArray(data?.titles)) {
            rawTitles = data.titles;
        } else if (Array.isArray(data)) {
            rawTitles = data;
        }

        const titles = rawTitles.map(normalizeTitle);

        res.json({ titles, total: titles.length });
    } catch (error) {
        console.error('Webtoon titleList error:', error.message);
        res.json({ titles: [], message: error.message });
    }
});

// @route   GET /api/webtoon/canvas/search
// @desc    Search webtoons by keyword (normalized)
router.get('/canvas/search', auth, async (req, res) => {
    try {
        if (!RAPIDAPI_KEY) {
            return res.json({ titles: [], message: 'API key not configured' });
        }
        const { query, startIndex = 0, pageSize = 20 } = req.query;
        if (!query) return res.json({ titles: [] });

        const data = await fetchWebtoonAPI('/canvas/search', {
            query,
            startIndex: String(startIndex),
            pageSize: String(pageSize),
        });

        let rawTitles = [];
        if (data?.result?.searchResult) {
            rawTitles = data.result.searchResult;
        } else if (data?.searchResult) {
            rawTitles = data.searchResult;
        } else if (Array.isArray(data?.titles)) {
            rawTitles = data.titles;
        } else if (Array.isArray(data)) {
            rawTitles = data;
        }

        const titles = rawTitles.map(normalizeTitle);

        res.json({ titles, total: titles.length });
    } catch (error) {
        console.error('Webtoon search error:', error.message);
        res.json({ titles: [], message: error.message });
    }
});

// @route   GET /api/webtoon/canvas/titleInfo
// @desc    Get info about a specific webtoon title
router.get('/canvas/titleInfo', auth, async (req, res) => {
    try {
        if (!RAPIDAPI_KEY) {
            return res.json({ title: null, message: 'API key not configured' });
        }
        const { titleNo } = req.query;
        if (!titleNo) return res.status(400).json({ message: 'titleNo required' });

        const data = await fetchWebtoonAPI('/canvas/titles/get-info', { titleNo });

        let rawTitle = data?.result?.titleInfo || data?.titleInfo || data;
        const title = normalizeTitle(rawTitle);

        res.json({ title });
    } catch (error) {
        console.error('Webtoon titleInfo error:', error.message);
        res.status(500).json({ message: 'Failed to fetch webtoon info' });
    }
});

// @route   GET /api/webtoon/canvas/genres
// @desc    Get available genres
router.get('/canvas/genres', auth, async (_req, res) => {
    res.json({
        genres: ['ALL', 'ACTION', 'ROMANCE', 'COMEDY', 'FANTASY', 'DRAMA', 'THRILLER', 'HORROR', 'SLICE_OF_LIFE', 'SUPERNATURAL', 'SPORTS', 'SCI_FI', 'HISTORICAL', 'HEARTWARMING', 'INFORMATIVE'],
    });
});

module.exports = router;
