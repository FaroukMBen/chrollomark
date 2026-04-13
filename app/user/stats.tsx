import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';

const { width } = Dimensions.get('window');

export default function InsightsScreen() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = async () => {
    try {
      const data = await api.getUserStats();
      setStats(data);
    } catch (error) {
      console.error('Stats loading error:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadStats();
  };

  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderStatCard = (label: string, value: number, icon: string, gradient: string[], subline?: string) => (
    <LinearGradient
      colors={gradient as [string, string]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.cardHeader}>
        <IconSymbol name={icon as any} size={24} color="#FFF" />
        <Text style={styles.cardLabel}>{label}</Text>
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      {subline && <Text style={styles.cardSubline}>{subline}</Text>}
    </LinearGradient>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Insights & Stats</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Main Stats Grid */}
        <View style={styles.grid}>
          {renderStatCard('Total Titles', stats.totalStories, 'books.vertical.fill', ['#6366F1', '#8B5CF6'])}
          {renderStatCard('Completed', stats.completed, 'checkmark.circle.fill', ['#10B981', '#059669'])}
          {renderStatCard('Reading', stats.reading, 'book.fill', ['#3B82F6', '#2563EB'])}
          {renderStatCard('Favorites', stats.favorites, 'heart.fill', ['#EF4444', '#DC2626'])}
        </View>

        {/* Media Distribution */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Media Breakdown</Text>
          <View style={styles.mediaRow}>
             <View style={styles.mediaItem}>
                <LinearGradient colors={['#A855F7', '#7C3AED']} style={styles.mediaIconBg}>
                   <IconSymbol name="book.fill" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                   <Text style={[styles.mediaLabel, { color: colors.textSecondary }]}>Manga</Text>
                   <Text style={[styles.mediaValue, { color: colors.text }]}>{stats.mangaCount}</Text>
                </View>
             </View>
             <View style={[styles.dividerVertical, { backgroundColor: colors.border }]} />
             <View style={styles.mediaItem}>
                <LinearGradient colors={['#F59E0B', '#EA580C']} style={styles.mediaIconBg}>
                   <IconSymbol name="play.fill" size={20} color="#FFF" />
                </LinearGradient>
                <View>
                   <Text style={[styles.mediaLabel, { color: colors.textSecondary }]}>Anime</Text>
                   <Text style={[styles.mediaValue, { color: colors.text }]}>{stats.animeCount}</Text>
                </View>
             </View>
          </View>
        </View>

        {/* Genre Ranking */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Top Genres</Text>
          {stats.genreDistribution && stats.genreDistribution.length > 0 ? (
            stats.genreDistribution.map((genre: any, idx: number) => {
              const percentage = Math.min((genre.count / stats.totalStories) * 100, 100);
              return (
                <View key={genre.name} style={styles.genreRow}>
                  <View style={styles.genreHeader}>
                    <Text style={[styles.genreName, { color: colors.text }]}>{genre.name}</Text>
                    <Text style={[styles.genreCount, { color: colors.textSecondary }]}>{genre.count} titles</Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: colors.surfaceElevated }]}>
                    <LinearGradient
                      colors={[colors.primary, '#8B5CF6'] as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[styles.barFill, { width: `${percentage}%` }]}
                    />
                  </View>
                </View>
              );
            })
          ) : (
             <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No genre data available yet.</Text>
          )}
        </View>

        {/* Totals */}
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
           <Text style={[styles.sectionTitle, { color: colors.text }]}>Activity Summary</Text>
           <View style={styles.activityRow}>
              <View style={styles.activityBox}>
                 <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>Read/Watched</Text>
                 <Text style={[styles.activityValue, { color: colors.text }]}>{stats.totalChaptersRead}</Text>
                 <Text style={[styles.activitySub, { color: colors.textSecondary }]}>total chapters/eps</Text>
              </View>
              <View style={styles.activityBox}>
                 <Text style={[styles.activityLabel, { color: colors.textSecondary }]}>This Week</Text>
                 <Text style={[styles.activityValue, { color: colors.text }]}>{stats.readThisWeek}</Text>
                 <Text style={[styles.activitySub, { color: colors.textSecondary }]}>titles updated</Text>
              </View>
           </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '800' },
  scrollContent: { padding: Spacing.lg },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  card: {
    width: (width - Spacing.lg * 2 - 12) / 2,
    padding: 16,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  cardValue: { color: '#FFF', fontSize: 24, fontWeight: '900' },
  cardSubline: { color: 'rgba(255,255,255,0.6)', fontSize: 10, marginTop: 4 },
  
  section: {
    padding: 20,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    marginBottom: 20,
    ...Shadows.sm,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  
  mediaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mediaItem: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  mediaIconBg: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  mediaLabel: { fontSize: 13, fontWeight: '600' },
  mediaValue: { fontSize: 20, fontWeight: '800' },
  dividerVertical: { width: 1, height: 40, marginHorizontal: 20 },
  
  genreRow: { marginBottom: 16 },
  genreHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  genreName: { fontSize: 14, fontWeight: '700' },
  genreCount: { fontSize: 12 },
  barBg: { height: 8, borderRadius: 4, width: '100%', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  
  emptyText: { textAlign: 'center', fontStyle: 'italic', paddingVertical: 20 },
  
  activityRow: { flexDirection: 'row', gap: 16 },
  activityBox: { flex: 1, alignItems: 'center', padding: 16 },
  activityLabel: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  activityValue: { fontSize: 28, fontWeight: '900', marginBottom: 2 },
  activitySub: { fontSize: 11 },
});
