import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

type SourceTab = 'local' | 'mangadex';

const ORDER_OPTIONS = [
  { label: 'Popular', value: 'followedCount', icon: 'flame.fill' as const },
  { label: 'Latest', value: 'latestUploadedChapter', icon: 'clock.fill' as const },
  { label: 'New', value: 'createdAt', icon: 'sparkles' as const },
  { label: 'Relevance', value: 'relevance', icon: 'star.fill' as const },
  { label: 'Title', value: 'title', icon: 'textformat' as const },
];

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
];

const CONTENT_RATINGS = [
  { label: 'Safe', value: 'safe' },
  { label: 'Suggestive', value: 'suggestive' },
  { label: 'Pornographic', value: 'pornographic' },
];

const statusColor = (status: string) => {
  switch (status) {
    case 'ongoing': case 'Ongoing': return '#10B981';
    case 'completed': case 'Completed': return '#6366F1';
    case 'hiatus': case 'Hiatus': return '#F59E0B';
    case 'cancelled': case 'Cancelled': return '#EF4444';
    default: return '#94A3B8';
  }
};

export default function ExploreScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

  // Shared state
  const [search, setSearch] = useState('');
  const searchRef = useRef('');
  const [source, setSource] = useState<SourceTab>('local');
  const [refreshing, setRefreshing] = useState(false);

  // Library of stories the user has in their reading progress
  const [userLibraryIds, setUserLibraryIds] = useState<Set<string>>(new Set());

  // Local stories state (Chrollomark)
  const [localResults, setLocalResults] = useState<any[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localTotal, setLocalTotal] = useState(0);
  const [localPage, setLocalPage] = useState(1);
  const [localTotalPages, setLocalTotalPages] = useState(1);

  // MangaDex state
  const [mdResults, setMdResults] = useState<any[]>([]);
  const [mdTotal, setMdTotal] = useState(0);
  const [mdOffset, setMdOffset] = useState(0);
  const [mdLoading, setMdLoading] = useState(false);

  // Shared filter state (used by BOTH tabs for a unified experience)
  const [order, setOrder] = useState('followedCount');
  const [statusFilter, setStatusFilter] = useState('');
  const [contentRating, setContentRating] = useState('safe,suggestive');
  const [showFilters, setShowFilters] = useState(false);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (order !== 'followedCount') count++;
    if (statusFilter !== '') count++;
    if (contentRating !== 'safe,suggestive') count++;
    return count;
  }, [order, statusFilter, contentRating]);

  const resetFilters = () => {
    setOrder('followedCount');
    setStatusFilter('');
    setContentRating('safe,suggestive');
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    searchRef.current = text;
  }, []);

  // Load user's library IDs so we know what's "already in library"
  const loadUserLibrary = useCallback(async () => {
    try {
      const progress = await api.getMyProgress({});
      const ids = new Set<string>();
      progress.forEach((p: any) => {
        if (p.story?._id) ids.add(p.story._id);
        if (p.story?.mangadexId) ids.add(p.story.mangadexId);
      });
      setUserLibraryIds(ids);
    } catch { /* ignore */ }
  }, []);

  // --- Local stories (Chrollomark) ---
  const loadLocal = useCallback(async (pageNum = 1, append = false) => {
    setLocalLoading(true);
    try {
      const params: any = { page: String(pageNum), limit: '20', sort: order === 'followedCount' ? '-views' : order === 'latestUploadedChapter' ? '-updatedAt' : order === 'relevance' ? '-averageRating' : order === 'title' ? 'title' : `-${order}` };
      if (searchRef.current.trim()) params.search = searchRef.current.trim();
      if (statusFilter) {
        // Map lowercase to our DB status
        const sMap: Record<string, string> = { ongoing: 'Ongoing', completed: 'Completed', hiatus: 'Hiatus', cancelled: 'Cancelled' };
        params.status = sMap[statusFilter] || statusFilter;
      }

      const data = await api.getStories(params);
      setLocalResults(append ? prev => [...prev, ...data.stories] : data.stories);
      setLocalTotalPages(data.totalPages);
      setLocalTotal(data.total);
      setLocalPage(pageNum);
    } catch (error) {
      console.log('Load local error:', error);
    } finally {
      setLocalLoading(false);
    }
  }, [order, statusFilter]);

  // --- MangaDex ---
  const loadMangaDex = useCallback(async (offset = 0, append = false) => {
    setMdLoading(true);
    try {
      const params: any = {
        limit: '20',
        offset: String(offset),
        order: order,
        orderDir: order === 'title' ? 'asc' : 'desc',
        contentRating: contentRating,
      };
      if (searchRef.current.trim()) params.title = searchRef.current.trim();
      if (statusFilter) params.status = statusFilter;

      const data = await api.getMangaDexManga(params);
      setMdResults(append ? prev => [...prev, ...(data.results || [])] : (data.results || []));
      setMdTotal(data.total || 0);
      setMdOffset(offset);
    } catch (error) {
      console.log('MangaDex error:', error);
      if (!append) setMdResults([]);
    } finally {
      setMdLoading(false);
    }
  }, [order, statusFilter, contentRating]);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadUserLibrary();
  }, [isAuthenticated, loadUserLibrary]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (source === 'local') {
      loadLocal(1);
    } else {
      loadMangaDex(0);
    }
  }, [isAuthenticated, source, loadLocal, loadMangaDex]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserLibrary();
    if (source === 'local') {
      await loadLocal(1);
    } else {
      await loadMangaDex(0);
    }
    setRefreshing(false);
  };

  const loadMore = () => {
    if (source === 'local') {
      if (localPage < localTotalPages && !localLoading) loadLocal(localPage + 1, true);
    } else {
      if (mdResults.length < mdTotal && !mdLoading) loadMangaDex(mdOffset + 20, true);
    }
  };

  const doSearch = useCallback(() => {
    if (source === 'local') {
      loadLocal(1);
    } else {
      loadMangaDex(0);
    }
  }, [source, loadLocal, loadMangaDex]);

  const handleAddToLibrary = async (item: any, isMD: boolean) => {
    try {
      if (isMD) {
        const result = await api.cloneMangaDex({
          mangadexId: item.id,
          title: item.title,
          description: item.description,
          coverImage: item.coverUrlHQ || item.coverUrl,
          author: item.author,
          status: item.status,
          totalChapters: item.lastChapter,
          genres: item.tags,
          year: item.year,
        });
        // Also create reading progress
        await api.updateProgress({ storyId: result.story._id, status: 'Plan to Read' });
        setUserLibraryIds(prev => new Set([...prev, item.id, result.story._id]));
        showToast({ message: result.created ? `"${item.title}" added to library!` : `"${item.title}" synced`, type: 'success' });
      } else {
        // Local story — add to user's reading progress
        await api.updateProgress({ storyId: item._id, status: 'Plan to Read' });
        setUserLibraryIds(prev => new Set([...prev, item._id]));
        showToast({ message: `"${item.title}" added to your library!`, type: 'success' });
      }
    } catch (e: any) {
      showToast({ message: e.message || 'Failed to add', type: 'error' });
    }
  };

  const isInLibrary = (item: any, isMD: boolean) => {
    if (isMD) return userLibraryIds.has(item.id);
    return userLibraryIds.has(item._id);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="magnifyingglass" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
            Sign in to explore stories
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Unified card renderer (same style for both tabs) ───
  const renderCard = ({ item }: { item: any }) => {
    const isMD = source === 'mangadex';
    const title = item.title;
    const coverUrl = isMD ? item.coverUrl : item.coverImage;
    const author = item.author || (isMD ? '' : item.addedBy?.username);
    const status = isMD ? item.status : (item.status || 'ongoing');
    const sColor = statusColor(status);
    const year = isMD ? item.year : item.year;
    const tags = isMD ? item.tags : item.genres;
    const inLib = isInLibrary(item, isMD);
    const storyId = isMD ? item.id : item._id;

    return (
      <View style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/story/${storyId}` as any)}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={styles.gridCover} contentFit="cover" />
          ) : (
            <View style={[styles.gridCover, styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
              <IconSymbol name="book.fill" size={32} color={colors.textSecondary} />
            </View>
          )}
          <LinearGradient colors={['transparent', 'rgba(0,0,0,0.85)']} style={styles.coverGradient} />

          {/* Source badge */}
          <View style={styles.badgeRow}>
            {isMD && (
              <View style={[styles.apiBadge, { backgroundColor: '#FF6740' }]}>
                <Text style={styles.apiBadgeText}>MANGADEX</Text>
              </View>
            )}
            {!isMD && (
              <View style={[styles.apiBadge, { backgroundColor: colors.primary }]}>
                <Text style={styles.apiBadgeText}>CHROLLOMARK</Text>
              </View>
            )}
          </View>

          <View style={styles.gridInfo}>
            <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>{title}</Text>
            {author ? (
              <Text style={[styles.authorText, { color: colors.textSecondary }]} numberOfLines={1}>{author}</Text>
            ) : null}
            <View style={styles.gridMeta}>
              <View style={[styles.typePill, { backgroundColor: sColor + '20' }]}>
                <Text style={[styles.typeText, { color: sColor }]}>{status?.toUpperCase()}</Text>
              </View>
              {year ? (
                <Text style={[styles.yearText, { color: colors.textSecondary }]}>{year}</Text>
              ) : null}
              {isMD && item.contentRating === 'suggestive' && (
                <View style={[styles.typePill, { backgroundColor: '#F59E0B20' }]}>
                  <Text style={[styles.typeText, { color: '#F59E0B' }]}>16+</Text>
                </View>
              )}
            </View>
            {tags?.length > 0 && (
              <Text style={[styles.tagText, { color: colors.textSecondary }]} numberOfLines={1}>
                {tags.slice(0, 3).join(' · ')}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {/* Add to Library — always at bottom */}
        <TouchableOpacity
          style={[styles.addToLibBtn, { backgroundColor: inLib ? colors.surfaceElevated : colors.primary }]}
          onPress={() => !inLib && handleAddToLibrary(item, isMD)}
          disabled={inLib}
          activeOpacity={inLib ? 1 : 0.8}>
          {inLib ? (
            <>
              <IconSymbol name="checkmark.circle.fill" size={12} color={colors.success} />
              <Text style={[styles.addToLibText, { color: colors.success }]}>In Your Library</Text>
            </>
          ) : (
            <>
              <IconSymbol name="plus" size={12} color="#FFF" />
              <Text style={styles.addToLibText}>Add to Library</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <IconSymbol name="tray.fill" size={48} color={colors.textSecondary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
        {search.trim() ? 'No results found' : 'No stories found. Try different filters.'}
      </Text>
    </View>
  );

  const currentData = source === 'local' ? localResults : mdResults;
  const currentLoading = source === 'local' ? localLoading : mdLoading;
  const totalCount = source === 'local' ? localTotal : mdTotal;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ──── HEADER (outside FlatList so keyboard persists) ──── */}
      <View style={styles.fixedHeader}>
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>
          <TouchableOpacity
            style={[styles.addStoryBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/story/add')}>
            <IconSymbol name="plus" size={16} color="#FFF" />
            <Text style={styles.addStoryText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Source Toggle */}
        <View style={styles.sourceRow}>
          {([
            { key: 'local' as SourceTab, label: 'Chrollomark', icon: 'books.vertical.fill' as const },
            { key: 'mangadex' as SourceTab, label: 'MangaDex', icon: 'globe' as const },
          ]).map(({ key, label, icon }) => {
            const isActive = source === key;
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sourceTab, isActive && { backgroundColor: colors.surface }]}
                onPress={() => setSource(key)}>
                <IconSymbol 
                  name={icon} 
                  size={14} 
                  color={isActive ? (key === 'mangadex' ? '#FF6740' : colors.primary) : colors.textSecondary} 
                />
                <Text style={[styles.sourceTabText, { color: isActive ? colors.text : colors.textSecondary }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Search bar — OUTSIDE FlatList to prevent keyboard dismiss */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <IconSymbol name="magnifyingglass" size={17} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={source === 'mangadex' ? 'Search MangaDex...' : 'Search Chrollomark...'}
              placeholderTextColor={colors.textSecondary}
              value={search}
              onChangeText={handleSearchChange}
              onSubmitEditing={doSearch}
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => { handleSearchChange(''); doSearch(); }}>
                <IconSymbol name="xmark.circle.fill" size={17} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterToggleBtn, { backgroundColor: showFilters ? colors.primary : colors.surface, borderColor: colors.border }]}
            onPress={() => setShowFilters(!showFilters)}>
            <IconSymbol name="line.3.horizontal.decrease" size={18} color={showFilters ? "#FFF" : colors.textSecondary} />
            {activeFilterCount > 0 && (
              <View style={styles.filterDotBadge}>
                <Text style={styles.filterDotText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Collapsible Filter Container */}
        {showFilters && (
          <View style={[styles.collapsibleFilters, { backgroundColor: colors.surfaceElevated, borderBottomColor: colors.border }]}>
            <View style={styles.filterHeaderRow}>
               <View style={styles.filterTitleGroup}>
                 <IconSymbol name="line.3.horizontal.decrease" size={14} color={colors.textSecondary} />
                 <Text style={[styles.filterHeaderTitle, { color: colors.text }]}>Active Filters</Text>
               </View>
               <TouchableOpacity 
                 style={[styles.resetBtn, { backgroundColor: colors.primary + '15' }]} 
                 onPress={resetFilters}
                 activeOpacity={0.7}>
                 <IconSymbol name="arrow.counterclockwise" size={12} color={colors.primary} />
                 <Text style={[styles.resetText, { color: colors.primary }]}>Reset All</Text>
               </TouchableOpacity>
            </View>

            {/* Filter pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterRow}>
              {ORDER_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.filterChip, {
                    backgroundColor: order === opt.value ? (source === 'mangadex' ? '#FF6740' : colors.primary) + '20' : colors.surface,
                    borderColor: order === opt.value ? (source === 'mangadex' ? '#FF6740' : colors.primary) : colors.border,
                  }]}
                  onPress={() => setOrder(opt.value)}>
                  <IconSymbol name={opt.icon} size={12} color={order === opt.value ? (source === 'mangadex' ? '#FF6740' : colors.primary) : colors.textSecondary} />
                  <Text style={[styles.filterText, { color: order === opt.value ? (source === 'mangadex' ? '#FF6740' : colors.primary) : colors.textSecondary }]}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent} style={styles.filterRow2}>
              {STATUS_OPTIONS.map(opt => {
                const isActive = statusFilter === opt.value;
                const chipColor = opt.value ? statusColor(opt.value) : colors.primary;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.filterChip, {
                      backgroundColor: isActive ? chipColor + '20' : colors.surface,
                      borderColor: isActive ? chipColor : colors.border,
                    }]}
                    onPress={() => setStatusFilter(opt.value)}>
                    <Text style={[styles.filterText, { color: isActive ? chipColor : colors.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              {CONTENT_RATINGS.map(opt => {
                const active = contentRating.includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.filterChip, {
                      backgroundColor: active ? colors.primary + '20' : colors.surface,
                      borderColor: active ? colors.primary : colors.border,
                    }]}
                    onPress={() => {
                      const arr = contentRating.split(',').filter(Boolean);
                      setContentRating(active ? arr.filter(r => r !== opt.value).join(',') || 'safe' : [...arr, opt.value].join(','));
                    }}>
                    <Text style={[styles.filterText, { color: active ? colors.primary : colors.textSecondary }]}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: colors.textSecondary }]}>{totalCount.toLocaleString()} {totalCount === 1 ? 'result' : 'results'}</Text>
        </View>
      </View>

      {/* ──── GRID (scrollable) ──── */}
      {currentLoading && currentData.length === 0 ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={currentData}
          renderItem={renderCard}
          keyExtractor={(item, i) => source === 'local' ? item._id : `md-${item.id || i}`}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          ListEmptyComponent={renderEmpty}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            (source === 'local' && localPage < localTotalPages) || (source === 'mangadex' && mdResults.length < mdTotal) ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: Spacing.lg }} />
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
  fixedHeader: { /* stays outside FlatList so keyboard persists */ },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  pageTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  addStoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  addStoryText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  sourceRow: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
    padding: 4,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  sourceTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  sourceTabText: { fontSize: 13, fontWeight: '700' },
  filterToggleBtn: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  filterDotBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    zIndex: 1,
  },
  filterDotText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '900',
  },
  collapsibleFilters: {
    marginTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    paddingTop: Spacing.xs,
  },
  filterHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    marginTop: Spacing.xs,
  },
  filterTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  filterHeaderTitle: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  resetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: { marginTop: Spacing.xs, maxHeight: 42 },
  filterRow2: { marginTop: Spacing.xs, maxHeight: 42 },
  searchContainer: { paddingHorizontal: Spacing.lg, marginTop: Spacing.sm, flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    height: 48,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filterContent: { paddingHorizontal: Spacing.lg, gap: 6 },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 11, fontWeight: '600' },
  divider: { width: 1, height: 18, alignSelf: 'center', marginHorizontal: 2 },
  resultsHeader: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.xs },
  resultsCount: { fontSize: 12, fontWeight: '500' },
  listContent: { paddingBottom: 100 },
  gridRow: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  gridItem: {
    flex: 1,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  gridCover: { width: '100%', height: 190 },
  coverGradient: { position: 'absolute', top: 110, left: 0, right: 0, height: 80 },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  badgeRow: { position: 'absolute', top: 6, right: 6, flexDirection: 'row', gap: 3 },
  apiBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  apiBadgeText: { color: '#FFF', fontSize: 7, fontWeight: '800', letterSpacing: 0.4 },
  gridInfo: { padding: Spacing.sm },
  gridTitle: { fontSize: 12, fontWeight: '700', marginBottom: 3, lineHeight: 16 },
  authorText: { fontSize: 10, marginBottom: 3, fontWeight: '500' },
  gridMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap' },
  typePill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  typeText: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase' },
  yearText: { fontSize: 10, fontWeight: '600' },
  tagText: { fontSize: 9, fontWeight: '500', marginTop: 1 },
  addToLibBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    marginHorizontal: 6,
    marginBottom: 6,
    borderRadius: BorderRadius.sm,
  },
  addToLibText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.lg },
  emptyText: { fontSize: 14, textAlign: 'center' },
});
