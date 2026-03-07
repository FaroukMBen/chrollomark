import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
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
  const [recentlyUpdated, setRecentlyUpdated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, readingData, allProgressData] = await Promise.all([
        api.getProgressStats(),
        api.getMyProgress({ status: 'Reading' }),
        api.getMyProgress({}),
      ]);
      setStats(statsData);
      setCurrentlyReading(readingData.slice(0, 8));
      // Show recently completed or updated
      const sorted = allProgressData
        .filter((p: any) => p.status !== 'Reading')
        .slice(0, 5);
      setRecentlyUpdated(sorted);
    } catch (error) {
      console.log('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.welcomeContainer}>
          <View style={[styles.logoBg, { backgroundColor: colors.primary + '15' }]}>
            <IconSymbol name="book.fill" size={48} color={colors.primary} />
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>ChrolloMark</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Track your manga & webtoon{'\n'}reading progress
          </Text>
          <TouchableOpacity
            style={[styles.authButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/auth/login')}
            activeOpacity={0.8}>
            <Text style={styles.authButtonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.authButtonOutline, { borderColor: colors.primary }]}
            onPress={() => router.push('/auth/register')}
            activeOpacity={0.8}>
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

  const statCards = [
    { label: 'Reading', value: stats?.reading ?? 0, color: StatusColors.Reading, icon: 'book.fill' as const },
    { label: 'Completed', value: stats?.completed ?? 0, color: StatusColors.Completed, icon: 'checkmark.circle.fill' as const },
    { label: 'Chapters', value: stats?.totalChaptersRead ?? 0, color: colors.accent, icon: 'doc.text.fill' as const },
    { label: 'Planned', value: stats?.planToRead ?? 0, color: StatusColors['Plan to Read'], icon: 'bookmark.fill' as const },
  ];

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
            <Text style={[styles.username, { color: colors.text }]}>{user?.username}</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/story/add')}
            activeOpacity={0.8}>
            <View style={[styles.addButton, { backgroundColor: colors.primary }]}>
              <IconSymbol name="plus" size={22} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        {stats && (
          <View style={styles.statsRow}>
            {statCards.map((item) => (
              <View
                key={item.label}
                style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <View style={[styles.statIconBg, { backgroundColor: item.color + '15' }]}>
                  <IconSymbol name={item.icon} size={16} color={item.color} />
                </View>
                <Text style={[styles.statNumber, { color: item.color }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/(tabs)/explore')}>
            <IconSymbol name="globe" size={20} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Browse MangaDex</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/(tabs)/social')}>
            <IconSymbol name="person.2.fill" size={20} color={colors.primary} />
            <Text style={[styles.quickActionText, { color: colors.text }]}>Friends</Text>
          </TouchableOpacity>
        </View>

        {/* Currently Reading */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <IconSymbol name="book.fill" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Currently Reading</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
            </TouchableOpacity>
          </View>

          {currentlyReading.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <IconSymbol name="books.vertical.fill" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No stories being read yet.{'\n'}Add your first story!
              </Text>
              <TouchableOpacity
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/story/add')}
                activeOpacity={0.8}>
                <IconSymbol name="plus" size={16} color="#FFF" />
                <Text style={styles.emptyButtonText}>Add Story</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {currentlyReading.map((progress) => {
                const pct = progress.story.totalChapters > 0
                  ? Math.round((progress.currentChapter / progress.story.totalChapters) * 100)
                  : 0;
                return (
                  <TouchableOpacity
                    key={progress._id}
                    style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                    onPress={() => router.push(`/story/${progress.story._id}` as any)}
                    activeOpacity={0.7}>
                    {progress.story.coverImage ? (
                      <View>
                        <Image source={{ uri: progress.story.coverImage }} style={styles.storyCover} contentFit="cover" />
                        <LinearGradient colors={['transparent', 'rgba(0,0,0,0.7)']} style={styles.coverOverlay} />
                      </View>
                    ) : (
                      <View style={[styles.storyCover, styles.placeholderCover, { backgroundColor: colors.surfaceElevated }]}>
                        <IconSymbol name="book.fill" size={32} color={colors.textSecondary} />
                      </View>
                    )}
                    <View style={styles.storyMeta}>
                      <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={2}>
                        {progress.story.title}
                      </Text>
                      <View style={styles.progressRow}>
                        <Text style={[styles.chapterText, { color: colors.primary }]}>
                          Ch. {progress.currentChapter}
                          {progress.story.totalChapters ? ` / ${progress.story.totalChapters}` : ''}
                        </Text>
                      </View>
                      {pct > 0 && (
                        <View style={[styles.progressBar, { backgroundColor: colors.surfaceElevated }]}>
                          <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                        </View>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.incrementButton, { backgroundColor: colors.primary }]}
                      onPress={async (e) => {
                        e.stopPropagation();
                        try {
                          const updated = await api.incrementChapter(progress._id);
                          setCurrentlyReading((prev) => prev.map((p) => (p._id === progress._id ? updated : p)));
                        } catch (err) { console.log(err); }
                      }}
                      activeOpacity={0.8}>
                      <IconSymbol name="plus" size={14} color="#FFF" />
                      <Text style={styles.incrementText}>Chapter</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Recently Updated */}
        {recentlyUpdated.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <IconSymbol name="clock.fill" size={18} color={colors.textSecondary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
            </View>
            {recentlyUpdated.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={[styles.activityItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                onPress={() => router.push(`/story/${item.story?._id}` as any)}>
                <View style={[styles.statusIndicator, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
                <View style={styles.activityInfo}>
                  <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.story?.title}
                  </Text>
                  <View style={styles.activityMeta}>
                    <View style={[styles.statusPill, { backgroundColor: (StatusColors[item.status] || colors.primary) + '20' }]}>
                      <Text style={[styles.statusPillText, { color: StatusColors[item.status] || colors.primary }]}>{item.status}</Text>
                    </View>
                    <Text style={[styles.activityChapter, { color: colors.textSecondary }]}>
                      Ch. {item.currentChapter}{item.story?.totalChapters ? ` / ${item.story.totalChapters}` : ''}
                    </Text>
                  </View>
                </View>
                <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
              </TouchableOpacity>
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
  greeting: { fontSize: 14, marginBottom: 2, fontWeight: '500' },
  username: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.glow,
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statCard: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    gap: 3,
  },
  statIconBg: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statNumber: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.3 },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  quickActionText: { fontSize: 13, fontWeight: '600' },
  section: { marginTop: Spacing.lg, paddingHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  seeAll: { fontSize: 13, fontWeight: '600' },
  storyCard: {
    width: 150,
    marginRight: Spacing.md,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  storyCover: { width: '100%', height: 190 },
  coverOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 60 },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  storyMeta: { padding: Spacing.sm },
  storyTitle: { fontSize: 12, fontWeight: '700', marginBottom: 4, lineHeight: 16 },
  progressRow: { flexDirection: 'row', alignItems: 'center' },
  chapterText: { fontSize: 11, fontWeight: '700' },
  progressBar: { height: 3, borderRadius: 2, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  incrementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  incrementText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    gap: Spacing.md,
  },
  statusIndicator: { width: 4, height: 36, borderRadius: 2 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: 10, fontWeight: '700' },
  activityChapter: { fontSize: 12, fontWeight: '600' },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
    ...Shadows.sm,
  },
  emptyButtonText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  logoBg: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  appName: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: Spacing.sm },
  tagline: { fontSize: 16, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 24 },
  authButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.glow,
  },
  authButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  authButtonOutline: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 2,
  },
  authButtonOutlineText: { fontSize: 16, fontWeight: '700' },
});
