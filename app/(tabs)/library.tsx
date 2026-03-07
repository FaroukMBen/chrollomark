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
import { BorderRadius, Colors, ReadingStatuses, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function LibraryScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [progress, setProgress] = useState<any[]>([]);
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const params = activeFilter !== 'All' ? { status: activeFilter } : undefined;
      const [progressData, collectionsData] = await Promise.all([
        api.getMyProgress(params),
        api.getMyCollections(),
      ]);
      setProgress(progressData);
      setCollections(collectionsData);
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="book.fill" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
            Sign in to view your library
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filters = ['All', ...ReadingStatuses];

  const getFilterIcon = (filter: string) => {
    const icons: Record<string, string> = {
      'All': 'books.vertical.fill',
      'Reading': 'book.fill',
      'Completed': 'checkmark.circle.fill',
      'Plan to Read': 'bookmark.fill',
      'On Hold': 'pause.circle.fill',
      'Dropped': 'xmark.circle.fill',
    };
    return icons[filter] || 'book.fill';
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>My Library</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {progress.length} {progress.length === 1 ? 'title' : 'titles'}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/story/add')}
          activeOpacity={0.8}>
          <IconSymbol name="plus" size={18} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}>
        {filters.map((filter) => {
          const isActive = activeFilter === filter;
          const chipColor = filter === 'All' ? colors.primary : (StatusColors[filter] || colors.primary);
          return (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                {
                  backgroundColor: isActive ? chipColor + '20' : colors.surface,
                  borderColor: isActive ? chipColor : colors.border,
                },
              ]}
              onPress={() => {
                setActiveFilter(filter);
                setIsLoading(true);
              }}>
              <IconSymbol
                name={getFilterIcon(filter) as any}
                size={13}
                color={isActive ? chipColor : colors.textSecondary}
              />
              <Text
                style={[
                  styles.filterText,
                  { color: isActive ? chipColor : colors.textSecondary },
                ]}>
                {filter}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}>

          {/* Collections section */}
          {activeFilter === 'All' && collections.length > 0 && (
            <View style={styles.collectionsSection}>
              <View style={styles.collectionHeader}>
                <View style={styles.collectionTitleRow}>
                  <IconSymbol name="folder.fill" size={16} color={colors.primary} />
                  <Text style={[styles.collectionTitle, { color: colors.text }]}>Collections</Text>
                </View>
                <TouchableOpacity
                  style={[styles.newCollBtn, { backgroundColor: colors.primary + '15' }]}
                  onPress={() => router.push('/collection/create')}>
                  <IconSymbol name="plus" size={12} color={colors.primary} />
                  <Text style={[styles.newCollText, { color: colors.primary }]}>New</Text>
                </TouchableOpacity>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {collections.map((coll) => (
                  <TouchableOpacity
                    key={coll._id}
                    style={[styles.collCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                    onPress={() => router.push(`/collection/${coll._id}` as any)}>
                    <View style={[styles.collStripe, { backgroundColor: coll.color || colors.primary }]} />
                    <Text style={[styles.collName, { color: colors.text }]} numberOfLines={1}>{coll.name}</Text>
                    <Text style={[styles.collCount, { color: colors.textSecondary }]}>{coll.stories?.length || 0} stories</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {progress.length === 0 ? (
            <View style={styles.emptyCenter}>
              <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                <IconSymbol name="books.vertical.fill" size={40} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {activeFilter === 'All' ? 'Library is empty' : `No "${activeFilter}" titles`}
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeFilter === 'All'
                  ? 'Start by exploring and adding stories to your library'
                  : `You don't have any stories with "${activeFilter}" status`}
              </Text>
              {activeFilter === 'All' && (
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/(tabs)/explore')}
                  activeOpacity={0.8}>
                  <IconSymbol name="globe" size={16} color="#FFF" />
                  <Text style={styles.emptyBtnText}>Browse MangaDex</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            progress.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={[styles.listItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                onPress={() => router.push(`/story/${item.story._id}` as any)}
                activeOpacity={0.7}>
                {item.story.coverImage ? (
                  <Image source={{ uri: item.story.coverImage }} style={styles.listCover} contentFit="cover" />
                ) : (
                  <View style={[styles.listCover, styles.placeholderCover, { backgroundColor: colors.surfaceElevated }]}>
                    <IconSymbol name="book.fill" size={24} color={colors.textSecondary} />
                  </View>
                )}
                <View style={styles.listInfo}>
                  <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.story.title}
                  </Text>
                  <Text style={[styles.listAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
                    {item.story.author || item.story.type}
                  </Text>
                  <View style={styles.listMeta}>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: (StatusColors[item.status] || colors.primary) + '20' },
                      ]}>
                      <View style={[styles.statusDot, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
                      <Text
                        style={[
                          styles.statusText,
                          { color: StatusColors[item.status] || colors.primary },
                        ]}>
                        {item.status}
                      </Text>
                    </View>
                    <Text style={[styles.chapterInfo, { color: colors.primary }]}>
                      Ch. {item.currentChapter}
                      {item.story.totalChapters ? ` / ${item.story.totalChapters}` : ''}
                    </Text>
                  </View>
                  {/* Progress bar */}
                  {item.story.totalChapters > 0 && (
                    <View style={[styles.progressBar, { backgroundColor: colors.surfaceElevated }]}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            backgroundColor: StatusColors[item.status] || colors.primary,
                            width: `${Math.min((item.currentChapter / item.story.totalChapters) * 100, 100)}%`,
                          },
                        ]}
                      />
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.quickAction, { backgroundColor: colors.primary }]}
                  onPress={async (e) => {
                    e.stopPropagation();
                    try {
                      const updated = await api.incrementChapter(item._id);
                      setProgress((prev) => prev.map((p) => (p._id === item._id ? updated : p)));
                    } catch (err) {
                      console.log(err);
                    }
                  }}
                  activeOpacity={0.7}>
                  <IconSymbol name="plus" size={16} color="#FFF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  filterContainer: { maxHeight: 50, marginBottom: Spacing.sm, marginTop: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },

  // Collections
  collectionsSection: { marginBottom: Spacing.md },
  collectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collectionTitle: { fontSize: 15, fontWeight: '700' },
  newCollBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  newCollText: { fontSize: 11, fontWeight: '700' },
  collCard: {
    width: 130,
    padding: Spacing.md,
    marginRight: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  collStripe: { width: 24, height: 3, borderRadius: 2, marginBottom: 8 },
  collName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  collCount: { fontSize: 11, fontWeight: '500' },

  // List
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  listCover: { width: 65, height: 90, borderRadius: BorderRadius.md },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1, marginLeft: Spacing.md },
  listTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  listAuthor: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  chapterInfo: { fontSize: 12, fontWeight: '700' },
  progressBar: {
    height: 3,
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  quickAction: {
    width: 38,
    height: 38,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
    ...Shadows.sm,
  },
  emptyCenter: {
    paddingTop: 60,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
