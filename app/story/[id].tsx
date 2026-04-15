import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSocket } from '@/store/SocketContext';
import { useToast } from '@/store/ToastContext';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeOutUp,
  Layout,
  useAnimatedStyle,
  useDerivedValue,
  withTiming,
  interpolateColor
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedView = Animated.View;
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

// MangaDex UUIDs contain dashes, MongoDB ObjectIds don't
const isMangaDexId = (id: string) => id.includes('-');

export default function StoryDetailScreen() {
  const { id, source, syncWith, syncSrc, keepCover } = useLocalSearchParams<{
    id: string;
    source?: string;
    syncWith?: string;
    syncSrc?: string;
    keepCover?: string;
  }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();
  const { socket } = useSocket();

  const [story, setStory] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [friendsProgress, setFriendsProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMangaDex, setIsMangaDex] = useState(false);
  const [isAniList, setIsAniList] = useState(false);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState<string | null>(null);
  const [isRecommended, setIsRecommended] = useState(false);
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [editChapter, setEditChapter] = useState('');
  const [showRecoInput, setShowRecoInput] = useState(false);
  const [recoMessage, setRecoMessage] = useState('');
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [displayedSeason, setDisplayedSeason] = useState(1);
  const [editSeason, setEditSeason] = useState('1');

  const [showCollPicker, setShowCollPicker] = useState(false);
  const [showFullCollModal, setShowFullCollModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

  // Animated values for active states
  const collPickerActive = useDerivedValue(() => {
    return showCollPicker ? withTiming(1) : withTiming(0);
  });

  const animToggleButtonStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      collPickerActive.value,
      [0, 1],
      ['rgba(0,0,0,0)', colors.primary]
    ),
    borderColor: interpolateColor(
      collPickerActive.value,
      [0, 1],
      [colors.border, colors.primary]
    )
  }));

  const unitLabel = story?.type === 'Anime' ? 'Episode' : 'Chapter';

  // High performance progress scrub
  const [displayedChapter, setDisplayedChapter] = useState(0);
  const holdTimer = useRef<NodeJS.Timeout | null>(null);
  const holdInterval = useRef<NodeJS.Timeout | null>(null);
  const initialChapterRef = useRef(0);

  // Confirmation Modal state
  const [confirmModal, setConfirmModal] = useState({
    visible: false,
    title: '',
    message: '',
    onConfirm: () => { },
    isDestructive: true,
  });

  const loadData = useCallback(async () => {
    try {
      // Priority 1: Force Sync from Explore parameters
      if (syncWith && syncSrc) {
        setIsLoading(true);
        const localData = await api.getStory(id);
        let externalData = null;

        if (syncSrc === 'anilist') {
          externalData = await api.getAniListDetail(syncWith);
          if (externalData.media) {
            const extMeta = externalData.media;
            const localMeta = localData.story;

            // Longest Description wins
            const bestDesc = (extMeta.description?.length || 0) > (localMeta.description?.length || 0)
              ? extMeta.description
              : localMeta.description;

            // Genre Expansion
            const unifiedGenres = Array.from(new Set([...(localMeta.genres || []), ...(extMeta.genres || [])]));

            // Type Priority (Manhwa > Manga)
            let finalType = localMeta.type;
            if (extMeta.type === 'Manhwa' && localMeta.type === 'Manga') finalType = 'Manhwa';

            // Author Merge
            let finalAuthor = localMeta.author || '';
            if (extMeta.author && !finalAuthor.includes(extMeta.author)) {
              finalAuthor = finalAuthor ? `${finalAuthor} | ${extMeta.author}` : extMeta.author;
            }

            // Chapter Sync (Highest wins)
            const extCaps = extMeta.totalChapters || 0;
            const finalChapters = Math.max(localMeta.totalChapters || 0, extCaps);

            const fused = {
              description: bestDesc,
              genres: unifiedGenres,
              type: finalType,
              author: finalAuthor,
              totalChapters: finalChapters,
              anilistId: extMeta.id,
              year: extMeta.year || localMeta.year,
              coverImage: (keepCover === 'true') ? localMeta.coverImage : (extMeta.coverImage || localMeta.coverImage),
            };

            setStory({ ...localMeta, ...fused });

            // PERSIST TO DATABASE
            api.updateStory(id, fused).catch(err => {
              console.error('Failed to persist sync:', err);
            });
          }
        } else if (syncSrc === 'mangadex') {
          externalData = await api.getMangaDexDetail(syncWith);
          if (externalData.manga) {
            const extMeta = externalData.manga;
            const localMeta = localData.story;

            // Longest Description wins
            const bestDesc = (extMeta.description?.length || 0) > (localMeta.description?.length || 0)
              ? extMeta.description
              : localMeta.description;

            // Genre Expansion
            const unifiedGenres = Array.from(new Set([...(localMeta.genres || []), ...(extMeta.tags || [])]));

            // Author Merge
            let finalAuthor = localMeta.author || '';
            if (extMeta.author && !finalAuthor.includes(extMeta.author)) {
              finalAuthor = finalAuthor ? `${finalAuthor} | ${extMeta.author}` : extMeta.author;
            }

            // Chapter Sync (Highest wins)
            const extCaps = extMeta.lastChapter || 0;
            const finalChapters = Math.max(localMeta.totalChapters || 0, extCaps);

            const fused = {
              description: bestDesc,
              genres: unifiedGenres,
              author: finalAuthor,
              totalChapters: finalChapters,
              coverImage: (keepCover === 'true') ? localMeta.coverImage : (extMeta.coverUrlHQ || extMeta.coverUrl || localMeta.coverImage),
              mangadexId: extMeta.id,
              contentRating: extMeta.contentRating,
            };

            setStory({ ...localMeta, ...fused });

            // PERSIST TO DATABASE
            api.updateStory(id, fused).catch(err => {
              console.error('Failed to persist sync:', err);
            });
          }
        }

        setProgress(localData.userProgress || null);

        setFriendsProgress(localData.friendsProgress || []);
        setReviews(localData.reviews || []);
        setIsRecommended(localData.isRecommended || false);
        setDisplayedChapter(localData.userProgress?.currentChapter || 0);
        setIsMangaDex(false);
        setIsAniList(false);
        return;
      }

      // Priority 2: Standard Fusion or Direct Load
      if (source === 'anilist' || (!isMangaDexId(id) && id.length < 24 && !isNaN(Number(id)))) {
        // It's an AniList ID
        setIsAniList(true);
        setIsMangaDex(false);

        // Parallel fetch for speed
        const [alData, localStory] = await Promise.all([
          api.getAniListDetail(id),
          api.findStoryByExternalId({ anilistId: id }).catch(() => null)
        ]);

        if (alData.media) {
          let fusedStory = {
            _id: localStory?._id || null,
            title: alData.media.title,
            coverImage: alData.media.coverUrl,
            description: alData.media.description,
            type: alData.media.type,
            genres: alData.media.genres,
            author: alData.media.author,
            status: alData.media.status,
            totalChapters: alData.media.totalChapters,
            averageRating: alData.media.averageRating || 0,
            year: alData.media.year,
            anilistId: alData.media.id,
            // Carry over local metrics if they exist
            views: localStory?.views || 0,
            totalReaders: localStory?.totalReaders || 0,
          };

          if (localStory?._id) {
            // Further enrichment with local metadata (reviews, progress)
            const localData = await api.getStory(localStory._id);
            setStory({ ...fusedStory, ...localData.story, description: fusedStory.description });
            setProgress(localData.userProgress || null);
            setFriendsProgress(localData.friendsProgress || []);
            setReviews(localData.reviews || []);
            setIsRecommended(localData.isRecommended || false);
            setDisplayedChapter(localData.userProgress?.currentChapter || 0);
            setEditChapter(String(localData.userProgress?.currentChapter || 0));
            setDisplayedSeason(localData.userProgress?.currentSeason || 1);
            setEditSeason(String(localData.userProgress?.currentSeason || 1));
            setIsAniList(false); // We have a local match!
          } else {
            setStory(fusedStory);
          }
        }
      } else if (source === 'mangadex' || isMangaDexId(id)) {
        // It's a MangaDex UUID
        setIsMangaDex(true);
        setIsAniList(false);

        const [mdData, localStory] = await Promise.all([
          api.getMangaDexDetail(id),
          api.findStoryByExternalId({ mangadexId: id }).catch(() => null)
        ]);

        if (mdData.manga) {
          let fusedStory = {
            _id: localStory?._id || null,
            title: mdData.manga.title,
            coverImage: mdData.manga.coverUrlHQ || mdData.manga.coverUrl,
            description: mdData.manga.description,
            type: 'Manga',
            genres: mdData.manga.tags || [],
            author: mdData.manga.author,
            status: mdData.manga.status,
            totalChapters: mdData.manga.lastChapter ? Number.parseInt(mdData.manga.lastChapter, 10) : null,
            year: mdData.manga.year,
            mangadexId: mdData.manga.id,
            contentRating: mdData.manga.contentRating,
            views: localStory?.views || 0,
          };

          if (localStory?._id) {
            const localData = await api.getStory(localStory._id);
            setStory({ ...fusedStory, ...localData.story, coverImage: fusedStory.coverImage });
            setProgress(localData.userProgress || null);
            setFriendsProgress(localData.friendsProgress || []);
            setReviews(localData.reviews || []);
            setIsRecommended(localData.isRecommended || false);
            setDisplayedChapter(localData.userProgress?.currentChapter || 0);
            setEditChapter(String(localData.userProgress?.currentChapter || 0));
            setIsMangaDex(false);
          } else {
            setStory(fusedStory);
          }
        }
      } else {
        // Standard MongoDB ID flow
        const data = await api.getStory(id);
        setStory(data.story);
        setProgress(data.userProgress);
        setFriendsProgress(data.friendsProgress || []);
        setReviews(data.reviews || []);
        setIsRecommended(data.isRecommended || false);
        setDisplayedChapter(data.userProgress?.currentChapter || 0);
        setEditChapter(String(data.userProgress?.currentChapter || 0));
        setDisplayedSeason(data.userProgress?.currentSeason || 1);
        setEditSeason(String(data.userProgress?.currentSeason || 1));
      }
      const colls = await api.getMyCollections().catch(() => []);
      setCollections(colls);
    } catch (error) {
      console.log('Fusion Load Error:', error);
      showToast({ message: 'Could not sync story data', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [id, source]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time progress updates from friends
  useEffect(() => {
    if (socket && story && !isMangaDex && !isAniList) {
      const handleProgressUpdate = (update: any) => {
        const updateStoryId = update.story?._id || update.story;
        if (updateStoryId === story._id) {
          // A friend updated their progress for this story, refresh silently
          loadData();
        }
      };

      socket.on('progress_update', handleProgressUpdate);
      return () => {
        socket.off('progress_update', handleProgressUpdate);
      };
    }
  }, [socket, story, isMangaDex, isAniList, loadData]);

  // Clone from external sources to local DB
  const handleCloneAndAdd = async (forcePrivate: boolean = false) => {
    if (!story) return;
    try {
      let result;
      if (isMangaDex) {
        result = await api.cloneMangaDex({
          mangadexId: story.mangadexId || id,
          title: story.title,
          description: story.description,
          coverImage: story.coverImage,
          author: story.author,
          status: story.status,
          totalChapters: story.totalChapters ? String(story.totalChapters) : undefined,
          genres: story.genres,
          year: story.year,
          contentRating: story.contentRating,
        });
        setIsMangaDex(false);
      } else if (isAniList) {
        result = await api.cloneAniList({
          anilistId: story.anilistId || parseInt(id),
          title: story.title,
          author: story.author,
          description: story.description,
          coverImage: story.coverImage,
          type: story.type,
          genres: story.genres,
          status: story.status,
          totalChapters: story.totalChapters,
          year: story.year,
          contentRating: story.genres?.includes('Hentai') ? 'pornographic' : 'safe',
        });
        setIsAniList(false);
      }

      if (result) {
        // Now add to reading progress
        const p = await api.updateProgress({
          storyId: result.story._id,
          status: 'Plan to Read',
          isPrivate: forcePrivate
        });
        setProgress(p);
        setDisplayedChapter(p.currentChapter || 0);
        setDisplayedSeason(p.currentSeason || 1);
        setStory(result.story);
        showToast({ message: result.created ? 'Added to library!' : 'Updated in library!', type: 'success' });
      }
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add', type: 'error' });
    }
  };

  const handleAddToLibrary = async (forcePrivate: boolean = false) => {
    if (isMangaDex || isAniList) {
      await handleCloneAndAdd(forcePrivate);
    } else {
      try {
        const p = await api.updateProgress({
          storyId: story?._id || id,
          status: 'Plan to Read',
          isPrivate: forcePrivate
        });
        setProgress(p);
        setDisplayedChapter(p.currentChapter || 0);
        setDisplayedSeason(p.currentSeason || 1);
      } catch (error: any) {
        showToast({ message: error.message, type: 'error' });
      }
    }
  };

  const handleRemoveFromLibrary = async () => {
    setConfirmModal({
      visible: true,
      title: "Remove from Library",
      message: "Are you sure you want to remove this story and all your reading progress?",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await api.removeFromLibrary(story?._id || id);
          setProgress(null);
          showToast({ message: 'Removed from library', type: 'success' });
        } catch (error: any) {
          showToast({ message: error.message, type: 'error' });
        }
      }
    });
  };

  const handleTogglePrivacy = async () => {
    if (!progress) return;
    try {
      const isPrivate = !progress.isPrivate;
      const updated = await api.updateProgress({
        storyId: story?._id || id,
        isPrivate: isPrivate
      });
      setProgress(updated);
      showToast({ 
        message: isPrivate ? 'Story is now hidden from your profile' : 'Story is now public', 
        type: 'success' 
      });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const storyId = story?._id || id;
      const p = await api.updateProgress({ storyId, status: newStatus });
      setProgress(p);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleDeleteStory = async () => {
    setShowManageModal(false);
    setConfirmModal({
      visible: true,
      title: "Delete Story",
      message: "Are you sure you want to PERMANENTLY delete this story from the database? This cannot be undone.",
      isDestructive: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, visible: false }));
        try {
          await api.deleteStory(story._id);
          showToast({ message: 'Story deleted forever', type: 'success' });
          router.back();
        } catch (error: any) {
          showToast({ message: error.message, type: 'error' });
        }
      }
    });
  };

  const handleUpdateManualProgress = async () => {
    const chapter = parseInt(editChapter);
    const season = parseInt(editSeason);
    if (isNaN(chapter) || isNaN(season)) {
      setEditChapter(String(displayedChapter));
      setEditSeason(String(displayedSeason));
      setIsEditingProgress(false);
      return;
    }

    try {
      const updated = await api.updateProgress({
        storyId: story?._id || id,
        currentChapter: chapter,
        currentSeason: season,
      });
      setProgress(updated);
      setDisplayedChapter(updated.currentChapter);
      setDisplayedSeason(updated.currentSeason);
      setIsEditingProgress(false);
      showToast({ message: 'Progress updated', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
      setEditChapter(String(displayedChapter));
      setEditSeason(String(displayedSeason));
    }
  };

  const handleIncrement = async () => {
    if (!progress) return;
    try {
      // Local optimistic update
      let nextChapter = displayedChapter + 1;
      let nextSeason = displayedSeason;

      if (story.type === 'Anime' && story.totalChapters && nextChapter > story.totalChapters) {
        nextChapter = 1;
        nextSeason += 1;
      }

      setDisplayedChapter(nextChapter);
      setDisplayedSeason(nextSeason);
      setEditChapter(String(nextChapter));
      setEditSeason(String(nextSeason));

      const updated = await api.incrementChapter(progress._id);
      setProgress(updated);
      setDisplayedChapter(updated.currentChapter);
      setDisplayedSeason(updated.currentSeason || 1);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
      setDisplayedChapter(progress.currentChapter);
      setDisplayedSeason(progress.currentSeason || 1);
    }
  };

  const handleDecrement = async () => {
    if (!progress || displayedChapter === 0 && displayedSeason === 1) return;
    try {
      // Local optimistic update
      let nextChapter = displayedChapter - 1;
      let nextSeason = displayedSeason;

      if (displayedChapter === 1 && story.type === 'Anime' && displayedSeason > 1) {
        nextSeason -= 1;
        nextChapter = story.totalChapters || 1;
      } else if (displayedChapter === 0) {
        return;
      }

      setDisplayedChapter(nextChapter);
      setDisplayedSeason(nextSeason);
      setEditChapter(String(nextChapter));
      setEditSeason(String(nextSeason));

      const updated = await api.decrementChapter(progress._id);
      setProgress(updated);
      setDisplayedChapter(updated.currentChapter);
      setDisplayedSeason(updated.currentSeason || 1);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
      setDisplayedChapter(progress.currentChapter);
      setDisplayedSeason(progress.currentSeason || 1);
    }
  };

  const handleSeasonIncrement = async () => {
    if (!progress) return;
    const nextSeason = displayedSeason + 1;
    try {
      setDisplayedSeason(nextSeason);
      setEditSeason(String(nextSeason));
      const updated = await api.updateProgress({
        storyId: story._id || id,
        currentSeason: nextSeason
      });
      setProgress(updated);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
      setDisplayedSeason(progress.currentSeason);
    }
  };

  const handleSeasonDecrement = async () => {
    if (!progress || displayedSeason <= 1) return;
    const nextSeason = displayedSeason - 1;
    try {
      setDisplayedSeason(nextSeason);
      setEditSeason(String(nextSeason));
      const updated = await api.updateProgress({
        storyId: story._id || id,
        currentSeason: nextSeason
      });
      setProgress(updated);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
      setDisplayedSeason(progress.currentSeason);
    }
  };

  const syncHoldValue = async (finalValue: number) => {
    if (!progress || finalValue === progress.currentChapter) return;
    try {
      const p = await api.updateProgress({
        storyId: story._id || id,
        currentChapter: finalValue
      });
      setProgress(p);
    } catch (error: any) {
      setDisplayedChapter(progress.currentChapter);
      showToast({ message: 'Sync failed: ' + error.message, type: 'error' });
    }
  };

  const startHold = (direction: 'up' | 'down') => {
    if (!progress) return;
    initialChapterRef.current = displayedChapter;
    holdTimer.current = setTimeout(() => {
      holdInterval.current = setInterval(() => {
        setDisplayedChapter(prev => {
          const next = direction === 'up' ? prev + 1 : prev - 1;
          return Math.max(0, next);
        });
      }, 100);
    }, 400);
  };

  const stopHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdInterval.current) {
      clearInterval(holdInterval.current);
      // Only sync if we actually held long enough to start the interval
      syncHoldValue(displayedChapter);
    }
    holdTimer.current = null;
    holdInterval.current = null;
  };

  const handleSubmitReview = async () => {
    try {
      if (reviewRating === 0) {
        showToast({ message: 'Please select a rating', type: 'error' });
        return;
      }
      await api.createReview({
        storyId: story?._id || id,
        rating: reviewRating,
        text: reviewText,
      });
      setShowReviewForm(false);
      setReviewText('');
      setReviewRating(5);
      setEditingReviewId(null);
      await loadData();
      showToast({ message: editingReviewId ? 'Review updated' : 'Review submitted', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleEditReview = (review: any) => {
    setReviewRating(review.rating);
    setReviewText(review.text || '');
    setEditingReviewId(review._id);
    setShowReviewForm(true);
  };

  const handleDeleteReview = async () => {
    if (!reviewToDelete) return;
    try {
      await api.deleteReview(reviewToDelete);
      setShowDeleteConfirm(false);
      setReviewToDelete(null);
      await loadData();
      showToast({ message: 'Review deleted', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleLikeReview = async (reviewId: string) => {
    try {
      const updatedReview = await api.likeReview(reviewId);
      setReviews(prev => prev.map(r => r._id === reviewId ? updatedReview : r));
    } catch (error: any) {
      showToast({ message: 'Action failed', type: 'error' });
    }
  };

  const handleAddToCollection = async (collectionId: string) => {
    try {
      let storyId = story?._id;
      const targetColl = collections.find(c => c._id === collectionId);
      const isAlreadyIn = targetColl?.stories?.some((s: any) => s._id === storyId);

      if (isAlreadyIn) {
        setConfirmModal({
          visible: true,
          title: "Remove from Collection",
          message: `Are you sure you want to remove "${story.title}" from "${targetColl.name}"?`,
          onConfirm: async () => {
            setConfirmModal(prev => ({ ...prev, visible: false }));
            try {
              await api.removeFromCollection(collectionId, storyId);
              setCollections(prev => prev.map(c =>
                c._id === collectionId
                  ? { ...c, stories: c.stories.filter((s: any) => s._id !== storyId) }
                  : c
              ));
              showToast({ message: 'Removed from collection', type: 'info' });
            } catch (err: any) {
              showToast({ message: err.message, type: 'error' });
            }
          },
          isDestructive: true
        });
        return;
      }

      // If it's a MangaDex story without a local ID, clone first
      if (!storyId && isMangaDex) {
        const result = await api.cloneMangaDex({
          mangadexId: story.mangadexId || id,
          title: story.title,
          description: story.description,
          coverImage: story.coverImage,
          author: story.author,
          status: story.status,
          totalChapters: story.totalChapters ? String(story.totalChapters) : undefined,
          genres: story.genres,
          year: story.year,
        });
        storyId = result.story._id;
        setStory(result.story);
        setIsMangaDex(false);
      }
      await api.addToCollection(collectionId, storyId);
      setCollections(prev => prev.map(c =>
        c._id === collectionId
          ? { ...c, stories: [...(c.stories || []), { _id: storyId }] }
          : c
      ));
      setShowCollPicker(false);
      showToast({ message: 'Added to collection!', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Error updating collection', type: 'error' });
    }
  };

  const handleLike = async () => {
    if (!story || isMangaDex) return;
    try {
      const result = await api.likeStory(story._id);
      setStory({
        ...story,
        likes: result.isLiked
          ? [...(story.likes || []), user?._id]
          : (story.likes || []).filter((id: any) => id !== user?._id),
        dislikes: (story.dislikes || []).filter((id: any) => id !== user?._id)
      });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleDislike = async () => {
    if (!story || isMangaDex) return;
    try {
      const result = await api.dislikeStory(story._id);
      setStory({
        ...story,
        dislikes: result.isDisliked
          ? [...(story.dislikes || []), user?._id]
          : (story.dislikes || []).filter((id: any) => id !== user?._id),
        likes: (story.likes || []).filter((id: any) => id !== user?._id)
      });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleToggleFavorite = async () => {
    let storyId = story?._id;
    if (!storyId && isMangaDex) {
      // Clone if it's MangaDex
      try {
        setIsLoading(true);
        const result = await api.cloneMangaDex({
          mangadexId: story.mangadexId || id,
          title: story.title,
          description: story.description,
          coverImage: story.coverImage,
          author: story.author,
          status: story.status,
          totalChapters: story.totalChapters ? String(story.totalChapters) : undefined,
          genres: story.genres,
          year: story.year,
        });
        storyId = result.story._id;
        setStory(result.story);
        setIsMangaDex(false);
      } catch (e: any) {
        showToast({ message: e.message || 'Failed to clone story', type: 'error' });
        return;
      } finally {
        setIsLoading(false);
      }
    }

    if (!storyId) return;

    try {
      const result = await api.toggleFavorite(storyId);
      setProgress(progress ? { ...progress, isFavorite: result.isFavorite } : { isFavorite: result.isFavorite, status: 'Plan to Read', currentChapter: 0 });
      showToast({
        message: result.isFavorite ? 'Added to favorites' : 'Removed from favorites',
        type: 'success'
      });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleRecommend = async () => {
    let storyId = story?._id;
    if (!storyId && isMangaDex) {
      try {
        setIsLoading(true);
        const result = await api.cloneMangaDex({
          mangadexId: story.mangadexId || id,
          title: story.title,
          description: story.description,
          coverImage: story.coverImage,
          author: story.author,
          status: story.status,
          totalChapters: story.totalChapters ? String(story.totalChapters) : undefined,
          genres: story.genres,
          year: story.year,
        });
        storyId = result.story._id;
        setStory(result.story);
        setIsMangaDex(false);
      } catch (e: any) {
        showToast({ message: e.message || 'Failed to clone story', type: 'error' });
      } finally {
        setIsLoading(false);
      }
    }
    if (!storyId) return;
    try {
      const result = await api.recommendStory(storyId, recoMessage);
      setIsRecommended(result.isRecommended);
      setShowRecoInput(false);
      setRecoMessage('');
      showToast({ message: result.message, type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const confirmRecommend = () => {
    if (isRecommended) {
      setConfirmModal({
        visible: true,
        title: "Remove Recommendation",
        message: "Are you sure you want to remove this recommendation?",
        isDestructive: true,
        onConfirm: () => {
          setConfirmModal(prev => ({ ...prev, visible: false }));
          handleRecommend();
        }
      });
    } else {
      setShowRecoInput(!showRecoInput);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!story) return null;

  const statusLabel = story.status
    ? story.status.charAt(0).toUpperCase() + story.status.slice(1)
    : 'Ongoing';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* New Immersive Background */}
          <View style={styles.immersiveHeader}>
            <Image
              source={{ uri: api.resolveImageUrl(story.coverImage) }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              blurRadius={50}
            />
            <LinearGradient
              colors={['transparent', colors.background]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          <View style={styles.floatingHeader}>
            <TouchableOpacity style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]} onPress={() => router.back()}>
              <IconSymbol name="arrow.left" size={20} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]}
              onPress={() => setShowManageModal(true)}>
              <IconSymbol name="ellipsis" size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Main Info Section */}
          <View style={styles.heroLayout}>
            <View style={styles.coverContainer}>
              {story.coverImage ? (
                <Image source={{ uri: api.resolveImageUrl(story.coverImage) }} style={styles.mainCover} contentFit="cover" />
              ) : (
                <View style={[styles.mainCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                  <IconSymbol name="book.fill" size={64} color={colors.textSecondary} />
                </View>
              )}
            </View>

            <View style={styles.mainMeta}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <Text style={[styles.mainTitle, { color: colors.text, flexShrink: 1 }]}>{story.title}</Text>
                {progress?.isPrivate && (
                  <View style={{ backgroundColor: colors.accent + '20', padding: 4, borderRadius: 6 }}>
                    <IconSymbol name="lock.fill" size={14} color={colors.accent} />
                  </View>
                )}
              </View>
              <Text style={[styles.mainAuthor, { color: colors.textSecondary }]}>{story.author || 'Unknown Author'}</Text>

              <View style={styles.statsPillRow}>
                <View style={[styles.pill, { backgroundColor: colors.primary + '15' }]}>
                  <Text style={[styles.pillText, { color: colors.primary }]}>{story.type?.toUpperCase() || 'MANGA'}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: (StatusColors[statusLabel] || colors.primary) + '15' }]}>
                  <Text style={[styles.pillText, { color: StatusColors[statusLabel] || colors.primary }]}>{statusLabel.toUpperCase()}</Text>
                </View>
                {story.year && (
                  <View style={[styles.pill, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.pillText, { color: colors.textSecondary }]}>{story.year}</Text>
                  </View>
                )}
              </View>

              {story.genres && story.genres.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, justifyContent: 'center' }}>
                  {story.genres.map((g: string) => (
                    <View key={g} style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: colors.textSecondary, letterSpacing: 0.5 }}>{g.toUpperCase()}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Action Row - Clean and Direct */}
          <View style={styles.heroActionsFull}>
            <View style={styles.mainActionRow}>
              <TouchableOpacity
                style={[
                  styles.premiumAddBtn, 
                  { backgroundColor: progress ? colors.surfaceElevated : colors.primary }
                ]}
                onPress={() => handleAddToLibrary(false)}
                disabled={!!progress}>
                <IconSymbol
                  name={progress ? "checkmark.circle.fill" : "plus"}
                  size={20}
                  color={progress ? colors.success : "#FFF"}
                />
                <Text style={[styles.premiumAddBtnText, { color: progress ? colors.success : "#FFF" }]}>
                  {progress ? 'In Library' : 'Add to Library'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.premiumIconBtn, { borderColor: colors.border }]}
                onPress={handleToggleFavorite}>
                <IconSymbol
                  name={progress?.isFavorite ? "heart.fill" : "heart"}
                  size={20}
                  color={progress?.isFavorite ? colors.error : colors.textSecondary}
                />
              </TouchableOpacity>

              {progress && (
                <TouchableOpacity
                  style={[
                    styles.premiumIconBtn, 
                    { 
                      borderColor: progress.isPrivate ? colors.accent + '40' : colors.border,
                      backgroundColor: progress.isPrivate ? colors.accent + '10' : 'transparent'
                    }
                  ]}
                  onPress={handleTogglePrivacy}>
                  <IconSymbol 
                    name={progress.isPrivate ? "eye.slash.fill" : "eye.fill"} 
                    size={20} 
                    color={progress.isPrivate ? colors.accent : colors.textSecondary} 
                  />
                </TouchableOpacity>
              )}

              <AnimatedTouchableOpacity
                style={[
                  styles.premiumIconBtn,
                  animToggleButtonStyle
                ]}
                onPress={() => setShowCollPicker(!showCollPicker)}>
                <IconSymbol
                  name="square.grid.2x2.fill"
                  size={20}
                  color={showCollPicker ? "#FFF" : colors.textSecondary}
                />
              </AnimatedTouchableOpacity>
            </View>

            {!progress && (
              <TouchableOpacity
                style={[styles.ghostPrivateBtn, { borderColor: colors.accent + '30' }]}
                onPress={() => handleAddToLibrary(true)}>
                <IconSymbol name="eye.slash.fill" size={16} color={colors.accent} />
                <Text style={[styles.ghostPrivateBtnText, { color: colors.accent }]}>
                  Add Privately (Incognito)
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Integrated Collection Picker Drawer - 2x2 Grid */}
          {showCollPicker && (
            <View style={{ marginBottom: Spacing.xl, paddingHorizontal: Spacing.lg }}>
              <View style={{
                backgroundColor: colors.surface,
                padding: 16,
                borderRadius: 24,
                borderWidth: 1,
                borderColor: colors.border,
                ...Shadows.md
              }}>
                <View style={{ marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconSymbol name="square.grid.2x2.fill" size={14} color={colors.textSecondary} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: colors.textSecondary, letterSpacing: 1 }}>MANAGE COLLECTIONS</Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' }}>
                  {/* Slot 1: Add New */}
                  <TouchableOpacity
                    style={{
                      width: '48%',
                      height: 100,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderStyle: 'dashed',
                      borderColor: colors.border,
                      justifyContent: 'center',
                      alignItems: 'center',
                      backgroundColor: colors.surfaceElevated + '30',
                      gap: 6
                    }}
                    onPress={() => router.push('/collection/create' as any)}>
                    <IconSymbol name="plus" size={20} color={colors.primary} />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: colors.primary }}>NEW LIST</Text>
                  </TouchableOpacity>

                  {/* Slots 2-4: Collections or See More */}
                  {(() => {
                    const visibleColls = collections.slice(0, collections.length > 3 ? 2 : 3);
                    const showSeeMore = collections.length > 3;

                    return (
                      <>
                        {visibleColls.map((coll) => {
                          const isAlreadyIn = coll.stories?.some((s: any) => s._id === (story?._id || id));
                          return (
                            <TouchableOpacity
                              key={coll._id}
                              style={{
                                width: '48%',
                                height: 100,
                                borderRadius: 20,
                                backgroundColor: colors.surfaceElevated,
                                borderWidth: 1.5,
                                borderColor: isAlreadyIn ? coll.color : colors.border,
                                padding: 12,
                                justifyContent: 'center',
                                alignItems: 'center',
                                ...Shadows.sm
                              }}
                              onPress={() => handleAddToCollection(coll._id)}>
                              <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: coll.color + '15', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }}>
                                <IconSymbol name={isAlreadyIn ? "checkmark.circle.fill" : "folder.fill"} size={16} color={coll.color || colors.primary} />
                              </View>
                              <Text style={{ fontSize: 12, fontWeight: '800', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{coll.name}</Text>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: colors.textSecondary, marginTop: 2 }}>{coll.stories?.length || 0} ITEMS</Text>
                            </TouchableOpacity>
                          );
                        })}

                        {showSeeMore && (
                          <TouchableOpacity
                            style={{
                              width: '48%',
                              height: 100,
                              borderRadius: 20,
                              backgroundColor: colors.surface,
                              borderWidth: 1.5,
                              borderColor: colors.border,
                              justifyContent: 'center',
                              alignItems: 'center',
                              gap: 6
                            }}
                            onPress={() => setShowFullCollModal(true)}>
                            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }}>
                              <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} />
                            </View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: colors.textSecondary }}>SEE ALL</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    );
                  })()}
                </View>
              </View>
            </View>
          )}

          <View style={[styles.section, { marginTop: -Spacing.sm }]}>
            <View style={[styles.voteGroupResponsive, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity
                style={[styles.voteBtn, story.likes?.includes(user?._id) && { backgroundColor: colors.success + '10' }]}
                onPress={handleLike}>
                <IconSymbol
                  name={story.likes?.includes(user?._id) ? "hand.thumbsup.fill" : "hand.thumbsup"}
                  size={16}
                  color={story.likes?.includes(user?._id) ? colors.success : colors.textSecondary}
                />
                <Text style={[styles.voteText, { color: story.likes?.includes(user?._id) ? colors.success : colors.textSecondary }]}>
                  {story.likes?.length || 0}
                </Text>
              </TouchableOpacity>

              <View style={[styles.voteDivider, { backgroundColor: colors.border }]} />

              <TouchableOpacity
                style={[styles.voteBtn, story.dislikes?.includes(user?._id) && { backgroundColor: colors.error + '10' }]}
                onPress={handleDislike}>
                <IconSymbol
                  name={story.dislikes?.includes(user?._id) ? "hand.thumbsdown.fill" : "hand.thumbsdown"}
                  size={16}
                  color={story.dislikes?.includes(user?._id) ? colors.error : colors.textSecondary}
                />
                <Text style={[styles.voteText, { color: story.dislikes?.includes(user?._id) ? colors.error : colors.textSecondary }]}>
                  {story.dislikes?.length || 0}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {!isMangaDex && (
            <View style={[styles.section, { paddingHorizontal: Spacing.lg }]}>
              <TouchableOpacity
                style={[styles.recommendActionBtn, { borderColor: isRecommended ? colors.accent : colors.border }]}
                onPress={confirmRecommend}>
                <IconSymbol
                  name={isRecommended ? "star.fill" : "star"}
                  size={16}
                  color={isRecommended ? colors.accent : colors.textSecondary}
                />
                <Text style={[styles.recommendActionText, { color: isRecommended ? colors.accent : colors.textSecondary }]}>
                  {isRecommended ? 'Recommended' : 'Recommend to Friends'}
                </Text>
              </TouchableOpacity>

              {showRecoInput && (
                <View style={[styles.recoInputContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <TextInput
                    style={[styles.recoTextInput, { color: colors.text }]}
                    placeholder="Add a message (optional)..."
                    placeholderTextColor={colors.textSecondary}
                    value={recoMessage}
                    onChangeText={setRecoMessage}
                    multiline
                  />
                  <View style={styles.recoActionRow}>
                    <TouchableOpacity
                      style={[styles.recoCancelBtn, { borderColor: colors.border }]}
                      onPress={() => setShowRecoInput(false)}>
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.recoConfirmBtn, { backgroundColor: colors.accent }]}
                      onPress={() => handleRecommend()}>
                      <Text style={{ color: '#FFF', fontWeight: '700' }}>Confirm</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Friends' Progress Section */}
          {!isMangaDex && friendsProgress.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconSymbol name="person.2.fill" size={18} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>Friends Progress</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.friendsProgressScroll}>
                {friendsProgress.map((fp) => {
                  return (
                    <View key={fp._id} style={[styles.friendProgressCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                      {fp.user?.avatar ? (
                        <Image source={{ uri: api.resolveImageUrl(fp.user.avatar) }} style={styles.friendAvatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.friendAvatar, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={[styles.avatarLetter, { color: colors.primary, fontSize: 14 }]}>
                            {fp.user?.username?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.friendMeta}>
                        <Text style={[styles.friendName, { color: colors.text }]} numberOfLines={1}>
                          {fp.user?.username}
                        </Text>
                        <View style={styles.friendSubMeta}>
                          <Text style={[styles.friendProgressText, { color: colors.primary }]}>
                            {story?.type === 'Anime' ? `S${fp.currentSeason} E${fp.currentChapter}` : `${unitLabel[0]}. ${fp.currentChapter}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Friends' Progress Section moved down */}

          {/* Description */}
          {story.description ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
              <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
                {story.description}
              </Text>
            </View>
          ) : null}

          {/* Reading Progress Dashboard */}
          {!isMangaDex && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <IconSymbol name="book.fill" size={18} color={colors.text} />
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>My Progress</Text>
                </View>
              </View>

              {!progress ? (
                <View style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated + '50' }]}>
                  <Text style={[styles.noReviews, { color: colors.textSecondary }]}>Add to library to track your progress</Text>
                </View>
              ) : (
                <View style={[styles.managementCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  {/* Top Bar: Status & Edit Toggle */}
                  <View style={styles.cardHeader}>
                    <TouchableOpacity
                      style={[styles.statusDropdown, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                      onPress={() => setShowStatusPicker(!showStatusPicker)}>
                      <View style={[styles.statusIndicator, { backgroundColor: StatusColors[progress.status] || colors.primary }]} />
                      <Text style={[styles.currentStatusText, { color: colors.text }]}>{progress.status}</Text>
                      <IconSymbol name={showStatusPicker ? "chevron.up" : "chevron.down"} size={14} color={colors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.miniEditBtn, isEditingProgress && { backgroundColor: colors.primary }]}
                      onPress={() => setIsEditingProgress(!isEditingProgress)}>
                      <IconSymbol name={isEditingProgress ? "xmark" : "pencil"} size={14} color={isEditingProgress ? "#FFF" : colors.textSecondary} />
                    </TouchableOpacity>
                  </View>

                  {showStatusPicker && (
                    <View style={styles.statusPickerGrid}>
                      {['Reading', 'Completed', 'Plan to Read', 'On Hold', 'Dropped'].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.statusPickerItem,
                            { borderColor: colors.border },
                            progress.status === s && { backgroundColor: (StatusColors[s] || colors.primary) + '15', borderColor: StatusColors[s] || colors.primary }
                          ]}
                          onPress={() => { handleStatusChange(s); setShowStatusPicker(false); }}>
                          <View style={[styles.statusItemSmallDot, { backgroundColor: StatusColors[s] || colors.primary }]} />
                          <Text style={[styles.statusPickerText, { color: progress.status === s ? (StatusColors[s] || colors.primary) : colors.textSecondary }]}>{s}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  {/* Elegant Season Control (Anime only) */}
                  {story.type === 'Anime' && !isEditingProgress && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 12 }}>
                      <TouchableOpacity
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' }}
                        onPress={handleSeasonDecrement}>
                        <IconSymbol name="chevron.left" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <View style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: BorderRadius.full, backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '30' }}>
                        <Text style={{ fontSize: 13, fontWeight: '900', color: colors.primary, letterSpacing: 1.5 }}>SEASON {displayedSeason}</Text>
                      </View>
                      <TouchableOpacity
                        style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.03)', justifyContent: 'center', alignItems: 'center' }}
                        onPress={handleSeasonIncrement}>
                        <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  )}

                  <View style={styles.counterSection}>
                    <TouchableOpacity
                      style={[styles.stepperBtn, { borderColor: colors.border }]}
                      onPress={handleDecrement}
                      onPressIn={() => startHold('down')}
                      onPressOut={stopHold}>
                      <IconSymbol name="minus" size={24} color={colors.text} />
                    </TouchableOpacity>

                    <View style={styles.chapterCenter}>
                      {isEditingProgress ? (
                        <View style={styles.inlineEditWrapper}>
                          {story.type === 'Anime' && (
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={[styles.editPrefix, { color: colors.textSecondary }]}>S</Text>
                              <TextInput style={[styles.centeredChapterInput, { color: colors.primary, width: 45 }]} value={editSeason} onChangeText={setEditSeason} keyboardType="numeric" selectTextOnFocus />
                              <Text style={[styles.editPrefix, { color: colors.textSecondary, marginLeft: 8 }]}>E</Text>
                            </View>
                          )}
                          <TextInput
                            style={[styles.centeredChapterInput, { color: colors.primary }]}
                            value={editChapter}
                            onChangeText={setEditChapter}
                            keyboardType="numeric"
                            returnKeyType="done"
                            autoFocus
                            selectTextOnFocus
                            onBlur={handleUpdateManualProgress}
                            onSubmitEditing={handleUpdateManualProgress}
                          />
                        </View>
                      ) : (
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setIsEditingProgress(true)} style={{ alignItems: 'center' }}>
                          <Text style={[styles.bigChapterNumber, { color: colors.text }]}>{displayedChapter}</Text>
                          <Text style={[styles.counterUnit, { color: colors.textSecondary }]}>{story.type === 'Anime' ? 'EPISODE' : unitLabel.toUpperCase()}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <TouchableOpacity
                      style={[styles.stepperBtnPrimary, { backgroundColor: colors.primary }]}
                      onPress={handleIncrement}
                      onPressIn={() => startHold('up')}
                      onPressOut={stopHold}>
                      <IconSymbol name="plus" size={24} color="#FFF" />
                    </TouchableOpacity>
                  </View>

                  {story.totalChapters > 0 && (
                    <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceElevated }]}>
                      <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${Math.min((displayedChapter / story.totalChapters) * 100, 100)}%` }]} />
                    </View>
                  )}

                  {/* PREMIUM PRIVACY ROW */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTopWidth: 1, borderColor: colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: progress.isPrivate ? colors.accent + '20' : colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }}>
                        <IconSymbol name={progress.isPrivate ? "eye.slash.fill" : "eye.fill"} size={16} color={progress.isPrivate ? colors.accent : colors.textSecondary} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: progress.isPrivate ? colors.accent : colors.text }}>
                          {progress.isPrivate ? 'Hidden Story' : 'Public Story'}
                        </Text>
                        <Text style={{ fontSize: 10, color: colors.textSecondary, marginTop: 2 }}>
                          {progress.isPrivate ? 'Invisible on your profile' : 'Visible to your friends'}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity 
                      style={{ 
                        width: 48, height: 28, borderRadius: 14, 
                        backgroundColor: progress.isPrivate ? colors.accent : colors.surfaceElevated, 
                        padding: 3, justifyContent: 'center', 
                        borderWidth: 1, borderColor: progress.isPrivate ? colors.accent : colors.border 
                      }} 
                      activeOpacity={0.8}
                      onPress={handleTogglePrivacy}>
                      <View style={{ 
                        width: 20, height: 20, borderRadius: 10, 
                        backgroundColor: '#FFF', 
                        alignSelf: progress.isPrivate ? 'flex-end' : 'flex-start',
                        ...Shadows.sm 
                      }} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Reviews Section */}
          {!isMangaDex && (
            <View style={styles.section}>
              {(() => {
                const myReview = reviews.find(r => r.user?._id === user?._id);
                const otherReviews = reviews.filter(r => r.user?._id !== user?._id);
                const sortedReviews = myReview ? [myReview, ...otherReviews] : reviews;

                return (
                  <>
                    <View style={styles.sectionHeader}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <IconSymbol name="star.fill" size={18} color={colors.text} />
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>
                      </View>
                    </View>

                    {showReviewForm && (
                      <View style={[styles.reviewForm, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                        <TouchableOpacity
                          style={styles.closeReviewForm}
                          onPress={() => {
                            setShowReviewForm(false);
                            setEditingReviewId(null);
                            setReviewText('');
                            setReviewRating(5);
                          }}>
                          <IconSymbol name="xmark" size={14} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <Text style={[styles.formSubtitle, { color: colors.textSecondary }]}>
                          {editingReviewId ? 'Edit your review' : 'How would you rate this story?'}
                        </Text>
                        <View style={styles.starsRow}>
                          {[1, 2, 3, 4, 5].map((s) => (
                            <TouchableOpacity key={s} onPress={() => setReviewRating(s)}>
                              <IconSymbol
                                name={s <= reviewRating ? "star.fill" : "star"}
                                size={32}
                                color={s <= reviewRating ? colors.accent : colors.border}
                              />
                            </TouchableOpacity>
                          ))}
                        </View>
                        <TextInput
                          style={[styles.reviewInput, { color: colors.text, borderColor: colors.border }]}
                          placeholder="What did you think? (optional)"
                          placeholderTextColor={colors.textSecondary}
                          value={reviewText}
                          onChangeText={setReviewText}
                          multiline
                        />
                        <TouchableOpacity
                          style={[styles.submitReviewBtn, { backgroundColor: colors.primary }]}
                          onPress={handleSubmitReview}>
                          <Text style={styles.submitReviewText}>{editingReviewId ? 'Update Review' : 'Submit Review'}</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {!showReviewForm && (
                      <TouchableOpacity
                        style={[styles.rateStorySection, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}
                        onPress={() => setShowReviewForm(true)}>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.rateStoryTitle, { color: colors.text }]}>
                            {myReview ? 'Your Review' : 'Write a Review'}
                          </Text>
                          <Text style={[styles.rateStorySubtitle, { color: colors.textSecondary }]}>
                            {myReview ? 'Share your updated thoughts' : 'Help others discover this story'}
                          </Text>
                        </View>
                        <View style={[styles.rateStoryBtn, { backgroundColor: colors.primary }]}>
                          <IconSymbol name="pencil" size={14} color="#FFF" />
                          <Text style={styles.rateStoryBtnText}>{myReview ? 'Edit' : 'Rate'}</Text>
                        </View>
                      </TouchableOpacity>
                    )}
                    {reviews.length === 0 ? (
                      <View style={[styles.emptyBox, { backgroundColor: colors.surface }]}>
                        <Text style={[styles.noReviews, { color: colors.textSecondary }]}>No reviews yet. Be the first!</Text>
                      </View>
                    ) : (sortedReviews.map((review: any) => {
                      const isMine = review.user?._id === user?._id;
                      return (
                        <View key={review._id} style={{
                          backgroundColor: colors.surface,
                          borderRadius: 20,
                          padding: 16,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: isMine ? colors.primary + '30' : colors.border,
                          ...Shadows.sm
                        }}>
                          {/* Review Header - Compact & Informative */}
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              backgroundColor: colors.surfaceElevated,
                              overflow: 'hidden',
                              borderWidth: 1,
                              borderColor: colors.border
                            }}>
                              {review.user?.avatar ? (
                                <Image source={{ uri: api.resolveImageUrl(review.user.avatar) }} style={{ width: '100%', height: '100%' }} />
                              ) : (
                                <View style={{ width: '100%', height: '100%', backgroundColor: (isMine ? colors.primary : colors.textSecondary) + '10', justifyContent: 'center', alignItems: 'center' }}>
                                  <Text style={{ fontSize: 14, fontWeight: '900', color: isMine ? colors.primary : colors.textSecondary }}>
                                    {review.user?.username?.[0]?.toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={{ flex: 1, marginLeft: 10 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }} numberOfLines={1}>
                                  {review.user?.username}
                                </Text>
                                {isMine && (
                                  <View style={{ backgroundColor: colors.primary + '15', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                    <Text style={{ fontSize: 8, fontWeight: '900', color: colors.primary, letterSpacing: 0.5 }}>YOU</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={{ fontSize: 10, fontWeight: '600', color: colors.textSecondary }}>
                                {new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Text>
                            </View>

                            <View style={{
                              backgroundColor: colors.accent + '10',
                              paddingHorizontal: 8,
                              paddingVertical: 4,
                              borderRadius: 8,
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: 4,
                              borderWidth: 1,
                              borderColor: colors.accent + '20'
                            }}>
                              <IconSymbol name="star.fill" size={10} color={colors.accent} />
                              <Text style={{ fontSize: 12, fontWeight: '900', color: colors.accent }}>{review.rating.toFixed(1)}</Text>
                            </View>
                          </View>

                          {/* Review Body */}
                          <View style={{ marginBottom: 12 }}>
                            {review.text ? (
                              <Text style={{ fontSize: 13, lineHeight: 18, color: colors.text, opacity: 0.85 }} numberOfLines={4}>
                                {review.text}
                              </Text>
                            ) : (
                              <Text style={{ fontSize: 12, fontStyle: 'italic', color: colors.textSecondary, opacity: 0.6 }}>Rated {review.rating} stars without comment.</Text>
                            )}
                          </View>

                          {/* Review Actions - Denes & Ergonomic */}
                          <View style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingTop: 12,
                            borderTopWidth: 1,
                            borderTopColor: colors.border + '50'
                          }}>
                            <TouchableOpacity
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                backgroundColor: review.likes?.includes(user?._id) ? colors.primary + '10' : 'transparent',
                                paddingHorizontal: 8,
                                paddingVertical: 4,
                                borderRadius: 8,
                              }}
                              onPress={() => handleLikeReview(review._id)}>
                              <IconSymbol
                                name={review.likes?.includes(user?._id) ? "hand.thumbsup.fill" : "hand.thumbsup"}
                                size={14}
                                color={review.likes?.includes(user?._id) ? colors.primary : colors.textSecondary}
                              />
                              <Text style={{ fontSize: 12, fontWeight: '700', color: review.likes?.includes(user?._id) ? colors.primary : colors.textSecondary }}>
                                {review.likes?.length || 0}
                              </Text>
                            </TouchableOpacity>

                            {isMine && (
                              <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                  style={{ padding: 4 }}
                                  onPress={() => handleEditReview(review)}>
                                  <IconSymbol name="pencil" size={14} color={colors.textSecondary} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={{ padding: 4 }}
                                  onPress={() => { setReviewToDelete(review._id); setShowDeleteConfirm(true); }}>
                                  <IconSymbol name="trash" size={14} color={colors.error} />
                                </TouchableOpacity>
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })
                    )}
                  </>
                );
              })()}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Management Options Modal */}
      {showManageModal && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => setShowManageModal(false)}
          />
          <View style={[styles.optionsMenu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.optionsHeader}>
              <Text style={[styles.optionsTitle, { color: colors.text }]}>Manage Story</Text>
              <View style={[styles.optionsStripe, { backgroundColor: colors.primary }]} />
            </View>

            {progress && (
              <TouchableOpacity
                style={styles.optionItem}
                onPress={() => { setShowManageModal(false); handleRemoveFromLibrary(); }}>
                <IconSymbol name="minus.circle.fill" size={20} color={colors.error} />
                <Text style={[styles.optionText, { color: colors.error }]}>Remove from Library</Text>
              </TouchableOpacity>
            )}

            {user?.role === 'admin' && !isMangaDex && (
              <>
                <View style={[styles.optionDivider, { backgroundColor: colors.border }]} />
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    setShowManageModal(false);
                    router.push(`/story/add?id=${story._id}` as any);
                  }}>
                  <IconSymbol name="pencil" size={20} color={colors.primary} />
                  <Text style={[styles.optionText, { color: colors.text }]}>Edit Story Data</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={handleDeleteStory}>
                  <IconSymbol name="list.bullet.rectangle.portrait" size={20} color={colors.error} />
                  <Text style={[styles.optionText, { color: colors.error }]}>Delete (Permanent)</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={[styles.optionCancel, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => setShowManageModal(false)}>
              <Text style={[styles.optionCancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Full Collections Modal */}
      {showFullCollModal && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalOverlay}
            onPress={() => setShowFullCollModal(false)}
          />
          <View style={[styles.optionsMenu, { backgroundColor: colors.surface, maxHeight: '80%' }]}>
            <View style={styles.optionsHeader}>
              <View style={[styles.optionsStripe, { backgroundColor: colors.primary }]} />
              <Text style={[styles.optionsTitle, { color: colors.text }]}>All Collections</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', padding: 4 }}>
                {collections.map((coll) => {
                  const isAlreadyIn = coll.stories?.some((s: any) => s._id === story._id);
                  return (
                    <TouchableOpacity
                      key={coll._id}
                      style={{
                        width: '48%',
                        borderRadius: 20,
                        backgroundColor: colors.surfaceElevated,
                        borderWidth: 1.5,
                        borderColor: isAlreadyIn ? coll.color : colors.border,
                        padding: 16,
                        alignItems: 'center',
                        gap: 10
                      }}
                      onPress={() => handleAddToCollection(coll._id)}>
                      <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: coll.color + '15', justifyContent: 'center', alignItems: 'center' }}>
                        <IconSymbol name={isAlreadyIn ? "checkmark.circle.fill" : "folder.fill"} size={22} color={coll.color || colors.primary} />
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text, textAlign: 'center' }} numberOfLines={1}>{coll.name}</Text>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: colors.textSecondary }}>{coll.stories?.length || 0} STORIES</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.optionCancel, { backgroundColor: colors.surfaceElevated, marginTop: 20 }]}
              onPress={() => setShowFullCollModal(false)}>
              <Text style={[styles.optionCancelText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        isDestructive={confirmModal.isDestructive}
      />
      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Review"
        message="Are you sure you want to delete your review?"
        onConfirm={handleDeleteReview}
        onCancel={() => { setShowDeleteConfirm(false); setReviewToDelete(null); }}
        isDestructive={true}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },

  // Immersive Redesign Components
  immersiveHeader: {
    height: 380,
    width: '100%',
    position: 'absolute',
    top: 0,
  },
  floatingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    zIndex: 10,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  heroLayout: {
    marginTop: 40,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  coverContainer: {
    width: 200,
    height: 300,
    borderRadius: BorderRadius.xl,
    backgroundColor: '#000',
    ...Shadows.lg,
    elevation: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 15,
  },
  mainCover: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.xl,
  },
  mainMeta: {
    marginTop: Spacing.lg,
    alignItems: 'center',
    width: '100%',
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  mainAuthor: {
    fontSize: 16,
    fontWeight: '600',
    opacity: 0.7,
    marginBottom: 16,
  },
  statsPillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroActionsFull: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    gap: 12,
  },
  mainActionRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  premiumAddBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderRadius: 18,
    gap: 8,
    ...Shadows.md,
  },
  premiumAddBtnText: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  premiumIconBtn: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostPrivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
    backgroundColor: 'transparent',
  },
  ghostPrivateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.2,
  },

  // Content Sections
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  descriptionText: { fontSize: 14, lineHeight: 22, opacity: 0.8 },

  voteGroupResponsive: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    height: 48,
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  voteDivider: { width: 1, height: '60%', alignSelf: 'center' },
  voteText: { fontSize: 14, fontWeight: '700' },

  recommendActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  recommendActionText: { fontSize: 14, fontWeight: '800' },

  managementCard: {
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  statusDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 8,
  },
  statusIndicator: { width: 8, height: 8, borderRadius: 4 },
  currentStatusText: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  miniEditBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  statusPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    gap: 8,
  },
  statusItemSmallDot: { width: 6, height: 6, borderRadius: 3 },
  statusPickerText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },

  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 25,
    marginBottom: 20,
  },
  stepperBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepperBtnPrimary: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.glow,
  },
  centeredChapterInput: { fontSize: 48, fontWeight: '900', textAlign: 'center' },
  inlineEditWrapper: { flexDirection: 'row', alignItems: 'center' },
  editPrefix: { fontSize: 24, fontWeight: '900' },
  chapterCenter: { alignItems: 'center' },
  bigChapterNumber: { fontSize: 60, fontWeight: '900', letterSpacing: -2 },
  counterUnit: { fontSize: 10, fontWeight: '800', letterSpacing: 1, opacity: 0.6 },
  progressBarBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },

  // Reviews & Friends
  friendsProgressScroll: { gap: 12 },
  friendProgressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    width: 160,
    gap: 10,
  },
  friendAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  friendMeta: { flex: 1 },
  friendName: { fontSize: 13, fontWeight: '700' },
  friendProgressText: { fontSize: 11, fontWeight: '800' },

  reviewForm: { padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 20 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: 20 },
  reviewInput: { padding: 12, borderRadius: 12, borderWidth: 1.5, minHeight: 100 },
  submitReviewBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 16 },
  submitReviewText: { color: '#FFF', fontSize: 16, fontWeight: '900' },

  rateStorySection: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 20, gap: 12 },
  rateStoryTitle: { fontSize: 16, fontWeight: '800' },
  rateStorySubtitle: { fontSize: 12, opacity: 0.6 },
  rateStoryBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, gap: 6 },
  rateStoryBtnText: { color: '#FFF', fontSize: 14, fontWeight: '900' },

  premiumReviewCard: { padding: 16, borderRadius: 16, borderWidth: 1.5, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  reviewUserInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  premiumAvatar: { width: 40, height: 40, borderRadius: 20 },
  userMeta: { justifyContent: 'center' },
  reviewUserName: { fontSize: 14, fontWeight: '800' },
  ratingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 10, fontWeight: '600' },
  premiumReviewBody: { fontSize: 14, lineHeight: 22, marginBottom: 16 },
  reviewFooter: { paddingTop: 12 },
  socialAction: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  socialCount: { fontSize: 12, fontWeight: '700' },

  recoInputContainer: { marginTop: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  recoTextInput: { fontSize: 14, minHeight: 60, textAlignVertical: 'top', marginBottom: 12 },
  recoActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  recoCancelBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  recoConfirmBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },

  collPicker: { padding: 16, borderRadius: 12, borderWidth: 1, marginBottom: 20 },
  collItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 0.5, gap: 8 },
  collDot: { width: 8, height: 8, borderRadius: 4 },
  collItemText: { flex: 1, fontSize: 14, fontWeight: '600' },
  collItemCount: { fontSize: 12, opacity: 0.6 },
  noCollText: { fontSize: 13, textAlign: 'center', opacity: 0.5 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  optionsMenu: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    ...Shadows.lg,
  },
  optionsHeader: { marginBottom: 24, alignItems: 'center' },
  optionsTitle: { fontSize: 20, fontWeight: '900' },
  optionsStripe: { width: 40, height: 5, borderRadius: 2.5, marginBottom: 12 },
  optionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 16 },
  optionText: { fontSize: 16, fontWeight: '700' },
  optionDivider: { height: 1, marginVertical: 8 },
  optionCancel: { marginTop: 16, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  optionCancelText: { fontSize: 16, fontWeight: '800' },
  closeReviewForm: { position: 'absolute', top: 12, right: 12, zIndex: 10 },
  formSubtitle: { fontSize: 14, fontWeight: '600', textAlign: 'center', marginBottom: 16 },

  // Missing styles found by diagnostics
  avatarLetter: { fontWeight: '800' },
  friendSubMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  addToLibraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    height: 56,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  privateAddBtnDetail: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  addToLibraryText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  emptyBox: { padding: 30, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  noReviews: { fontSize: 14, fontWeight: '600', opacity: 0.5 },
  myReviewBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  myReviewBadgeText: { fontSize: 8, fontWeight: '900' },
  reviewActionGroup: { flexDirection: 'row', gap: 12 },
  reviewIconButton: { padding: 4 },
});
