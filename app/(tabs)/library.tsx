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
import { BorderRadius, Colors, ReadingStatuses, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function LibraryScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [progress, setProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('All');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const params = activeFilter !== 'All' ? { status: activeFilter } : undefined;
      const data = await api.getMyProgress(params);
      setProgress(data);
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeFilter]);

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
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to view your library
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const filters = ['All', ...ReadingStatuses];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>My Library</Text>
        <TouchableOpacity onPress={() => router.push('/story/add')}>
          <IconSymbol name="plus.circle.fill" size={28} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}>
        {filters.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              {
                backgroundColor:
                  activeFilter === filter ? colors.primary : colors.surface,
                borderColor: activeFilter === filter ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setActiveFilter(filter);
              setIsLoading(true);
            }}>
            <Text
              style={[
                styles.filterText,
                { color: activeFilter === filter ? '#FFF' : colors.textSecondary },
              ]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.listContent}>
          {progress.length === 0 ? (
            <View style={styles.center}>
              <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>📚</Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {activeFilter === 'All'
                  ? 'Your library is empty. Start by adding a story!'
                  : `No stories with status "${activeFilter}"`}
              </Text>
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
                    <Text style={{ fontSize: 24 }}>📖</Text>
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
                  }}>
                  <Text style={styles.quickActionText}>+1</Text>
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
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  filterContainer: { maxHeight: 50, marginBottom: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  listCover: { width: 60, height: 85, borderRadius: BorderRadius.sm },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1, marginLeft: Spacing.md },
  listTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  listAuthor: { fontSize: 12, marginBottom: 6 },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  chapterInfo: { fontSize: 12, fontWeight: '700' },
  quickAction: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.sm,
  },
  quickActionText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
