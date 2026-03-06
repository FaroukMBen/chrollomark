import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function HomeScreen() {
  const { user, isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [currentlyReading, setCurrentlyReading] = useState<any[]>([]);
  const [activity, setActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, progressData, activityData] = await Promise.all([
        api.getProgressStats(),
        api.getMyProgress({ status: 'Reading' }),
        api.getFriendsActivity().catch(() => []),
      ]);
      setStats(statsData);
      setCurrentlyReading(progressData.slice(0, 6));
      setActivity(activityData.slice(0, 10));
    } catch (error) {
      console.log('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContainer}>
          <Text style={[styles.logo, { color: colors.primary }]}>📖</Text>
          <Text style={[styles.appName, { color: colors.text }]}>ChrolloMark</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Track your manga & webtoon reading progress
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/login')}>
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButtonOutline, { borderColor: colors.primary }]}
            onPress={() => router.push('/auth/register')}>
            <Text style={[styles.authButtonOutlineText, { color: colors.primary }]}>
              Create Account
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>Welcome back,</Text>
            <Text style={[styles.username, { color: colors.text }]}>
              {user?.username} 👋
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/story/add')}>
            <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
              <IconSymbol name="plus" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statNumber, { color: colors.primary }]}>{stats.reading}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Reading</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statNumber, { color: colors.success }]}>{stats.completed}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statNumber, { color: colors.accent }]}>
                {stats.totalChaptersRead}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Chapters</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.statNumber, { color: '#3B82F6' }]}>{stats.planToRead}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Planned</Text>
            </View>
          </View>
        )}

        {/* Currently Reading */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📚 Currently Reading</Text>
            <TouchableOpacity onPress={() => router.push('/library')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {currentlyReading.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No stories being read yet. Add your first story!
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/story/add')}>
                <Text style={styles.emptyButtonText}>Add Story</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {currentlyReading.map((progress) => (
                <TouchableOpacity
                  key={progress._id}
                  style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => router.push(`/story/${progress.story._id}` as any)}
                  activeOpacity={0.7}>
                  {progress.story.coverImage ? (
                    <Image
                      source={{ uri: progress.story.coverImage }}
                      style={styles.storyCover}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={[styles.storyCover, styles.placeholderCover, { backgroundColor: colors.surfaceElevated }]}>
                      <Text style={{ fontSize: 32 }}>📖</Text>
                    </View>
                  )}
                  <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
                    {progress.story.title}
                  </Text>
                  <View style={styles.progressInfo}>
                    <Text style={[styles.chapterText, { color: colors.primary }]}>
                      Ch. {progress.currentChapter}
                      {progress.story.totalChapters ? ` / ${progress.story.totalChapters}` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.incrementButton, { backgroundColor: colors.primary }]}
                    onPress={async (e) => {
                      e.stopPropagation();
                      try {
                        const updated = await api.incrementChapter(progress._id);
                        setCurrentlyReading((prev) =>
                          prev.map((p) => (p._id === progress._id ? updated : p))
                        );
                      } catch (err) {
                        console.log(err);
                      }
                    }}>
                    <Text style={styles.incrementText}>+1 Chapter</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Friends Activity */}
        {activity.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>👥 Friends Activity</Text>
            {activity.map((item, index) => (
              <View
                key={`${item._id}-${index}`}
                style={[styles.activityItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <View style={styles.activityContent}>
                  <Text style={[styles.activityUser, { color: colors.primary }]}>
                    {item.user?.username}
                  </Text>
                  <Text style={[styles.activityText, { color: colors.textSecondary }]}>
                    is on chapter {item.currentChapter} of
                  </Text>
                  <Text style={[styles.activityStory, { color: colors.text }]}>
                    {' '}
                    {item.story?.title}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  greeting: { fontSize: 14, marginBottom: 2 },
  username: { fontSize: 24, fontWeight: '700' },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statNumber: { fontSize: 22, fontWeight: '700' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  seeAll: { fontSize: 14, fontWeight: '600' },
  storyCard: {
    width: 150,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  storyCover: {
    width: '100%',
    height: 200,
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyTitle: {
    fontSize: 13,
    fontWeight: '600',
    padding: Spacing.sm,
    paddingBottom: 4,
  },
  progressInfo: {
    paddingHorizontal: Spacing.sm,
  },
  chapterText: { fontSize: 12, fontWeight: '700' },
  incrementButton: {
    margin: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  incrementText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 14, textAlign: 'center', marginBottom: Spacing.md },
  emptyButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  emptyButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  activityItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  activityContent: { flexDirection: 'row', flexWrap: 'wrap' },
  activityUser: { fontWeight: '700', fontSize: 14 },
  activityText: { fontSize: 14 },
  activityStory: { fontWeight: '600', fontSize: 14 },
  // Welcome screen
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  logo: { fontSize: 72, marginBottom: Spacing.md },
  appName: { fontSize: 36, fontWeight: '800', marginBottom: Spacing.sm },
  tagline: { fontSize: 16, textAlign: 'center', marginBottom: Spacing.xl },
  authButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  authButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  authButtonOutline: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 2,
  },
  authButtonOutlineText: { fontSize: 16, fontWeight: '700' },
});
