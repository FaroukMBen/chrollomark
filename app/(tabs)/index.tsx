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
  const [trendingStories, setTrendingStories] = useState<any[]>([]);
  const [recentlyUpdated, setRecentlyUpdated] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, readingData, allProgressData, trendingData] = await Promise.all([
        api.getProgressStats(),
        api.getMyProgress({ status: 'Reading' }),
        api.getMyProgress({}),
        api.getStories({ sort: 'popularity', limit: '10' }),
      ]);
      setStats(statsData);
      setCurrentlyReading(readingData.slice(0, 8));
      setTrendingStories(trendingData.stories);
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
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
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
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
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
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}>

        {/* Header & Hero */}
        <View style={styles.heroSection}>
          <View style={styles.header}>
            <View>
              <Text style={[styles.greeting, { color: colors.textSecondary }]}>{getGreeting()},</Text>
              <Text style={[styles.username, { color: colors.text }]}>{user?.username}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.profileButton, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
              onPress={() => router.push('/(tabs)/profile')}>
              <Image 
                source={user?.avatar ? { uri: user.avatar } : undefined} 
                style={styles.avatarMini}
                contentFit="cover"
              />
            </TouchableOpacity>
          </View>

          {/* Featured/Most Recent Reading Card */}
          {currentlyReading.length > 0 ? (
            <TouchableOpacity 
              style={[styles.heroCard, { backgroundColor: colors.surface }]}
              onPress={() => router.push(`/story/${currentlyReading[0].story._id}` as any)}
              activeOpacity={0.9}>
              <Image 
                source={{ uri: currentlyReading[0].story.coverImage }} 
                style={styles.heroBackground} 
                contentFit="cover" 
              />
              <LinearGradient 
                colors={['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.85)']} 
                style={styles.heroGradient} 
              />
              <View style={styles.heroContent}>
                <View style={[styles.heroBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.heroBadgeText}>CONTINUE READING</Text>
                </View>
                <Text style={styles.heroTitle} numberOfLines={2}>{currentlyReading[0].story.title}</Text>
                <View style={styles.heroMeta}>
                  <Text style={styles.heroChapter}>Chapter {currentlyReading[0].currentChapter}</Text>
                  <View style={styles.dot} />
                  <Text style={styles.heroSubText}>{currentlyReading[0].story.type}</Text>
                </View>
                {currentlyReading[0].story.totalChapters > 0 && (
                  <View style={styles.heroProgressContainer}>
                    <View style={[styles.heroProgressBar, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                      <View style={[styles.heroProgressFill, { 
                        width: `${Math.round((currentlyReading[0].currentChapter / currentlyReading[0].story.totalChapters) * 100)}%`, 
                        backgroundColor: colors.primary 
                      }]} />
                    </View>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={[styles.heroCard, { backgroundColor: colors.primary + '20' }]}
              onPress={() => router.push('/(tabs)/explore')}
              activeOpacity={0.9}>
              <LinearGradient 
                colors={[colors.primary + '40', colors.primary + '10']} 
                style={styles.heroBackground} 
              />
              <View style={[styles.heroContent, { alignItems: 'center', justifyContent: 'center' }]}>
                <View style={[styles.heroBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.heroBadgeText}>DISCOVER</Text>
                </View>
                <Text style={[styles.heroTitle, { textAlign: 'center' }]}>Find your next favorite story</Text>
                <Text style={[styles.heroSubText, { color: colors.textSecondary, textAlign: 'center', marginTop: 8 }]}>
                  Explore thousands of manga, webtoons and comics.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Stats Summary - New Robust Grid */}
          {stats && (
            <View style={styles.statsGrid}>
              {statCards.map((item) => (
                <View
                  key={item.label}
                  style={[styles.statGridCard, { backgroundColor: colors.surface + '80', borderColor: colors.cardBorder }]}>
                  <View style={[styles.statIconContainer, { backgroundColor: item.color + '15' }]}>
                    <IconSymbol name={item.icon} size={16} color={item.color} />
                  </View>
                  <View style={styles.statInfo}>
                    <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{item.label}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/(tabs)/explore')}>
            <View style={[styles.quickActionCircle, { backgroundColor: colors.primary + '15' }]}>
              <IconSymbol name="globe" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Discover</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/(tabs)/social')}>
            <View style={[styles.quickActionCircle, { backgroundColor: colors.primary + '15' }]}>
              <IconSymbol name="person.2.fill" size={16} color={colors.primary} />
            </View>
            <Text style={[styles.quickActionText, { color: colors.text }]}>Friends</Text>
          </TouchableOpacity>
        </View>

        {/* Trending on Chrollomark */}
        {trendingStories.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <IconSymbol name="flame.fill" size={18} color="#FF6B6B" />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Trending Now</Text>
              </View>
              <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
                <Text style={[styles.seeAll, { color: colors.primary }]}>Explore</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {trendingStories.map((story) => (
                <TouchableOpacity
                  key={story._id}
                  style={styles.trendingCard}
                  onPress={() => router.push(`/story/${story._id}` as any)}
                  activeOpacity={0.8}>
                  <View style={styles.trendingCoverContainer}>
                    <Image source={{ uri: story.coverImage }} style={styles.trendingCover} contentFit="cover" />
                    <View style={[styles.popularityBadge, { backgroundColor: colors.surface + 'E6' }]}>
                      <IconSymbol name="plus.circle.fill" size={10} color={colors.primary} />
                      <Text style={[styles.popularityText, { color: colors.text }]}>{Math.round(story.popularityScore)}</Text>
                    </View>
                  </View>
                  <Text style={[styles.trendingTitle, { color: colors.text }]} numberOfLines={2}>
                    {story.title}
                  </Text>
                  <Text style={[styles.trendingSub, { color: colors.textSecondary }]}>
                    {story.genres?.[0] || story.type}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Currently Reading */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <IconSymbol name="book.fill" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Currently Reading</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/(tabs)/library')}>
              <Text style={[styles.seeAll, { color: colors.primary }]}>Go to Library</Text>
            </TouchableOpacity>
          </View>

          {currentlyReading.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <IconSymbol name="books.vertical.fill" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Your reading list is empty.{'\n'}Find something great to read!
              </Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
              {currentlyReading.map((progress) => {
                const pct = progress.story.totalChapters > 0
                  ? Math.round((progress.currentChapter / progress.story.totalChapters) * 100)
                  : 0;
                return (
                  <TouchableOpacity
                    key={progress._id}
                    style={[styles.storyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                    onPress={() => router.push(`/story/${progress.story._id}` as any)}
                    activeOpacity={0.8}>
                    <View>
                      <Image source={{ uri: progress.story.coverImage }} style={styles.storyCover} contentFit="cover" />
                      <LinearGradient colors={['transparent', 'rgba(0,0,0,0.8)']} style={styles.coverOverlay} />
                      <TouchableOpacity
                        style={[styles.incrementAction, { backgroundColor: colors.primary }]}
                        onPress={async (e) => {
                          e.stopPropagation();
                          try {
                            const updated = await api.incrementChapter(progress._id);
                            setCurrentlyReading((prev) => prev.map((p) => (p._id === progress._id ? updated : p)));
                          } catch (err) { console.log(err); }
                        }}>
                        <IconSymbol name="plus" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                    <View style={styles.storyMeta}>
                      <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={1}>
                        {progress.story.title}
                      </Text>
                      <Text style={[styles.chapterText, { color: colors.textSecondary }]}>
                        Ch. {progress.currentChapter} / {progress.story.totalChapters || '??'}
                      </Text>
                      {pct > 0 && (
                        <View style={[styles.miniProgressBar, { backgroundColor: colors.surfaceElevated }]}>
                          <View style={[styles.miniProgressFill, { width: `${pct}%`, backgroundColor: colors.primary }]} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        {/* Recently Updated */}
        {recentlyUpdated.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <IconSymbol name="clock.fill" size={18} color={colors.textSecondary} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Activity</Text>
              </View>
            </View>
            <View style={{ marginTop: Spacing.xs }}>
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
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  heroSection: {
    paddingBottom: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  greeting: { fontSize: 13, marginBottom: 2, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  username: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarMini: { width: '100%', height: '100%' },
  
  heroCard: {
    marginHorizontal: Spacing.lg,
    height: 220,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  heroBackground: { width: '100%', height: '100%', position: 'absolute' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '100%' },
  heroContent: { flex: 1, justifyContent: 'flex-end', padding: Spacing.lg },
  heroBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.sm,
    marginBottom: 8,
  },
  heroBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#FFF', marginBottom: 6, textShadowColor: 'rgba(0,0,0,0.3)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  heroChapter: { color: '#FFF', fontSize: 14, fontWeight: '700', opacity: 0.9 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFF', opacity: 0.5 },
  heroSubText: { color: '#FFF', fontSize: 14, fontWeight: '500', opacity: 0.8 },
  heroProgressContainer: { width: '100%', marginTop: 4 },
  heroProgressBar: { height: 4, borderRadius: 2, overflow: 'hidden' },
  heroProgressFill: { height: '100%', borderRadius: 2 },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    justifyContent: 'space-between',
    marginTop: Spacing.md,
  },
  statGridCard: {
    width: '48.5%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  statIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statInfo: { flex: 1 },
  statValue: { fontSize: 18, fontWeight: '800', lineHeight: 22 },
  statLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.6, marginTop: 1 },

  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 10,
  },
  quickActionCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: { fontSize: 13, fontWeight: '700' },

  section: { marginTop: Spacing.xl },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  seeAll: { fontSize: 13, fontWeight: '700' },
  horizontalScroll: { paddingLeft: Spacing.lg, paddingRight: Spacing.sm, paddingBottom: 4 },

  trendingCard: { width: 130, marginRight: Spacing.md },
  trendingCoverContainer: { width: 130, height: 180, borderRadius: BorderRadius.lg, overflow: 'hidden', marginBottom: 8, ...Shadows.sm },
  trendingCover: { width: '100%', height: '100%' },
  popularityBadge: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: BorderRadius.sm, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  popularityText: { fontSize: 10, fontWeight: '800' },
  trendingTitle: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  trendingSub: { fontSize: 11, fontWeight: '600', opacity: 0.8 },

  storyCard: { width: 160, marginRight: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden', borderWidth: 1, ...Shadows.sm },
  storyCover: { width: '100%', height: 120 },
  coverOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40 },
  storyMeta: { padding: 12 },
  storyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  chapterText: { fontSize: 12, fontWeight: '600' },
  miniProgressBar: { height: 3, borderRadius: 2, marginTop: 10, overflow: 'hidden' },
  miniProgressFill: { height: '100%', borderRadius: 2 },
  incrementAction: { position: 'absolute', bottom: 8, right: 8, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },

  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    gap: Spacing.md,
  },
  statusIndicator: { width: 4, height: 36, borderRadius: 2 },
  activityInfo: { flex: 1 },
  activityTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  activityMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusPillText: { fontSize: 11, fontWeight: '700' },
  activityChapter: { fontSize: 12, fontWeight: '600' },

  emptyCard: { marginHorizontal: Spacing.lg, padding: Spacing.xl, borderRadius: BorderRadius.xl, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed', gap: Spacing.sm },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  logoBg: { width: 100, height: 100, borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg },
  appName: { fontSize: 36, fontWeight: '800', letterSpacing: -1, marginBottom: Spacing.sm },
  tagline: { fontSize: 16, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 24 },
  authButton: { width: '100%', paddingVertical: 16, borderRadius: BorderRadius.lg, alignItems: 'center', marginBottom: Spacing.md, ...Shadows.glow },
  authButtonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  authButtonOutline: { width: '100%', paddingVertical: 16, borderRadius: BorderRadius.lg, alignItems: 'center', borderWidth: 2 },
  authButtonOutlineText: { fontSize: 16, fontWeight: '700' },
});
