import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from '@react-navigation/native';
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
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

type SourceTab = 'local' | 'mangadex' | 'anilist';

const ORDER_OPTIONS = [
  { label: 'Popular', value: 'popularity', icon: 'flame.fill' as const },
  { label: 'Latest', value: 'latestUploadedChapter', icon: 'clock.fill' as const },
  { label: 'New', value: 'createdAt', icon: 'sparkles' as const },
  { label: 'Title', value: 'title', icon: 'textformat' as const },
];

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Ongoing', value: 'ongoing' },
  { label: 'Completed', value: 'completed' },
  { label: 'Hiatus', value: 'hiatus' },
];

const CONTENT_RATINGS = [
  { label: 'Safe', value: 'safe', color: '#10B981' },
  { label: 'Suggestive', value: 'suggestive', color: '#F59E0B' },
  { label: '+18', value: 'nsfw', color: '#EF4444' },
];

const COMMON_GENRES = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery',
  'Romance', 'Sci-Fi', 'Slice of Life', 'Supernatural', 'Sports', 'Psychological', 'Thriller'
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

  // AniList state
  const [alResults, setAlResults] = useState<any[]>([]);
  const [alPage, setAlPage] = useState(1);
  const [alHasNextPage, setAlHasNextPage] = useState(false);
  const [alTotal, setAlTotal] = useState(0);
  const [alLoading, setAlLoading] = useState(false);
  const [alType, setAlType] = useState<'ANIME' | 'MANGA'>('MANGA');

  // Genre filtering
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [mdTags, setMdTags] = useState<any[]>([]); // For MangaDex tag ID mapping

  // Shared filter state (used by BOTH tabs for a unified experience)
  const [order, setOrder] = useState('popularity');
  const [statusFilter, setStatusFilter] = useState('');
  const [contentRating, setContentRating] = useState('safe,suggestive');
  const [showFilters, setShowFilters] = useState(false);

  // Sync Confirmation Modal state
  const [syncTarget, setSyncTarget] = useState<{ external: any, local: any, source: SourceTab } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [selectedCover, setSelectedCover] = useState<'local' | 'external'>('external');
  const [syncedIds, setSyncedIds] = useState<Set<string>>(new Set());
  const [syncPhase, setSyncPhase] = useState<number>(0); // 0 = Idle, 1 = Processing
  const [syncProgress, setSyncProgress] = useState(0);
  const [privacyTarget, setPrivacyTarget] = useState<any>(null);

  const activeFilterCount = React.useMemo(() => {
    let count = 0;
    if (order !== 'popularity') count++;
    if (statusFilter !== '') count++;
    if (contentRating !== 'safe,suggestive') count++;
    return count;
  }, [order, statusFilter, contentRating]);

  const resetFilters = () => {
    setOrder('popularity');
    setStatusFilter('');
    setContentRating('safe,suggestive');
    setSelectedGenres([]);
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
        if (p.story?.anilistId) ids.add(String(p.story.anilistId));
      });
      setUserLibraryIds(ids);
    } catch { /* ignore */ }
  }, []);

  // --- Local stories (Chrollomark) ---
  const loadLocal = useCallback(async (pageNum = 1, append = false) => {
    setLocalLoading(true);
    try {
      let sortParam = `-${order}`;
      if (order === 'popularity') sortParam = 'popularity';
      else if (order === 'latestUploadedChapter') sortParam = '-updatedAt';
      else if (order === 'title') sortParam = 'title';

      const params: any = {
        page: String(pageNum),
        limit: '20',
        sort: sortParam,
        contentRating: contentRating.replace('nsfw', 'erotica,pornographic'),
      };

      if (searchRef.current.trim()) params.search = searchRef.current.trim();
      if (selectedGenres.length > 0) params.genre = selectedGenres.join(',');
      if (statusFilter) {
        // Map lowercase to our DB status
        const sMap: Record<string, string> = { ongoing: 'Ongoing', completed: 'Completed', hiatus: 'Hiatus', cancelled: 'Cancelled' };
        params.status = sMap[statusFilter] || statusFilter;
      }

      const data = await api.getStories(params);
      setLocalResults(prev => {
        if (!append) return data.stories;
        const existingIds = new Set(prev.map(p => p._id));
        return [...prev, ...data.stories.filter((p: any) => !existingIds.has(p._id))];
      });
      setLocalTotalPages(data.totalPages);
      setLocalTotal(data.total);
      setLocalPage(pageNum);
    } catch (error) {
      console.log('Load local error:', error);
    } finally {
      setLocalLoading(false);
    }
  }, [order, statusFilter, contentRating, selectedGenres]);

  // --- MangaDex ---
  const loadMangaDex = useCallback(async (offset = 0, append = false) => {
    setMdLoading(true);
    try {
      const params: any = {
        limit: '20',
        offset: String(offset),
        order: order,
        orderDir: order === 'title' ? 'asc' : 'desc',
        contentRating: contentRating.replace('nsfw', 'erotica,pornographic'),
      };
      if (searchRef.current.trim()) params.title = searchRef.current.trim();
      if (statusFilter) params.status = statusFilter;

      if (selectedGenres.length > 0) {
        const tagIds = selectedGenres
          .map(g => mdTags.find(t => t.name.toLowerCase() === g.toLowerCase())?.id)
          .filter(Boolean);
        if (tagIds.length > 0) params.tags = tagIds.join(',');
      }

      const data = await api.getMangaDexManga(params);
      setMdResults(prev => {
        const newData = data.results || [];
        if (!append) return newData;
        const existingIds = new Set(prev.map(item => item.id));
        return [...prev, ...newData.filter(item => !existingIds.has(item.id))];
      });
      setMdTotal(data.total || 0);
      setMdOffset(offset);
    } catch (error) {
      console.log('MangaDex error:', error);
      if (!append) setMdResults([]);
    } finally {
      setMdLoading(false);
    }
  }, [order, statusFilter, contentRating, mdTags, selectedGenres]);

  // --- AniList ---
  const loadAniList = useCallback(async (pageNum = 1, append = false) => {
    setAlLoading(true);
    try {
      const params: any = {
        page: String(pageNum),
        perPage: '20',
        type: alType,
      };
      if (searchRef.current.trim()) params.search = searchRef.current.trim();
      if (contentRating) params.contentRating = contentRating.replace('nsfw', 'erotica,pornographic');
      if (selectedGenres.length > 0) params.genres = selectedGenres.join(',');

      const data = await api.getAniListMedia(params);
      setAlResults(prev => {
        const newData = data.results || [];
        if (!append) return newData;
        const existingIds = new Set(prev.map(item => String(item.id)));
        return [...prev, ...newData.filter(item => !existingIds.has(String(item.id)))];
      });
      setAlPage(pageNum);
      setAlHasNextPage(data.pageInfo?.hasNextPage || false);
      setAlTotal(data.pageInfo?.total || 0);
    } catch (error) {
      console.log('AniList error:', error);
      if (!append) setAlResults([]);
    } finally {
      setAlLoading(false);
    }
  }, [contentRating, alType, selectedGenres]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      loadUserLibrary();
    }, [isAuthenticated, loadUserLibrary])
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    // Fetch MangaDex tags for mapping
    api.getMangaDexTags().then(res => setMdTags(res.tags || []));
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (source === 'local') {
      loadLocal(1);
    } else if (source === 'mangadex') {
      loadMangaDex(0);
    } else {
      loadAniList(1);
    }
  }, [isAuthenticated, source, loadLocal, loadMangaDex, loadAniList]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUserLibrary();
    if (source === 'local') {
      await loadLocal(1);
    } else if (source === 'mangadex') {
      await loadMangaDex(0);
    } else {
      await loadAniList(1);
    }
    setRefreshing(false);
  };

  const loadMore = () => {
    if (source === 'local') {
      if (localPage < localTotalPages && !localLoading) loadLocal(localPage + 1, true);
    } else if (source === 'mangadex') {
      if (mdResults.length < mdTotal && !mdLoading) loadMangaDex(mdOffset + 20, true);
    } else {
      if (alHasNextPage && !alLoading) loadAniList(alPage + 1, true);
    }
  };

  const doSearch = useCallback(() => {
    if (source === 'local') {
      loadLocal(1);
    } else if (source === 'mangadex') {
      loadMangaDex(0);
    } else {
      loadAniList(1);
    }
  }, [source, loadLocal, loadMangaDex, loadAniList]);

  const handleAddToLibrary = async (item: any, sourceTab: SourceTab, forcePrivate?: boolean) => {
    // Intercept mature content for privacy prompt
    const isMature = item.contentRating === 'erotica' || item.contentRating === 'pornographic' || item.contentRating === 'suggestive';
    if (isMature && !forcePrivate && !privacyTarget) {
      setPrivacyTarget({ item, sourceTab });
      return;
    }

    try {
      const finalPrivate = forcePrivate || false;
      if (sourceTab === 'mangadex') {
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
          contentRating: item.contentRating,
        });
        await api.updateProgress({
          storyId: result.story._id,
          status: 'Plan to Read',
          isPrivate: finalPrivate
        });
        setUserLibraryIds(prev => new Set([...prev, item.id, result.story._id]));
        showToast({ message: `"${item.title}" added to library!`, type: 'success' });
      } else if (sourceTab === 'anilist') {
        const result = await api.cloneAniList({
          anilistId: item.id,
          title: item.title,
          author: item.author,
          description: item.description,
          coverImage: item.coverUrl,
          type: item.type,
          genres: item.genres,
          status: item.status,
          totalChapters: item.totalChapters,
          year: item.year,
          contentRating: item.genres?.includes('Hentai') ? 'pornographic' : 'safe',
        });
        await api.updateProgress({
          storyId: result.story._id,
          status: 'Plan to Read',
          isPrivate: finalPrivate
        });
        setUserLibraryIds(prev => new Set([...prev, String(item.id), result.story._id]));
        showToast({ message: `"${item.title}" added to library!`, type: 'success' });
      } else {
        // Local story — add to user's reading progress
        await api.updateProgress({
          storyId: item._id,
          status: 'Plan to Read',
          isPrivate: finalPrivate
        });
        setUserLibraryIds(prev => new Set([...prev, item._id]));
        showToast({ message: `"${item.title}" added to your library!`, type: 'success' });
      }
      showToast({ message: `"${item.title}" added to your library!`, type: 'success' });
      setPrivacyTarget(null);
    } catch (e: any) {
      showToast({ message: e.message || 'Failed to add', type: 'error' });
    }
  };

  const isInLibrary = (item: any, sourceTab: SourceTab) => {
    if (sourceTab === 'mangadex') return userLibraryIds.has(item.id);
    if (sourceTab === 'anilist') return userLibraryIds.has(String(item.id));
    return userLibraryIds.has(item._id);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
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
    const isAL = source === 'anilist';
    const title = item.title;
    const coverUrl = (isMD || isAL) ? item.coverUrl : item.coverImage;
    const author = item.author || (isMD || isAL ? '' : item.addedBy?.username);
    const status = (isMD || isAL) ? item.status : (item.status || 'ongoing');
    const sColor = statusColor(status);
    const year = item.year;
    const tags = isMD ? item.tags : (isAL ? item.genres : item.genres);
    const inLib = isInLibrary(item, source);
    const storyId = (isMD || isAL) ? item.id : item._id;

    return (
      <View style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/story/${storyId}?source=${source}` as any)}>
          {coverUrl ? (
            <Image source={{ uri: api.resolveImageUrl(coverUrl) }} style={styles.gridCover} contentFit="cover" />
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
            {isAL && (
              <View style={[styles.apiBadge, { backgroundColor: '#3DB4F2' }]}>
                <Text style={styles.apiBadgeText}>ANILIST</Text>
              </View>
            )}
            {!isMD && !isAL && (
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
              {isAL && (
                <View style={[styles.typePill, { backgroundColor: colors.accent + '20' }]}>
                  <Text style={[styles.typeText, { color: colors.accent }]}>{item.type}</Text>
                </View>
              )}
              {isMD && item.contentRating === 'suggestive' && (
                <View style={[styles.typePill, { backgroundColor: '#F59E0B20' }]}>
                  <Text style={[styles.typeText, { color: '#F59E0B' }]}>16+</Text>
                </View>
              )}
              {isMD && (item.contentRating === 'erotica' || item.contentRating === 'pornographic') && (
                <View style={[styles.typePill, { backgroundColor: '#EF444420' }]}>
                  <Text style={[styles.typeText, { color: '#EF4444' }]}>18+</Text>
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

        {/* Local Sync or Add to Library */}
        {item.chrollomarkId ? (() => {
          const isAlreadyInSync = syncedIds.has(item.chrollomarkId) || item.alreadyInSync;
          return (
            <TouchableOpacity
              style={[styles.addToLibBtn, { backgroundColor: isAlreadyInSync ? colors.surfaceElevated : colors.accent }]}
              onPress={async () => {
                if (isAlreadyInSync) {
                  showToast({ message: 'This story is already fully synchronized.', type: 'success' });
                  return;
                }
                setSyncLoading(true);
                try {
                  const res = await api.getStory(item.chrollomarkId);
                  const local = res.story;

                  // Verification logic
                  const extGenres = item.tags || item.genres || [];
                  const locGenres = local.genres || [];
                  const newGenres = extGenres.filter((g: string) => !locGenres.includes(g));
                  const isDescLonger = (item.description?.length || 0) > (local.description?.length || 0);
                  const isTypeUpdated = item.type === 'Manhwa' && local.type === 'Manga';
                  const isIdsMissing = (source === 'anilist' && !local.anilistId) || (source === 'mangadex' && !local.mangadexId);

                  if (newGenres.length === 0 && !isDescLonger && !isTypeUpdated && !isIdsMissing) {
                    showToast({ message: 'Already in Sync', type: 'success' });
                    setSyncedIds(prev => new Set([...prev, item.chrollomarkId]));
                  } else {
                    setSelectedCover('external');
                    setSyncTarget({ external: item, local: local, source: source });
                  }
                } catch (e) {
                  showToast({ message: 'Failed to fetch local data', type: 'error' });
                } finally {
                  setSyncLoading(false);
                }
              }}
              activeOpacity={0.8}
              disabled={syncLoading}>
              {syncLoading ? (
                <ActivityIndicator size="small" color="#FFF" />
              ) : (
                <>
                  <IconSymbol
                    name={isAlreadyInSync ? "checkmark.circle.fill" : "arrow.triangle.2.circlepath"}
                    size={12}
                    color={isAlreadyInSync ? colors.success : "#FFF"}
                  />
                  <Text style={[styles.addToLibText, { color: isAlreadyInSync ? colors.success : "#FFF" }]}>
                    {isAlreadyInSync ? 'Already in Sync' : 'Sync Library'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          );
        })() : (
          <TouchableOpacity
            style={[styles.addToLibBtn, { backgroundColor: inLib ? colors.surfaceElevated : colors.primary }]}
            onPress={() => !inLib && handleAddToLibrary(item, source)}
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
        )}

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

  const currentData = source === 'local' ? localResults : (source === 'mangadex' ? mdResults : alResults);
  const currentLoading = source === 'local' ? localLoading : (source === 'mangadex' ? mdLoading : alLoading);
  const totalCount = source === 'local' ? localTotal : (source === 'mangadex' ? mdTotal : alTotal);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ──── HEADER (outside FlatList so keyboard persists) ──── */}
      <View style={styles.fixedHeader}>
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Explore</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity
              style={[styles.addStoryBtn, { backgroundColor: colors.primary }]}
              onPress={() => router.push('/navigator')}>
              <IconSymbol name="globe" size={16} color="#FFF" />
              <Text style={styles.addStoryText}>Browser</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Source Toggle */}
        <View style={styles.sourceRow}>
          {([
            { key: 'local' as SourceTab, label: 'Chrollomark', icon: 'books.vertical.fill' as const },
            { key: 'mangadex' as SourceTab, label: 'MangaDex', icon: 'globe' as const },
            { key: 'anilist' as SourceTab, label: 'AniList', icon: 'sparkles' as const },
          ]).map(({ key, label, icon }) => {
            const isActive = source === key;
            const activeColor = key === 'mangadex' ? '#FF6740' : (key === 'anilist' ? '#3DB4F2' : colors.primary);
            return (
              <TouchableOpacity
                key={key}
                style={[styles.sourceTab, isActive && { backgroundColor: colors.surface }]}
                onPress={() => setSource(key)}>
                <IconSymbol
                  name={icon}
                  size={14}
                  color={isActive ? activeColor : colors.textSecondary}
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
              placeholder={source === 'mangadex' ? 'Search MangaDex...' : (source === 'anilist' ? 'Search AniList...' : 'Search Chrollomark...')}
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
            style={[
              styles.filterActionButtonPremium,
              { backgroundColor: colors.surfaceElevated },
              showFilters && { borderColor: colors.primary, borderWidth: 1, backgroundColor: colors.primary + '10' }
            ]}
            onPress={() => setShowFilters(!showFilters)}
            activeOpacity={0.7}>
            <IconSymbol
              name="line.3.horizontal.decrease"
              size={14}
              color={showFilters ? colors.primary : colors.text}
            />
            <Text style={[styles.filterActionText, { color: showFilters ? colors.primary : colors.text }]}>Filters</Text>
            {activeFilterCount > 0 && (
              <View style={[styles.activeBadgeSmall, { backgroundColor: colors.primary }]}>
                <Text style={styles.activeBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Collapsible Filter Container */}
        {showFilters && (
          <ScrollView style={[styles.filterPanelFull, { backgroundColor: colors.surface + '40', borderBottomColor: colors.border, marginTop: Spacing.sm, maxHeight: 450 }]}>

            {/* Special Mode Switcher (AniList) */}
            {source === 'anilist' && (
              <View style={[styles.filterSection, { paddingBottom: Spacing.sm, paddingHorizontal: 32 }]}>
                <View style={styles.filterPanelHeader}>
                  <Text style={[styles.filterPanelLabel, { color: colors.textSecondary, textAlign: 'center', width: '100%' }]}>MEDIA MODE</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
                  {/* Anime Mode Card */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: 68,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 2,
                      borderColor: alType === 'ANIME' ? '#F59E0B' : 'transparent',
                      overflow: 'hidden',
                      ...Shadows.sm,
                    }}
                    onPress={() => setAlType('ANIME')}>
                    {alType === 'ANIME' && (
                      <LinearGradient
                        colors={['#F59E0B20', '#F59E0B05']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={{ padding: 12, flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                      <IconSymbol name="play.fill" size={16} color={alType === 'ANIME' ? '#F59E0B' : colors.textSecondary} />
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '900',
                        color: alType === 'ANIME' ? '#F59E0B' : colors.text,
                        letterSpacing: 0.5
                      }}>ANIME</Text>
                    </View>
                  </TouchableOpacity>

                  {/* Manga Mode Card */}
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={{
                      flex: 1,
                      height: 68,
                      borderRadius: 18,
                      backgroundColor: colors.surfaceElevated,
                      borderWidth: 2,
                      borderColor: alType === 'MANGA' ? '#6366F1' : 'transparent',
                      overflow: 'hidden',
                      ...Shadows.sm,
                    }}
                    onPress={() => setAlType('MANGA')}>
                    {alType === 'MANGA' && (
                      <LinearGradient
                        colors={['#6366F120', '#6366F105']}
                        style={StyleSheet.absoluteFill}
                      />
                    )}
                    <View style={{ padding: 12, flex: 1, justifyContent: 'center', alignItems: 'center', gap: 4 }}>
                      <IconSymbol name="book.fill" size={16} color={alType === 'MANGA' ? '#6366F1' : colors.textSecondary} />
                      <Text style={{
                        fontSize: 12,
                        fontWeight: '900',
                        color: alType === 'MANGA' ? '#6366F1' : colors.text,
                        letterSpacing: 0.5
                      }}>MANGA</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Sort Section */}
            <View style={styles.filterSection}>
              <View style={styles.filterPanelHeader}>
                <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>SORT BY</Text>
                <TouchableOpacity
                  style={[styles.resetActionPremium, { backgroundColor: colors.primary + '10' }]}
                  onPress={resetFilters}
                  activeOpacity={0.7}>
                  <IconSymbol name="arrow.counterclockwise" size={12} color={colors.primary} />
                  <Text style={[styles.resetActionText, { color: colors.primary }]}>Clear Filters</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.filterGridWrapContainer}>
                {ORDER_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.filterTilePremium,
                      { backgroundColor: colors.surfaceElevated, minWidth: '30%', flexGrow: 1 },
                      order === opt.value && { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1 }
                    ]}
                    onPress={() => setOrder(opt.value)}>
                    <IconSymbol name={opt.icon} size={12} color={order === opt.value ? colors.primary : colors.textSecondary} />
                    <Text style={[styles.filterTileText, { color: order === opt.value ? colors.primary : colors.text }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Status Section */}
            <View style={[styles.filterSection, { marginTop: Spacing.lg }]}>
              <View style={styles.filterPanelHeader}>
                <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>RELEASE STATUS</Text>
              </View>

              <View style={styles.filterGridWrapContainer}>
                {STATUS_OPTIONS.map(opt => {
                  const isActive = statusFilter === opt.value;
                  const chipColor = opt.value ? statusColor(opt.value) : colors.primary;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.filterChipPremium,
                        { backgroundColor: colors.surfaceElevated },
                        isActive && { backgroundColor: chipColor + '15', borderColor: chipColor, borderWidth: 1 }
                      ]}
                      onPress={() => setStatusFilter(opt.value)}>
                      <View style={[styles.statusDotPremium, { backgroundColor: chipColor }]} />
                      <Text style={[styles.filterChipText, { color: isActive ? chipColor : colors.text }]}>{opt.label || 'All Status'}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Maturity Section */}
            <View style={[styles.filterSection, { marginTop: Spacing.lg }]}>
              <View style={styles.filterPanelHeader}>
                <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>MATURITY</Text>
              </View>

              <View style={styles.filterGridWrapContainer}>
                {CONTENT_RATINGS.map(opt => {
                  const active = contentRating.includes(opt.value);
                  const levelColor = opt.color;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[
                        styles.filterChipPremium,
                        { backgroundColor: colors.surfaceElevated, flex: 1 },
                        active && { backgroundColor: levelColor + '15', borderColor: levelColor, borderWidth: 1.5 }
                      ]}
                      onPress={() => {
                        const arr = contentRating.split(',').filter(Boolean);
                        setContentRating(active ? arr.filter(r => r !== opt.value).join(',') || 'safe' : [...arr, opt.value].join(','));
                      }}>
                      <View style={[styles.statusDotPremium, { backgroundColor: levelColor }]} />
                      <Text style={[styles.filterChipText, { color: active ? levelColor : colors.text, fontWeight: active ? '900' : '700' }]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Genre Section */}
            <View style={[styles.filterSection, { marginTop: Spacing.lg }]}>
              <View style={styles.filterPanelHeader}>
                <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>GENRES (AND LOGIC)</Text>
              </View>
              <View style={styles.filterGridWrapContainer}>
                {COMMON_GENRES.map(item => {
                  const active = selectedGenres.includes(item);
                  return (
                    <TouchableOpacity
                      key={item}
                      style={[
                        styles.filterChipPremium,
                        { backgroundColor: colors.surfaceElevated },
                        active && { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderWidth: 1 }
                      ]}
                      onPress={() => {
                        setSelectedGenres(prev =>
                          active ? prev.filter(g => g !== item) : [...prev, item]
                        );
                      }}>
                      <Text style={[styles.filterChipText, { color: active ? colors.primary : colors.text }]}>
                        {item}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </ScrollView>
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
          keyExtractor={(item, i) => source === 'local' ? item._id : `${source}-${item.id || i}`}
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
            (source === 'local' && localPage < localTotalPages) ||
              (source === 'mangadex' && mdResults.length < mdTotal) ||
              (source === 'anilist' && alHasNextPage) ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: Spacing.lg }} />
            ) : null
          }
        />
      )}
      {/* Sync Confirmation Modal with Comparison */}
      {syncTarget && (() => {
        const extGenres = syncTarget.external.tags || syncTarget.external.genres || [];
        const locGenres = syncTarget.local.genres || [];
        const newGenres = extGenres.filter((g: string) => !locGenres.includes(g));

        const isDescLonger = (syncTarget.external.description?.length || 0) > (syncTarget.local.description?.length || 0);
        const isTypeUpdated = syncTarget.external.type === 'Manhwa' && syncTarget.local.type === 'Manga';
        const isIdsMissing = (syncTarget.source === 'anilist' && !syncTarget.local.anilistId) ||
          (syncTarget.source === 'mangadex' && !syncTarget.local.mangadexId);

        const extChapters = syncTarget.source === 'mangadex' ? (syncTarget.external.lastChapter || 0) : (syncTarget.external.totalChapters || 0);
        const isChaptersBetter = Number(extChapters) > (syncTarget.local.totalChapters || 0);
        const isAuthorDifferent = syncTarget.external.author && syncTarget.local.author && !syncTarget.local.author.includes(syncTarget.external.author);

        const hasChanges = newGenres.length > 0 || isDescLonger || isTypeUpdated || isIdsMissing || isChaptersBetter || isAuthorDifferent;

        return (
          <View style={StyleSheet.absoluteFill}>
            <TouchableOpacity
              activeOpacity={1}
              style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}
              onPress={() => setSyncTarget(null)}
            />
            <View style={styles.modalCenter}>
              <View style={[styles.syncModal, { backgroundColor: colors.surface, borderColor: colors.cardBorder, maxHeight: '90%' }]}>
                <View style={[styles.syncIconContainer, { backgroundColor: (hasChanges ? colors.accent : colors.textSecondary) + '15' }]}>
                  <IconSymbol name={hasChanges ? "arrow.triangle.2.circlepath" : "checkmark.seal.fill"} size={24} color={hasChanges ? colors.accent : colors.textSecondary} />
                </View>

                <Text style={[styles.syncModalTitle, { color: colors.text }]}>
                  {hasChanges ? 'Synchronize Metadata' : 'Already in Sync'}
                </Text>
                <Text style={[styles.syncModalDesc, { color: colors.textSecondary }]}>
                  {hasChanges
                    ? `Improve your local story with data from ${syncTarget.source.toUpperCase()}.`
                    : `Your local copy is fully optimized with ${syncTarget.source.toUpperCase()} metadata.`}
                </Text>

                <ScrollView style={{ width: '100%' }} showsVerticalScrollIndicator={false}>
                  {hasChanges && <Text style={[styles.compLabel, { textAlign: 'center', marginBottom: 12, fontSize: 10, color: colors.textSecondary }]}>TAP A COVER TO SELECT</Text>}

                  {/* Comparison UI */}
                  <View style={styles.comparisonContainer}>
                    {/* Before Column */}
                    <TouchableOpacity
                      activeOpacity={hasChanges ? 0.7 : 1}
                      onPress={() => hasChanges && setSelectedCover('local')}
                      style={styles.comparisonCol}>
                      <Text style={[styles.compLabel, { color: selectedCover === 'local' ? colors.primary : colors.textSecondary }]}>
                        {selectedCover === 'local' ? 'KEEP CURRENT' : 'CURRENT (LOCAL)'}
                      </Text>
                      <View style={[styles.compCard, { borderColor: selectedCover === 'local' ? colors.primary : colors.border, borderWidth: selectedCover === 'local' ? 3 : 1 }]}>
                        <Image source={{ uri: syncTarget.local.coverImage }} style={styles.compCover} contentFit="cover" />
                        {selectedCover === 'local' && (
                          <View style={[styles.selectedIndicator, { backgroundColor: colors.primary }]}>
                            <IconSymbol name="checkmark" size={12} color="#FFF" />
                          </View>
                        )}
                        <View style={styles.compBadgeRow}>
                          <View style={[styles.compBadge, { backgroundColor: colors.surfaceElevated }]}>
                            <Text style={[styles.compBadgeText, { color: colors.textSecondary }]}>{syncTarget.local.type || 'Manga'}</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>

                    <View style={styles.arrowContainer}>
                      <IconSymbol name="arrow.right" size={20} color={hasChanges ? colors.accent : colors.textSecondary} />
                    </View>

                    {/* After Column */}
                    <TouchableOpacity
                      activeOpacity={hasChanges ? 0.7 : 1}
                      onPress={() => hasChanges && setSelectedCover('external')}
                      style={styles.comparisonCol}>
                      <Text style={[styles.compLabel, { color: selectedCover === 'external' ? colors.accent : colors.textSecondary }]}>
                        {selectedCover === 'external' ? 'USE NEW HQ' : 'NEW HQ (PROPOSED)'}
                      </Text>
                      <View style={[styles.compCard, { borderColor: selectedCover === 'external' ? colors.accent : colors.border, borderWidth: selectedCover === 'external' ? 3 : 1 }]}>
                        <Image source={{ uri: syncTarget.external.coverUrlHQ || syncTarget.external.coverUrl }} style={styles.compCover} contentFit="cover" />
                        {selectedCover === 'external' && (
                          <View style={[styles.selectedIndicator, { backgroundColor: colors.accent }]}>
                            <IconSymbol name="checkmark" size={12} color="#FFF" />
                          </View>
                        )}
                        <View style={styles.compBadgeRow}>
                          <View style={[styles.compBadge, { backgroundColor: hasChanges ? colors.accent : colors.surfaceElevated }]}>
                            <Text style={[styles.compBadgeText, { color: hasChanges ? '#FFF' : colors.textSecondary }]}>
                              {syncTarget.external.type || 'Manga'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </View>

                  {hasChanges && (
                    <View style={[styles.syncChangesBox, { backgroundColor: colors.surfaceElevated + '50' }]}>
                      <Text style={[styles.syncChangesTitle, { color: colors.textSecondary }]}>IMPROVEMENTS DETECTED</Text>

                      {isDescLonger && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="text.quote.rtl" size={10} color={colors.accent} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Better Description (+{syncTarget.external.description.length - syncTarget.local.description.length} chars)</Text>
                          </View>
                        </View>
                      )}

                      {newGenres.length > 0 && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="tag.fill" size={10} color={colors.accent} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Adds {newGenres.length} missing genre tags</Text>
                          </View>
                        </View>
                      )}

                      {isTypeUpdated && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="book.fill" size={10} color={colors.warning} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Corrects format to Manhwa</Text>
                          </View>
                        </View>
                      )}

                      {isIdsMissing && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="link" size={10} color={colors.primary} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Acquires Official Tracker IDs</Text>
                          </View>
                        </View>
                      )}

                      {isChaptersBetter && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="list.number" size={10} color={colors.success} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>More Content: {syncTarget.local.totalChapters || 0} → {extChapters} chapters</Text>
                          </View>
                        </View>
                      )}

                      {isAuthorDifferent && (
                        <View style={styles.diffRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <IconSymbol name="person.2.fill" size={10} color={colors.accent} />
                            <Text style={[styles.diffLabel, { color: colors.textSecondary }]}>Author Merge: Includes {syncTarget.external.author}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={[styles.safeAlert, { backgroundColor: colors.success + '10', borderColor: colors.success + '30' }]}>
                    <IconSymbol name="lock.fill" size={14} color={colors.success} />
                    <Text style={[styles.safeAlertText, { color: colors.success }]}>
                      Reading progress and reviews are safely locked.
                    </Text>
                  </View>


                </ScrollView>

                {hasChanges ? (
                  <TouchableOpacity
                    style={[styles.confirmSyncBtn, { backgroundColor: colors.accent, marginTop: 20 }]}
                    onPress={() => {
                      const t = syncTarget;
                      setSyncPhase(1);

                      // Perceived progress animation
                      let p = 0;
                      const interval = setInterval(() => {
                        p += Math.random() * 15;
                        if (p >= 100) {
                          p = 100;
                          setSyncProgress(100);
                          clearInterval(interval);
                          setTimeout(() => {
                            setSyncTarget(null);
                            setSyncPhase(0);
                            setSyncProgress(0);
                            const keepCover = selectedCover === 'local' ? '&keepCover=true' : '';
                            router.push(`/story/${t.local._id}?source=local&syncWith=${t.external.id}&syncSrc=${t.source}${keepCover}` as any);
                          }, 400);
                        } else {
                          setSyncProgress(p);
                        }
                      }, 150);
                    }}>
                    <Text style={styles.confirmSyncText}>Apply Updates</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.confirmSyncBtn, { backgroundColor: colors.surfaceElevated, marginTop: 20 }]}
                    onPress={() => { setSyncTarget(null); }}>
                    <Text style={[styles.confirmSyncText, { color: colors.textSecondary }]}>Close</Text>
                  </TouchableOpacity>
                )}

                {hasChanges && (
                  <TouchableOpacity
                    style={styles.cancelSyncBtn}
                    onPress={() => { setSyncTarget(null); }}>
                    <Text style={[styles.cancelSyncText, { color: colors.textSecondary }]}>Cancel</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* SYNC PROGRESS OVERLAY */}
            {syncPhase === 1 && (
              <Animated.View
                entering={FadeInDown}
                style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 999, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
                <View style={{ width: '100%', alignItems: 'center' }}>
                  <IconSymbol name="arrow.triangle.2.circlepath" size={48} color={colors.accent} />
                  <Text style={[styles.progressTitle, { color: colors.text }]}>
                    {syncProgress < 40 ? 'Fetching HQ Metadata...' : syncProgress < 80 ? 'Merging Database Records...' : 'Finalizing Fusion...'}
                  </Text>

                  <View style={[styles.progressBarBg, { backgroundColor: colors.surfaceElevated }]}>
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        { backgroundColor: colors.accent, width: `${syncProgress}%` }
                      ]}
                    />
                  </View>

                  <Text style={[styles.progressPerc, { color: colors.accent }]}>{Math.round(syncProgress)}%</Text>
                </View>
              </Animated.View>
            )}
          </View>
        );
      })()}

      {/* GLOBAL PRIVACY MODAL (For new additions) */}
      {privacyTarget && (
        <View style={StyleSheet.absoluteFill}>
          <TouchableOpacity
            activeOpacity={1}
            style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.85)' }]}
            onPress={() => setPrivacyTarget(null)}
          />
          <View style={styles.modalCenter}>
            <View style={[styles.privacyModal, { backgroundColor: colors.surface, borderColor: colors.border, width: '100%' }]}>
              <LinearGradient
                colors={[colors.accent + '20', 'transparent']}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.matureIconBg, { backgroundColor: colors.accent + '15' }]}>
                <IconSymbol name="shield.lefthalf.filled" size={28} color={colors.accent} />
              </View>

              <Text style={[styles.modalTitle, { color: colors.text }]}>Silent Addition?</Text>
              <Text style={[styles.modalDesc, { color: colors.textSecondary }]}>
                "{privacyTarget.item.title}" is a mature story. Would you like to add it <Text style={{ color: colors.accent, fontWeight: '700' }}>silently</Text> so friends don't see it?
              </Text>

              <View style={styles.modalActionRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.accent }]}
                  onPress={() => handleAddToLibrary(privacyTarget.item, privacyTarget.sourceTab, true)}>
                  <IconSymbol name="lock.fill" size={14} color="#FFF" />
                  <Text style={styles.modalBtnText}>Add Privately</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalBtn, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => handleAddToLibrary(privacyTarget.item, privacyTarget.sourceTab, false)}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Add Publicly</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setPrivacyTarget(null)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Not now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  modalOverlay: { ...StyleSheet.absoluteFillObject },
  modalCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  syncModal: {
    width: '100%',
    padding: 24,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    ...Shadows.lg,
  },
  syncIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  syncModalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  syncModalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 24, opacity: 0.8 },

  comparisonContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, width: '100%' },
  comparisonCol: { width: '42%' },
  compLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 8, textAlign: 'center' },
  compCard: { width: '100%', height: 160, borderRadius: 16, overflow: 'hidden', borderWidth: 1 },
  compCover: { width: '100%', height: '100%' },
  compBadgeRow: { position: 'absolute', top: 6, right: 6 },
  compBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  compBadgeText: { fontSize: 8, fontWeight: '900' },
  arrowContainer: { width: 40, alignItems: 'center' },
  selectedIndicator: { position: 'absolute', bottom: 8, right: 8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },

  syncChangesBox: {
    width: '100%',
    padding: 16,
    borderRadius: 20,
    marginBottom: 16,
    gap: 12,
  },
  syncChangesTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
  diffRow: { gap: 4 },
  diffLabel: { fontSize: 11, fontWeight: '700' },
  diffVal: { fontSize: 12, fontWeight: '500', opacity: 0.9 },
  diffTag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  diffTagText: { fontSize: 10, fontWeight: '700' },

  safeAlert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10 },
  safeAlertText: { fontSize: 12, fontWeight: '600', flex: 1 },

  confirmSyncBtn: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    marginBottom: 8,
    ...Shadows.glow,
  },
  confirmSyncText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  cancelSyncBtn: { paddingVertical: 8 },
  cancelSyncText: { fontSize: 14, fontWeight: '700' },

  progressTitle: { fontSize: 20, fontWeight: '900', marginTop: 24, marginBottom: 32 },
  progressBarBg: { width: '100%', height: 10, borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  progressBarFill: { height: '100%', borderRadius: 5 },
  progressPerc: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },

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
  filterActionButtonPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
  },
  filterActionText: { fontSize: 13, fontWeight: '700' },
  activeBadgeSmall: {
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900' },
  filterPanelFull: {
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    borderBottomWidth: 1,
    width: '100%'
  },
  filterSection: { width: '100%' },
  filterPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md
  },
  filterPanelLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  filterGridContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg
  },
  filterGridWrapContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg
  },
  filterTilePremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    ...Shadows.sm
  },
  filterTileText: { fontSize: 12, fontWeight: '800' },
  filterChipPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    minWidth: '30%',
    flexGrow: 1,
    ...Shadows.sm
  },
  statusDotPremium: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  resetActionPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  resetActionText: { fontSize: 11, fontWeight: '800' },
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
  filterContent: { paddingHorizontal: Spacing.lg, gap: 8 },
  filterContentWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: 8
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 12, fontWeight: '700' },
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
    borderRadius: BorderRadius.sm,
    marginBottom: 6,
    marginHorizontal: 6,
  },
  addToLibText: { color: '#FFF', fontSize: 10, fontWeight: '700' },
  emptyContainer: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.lg },
  emptyText: { fontSize: 14, textAlign: 'center' },



  // Modal Styles (Explore specific)
  privacyModal: {
    width: '100%',
    padding: 30,
    borderRadius: 32,
    borderWidth: 1.5,
    alignItems: 'center',
    overflow: 'hidden',
    ...Shadows.lg,
  },
  matureIconBg: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  modalDesc: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  modalActionRow: { width: '100%', gap: 12 },
  modalBtn: {
    height: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalBtnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  modalCancel: { marginTop: 16, padding: 8 },
  modalCancelText: { fontSize: 13, fontWeight: '700' }
});
