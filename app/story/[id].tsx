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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

// MangaDex UUIDs contain dashes, MongoDB ObjectIds don't
const isMangaDexId = (id: string) => id.includes('-');

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

  const [story, setStory] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMangaDex, setIsMangaDex] = useState(false);

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

  // Add to Collection modal
  const [showCollPicker, setShowCollPicker] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

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
    onConfirm: () => {},
    isDestructive: true,
  });

  const loadData = useCallback(async () => {
    try {
      if (isMangaDexId(id)) {
        // It's a MangaDex UUID — fetch directly from MangaDex API
        setIsMangaDex(true);
        const mdData = await api.getMangaDexDetail(id);
        if (mdData.manga) {
          setStory({
            _id: null,
            title: mdData.manga.title,
            coverImage: mdData.manga.coverUrlHQ || mdData.manga.coverUrl,
            description: mdData.manga.description,
            type: 'Manga',
            genres: mdData.manga.tags || [],
            author: mdData.manga.author,
            status: mdData.manga.status,
            totalChapters: mdData.manga.lastChapter ? Number.parseInt(mdData.manga.lastChapter, 10) : null,
            averageRating: 0,
            totalReviews: 0,
            totalReaders: 0,
            views: 0,
            year: mdData.manga.year,
            mangadexId: mdData.manga.id,
            contentRating: mdData.manga.contentRating,
          });
        }
      } else {
        // It's a MongoDB ObjectId — load from our DB
        setIsMangaDex(false);
        const data = await api.getStory(id);
        setStory(data.story);
        setProgress(data.userProgress);
        setDisplayedChapter(data.userProgress?.currentChapter || 0);
        setEditChapter(String(data.userProgress?.currentChapter || 0));
        setReviews(data.reviews);
        setIsRecommended(data.isRecommended || false);
      }
      // Load collections for the picker
      const colls = await api.getMyCollections().catch(() => []);
      setCollections(colls);
    } catch (error) {
      console.log('Error:', error);
      showToast({ message: 'Could not load story', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Clone from MangaDex to local DB, then reload as local story
  const handleCloneAndAdd = async () => {
    if (!story) return;
    try {
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
      // Now add to reading progress
      const p = await api.updateProgress({ storyId: result.story._id, status: 'Plan to Read' });
      setProgress(p);
      setDisplayedChapter(p.currentChapter || 0);
      setStory(result.story);
      setIsMangaDex(false);
      showToast({ message: result.created ? 'Added to library!' : 'Updated in library!', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to add', type: 'error' });
    }
  };

  const handleAddToLibrary = async () => {
    if (isMangaDex) {
      await handleCloneAndAdd();
    } else {
      try {
        const p = await api.updateProgress({ storyId: id, status: 'Plan to Read' });
        setProgress(p);
        setDisplayedChapter(p.currentChapter || 0);
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
    try {
      const chapter = parseInt(editChapter, 10);
      if (isNaN(chapter)) return;
      
      const p = await api.updateProgress({ 
        storyId: story._id || id, 
        currentChapter: chapter 
      });
      setProgress(p);
      setIsEditingProgress(false);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleIncrement = async () => {
    if (!progress) return;
    try {
      setDisplayedChapter(prev => prev + 1);
      const updated = await api.incrementChapter(progress._id);
      setProgress(updated);
    } catch (error: any) {
      setDisplayedChapter(progress.currentChapter);
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleDecrement = async () => {
    if (!progress || displayedChapter <= 0) return;
    try {
      setDisplayedChapter(prev => Math.max(0, prev - 1));
      const updated = await api.decrementChapter(progress._id);
      setProgress(updated);
    } catch (error: any) {
      setDisplayedChapter(progress.currentChapter);
      showToast({ message: error.message, type: 'error' });
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
      setShowCollPicker(false);
      showToast({ message: 'Added to collection!', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message || 'Already in collection', type: 'error' });
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
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="arrow.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerMoreBtn} 
            onPress={() => setShowManageModal(true)}>
            <IconSymbol name="ellipsis" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Cover & Info */}
        <View style={styles.heroSection}>
          {story.coverImage ? (
            <Image source={{ uri: story.coverImage }} style={styles.heroCover} contentFit="cover" />
          ) : (
            <View style={[styles.heroCover, styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
              <IconSymbol name="book.fill" size={64} color={colors.textSecondary} />
            </View>
          )}

          <View style={styles.heroInfo}>
            <Text style={[styles.storyTitle, { color: colors.text }]}>{story.title}</Text>
            <Text style={[styles.storyAuthor, { color: colors.textSecondary }]}>
              {story.author || 'Unknown Author'}
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.typeText, { color: colors.primary }]}>{story.type || 'Manga'}</Text>
              </View>
              {story.year ? (
                <Text style={[styles.yearLabel, { color: colors.textSecondary }]}>{story.year}</Text>
              ) : null}
              {story.averageRating > 0 && (
                <View style={styles.ratingRow}>
                  <IconSymbol name="star.fill" size={14} color={colors.accent} />
                  <Text style={[styles.ratingValue, { color: colors.text }]}>
                    {story.averageRating.toFixed(1)}
                  </Text>
                </View>
              )}
              <View style={styles.ratingRow}>
                <IconSymbol name="eye.fill" size={14} color={colors.textSecondary} />
                <Text style={[styles.ratingValue, { color: colors.textSecondary }]}>
                  {story.views || 0}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={[styles.statusPill, { backgroundColor: (StatusColors[statusLabel] || colors.primary) + '20' }]}>
                <Text style={[styles.statusPillText, { color: StatusColors[statusLabel] || colors.primary }]}>{statusLabel}</Text>
              </View>
              {story.totalChapters ? (
                <Text style={[styles.chapterMeta, { color: colors.textSecondary }]}>
                  {story.totalChapters} chapters
                </Text>
              ) : null}
            </View>

            {story.genres?.length > 0 && (
              <View style={styles.genreRow}>
                {story.genres.slice(0, 5).map((genre: string) => (
                  <View key={genre} style={[styles.genreChip, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.genreText, { color: colors.textSecondary }]}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: progress ? colors.surfaceElevated : colors.primary, flex: 2 }]}
            onPress={handleAddToLibrary}
            disabled={!!progress}>
            <IconSymbol 
              name={progress ? "checkmark.circle.fill" : "plus"} 
              size={16} 
              color={progress ? colors.success : "#FFF"} 
            />
            <Text style={[styles.actionBtnText, { color: progress ? colors.success : "#FFF" }]}>
              {progress ? 'In Your Library' : 'Add to Library'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: progress?.isFavorite ? colors.error : colors.primary, flex: 1, marginLeft: Spacing.sm }]}
            onPress={handleToggleFavorite}>
            <IconSymbol 
                name={progress?.isFavorite ? "heart.fill" : "heart"} 
                size={18} 
                color={progress?.isFavorite ? colors.error : colors.primary} 
            />
          </TouchableOpacity>
        </View>

        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtnOutline, { borderColor: colors.primary }]}
            onPress={() => setShowCollPicker(!showCollPicker)}>
            <IconSymbol name="folder.fill" size={16} color={colors.primary} />
            <Text style={[styles.actionBtnOutlineText, { color: colors.primary }]}>Collection</Text>
          </TouchableOpacity>
          
          <View style={[styles.voteGroup, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.voteBtn, 
                story.likes?.includes(user?._id) && { backgroundColor: colors.success + '20' }
              ]}
              onPress={handleLike}>
              <IconSymbol 
                name={story.likes?.includes(user?._id) ? "hand.thumbsup.fill" : "hand.thumbsup"} 
                size={16} 
                color={story.likes?.includes(user?._id) ? colors.success : colors.textSecondary} 
              />
              <Text style={[
                styles.voteText, 
                { color: story.likes?.includes(user?._id) ? colors.success : colors.textSecondary }
              ]}>
                {story.likes?.length || 0}
              </Text>
            </TouchableOpacity>

            <View style={[styles.voteDivider, { backgroundColor: colors.border }]} />

            <TouchableOpacity
              style={[
                styles.voteBtn, 
                story.dislikes?.includes(user?._id) && { backgroundColor: colors.error + '20' }
              ]}
              onPress={handleDislike}>
              <IconSymbol 
                name={story.dislikes?.includes(user?._id) ? "hand.thumbsdown.fill" : "hand.thumbsdown"} 
                size={16} 
                color={story.dislikes?.includes(user?._id) ? colors.error : colors.textSecondary} 
              />
              <Text style={[
                styles.voteText, 
                { color: story.dislikes?.includes(user?._id) ? colors.error : colors.textSecondary }
              ]}>
                {story.dislikes?.length || 0}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {!isMangaDex && (
          <View style={[styles.section, { marginTop: -Spacing.sm, paddingHorizontal: Spacing.lg }]}>
            <TouchableOpacity
              style={[
                styles.actionBtnOutline, 
                { borderColor: isRecommended ? colors.accent : colors.primary, width: '100%', marginBottom: showRecoInput ? Spacing.sm : 0 }
              ]}
              onPress={confirmRecommend}>
              <IconSymbol 
                name={isRecommended ? "star.fill" : "star"} 
                size={16} 
                color={isRecommended ? colors.accent : colors.primary} 
              />
              <Text style={[
                styles.actionBtnOutlineText, 
                { color: isRecommended ? colors.accent : colors.primary, marginLeft: Spacing.xs }
              ]}>
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
        {/* Collection Picker */}
        {showCollPicker && (
          <View style={[styles.collPicker, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            {collections.length === 0 ? (
              <Text style={[styles.noCollText, { color: colors.textSecondary }]}>No collections yet</Text>
            ) : (
              collections.map((coll) => (
                <TouchableOpacity
                  key={coll._id}
                  style={[styles.collItem, { borderColor: colors.border }]}
                  onPress={() => handleAddToCollection(coll._id)}>
                  <View style={[styles.collDot, { backgroundColor: coll.color || colors.primary }]} />
                  <Text style={[styles.collItemText, { color: colors.text }]}>{coll.name}</Text>
                  <Text style={[styles.collItemCount, { color: colors.textSecondary }]}>{coll.stories?.length || 0}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Description */}
        {story.description ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {story.description}
            </Text>
          </View>
        ) : null}

        {/* Reading Progress — only for local stories */}
        {!isMangaDex && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <IconSymbol name="book.fill" size={18} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Progress</Text>
              </View>
            </View>

            {!progress ? (
              <TouchableOpacity
                style={[styles.addToLibraryBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddToLibrary}>
                <IconSymbol name="plus" size={20} color="#FFF" />
                <Text style={styles.addToLibraryText}>Add to Library</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.compactProgressCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
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

                {/* Expanded Status Picker */}
                {showStatusPicker && (
                  <View style={styles.statusPickerGrid}>
                    {['Reading', 'Completed', 'Plan to Read', 'On Hold', 'Dropped'].map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.statusPickerItem,
                          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                          progress.status === s && { backgroundColor: (StatusColors[s] || colors.primary) + '15', borderColor: StatusColors[s] || colors.primary }
                        ]}
                        onPress={() => {
                          handleStatusChange(s);
                          setShowStatusPicker(false);
                        }}>
                        <View style={[styles.statusItemSmallDot, { backgroundColor: StatusColors[s] || colors.primary }]} />
                        <Text style={[
                          styles.statusPickerText, 
                          { color: progress.status === s ? (StatusColors[s] || colors.primary) : colors.textSecondary }
                        ]}>
                          {s}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Main Counter UI */}
                <View style={[styles.counterSection, showStatusPicker && { opacity: 0.3 }]}>
                  <TouchableOpacity
                    style={[styles.roundActionBtn, { borderColor: colors.border }]}
                    onPress={handleDecrement}
                    onPressIn={() => startHold('down')}
                    onPressOut={stopHold}>
                    <IconSymbol name="minus" size={24} color={colors.text} />
                  </TouchableOpacity>

                  <View style={styles.chapterCenter}>
                    {isEditingProgress ? (
                      <View style={styles.inlineEditWrapper}>
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
                        <Text style={[styles.bigChapterNumber, { color: colors.text }]}>
                          {displayedChapter}
                        </Text>
                        <Text style={[styles.counterUnit, { color: colors.textSecondary }]}>CHAPTRES</Text>
                      </TouchableOpacity>
                    )}
                    {story.totalChapters && (
                      <Text style={[styles.totalCountLabel, { color: colors.textSecondary }]}>
                        / {story.totalChapters}
                      </Text>
                    )}
                  </View>

                  <TouchableOpacity
                    style={[styles.roundActionBtn, { backgroundColor: colors.primary, ...Shadows.glow }]}
                    onPress={handleIncrement}
                    onPressIn={() => startHold('up')}
                    onPressOut={stopHold}>
                    <IconSymbol name="plus" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* Slim Progress Bar */}
                {story.totalChapters > 0 && (
                  <View style={[styles.slimProgressBar, { backgroundColor: colors.surfaceElevated }]}>
                    <View
                      style={[
                        styles.slimProgressFill,
                        {
                          backgroundColor: colors.primary,
                          width: `${Math.min((displayedChapter / story.totalChapters) * 100, 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* Reviews Section — only for local stories */}
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
                        {editingReviewId ? 'Edit your existing review' : 'Share your opinion about this story'}
                      </Text>
                      <View style={styles.starsRow}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                            <Text style={{ fontSize: 28, color: star <= reviewRating ? colors.accent : colors.textSecondary }}>
                              ★
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TextInput
                        style={[styles.reviewInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
                        placeholder="Share your thoughts..."
                        placeholderTextColor={colors.textSecondary}
                        value={reviewText}
                        onChangeText={setReviewText}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <TouchableOpacity
                        style={[styles.submitReviewBtn, { backgroundColor: colors.primary }]}
                        onPress={handleSubmitReview}>
                        <Text style={styles.submitReviewText}>
                          {editingReviewId ? 'Update Review' : 'Submit Review'}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {!myReview && !showReviewForm && (
                     <View style={[styles.rateStorySection, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }]}>
                        <View style={{ flex: 1 }}>
                           <Text style={[styles.rateStoryTitle, { color: colors.text }]}>Rate this story</Text>
                           <Text style={[styles.rateStorySubtitle, { color: colors.textSecondary }]}>Share your experience with the community</Text>
                        </View>
                        <TouchableOpacity 
                           style={[styles.rateStoryBtn, { backgroundColor: colors.primary }]}
                           onPress={() => setShowReviewForm(true)}>
                           <IconSymbol name="plus" size={16} color="#FFF" />
                           <Text style={styles.rateStoryBtnText}>Review</Text>
                        </TouchableOpacity>
                     </View>
                  )}

                  {sortedReviews.length === 0 ? (
                    <TouchableOpacity 
                      activeOpacity={0.7}
                      onPress={() => setShowReviewForm(true)}
                      style={[styles.emptyBox, { backgroundColor: colors.surfaceElevated }]}>
                      <IconSymbol name="star" size={32} color={colors.textSecondary} style={{ opacity: 0.3, marginBottom: 12 }} />
                      <Text style={[styles.noReviews, { color: colors.textSecondary }]}>
                        No reviews yet. Be the first to share your experience!
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    sortedReviews.map((review) => (
                      <View
                        key={review._id}
                        style={[
                          styles.premiumReviewCard, 
                          { backgroundColor: colors.surface, borderColor: colors.cardBorder },
                          review.user?._id === user?._id && { borderColor: colors.primary + '40', borderWidth: 2 }
                        ]}>
                        
                        {/* Review Header: User Info & Score */}
                        <View style={styles.reviewHeader}>
                          <View style={styles.reviewUserInfo}>
                            {review.user?.avatar ? (
                              <Image source={{ uri: review.user.avatar }} style={styles.premiumAvatar} contentFit="cover" />
                            ) : (
                              <View style={[styles.premiumAvatar, { backgroundColor: colors.primary + '15' }]}>
                                <Text style={[styles.avatarLetter, { color: colors.primary }]}>
                                  {review.user?.username?.[0]?.toUpperCase()}
                                </Text>
                              </View>
                            )}
                            <View style={styles.userMeta}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={[styles.reviewUserName, { color: colors.text }]}>
                                  {review.user?.username}
                                </Text>
                                {review.user?._id === user?._id && (
                                  <View style={[styles.myReviewBadge, { backgroundColor: colors.primary + '20' }]}>
                                    <Text style={[styles.myReviewBadgeText, { color: colors.primary }]}>YOU</Text>
                                  </View>
                                )}
                              </View>
                              <View style={styles.ratingBadge}>
                                <IconSymbol name="star.fill" size={10} color={colors.accent} />
                                <Text style={[styles.ratingText, { color: colors.accent }]}>{review.rating}/5</Text>
                              </View>
                            </View>
                          </View>

                          {/* Manage Actions (If Owner) */}
                          {review.user?._id === user?._id && (
                            <View style={styles.reviewActionGroup}>
                              <TouchableOpacity 
                                style={styles.reviewIconButton} 
                                onPress={() => handleEditReview(review)}>
                                <IconSymbol name="pencil" size={14} color={colors.textSecondary} />
                              </TouchableOpacity>
                              <TouchableOpacity 
                                style={styles.reviewIconButton} 
                                onPress={() => {
                                  setReviewToDelete(review._id);
                                  setShowDeleteConfirm(true);
                                }}>
                                <IconSymbol name="trash" size={14} color="#FF4444" />
                              </TouchableOpacity>
                            </View>
                          )}
                        </View>

                        {/* Review Body */}
                        {review.text ? (
                          <Text style={[styles.premiumReviewBody, { color: colors.textSecondary }]}>
                            {review.text}
                          </Text>
                        ) : (
                          <Text style={[styles.premiumReviewBody, { color: colors.textSecondary, fontStyle: 'italic', opacity: 0.5 }]}>
                            No comments provided.
                          </Text>
                        )}

                        {/* Social Footer: Likes & Interaction */}
                        <View style={[styles.reviewFooter, { borderTopColor: colors.border + '30' }]}>
                          <TouchableOpacity 
                            style={[
                              styles.socialAction,
                              review.likes?.includes(user?._id) && { backgroundColor: colors.primary + '15' }
                            ]}
                            onPress={() => handleLikeReview(review._id)}>
                            <IconSymbol 
                              name={review.likes?.includes(user?._id) ? "hand.thumbsup.fill" : "hand.thumbsup"} 
                              size={14} 
                              color={review.likes?.includes(user?._id) ? colors.primary : colors.textSecondary} 
                            />
                            <Text style={[
                              styles.socialCount, 
                              { color: review.likes?.includes(user?._id) ? colors.primary : colors.textSecondary }
                            ]}>
                              {review.likes?.length || 0} Helpful
                            </Text>
                          </TouchableOpacity>

                          <Text style={[styles.reviewTime, { color: colors.textSecondary }]}>
                            {new Date(review.createdAt).toLocaleDateString()}
                          </Text>
                        </View>
                      </View>
                    ))
                  )}
                </>
              );
            })()}
          </View>
        )}
        </ScrollView>
      </KeyboardAvoidingView>

      <ConfirmModal
        visible={showDeleteConfirm}
        title="Delete Review"
        message="Are you sure you want to delete this review? This action cannot be undone."
        onConfirm={handleDeleteReview}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setReviewToDelete(null);
        }}
        confirmText="Delete"
        isDestructive={true}
      />

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

      <ConfirmModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
        isDestructive={confirmModal.isDestructive}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  headerRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    paddingRight: Spacing.lg,
  },
  backButton: { padding: Spacing.lg },
  headerMoreBtn: { padding: Spacing.md },
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  optionsMenu: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    borderRadius: BorderRadius.xl,
    padding: 20,
    borderWidth: 1,
    ...Shadows.lg,
  },
  optionsHeader: { marginBottom: 20 },
  optionsTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  optionsStripe: { width: 30, height: 4, borderRadius: 2, marginTop: 4 },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  optionText: { fontSize: 15, fontWeight: '700' },
  optionDivider: { height: 1, width: '100%', marginVertical: 4, opacity: 0.5 },
  optionCancel: {
    marginTop: 15,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
  },
  optionCancelText: { fontSize: 14, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  heroSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.md,
  },
  heroCover: { width: 130, height: 190, borderRadius: BorderRadius.md },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  heroInfo: { flex: 1, justifyContent: 'center' },
  storyTitle: { fontSize: 20, fontWeight: '800', marginBottom: 4, lineHeight: 24 },
  storyAuthor: { fontSize: 13, marginBottom: Spacing.sm, fontWeight: '500' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  typeText: { fontSize: 11, fontWeight: '700' },
  yearLabel: { fontSize: 12, fontWeight: '600' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingValue: { fontSize: 14, fontWeight: '700' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  chapterMeta: { fontSize: 12, fontWeight: '500' },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  genreChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full },
  genreText: { fontSize: 10, fontWeight: '600' },

  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: { fontSize: 13, fontWeight: '700', marginLeft: Spacing.xs },
  actionBtnIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  actionBtnOutlineText: { fontSize: 13, fontWeight: '700' },
  saveProgressBtn: {
    width: 54,
    height: 54,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voteGroup: {
    flex: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginLeft: Spacing.sm,
    overflow: 'hidden',
  },
  voteBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  voteDivider: {
    width: 1,
    height: '60%',
  },
  voteText: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 4,
  },
  recoInputContainer: {
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  recoTextInput: {
    fontSize: 14,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: Spacing.md,
  },
  recoActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
  },
  recoCancelBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  recoConfirmBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    ...Shadows.glow,
  },

  // Collection picker
  collPicker: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  collItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    gap: 8,
  },
  collDot: { width: 8, height: 8, borderRadius: 4 },
  collItemText: { flex: 1, fontSize: 14, fontWeight: '600' },
  collItemCount: { fontSize: 12, fontWeight: '500' },
  noCollText: { fontSize: 13, textAlign: 'center', paddingVertical: Spacing.md },

  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: 6,
  },
  sectionTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  descriptionText: { fontSize: 14, lineHeight: 22, opacity: 0.8 },
  addToLibraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: 16,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  addToLibraryText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  progressCard: { 
    padding: Spacing.lg, 
    borderRadius: BorderRadius.xl, 
    borderWidth: 1.5,
    ...Shadows.md,
  },
  compactProgressCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    gap: 8,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  currentStatusText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  miniEditBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusPickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.02)',
    borderRadius: BorderRadius.lg,
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
  statusItemSmallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPickerText: {
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  counterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginVertical: 10,
  },
  roundActionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chapterCenter: {
    alignItems: 'center',
    minWidth: 100,
  },
  bigChapterNumber: {
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2,
  },
  counterUnit: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginTop: -8,
    opacity: 0.6,
  },
  inlineEditWrapper: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  centeredChapterInput: {
    fontSize: 56,
    fontWeight: '900',
    textAlign: 'center',
    width: 100,
    padding: 0,
    letterSpacing: -2,
  },
  totalCountLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
    opacity: 0.5,
  },
  slimProgressBar: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 16,
  },
  slimProgressFill: {
    height: '100%',
    borderRadius: 3,
  },
  
  progressRow: { marginBottom: Spacing.xl },
  writeReview: { fontSize: 15, fontWeight: '800' },
  reviewForm: { 
    padding: Spacing.lg, 
    borderRadius: BorderRadius.xl, 
    borderWidth: 1.5, 
    marginBottom: Spacing.xl,
    ...Shadows.md
  },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginBottom: Spacing.lg },
  reviewInput: { 
    padding: Spacing.md, 
    borderRadius: BorderRadius.lg, 
    borderWidth: 1.5, 
    minHeight: 120, 
    fontSize: 15,
    fontWeight: '500'
  },
  submitReviewBtn: { 
    marginTop: Spacing.lg, 
    padding: 16, 
    borderRadius: BorderRadius.lg, 
    alignItems: 'center',
    ...Shadows.glow
  },
  submitReviewText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  
  emptyBox: { 
    padding: 30, 
    borderRadius: BorderRadius.xl, 
    alignItems: 'center',
    justifyContent: 'center'
  },
  noReviews: { fontSize: 14, textAlign: 'center', fontWeight: '600', opacity: 0.7 },
  premiumReviewCard: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    padding: 16,
    marginBottom: 16,
    ...Shadows.sm,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  reviewUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  premiumAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    fontSize: 16,
    fontWeight: '900',
  },
  userMeta: {
    justifyContent: 'center',
  },
  reviewUserName: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 2,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 11,
    fontWeight: '800',
    opacity: 0.9,
  },
  reviewActionGroup: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewIconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  premiumReviewBody: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    marginBottom: 16,
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
  },
  socialAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  socialCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  myReviewBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  myReviewBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  reviewTime: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.4,
  },
  formSubtitle: { 
    fontSize: 13, 
    textAlign: 'center', 
    marginBottom: 16, 
    opacity: 0.6, 
    fontWeight: '600' 
  },
  closeReviewForm: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 10,
    padding: 4,
  },
  rateStorySection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: 20,
    gap: 16,
  },
  rateStoryTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  rateStorySubtitle: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.7,
  },
  rateStoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    gap: 6,
    ...Shadows.glow,
  },
  rateStoryBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '900',
  },
});
