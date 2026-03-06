import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [story, setStory] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  const loadData = useCallback(async () => {
    try {
      const data = await api.getStory(id);
      setStory(data.story);
      setProgress(data.userProgress);
      setReviews(data.reviews);
    } catch (error) {
      console.log('Error:', error);
      Alert.alert('Error', 'Could not load story');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleAddToLibrary = async () => {
    try {
      const p = await api.updateProgress({ storyId: id, status: 'Plan to Read' });
      setProgress(p);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const p = await api.updateProgress({ storyId: id, status: newStatus });
      setProgress(p);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleIncrement = async () => {
    if (!progress) return;
    try {
      const updated = await api.incrementChapter(progress._id);
      setProgress(updated);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleSubmitReview = async () => {
    try {
      await api.createReview({
        storyId: id,
        rating: reviewRating,
        text: reviewText,
      });
      setShowReviewForm(false);
      setReviewText('');
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="arrow.left" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Cover & Info */}
        <View style={styles.heroSection}>
          {story.coverImage ? (
            <Image source={{ uri: story.coverImage }} style={styles.heroCover} contentFit="cover" />
          ) : (
            <View style={[styles.heroCover, styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
              <Text style={{ fontSize: 64 }}>📖</Text>
            </View>
          )}

          <View style={styles.heroInfo}>
            <Text style={[styles.storyTitle, { color: colors.text }]}>{story.title}</Text>
            <Text style={[styles.storyAuthor, { color: colors.textSecondary }]}>
              {story.author || 'Unknown Author'}
            </Text>

            <View style={styles.metaRow}>
              <View style={[styles.typeBadge, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.typeText, { color: colors.primary }]}>{story.type}</Text>
              </View>
              {story.averageRating > 0 && (
                <View style={styles.ratingRow}>
                  <Text style={{ color: colors.accent, fontSize: 16 }}>★</Text>
                  <Text style={[styles.ratingValue, { color: colors.text }]}>
                    {story.averageRating.toFixed(1)}
                  </Text>
                  <Text style={[styles.ratingCount, { color: colors.textSecondary }]}>
                    ({story.totalReviews})
                  </Text>
                </View>
              )}
            </View>

            {story.genres?.length > 0 && (
              <View style={styles.genreRow}>
                {story.genres.map((genre: string) => (
                  <View key={genre} style={[styles.genreChip, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={[styles.genreText, { color: colors.textSecondary }]}>{genre}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Description */}
        {story.description ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Description</Text>
            <Text style={[styles.descriptionText, { color: colors.textSecondary }]}>
              {story.description}
            </Text>
          </View>
        ) : null}

        {/* Reading Progress */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>📖 Your Progress</Text>

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
                <Text style={[styles.chapterLabel, { color: colors.textSecondary }]}>
                  Chapter Progress
                </Text>
                <View style={styles.chapterRow}>
                  <Text style={[styles.chapterNumber, { color: colors.primary }]}>
                    {progress.currentChapter}
                  </Text>
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

        {/* Reviews Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>⭐ Reviews</Text>
            <TouchableOpacity onPress={() => setShowReviewForm(!showReviewForm)}>
              <Text style={[styles.writeReview, { color: colors.primary }]}>
                {showReviewForm ? 'Cancel' : 'Write Review'}
              </Text>
            </TouchableOpacity>
          </View>

          {showReviewForm && (
            <View style={[styles.reviewForm, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              {/* Star Rating */}
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
                  <View style={[styles.reviewAvatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.reviewAvatarText}>
                      {review.user?.username?.[0]?.toUpperCase()}
                    </Text>
                  </View>
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  backButton: { padding: Spacing.lg },
  heroSection: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  heroCover: { width: 130, height: 190, borderRadius: BorderRadius.md },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  heroInfo: { flex: 1, justifyContent: 'center' },
  storyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  storyAuthor: { fontSize: 14, marginBottom: Spacing.sm },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  typeText: { fontSize: 12, fontWeight: '700' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingValue: { fontSize: 16, fontWeight: '700' },
  ratingCount: { fontSize: 12 },
  genreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  genreChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  genreText: { fontSize: 11, fontWeight: '600' },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: Spacing.md },
  descriptionText: { fontSize: 14, lineHeight: 22 },
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
