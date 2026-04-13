const express = require('express');
const auth = require('../middleware/auth');

const router = express.Router();

const ANILIST_URL = 'https://graphql.anilist.co';

const normalizeMedia = (media) => {
  // English title preferred, then Romaji
  const title = media.title.english || media.title.romaji || 'Untitled';

  // Determine type (Manga, Anime, Manhwa, Manhua)
  let type = media.type === 'ANIME' ? 'Anime' : 'Manga';
  if (media.type === 'MANGA') {
    if (media.countryOfOrigin === 'KR') type = 'Manhwa';
    else if (media.countryOfOrigin === 'CN') type = 'Manhua';
  }

  // Map status
  const statusMap = {
    FINISHED: 'Completed',
    RELEASING: 'Ongoing',
    NOT_YET_RELEASED: 'Planned',
    CANCELLED: 'Cancelled',
    HIATUS: 'Hiatus'
  };

  return {
    id: media.id,
    title,
    description: media.description?.replace(/<br>/g, '\n').replace(/<i>/g, '').replace(/<\/i>/g, ''),
    coverUrl: media.coverImage.extraLarge || media.coverImage.large,
    type,
    genres: media.genres || [],
    status: statusMap[media.status] || 'Ongoing',
    year: media.seasonYear || media.startDate?.year,
    averageRating: media.averageScore ? media.averageScore / 20 : 0, // AniList is 0-100, we are 0-5
    totalChapters: media.chapters || media.episodes,
    episodes: media.episodes,
    chapters: media.chapters,
    bannerImage: media.bannerImage,
    author: media.staff?.edges?.find(e => e.role?.toLowerCase().includes('story') || e.role?.toLowerCase().includes('original') || e.role?.toLowerCase().includes('director'))?.node?.name?.full || media.staff?.edges?.[0]?.node?.name?.full || 'Unknown Author',
  };
};

// @route   POST /api/anilist/search
// @desc    Search media on AniList
router.get('/search', auth, async (req, res) => {
  try {
    const { search, page = 1, perPage = 20, type = 'MANGA', contentRating, genres } = req.query;

    const query = `
        query ($page: Int, $perPage: Int, $search: String, $isAdult: Boolean, $type: MediaType, $genres: [String]) {
          Page(page: $page, perPage: $perPage) {
            pageInfo {
              total
              currentPage
              lastPage
              hasNextPage
            }
            media(search: $search, sort: POPULARITY_DESC, isAdult: $isAdult, type: $type, genre_in: $genres) {
              id
              title {
                romaji
                english
                native
              }
              genres
              type
              format
              status
              description
              seasonYear
              startDate {
                year
              }
              genres
              countryOfOrigin
              averageScore
              episodes
              chapters
              coverImage {
                extraLarge
                large
              }
              bannerImage
              staff(sort: [RELEVANCE, ID]) {
                edges {
                  role
                  node {
                    name {
                      full
                    }
                  }
                }
              }
            }
          }
        }
        `;

    console.log(`AniList Search: term="${search}", ratings="${contentRating}", type="${type}"`);
    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: {
          page: parseInt(page),
          perPage: parseInt(perPage),
          search: search || undefined,
          type: type,
          genres: genres ? genres.split(',') : undefined,
          isAdult: (() => {
            const adultVars = {
              contentRating,
              hasAdult: contentRating?.includes('pornographic') || contentRating?.includes('erotica'),
              hasSafe: contentRating?.includes('safe') || contentRating?.includes('suggestive')
            };
            console.log('Adult Mapping Logic:', adultVars);
            if (!contentRating) return undefined;
            const ratings = contentRating.split(',');
            const hasAdult = ratings.includes('pornographic') || ratings.includes('erotica');
            const hasSafe = ratings.includes('safe') || ratings.includes('suggestive');
            if (hasAdult && hasSafe) return undefined;
            if (hasAdult) return true;
            return false;
          })(),
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'AniList API Error');
    }

    const mongoose = require('mongoose');
    const Story = mongoose.model('Story');

    let results = data.data.Page.media.map(normalizeMedia);

    // Fusion logic: Find matches in our local DB by title (case-insensitive)
    const titles = results.map(r => r.title);
    const localMatches = await Story.find({
      title: { $in: titles }
    });

    const matchMap = {};
    const syncStatusMap = {};

    localMatches.forEach(s => {
      const key = s.title.toLowerCase();

      // Find the specific result that matches this title AND type compatibility
      const result = results.find(r => {
        if (r.title.toLowerCase() !== key) return false;

        const isLocalAnime = s.type === 'Anime';
        const isExtAnime = r.type === 'Anime';
        return isLocalAnime === isExtAnime;
      });

      if (result) {
        matchMap[key] = s._id;

        const extGenres = result.genres || [];
        const locGenres = s.genres || [];
        const hasNewGenres = extGenres.some(g => !locGenres.includes(g));
        const isDescLonger = (result.description?.length || 0) > (s.description?.length || 0);
        const isTypeUpdated = result.type === 'Manhwa' && s.type === 'Manga';
        const isChaptersBetter = (result.totalChapters || 0) > (s.totalChapters || 0);
        const isAuthorDifferent = result.author && s.author && !s.author.includes(result.author);
        const isIdMissing = !s.anilistId;

        syncStatusMap[key] = !hasNewGenres && !isDescLonger && !isTypeUpdated && !isChaptersBetter && !isAuthorDifferent && !isIdMissing;
      }
    });

    results = results.map(r => ({
      ...r,
      chrollomarkId: matchMap[r.title.toLowerCase()] || null,
      alreadyInSync: syncStatusMap[r.title.toLowerCase()] || false
    }));

    // Perform strict AND filtering for genres if requested
    if (genres) {
      const requestedGenres = genres.split(',');
      results = results.filter(media =>
        requestedGenres.every(rg => media.genres.includes(rg))
      );
    }

    res.json({
      results,
      pageInfo: data.data.Page.pageInfo
    });
  } catch (error) {
    console.error('AniList Search Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/anilist/media/:id
// @desc    Get detailed info from AniList
router.get('/media/:id', auth, async (req, res) => {
  try {
    const query = `
        query ($id: Int) {
          Media(id: $id) {
            id
            title {
              romaji
              english
              native
            }
            type
            format
            status
            description
            seasonYear
            startDate {
              year
            }
            genres
            countryOfOrigin
            averageScore
            episodes
            chapters
            coverImage {
              extraLarge
              large
            }
            bannerImage
            staff(sort: [RELEVANCE, ID]) {
              edges {
                role
                node {
                  name {
                    full
                  }
                }
              }
            }
          }
        }
        `;

    const response = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query,
        variables: { id: parseInt(req.params.id) }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors?.[0]?.message || 'AniList API Error');
    }

    res.json({ media: normalizeMedia(data.data.Media) });
  } catch (error) {
    console.error('AniList Detail Error:', error.message);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
