import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeSection, setActiveSection] = useState<'Stories' | 'Collections' | 'Favorites'>('Stories');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<'All' | 'Manga' | 'Anime'>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [showPrivateOnly, setShowPrivateOnly] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      if (activeSection === 'Collections') {
        const collectionsData = await api.getMyCollections();
        setCollections(collectionsData);
        setProgress([]);
      } else {
        let params: any = {};
        if (activeSection === 'Favorites') params.favorite = 'true';
        if (statusFilter !== 'All') params.status = statusFilter;
        if (mediaTypeFilter !== 'All') params.type = mediaTypeFilter;

        const [progressData, statsData] = await Promise.all([
          api.getMyProgress(Object.keys(params).length > 0 ? params : undefined),
          api.getProgressStats()
        ]);

        setProgress(progressData);
        setStats(statsData);
        setCollections([]);
      }
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, activeSection, statusFilter, mediaTypeFilter]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const sortedProgress = React.useMemo(() => {
    if (!progress) return [];
    let items = [...progress];

    // Filter by search query
    if (librarySearchQuery.trim()) {
      const q = librarySearchQuery.toLowerCase();
      items = items.filter(p => p.story?.title?.toLowerCase().includes(q));
    }

    if (mediaTypeFilter !== 'All') {
      items = items.filter(p => p.story?.type === mediaTypeFilter);
    }

    if (showPrivateOnly) {
      items = items.filter(p => p.isPrivate === true);
    }

    switch (sortBy) {
      case 'az':
        return items.sort((a, b) => (a.story?.title || '').localeCompare(b.story?.title || ''));
      case 'za':
        return items.sort((a, b) => (b.story?.title || '').localeCompare(a.story?.title || ''));
      case 'newest':
        return items; // Default from API is usually newest
      case 'oldest':
        return items.reverse();
      default:
        return items;
    }
  }, [progress, sortBy, librarySearchQuery, mediaTypeFilter, showPrivateOnly]);

  const filteredCollections = React.useMemo(() => {
    if (!collections) return [];
    if (!librarySearchQuery.trim()) return collections;

    const q = librarySearchQuery.toLowerCase();
    return collections.filter(c => c.name?.toLowerCase().includes(q));
  }, [collections, librarySearchQuery]);

  const toggleSort = () => {
    const options: Array<'newest' | 'oldest' | 'az' | 'za'> = ['newest', 'oldest', 'az', 'za'];
    const nextIndex = (options.indexOf(sortBy) + 1) % options.length;
    setSortBy(options[nextIndex]);
  };

  const getSortIcon = () => {
    switch (sortBy) {
      case 'az':
      case 'za': return 'abc';
      case 'newest': return 'arrow.down';
      case 'oldest': return 'arrow.up';
    }
  };

  const getSortLabel = () => {
    switch (sortBy) {
      case 'az': return 'A-Z';
      case 'za': return 'Z-A';
      case 'newest': return 'Newest';
      case 'oldest': return 'Oldest';
      default: return '';
    }
  };

  const handleStatusFilterToggle = (filter: string) => {
    // If clicking the current filter, or clicking "All" when it's already active, keep/reset to "All"
    if (statusFilter === filter) {
      if (filter === 'All') return; // Already on All
      setStatusFilter('All');
    } else {
      setStatusFilter(filter);
    }
    setIsLoading(true);
  };

  const SECTION_COLORS: Record<string, string> = {
    Favorites: '#EF4444',
    Collections: '#F59E0B',
  };

  const SECTION_ICONS: Record<string, string> = {
    Stories: 'books.vertical.fill',
    Collections: 'folder.fill',
    Favorites: 'heart.fill',
  };

  const getStatusCount = (status: string) => {
    if (!stats) return 0;
    const countMap: Record<string, number> = {
      'All': stats.totalStories || 0,
      'Reading': stats.reading || 0,
      'Completed': stats.completed || 0,
      'Plan to Read': stats.planToRead || 0,
      'On Hold': stats.onHold || 0,
      'Dropped': stats.dropped || 0,
    };
    return countMap[status] ?? 0;
  };

  const getSectionCount = (section: string) => {
    if (section === 'Stories') return stats?.totalStories || 0;
    if (section === 'Collections') return collections.length;
    if (section === 'Favorites') return stats?.favorites || 0;
    return 0;
  };


  const renderCollectionCard = (coll: any) => (
    <TouchableOpacity
      key={coll._id}
      style={[styles.fullCollCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      onPress={() => router.push(`/collection/${coll._id}` as any)}
      activeOpacity={0.8}>

      {/* Dynamic Theme Accent */}
      <View style={[styles.collThemeBar, { backgroundColor: coll.color || colors.primary }]} />

      <View style={[styles.collPreviewContainer, { backgroundColor: colors.surfaceElevated }]}>
        {coll.stories && coll.stories.length > 0 ? (
          <View style={styles.previewGrid}>
            {coll.stories.slice(0, 4).map((story: any, idx: number) => (
              <Image
                key={story._id || idx}
                source={{ uri: api.resolveImageUrl(story.coverImage) }}
                style={[
                  styles.previewImg,
                  coll.stories.length === 1 && styles.previewImgFull,
                  coll.stories.length === 2 && styles.previewImgHalf,
                  coll.stories.length === 3 && idx === 0 && styles.previewImgHalfHeight,
                ]}
                contentFit="cover"
              />
            ))}
            {coll.stories.length > 4 && (
              <View style={[styles.previewMoreOverlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
                <Text style={styles.previewMoreText}>+{coll.stories.length - 4}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.previewEmpty}>
            <View style={[styles.emptyCollIcon, { backgroundColor: (coll.color || colors.primary) + '15' }]}>
              <IconSymbol name="folder.fill" size={32} color={coll.color || colors.primary} />
            </View>
          </View>
        )}
      </View>

      <View style={styles.collDetails}>
        <View style={styles.collTitleRow}>
          <Text style={[styles.collName, { color: colors.text, flex: 1 }]} numberOfLines={1}>{coll.name}</Text>
          <IconSymbol
            name={coll.isPublic ? "globe" : "lock.fill"}
            size={12}
            color={colors.textSecondary}
          />
        </View>
        <View style={styles.collMetaRow}>
          <IconSymbol name="books.vertical.fill" size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.collCount, { color: colors.textSecondary }]}>
            {coll.stories?.length || 0} {coll.stories?.length === 1 ? 'title' : 'titles'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderStoryItem = (item: any) => {
    const itemKey = `${viewMode}-${item._id}`;

    if (viewMode === 'list') {
      const sColor = StatusColors[item.status] || colors.primary;
      return (
        <TouchableOpacity
          key={itemKey}
          style={[styles.libListCard, { borderColor: colors.border + '20' }]}
          onPress={() => router.push(`/story/${item.story?._id}` as any)}
          activeOpacity={0.8}>

          {/* Full-bleed cover background */}
          {item.story?.coverImage ? (
            <Image
              source={{ uri: api.resolveImageUrl(item.story?.coverImage) }}
              style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
              contentFit="cover"
              blurRadius={1}
            />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated }]} />
          )}

          {/* Cinematic gradient — heavier on the right for text readability */}
          <LinearGradient
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
          />

          {/* Content overlay */}
          <View style={styles.libListOverlay}>
            {/* Left: cover thumbnail + status accent */}
            <View style={styles.libListLeft}>
              {item.story?.coverImage ? (
                <Image source={{ uri: api.resolveImageUrl(item.story.coverImage) }} style={styles.libListThumb} contentFit="cover" />
              ) : (
                <View style={[styles.libListThumb, { backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
                  <IconSymbol name="book.fill" size={20} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              {/* Status accent bar under thumbnail */}
              <View style={[styles.libListThumbAccent, { backgroundColor: sColor }]} />
            </View>

            {/* Right: text info */}
            <View style={styles.libListInfo}>
              <Text style={styles.libListTitle} numberOfLines={1}>
                {item.story?.title}
              </Text>
              <Text style={styles.libListAuthor} numberOfLines={1}>
                {item.story?.author || (item.story?.type || 'Story')}
              </Text>

              <View style={styles.libListMeta}>
                <View style={[styles.libListStatusPill, { backgroundColor: sColor + '50' }]}>
                  <Text style={styles.libListStatusText}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.libListChapter}>
                  {item.story?.type === 'Anime' ? `S${item.currentSeason || 1} E${item.currentChapter}` : `Ch. ${item.currentChapter}`}
                  {item.story?.totalChapters ? ` / ${item.story.totalChapters}` : ''}
                </Text>
              </View>
            </View>

            {/* Quick increment */}
            <TouchableOpacity
              style={[styles.libListPlusBtn, { backgroundColor: 'rgba(255,255,255,0.12)' }]}
              onPress={async (e) => {
                e.stopPropagation();
                try {
                  const updated = await api.incrementChapter(item._id);
                  setProgress((prev) => prev.map((p) => (p._id === item._id ? updated : p)));
                } catch (err) { console.log(err); }
              }}>
              <IconSymbol name="plus" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Badges */}
          {item.isFavorite && (
            <View style={styles.libListFavBadge}>
              <IconSymbol name="heart.fill" size={10} color="#EF4444" />
            </View>
          )}
          {item.isPrivate && (
            <View style={styles.libListLockBadge}>
              <IconSymbol name="lock.fill" size={9} color="rgba(255,255,255,0.8)" />
            </View>
          )}
        </TouchableOpacity>
      );
    }

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          key={itemKey}
          style={[styles.libGridCard, { borderColor: colors.border + '30', minHeight: 240 }]}
          onPress={() => router.push(`/story/${item.story?._id}` as any)}
          activeOpacity={0.8}>

          {item.story?.coverImage ? (
            <Image source={{ uri: api.resolveImageUrl(item.story.coverImage) }} style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]} contentFit="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
              <IconSymbol name="book.fill" size={32} color={colors.textSecondary} />
            </View>
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.95)']}
            style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
          />

          <View style={styles.libGridOverlay}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
              <Text style={styles.libGridTitle} numberOfLines={2}>
                {item.story?.title}
              </Text>
              {item.isPrivate && <IconSymbol name="lock.fill" size={10} color="rgba(255,255,255,0.6)" />}
            </View>

            <View style={styles.libGridMeta}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={[styles.libStatusPill, { backgroundColor: (StatusColors[item.status] || '#FFF') + '40', alignSelf: 'flex-start' }]}>
                  <Text style={styles.libStatusText}>{item.status.toUpperCase()}</Text>
                </View>
                <Text style={styles.libGridChapter}>
                  {item.story?.type === 'Anime' ? `S${item.currentSeason || 1} E${item.currentChapter}` : `CH. ${item.currentChapter}`}
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.libQuickPlus, { backgroundColor: colors.primary }]}
                onPress={async (e) => {
                  e.stopPropagation();
                  try {
                    const updated = await api.incrementChapter(item._id);
                    setProgress((prev) => prev.map((p) => (p._id === item._id ? updated : p)));
                  } catch (err) { console.log(err); }
                }}>
                <IconSymbol name="plus" size={14} color="#FFF" />
              </TouchableOpacity>
            </View>
          </View>

          {item.isFavorite && <View style={styles.favoriteBadge}><IconSymbol name="heart.fill" size={10} color="#EF4444" /></View>}
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={itemKey}
        style={[styles.compactCard, { borderColor: colors.cardBorder }]}
        onPress={() => router.push(`/story/${item.story?._id}` as any)}
        activeOpacity={0.7}>
        {item.story?.coverImage ? (
          <Image source={{ uri: api.resolveImageUrl(item.story.coverImage) }} style={styles.compactCover} contentFit="cover" />
        ) : (
          <View style={[styles.compactCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
            <IconSymbol name="book.fill" size={20} color={colors.textSecondary} />
          </View>
        )}
        {item.isFavorite && <View style={styles.compactFav}><IconSymbol name="heart.fill" size={8} color="#EF4444" /></View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 4 }}>
          <Text style={[styles.compactTitle, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>{item.story?.title}</Text>
          {item.isPrivate && <IconSymbol name="lock.fill" size={8} color={colors.accent} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = (type: 'Stories' | 'Collections') => {
    const isSearch = librarySearchQuery.trim().length > 0;

    if (type === 'Collections') {
      const collTitle = isSearch ? "No results found" : "No collections yet";
      const collSub = isSearch ? `No collection matches "${librarySearchQuery}"` : "Create collections to organize your stories";

      return (
        <View style={styles.emptyCenter}>
          <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
            <IconSymbol name="folder.fill" size={40} color={colors.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{collTitle}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{collSub}</Text>
        </View>
      );
    }

    const isAll = statusFilter === 'All';
    let title = '';
    let subtitle = '';

    if (isSearch) {
      title = "No results found";
      subtitle = `No stories match "${librarySearchQuery}"`;
    } else if (isAll) {
      title = 'Library is empty';
      subtitle = 'Start by exploring and adding stories';
    } else {
      title = `No titles in "${statusFilter}"`;
      subtitle = `You don't have any stories with "${statusFilter}" status`;
    }

    return (
      <View style={styles.emptyCenter}>
        <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
          <IconSymbol name="books.vertical.fill" size={40} color={colors.textSecondary} />
        </View>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{subtitle}</Text>
      </View>
    );
  };

  const renderStoriesContent = () => {
    if (progress.length === 0) return renderEmptyState('Stories');

    return (
      <View style={[styles.storiesScrollSection, viewMode !== 'list' && styles.gridContainer]}>
        {sortedProgress.map(renderStoryItem)}
      </View>
    );
  };

  const renderPinnedToolbar = () => {
    if (activeSection === 'Collections') return null;

    return (
      <View style={[styles.pinnedToolbar, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <View style={styles.pinnedHeaderLeft}>
          <TouchableOpacity
            style={[
              styles.filterActionButtonCompact,
              { backgroundColor: colors.surfaceElevated },
              isFiltersExpanded && { borderColor: colors.primary, borderWidth: 1, backgroundColor: colors.primary + '10' }
            ]}
            onPress={() => setIsFiltersExpanded(!isFiltersExpanded)}
            activeOpacity={0.6}
          >
            <IconSymbol
              name="line.3.horizontal.decrease"
              size={14}
              color={isFiltersExpanded ? colors.primary : colors.text}
            />
            <Text style={[styles.filterActionText, { color: isFiltersExpanded ? colors.primary : colors.text }]}>Filters</Text>
          </TouchableOpacity>

          <View style={[styles.pinnedCountBadge, { backgroundColor: colors.primary + '10' }]}>
            <Text style={[styles.pinnedCountText, { color: colors.primary }]}>{sortedProgress.length}</Text>
          </View>
        </View>

        <View style={styles.toolbarActions}>
          <TouchableOpacity style={[styles.miniSortAction, { backgroundColor: colors.surfaceElevated }]} onPress={toggleSort}>
            <IconSymbol
              name={getSortIcon() as any}
              size={14}
              color={colors.primary}
              style={sortBy === 'za' ? { transform: [{ rotate: '180deg' }] } : undefined}
            />
          </TouchableOpacity>

          <View style={[styles.viewTogglePinned, { backgroundColor: colors.surfaceElevated }]}>
            {(['list', 'grid', 'compact'] as const).map(mode => {
              const isModeActive = viewMode === mode;
              const modeIcons = { list: 'list.bullet', grid: 'square.grid.2x2.fill', compact: 'square.grid.3x3.fill' };

              return (
                <TouchableOpacity
                  key={mode}
                  onPress={() => setViewMode(mode)}
                  style={[styles.toggleBtnPinned, isModeActive && { backgroundColor: colors.primary }]}
                >
                  <IconSymbol
                    name={modeIcons[mode] as any}
                    size={14}
                    color={isModeActive ? '#FFF' : colors.textSecondary}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const renderFilterGrid = () => {
    if (activeSection === 'Collections' || !isFiltersExpanded) return null;

    return (
      <View style={[styles.filterPanelFull, { backgroundColor: colors.surface + '60', borderBottomColor: colors.border }]}>
        {/* Media Type Section */}
        <View style={styles.filterSection}>
          <View style={styles.filterPanelHeader}>
            <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>MEDIA TYPE</Text>
          </View>
          <View style={styles.sortGridContainer}>
            {(['All', 'Manga', 'Anime'] as const).map((type) => {
              const isActive = mediaTypeFilter === type;
              const typeIcons = { All: 'square.grid.2x2.fill', Manga: 'book.fill', Anime: 'play.fill' };
              const colorsList = {
                Manga: ['#8B5CF6', '#D946EF'],
                Anime: ['#F59E0B', '#EF4444'],
                All: [colors.primary, '#06B6D4']
              };
              const currentColors = colorsList[type] || [colors.primary, colors.primary];

              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.mediaTypeTile, { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => { setMediaTypeFilter(type); setIsLoading(true); }}
                  activeOpacity={0.8}
                >
                  {isActive ? (
                    <LinearGradient
                      colors={currentColors as [string, string]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFill}
                    />
                  ) : (
                    <View style={[styles.inactiveGradientBorder, { borderColor: currentColors[0] + '30' }]} />
                  )}
                  <IconSymbol
                    name={typeIcons[type] as any}
                    size={18}
                    color={isActive ? '#FFF' : currentColors[0]}
                  />
                  <Text style={[styles.mediaTileText, { color: isActive ? '#FFF' : colors.text }]}>{type}</Text>
                  {isActive && <View style={styles.activeDotPointer} />}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Status Section */}
        <View style={[styles.filterSection, { marginTop: Spacing.xl }]}>
          <View style={styles.filterPanelHeader}>
            <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>STORY STATUS</Text>
          </View>
          <View style={styles.filterGridContainer}>
            {['All', ...ReadingStatuses].map((filter) => {
              const isActive = statusFilter === filter;
              const isDropped = filter === 'Dropped';
              let filterColor = colors.primary;
              if (isDropped) filterColor = '#EF4444';
              else if (filter !== 'All' && StatusColors[filter]) filterColor = StatusColors[filter];

              const textColor = isActive ? filterColor : (isDropped ? '#EF444490' : colors.text);
              const currentCount = getStatusCount(filter);

              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.filterChipPremium,
                    { backgroundColor: colors.surfaceElevated },
                    isActive && { backgroundColor: filterColor + '15', borderColor: filterColor, borderWidth: 1 }
                  ]}
                  onPress={() => handleStatusFilterToggle(filter)}
                  activeOpacity={0.7}
                >
                  <View style={styles.filterChipMain}>
                    {isDropped ? (
                      <IconSymbol name="trash" size={10} color={isActive ? '#EF4444' : '#EF444490'} />
                    ) : (
                      <View style={[styles.statusDotPremium, { backgroundColor: filterColor }]} />
                    )}
                    <Text style={[styles.filterChipText, { color: textColor }]}>{filter}</Text>
                  </View>
                  {currentCount > 0 && (
                    <View style={[styles.filterChipBadge, { backgroundColor: isActive ? filterColor + '20' : colors.background }]}>
                      <Text style={[styles.filterChipCount, { color: isActive ? filterColor : colors.textSecondary }]}>{currentCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Sort Section */}
        <View style={[styles.filterSection, { marginTop: Spacing.xl }]}>
          <View style={styles.filterPanelHeader}>
            <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>SORT ORDER</Text>
          </View>
          <View style={styles.sortGridContainer}>
            {(['newest', 'oldest', 'az', 'za'] as const).map((option) => {
              const isActive = sortBy === option;
              const labels = { newest: 'Newest', oldest: 'Oldest', az: 'A-Z', za: 'Z-A' };
              const icons = { newest: 'arrow.down', oldest: 'arrow.up', az: 'abc', za: 'textformat.abc' };

              return (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.sortTilePremium,
                    { backgroundColor: colors.surfaceElevated },
                    isActive && { backgroundColor: colors.primary, borderColor: colors.primary }
                  ]}
                  onPress={() => setSortBy(option)}
                  activeOpacity={0.7}
                >
                  <IconSymbol
                    name={icons[option] as any}
                    size={14}
                    color={isActive ? '#FFF' : colors.textSecondary}
                    style={option === 'za' ? { transform: [{ rotate: '180deg' }] } : undefined}
                  />
                  <Text style={[styles.sortTileText, { color: isActive ? '#FFF' : colors.text }]}>{labels[option]}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        {isSearchVisible ? (
          <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated }]}>
            <IconSymbol name="magnifyingglass" size={18} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search in library..."
              placeholderTextColor={colors.textSecondary}
              value={librarySearchQuery}
              onChangeText={setLibrarySearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setIsSearchVisible(false); setLibrarySearchQuery(''); }}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>My Library</Text>
              <Text style={[styles.statsSummaryText, { color: colors.textSecondary }]}>
                {activeSection === 'Collections' ? `${filteredCollections.length} collections` : `${sortedProgress.length} titles`}
              </Text>
            </View>
            <View style={styles.headerRightActions}>
              <TouchableOpacity
                style={[
                  styles.smallActionBtn,
                  { backgroundColor: showPrivateOnly ? colors.accent + '20' : colors.surfaceElevated, borderWidth: showPrivateOnly ? 1 : 0, borderColor: colors.accent }
                ]}
                onPress={() => { setShowPrivateOnly(!showPrivateOnly); }}
              >
                <IconSymbol name={showPrivateOnly ? "eye.slash.fill" : "eye.fill"} size={20} color={showPrivateOnly ? colors.accent : colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.smallActionBtn, { backgroundColor: colors.surfaceElevated }]}
                onPress={() => router.push('/user/stats')}
              >
                <IconSymbol name="chart.bar.fill" size={20} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.searchToggle, { backgroundColor: colors.surfaceElevated }]}
                onPress={() => setIsSearchVisible(true)}
              >
                <IconSymbol name="magnifyingglass" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.tabContent}>
          {['Stories', 'Collections', 'Favorites'].map((section) => {
            const isActive = activeSection === section;
            const activeColor = SECTION_COLORS[section] || colors.primary;
            const count = getSectionCount(section);
            const iconName = SECTION_ICONS[section] || 'book.fill';

            return (
              <TouchableOpacity
                key={section}
                style={[styles.tabItem, isActive && { borderBottomColor: activeColor }]}
                onPress={() => { setActiveSection(section as any); setIsLoading(true); }}>
                <View style={styles.tabItemWithBadge}>
                  <IconSymbol name={iconName as any} size={16} color={isActive ? activeColor : colors.textSecondary} />
                  <Text style={[styles.tabText, { color: isActive ? colors.text : colors.textSecondary }, isActive && { fontWeight: '700' }]}>{section}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {renderPinnedToolbar()}

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />} contentContainerStyle={styles.listContent}>
          {activeSection === 'Collections' ? (
            <View style={styles.collectionsFullSection}>
              <View style={styles.collectionHeader}>
                <View style={styles.collectionTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text, fontSize: 18 }]}>My Collections</Text>
                </View>
                <TouchableOpacity
                  style={[styles.newCollBtnPremium, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/collection/create')}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="plus" size={14} color="#FFF" />
                  <Text style={styles.newCollTextPremium}>New Collection</Text>
                </TouchableOpacity>
              </View>
              {filteredCollections.length === 0 ? renderEmptyState('Collections') : (
                <View style={[styles.gridContainer, { marginTop: Spacing.md }]}>
                  {filteredCollections.map(renderCollectionCard)}
                </View>
              )}
            </View>
          ) : (
            <>
              {renderFilterGrid()}
              {renderStoriesContent()}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  statsSummaryText: { fontSize: 13, fontWeight: '500', marginTop: 2 },
  addBtn: { width: 40, height: 40, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  tabContainer: { borderBottomWidth: 1, marginBottom: Spacing.xs },
  tabContent: { paddingHorizontal: Spacing.lg, flexDirection: 'row', justifyContent: 'space-between' },
  tabItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent', gap: 8 },
  tabText: { fontSize: 14, fontWeight: '700' },
  filterWrapper: { paddingVertical: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pinnedToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderBottomWidth: 1,
    zIndex: 10
  },
  pinnedHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  pinnedCountBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  pinnedCountText: { fontSize: 10, fontWeight: '800' },
  toolbarActions: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  miniSortAction: { width: 32, height: 32, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  filterActionButtonCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    ...Shadows.sm
  },
  filterActionText: { fontSize: 13, fontWeight: '700' },
  viewTogglePinned: { flexDirection: 'row', borderRadius: BorderRadius.md, padding: 2 },
  toggleBtnPinned: { width: 30, height: 30, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },

  filterPanelFull: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl + 10,
    borderBottomWidth: 1,
    zIndex: 5,
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
  filterCloseText: { fontSize: 12, fontWeight: '700' },
  filterGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: Spacing.lg
  },
  filterChipPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    minWidth: '31%',
    flexGrow: 1,
    ...Shadows.sm
  },
  sortTilePremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    flex: 1,
    justifyContent: 'center',
    ...Shadows.sm
  },
  sortTileText: { fontSize: 11, fontWeight: '800' },
  sortGridContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: Spacing.lg
  },
  filterChipMain: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusDotPremium: { width: 6, height: 6, borderRadius: 3 },
  filterChipText: { fontSize: 12, fontWeight: '700' },
  filterChipBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  filterChipCount: { fontSize: 10, fontWeight: '800' },
  tabItemWithBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: BorderRadius.full },
  tabBadgeText: { fontSize: 10, fontWeight: '700' },
  collectionsFullSection: { paddingHorizontal: Spacing.lg, paddingBottom: 20, paddingTop: Spacing.sm },
  collectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  newCollBtnPremium: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    ...Shadows.md
  },
  newCollTextPremium: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  fullCollCard: { width: '48%', borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.md },
  collThemeBar: { width: '100%', height: 4 },
  collPreviewContainer: { width: '100%', height: 110, overflow: 'hidden' },
  previewGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  previewImg: { width: '50%', height: '50%', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.05)' },
  previewImgFull: { width: '100%', height: '100%' },
  previewImgHalf: { width: '50%', height: '100%' },
  previewImgHalfHeight: { width: '100%', height: '50%' },
  previewMoreOverlay: { position: 'absolute', bottom: 0, right: 0, width: '50%', height: '50%', justifyContent: 'center', alignItems: 'center' },
  previewMoreText: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  previewEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyCollIcon: { width: 56, height: 56, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  collDetails: { padding: Spacing.md },
  collTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  collName: { fontSize: 14, fontWeight: '800' },
  collMetaRow: { flexDirection: 'row', alignItems: 'center' },
  collCount: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingBottom: 100 },
  storiesScrollSection: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  libListCard: {
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    position: 'relative',
    backgroundColor: '#000',
    ...Shadows.md,
  },
  libListOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingRight: 10,
    gap: 15,
  },
  libListLeft: { alignItems: 'center', gap: 6 },
  libListThumb: { width: 65, height: 90, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  libListThumbAccent: { width: 30, height: 4, borderRadius: 2 },
  libListInfo: { flex: 1, justifyContent: 'center' },
  libListTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  libListAuthor: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  libListMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  libListStatusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  libListStatusText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  libListChapter: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800' },
  libListPlusBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  libListFavBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  libListLockBadge: { position: 'absolute', top: 8, right: 34, backgroundColor: 'rgba(0,0,0,0.5)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  emptyCenter: { paddingTop: 60, alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyIconBg: { width: 80, height: 80, borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.sm },
  viewToggle: { flexDirection: 'row', borderRadius: BorderRadius.lg, padding: 4 },
  toggleBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  libGridCard: {
    width: '48%',
    height: 240,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.md,
    position: 'relative',
    backgroundColor: '#000',
    ...Shadows.md
  },
  libGridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    paddingBottom: 12,
  },
  libGridTitle: { color: '#FFF', fontSize: 13, fontWeight: '900', lineHeight: 16, flex: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  libGridMeta: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8 },
  libStatusPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  libStatusText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  libGridChapter: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '800' },
  libQuickPlus: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', ...Shadows.sm },
  favoriteBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  compactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-start' },
  compactCard: { width: '31%', marginBottom: Spacing.md },
  compactCover: { width: '100%', height: 140, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: 'rgba(148, 163, 184, 0.1)' },
  compactTitle: { fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  compactFav: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(255,255,255,0.9)', width: 14, height: 14, borderRadius: 7, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  sortText: { fontSize: 11, fontWeight: '700' },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 46,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    gap: 10,
    ...Shadows.sm
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  smallActionBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    padding: 0,
  },
  searchToggle: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm
  },
  mediaTypeTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 18,
    borderRadius: BorderRadius.md,
    flex: 1,
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.md
  },
  inactiveGradientBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    opacity: 0.5,
  },
  mediaTileText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.5, textTransform: 'uppercase' },
  activeDotPointer: { position: 'absolute', bottom: 6, width: 20, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
});



