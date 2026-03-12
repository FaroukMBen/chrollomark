import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [isRecommended, setIsRecommended] = useState(false);
  const [isEditingProgress, setIsEditingProgress] = useState(false);
  const [editChapter, setEditChapter] = useState('');
  const [showRecoInput, setShowRecoInput] = useState(false);
  const [recoMessage, setRecoMessage] = useState('');

  // Add to Collection modal
  const [showCollPicker, setShowCollPicker] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

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
      const updated = await api.incrementChapter(progress._id);
      setProgress(updated);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const handleSubmitReview = async () => {
    try {
      await api.createReview({
        storyId: story?._id || id,
        rating: reviewRating,
        text: reviewText,
      });
      setShowReviewForm(false);
      setReviewText('');
      await loadData();
      showToast({ message: 'Review submitted', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
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
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
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
              {progress && (
                <TouchableOpacity onPress={() => setIsEditingProgress(!isEditingProgress)}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                    {isEditingProgress ? 'Cancel' : 'Edit Progress'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {!progress ? (
              <TouchableOpacity
                style={[styles.addToLibraryBtn, { backgroundColor: colors.primary }]}
                onPress={handleAddToLibrary}>
                <IconSymbol name="plus" size={20} color="#FFF" />
                <Text style={styles.addToLibraryText}>Add to Library</Text>
              </TouchableOpacity>
            ) : (
              <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                {/* Status */}
                <View style={styles.progressRow}>
                  <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Status</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.statusRow}>
                      {['Reading', 'Completed', 'Plan to Read', 'On Hold', 'Dropped'].map((s) => (
                        <TouchableOpacity
                          key={s}
                          style={[
                            styles.statusChip,
                            {
                              backgroundColor: progress.status === s ? (StatusColors[s] || colors.primary) : 'transparent',
                              borderColor: StatusColors[s] || colors.primary,
                            },
                          ]}
                          onPress={() => handleStatusChange(s)}>
                          <Text
                            style={[
                              styles.statusChipText,
                              { color: progress.status === s ? '#FFF' : (StatusColors[s] || colors.primary) },
                            ]}>
                            {s}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>

                {/* Chapter Progress */}
                <View style={styles.chapterSection}>
                  <Text style={[styles.chapterLabel, { color: colors.textSecondary }]}>Chapter Progress</Text>
                  <View style={styles.chapterRow}>
                    {isEditingProgress ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <TextInput
                          style={[styles.editProgressInput, { backgroundColor: colors.surfaceElevated, color: colors.text, borderColor: colors.border }]}
                          value={editChapter}
                          onChangeText={setEditChapter}
                          keyboardType="numeric"
                          autoFocus
                          selectTextOnFocus
                        />
                        <TouchableOpacity
                          style={[styles.saveProgressBtn, { backgroundColor: colors.primary }]}
                          onPress={handleUpdateManualProgress}>
                          <IconSymbol name="checkmark" size={16} color="#FFF" />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={[styles.chapterNumber, { color: colors.primary }]}>
                        {progress.currentChapter}
                      </Text>
                    )}
                    {story.totalChapters && (
                      <Text style={[styles.chapterTotal, { color: colors.textSecondary }]}>
                        / {story.totalChapters}
                      </Text>
                    )}
                  </View>

                  {story.totalChapters > 0 && (
                    <View style={[styles.progressBar, { backgroundColor: colors.surfaceElevated }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: colors.primary,
                            width: `${Math.min((progress.currentChapter / story.totalChapters) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  )}

                  <TouchableOpacity
                    style={[styles.incrementBtn, { backgroundColor: colors.primary, ...Shadows.glow }]}
                    onPress={handleIncrement}>
                    <Text style={styles.incrementBtnText}>+1 Chapter</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Reviews Section — only for local stories */}
        {!isMangaDex && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionHeader}>
                <IconSymbol name="star.fill" size={18} color={colors.text} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Reviews</Text>
              </View>
              <TouchableOpacity onPress={() => setShowReviewForm(!showReviewForm)}>
                <Text style={[styles.writeReview, { color: colors.primary }]}>
                  {showReviewForm ? 'Cancel' : 'Write Review'}
                </Text>
              </TouchableOpacity>
            </View>

            {showReviewForm && (
              <View style={[styles.reviewForm, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
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
                  <Text style={styles.submitReviewText}>Submit Review</Text>
                </TouchableOpacity>
              </View>
            )}

            {reviews.length === 0 ? (
              <Text style={[styles.noReviews, { color: colors.textSecondary }]}>
                No reviews yet. Be the first!
              </Text>
            ) : (
              reviews.map((review) => (
                <View
                  key={review._id}
                  style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={styles.reviewHeader}>
                    {review.user?.avatar ? (
                      <Image source={{ uri: review.user.avatar }} style={styles.reviewAvatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                        <Text style={styles.reviewAvatarText}>
                          {review.user?.username?.[0]?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.reviewMeta}>
                      <Text style={[styles.reviewUser, { color: colors.text }]}>
                        {review.user?.username}
                      </Text>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Text
                            key={star}
                            style={{ fontSize: 12, color: star <= review.rating ? colors.accent : colors.textSecondary }}>
                            ★
                          </Text>
                        ))}
                      </View>
                    </View>
                  </View>
                  {review.text ? (
                    <Text style={[styles.reviewText, { color: colors.textSecondary }]}>
                      {review.text}
                    </Text>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

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
  editProgressInput: {
    width: 60,
    height: 44,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
  },
  saveProgressBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
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
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  recoConfirmBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.sm,
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
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  descriptionText: { fontSize: 13, lineHeight: 20 },
  addToLibraryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: 14,
    borderRadius: BorderRadius.md,
  },
  addToLibraryText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  progressCard: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1 },
  progressRow: { marginBottom: Spacing.md },
  progressLabel: { fontSize: 12, fontWeight: '600', marginBottom: Spacing.sm },
  statusRow: { flexDirection: 'row', gap: 6 },
  statusChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 1 },
  statusChipText: { fontSize: 11, fontWeight: '700' },
  chapterSection: { alignItems: 'center' },
  chapterLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  chapterRow: { flexDirection: 'row', alignItems: 'baseline' },
  chapterNumber: { fontSize: 36, fontWeight: '800' },
  chapterTotal: { fontSize: 18, fontWeight: '600' },
  progressBar: { width: '100%', height: 6, borderRadius: 3, marginTop: Spacing.sm, marginBottom: Spacing.md },
  progressFill: { height: '100%', borderRadius: 3 },
  incrementBtn: { paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: BorderRadius.md },
  incrementBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  writeReview: { fontSize: 14, fontWeight: '700' },
  reviewForm: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: Spacing.md },
  reviewInput: { padding: Spacing.md, borderRadius: BorderRadius.sm, borderWidth: 1, minHeight: 80, fontSize: 14 },
  submitReviewBtn: { marginTop: Spacing.md, padding: 12, borderRadius: BorderRadius.sm, alignItems: 'center' },
  submitReviewText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  noReviews: { fontSize: 14, textAlign: 'center', paddingVertical: Spacing.lg },
  reviewCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.sm },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  reviewAvatarText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  reviewMeta: { marginLeft: Spacing.sm },
  reviewUser: { fontSize: 14, fontWeight: '700' },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewText: { fontSize: 13, lineHeight: 20 },
});
