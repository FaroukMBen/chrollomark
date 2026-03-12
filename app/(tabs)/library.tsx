import { Image } from 'expo-image';
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
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'az' | 'za'>('newest');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFiltersExpanded, setIsFiltersExpanded] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

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
  }, [isAuthenticated, activeSection, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

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
  }, [progress, sortBy, librarySearchQuery]);

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
                source={{ uri: story.coverImage }}
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
    if (viewMode === 'list') {
      return (
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
            <Text style={[styles.listTitle, { color: colors.text }]} numberOfLines={1}>{item.story.title}</Text>
            <Text style={[styles.listAuthor, { color: colors.textSecondary }]} numberOfLines={1}>{item.story.author || item.story.type}</Text>
            <View style={styles.listMeta}>
              <View style={[styles.statusBadge, { backgroundColor: (StatusColors[item.status] || colors.primary) + '20' }]}>
                <View style={[styles.statusDot, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
                <Text style={[styles.statusText, { color: StatusColors[item.status] || colors.primary }]}>{item.status}</Text>
              </View>
              <Text style={[styles.chapterInfo, { color: colors.primary }]}>Ch. {item.currentChapter}{item.story.totalChapters ? ` / ${item.story.totalChapters}` : ''}</Text>
            </View>
          </View>
          {item.isFavorite && <IconSymbol name="heart.fill" size={14} color="#EF4444" style={{ marginRight: 8 }} />}
          <TouchableOpacity style={[styles.quickAction, { backgroundColor: colors.primary }]} onPress={async (e) => {
            e.stopPropagation();
            try {
              const updated = await api.incrementChapter(item._id);
              setProgress((prev) => prev.map((p) => (p._id === item._id ? updated : p)));
            } catch (err) { console.log(err); }
          }}><IconSymbol name="plus" size={16} color="#FFF" /></TouchableOpacity>
        </TouchableOpacity>
      );
    }
    
    if (viewMode === 'grid') {
      return (
        <TouchableOpacity
          key={item._id}
          style={[styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
          onPress={() => router.push(`/story/${item.story._id}` as any)}
          activeOpacity={0.7}>
          {item.story.coverImage ? (
            <Image source={{ uri: item.story.coverImage }} style={styles.gridCover} contentFit="cover" />
          ) : (
            <View style={[styles.gridCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
              <IconSymbol name="book.fill" size={32} color={colors.textSecondary} />
            </View>
          )}
          {item.isFavorite && <View style={styles.favoriteBadge}><IconSymbol name="heart.fill" size={10} color="#EF4444" /></View>}
          <View style={styles.gridInfo}>
            <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={1}>{item.story.title}</Text>
            <View style={styles.gridMeta}>
              <Text style={[styles.gridChapter, { color: colors.primary }]}>Ch. {item.currentChapter}</Text>
              <View style={[styles.gridStatusDot, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        key={item._id}
        style={[styles.compactCard, { borderColor: colors.cardBorder }]}
        onPress={() => router.push(`/story/${item.story._id}` as any)}
        activeOpacity={0.7}>
        {item.story.coverImage ? (
          <Image source={{ uri: item.story.coverImage }} style={styles.compactCover} contentFit="cover" />
        ) : (
          <View style={[styles.compactCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
            <IconSymbol name="book.fill" size={20} color={colors.textSecondary} />
          </View>
        )}
        {item.isFavorite && <View style={styles.compactFav}><IconSymbol name="heart.fill" size={8} color="#EF4444" /></View>}
        <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>{item.story.title}</Text>
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
        <View style={styles.filterSection}>
          <View style={styles.filterPanelHeader}>
            <Text style={[styles.filterPanelLabel, { color: colors.textSecondary }]}>STORY STATUS</Text>
          </View>
          
          <View style={styles.filterGridContainer}>
            {['All', ...ReadingStatuses].map((filter) => {
              const isActive = statusFilter === filter;
              const isDropped = filter === 'Dropped';
              
              let filterColor = colors.primary;
              if (isDropped) {
                filterColor = '#EF4444';
              } else if (filter !== 'All' && StatusColors[filter]) {
                filterColor = StatusColors[filter];
              }

              const textColor = isActive ? filterColor : (isDropped ? '#EF444490' : colors.text);
              const countColor = isActive ? filterColor : (isDropped ? '#EF444460' : colors.textSecondary);
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
                      <Text style={[styles.filterChipCount, { color: countColor }]}>{currentCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

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
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                {activeSection === 'Collections' ? `${filteredCollections.length} collections` : `${sortedProgress.length} titles`}
              </Text>
            </View>
            <TouchableOpacity 
              style={[styles.searchToggle, { backgroundColor: colors.surfaceElevated }]} 
              onPress={() => setIsSearchVisible(true)}
            >
              <IconSymbol name="magnifyingglass" size={20} color={colors.text} />
            </TouchableOpacity>
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
  subtitle: { fontSize: 13, fontWeight: '500', marginTop: 2 },
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
  listItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  listCover: { width: 65, height: 90, borderRadius: BorderRadius.md },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  listInfo: { flex: 1, marginLeft: Spacing.md },
  listTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  listAuthor: { fontSize: 12, marginBottom: 6, fontWeight: '500' },
  listMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  chapterInfo: { fontSize: 12, fontWeight: '700' },
  quickAction: { width: 38, height: 38, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center', marginLeft: Spacing.sm, ...Shadows.sm },
  emptyCenter: { paddingTop: 60, alignItems: 'center', paddingHorizontal: Spacing.xl },
  emptyIconBg: { width: 80, height: 80, borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md, marginTop: Spacing.sm },
  viewToggle: { flexDirection: 'row', borderRadius: BorderRadius.lg, padding: 4 },
  toggleBtn: { width: 36, height: 36, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.md },
  gridCover: { width: '100%', height: 200 },
  gridInfo: { padding: Spacing.sm },
  gridTitle: { fontSize: 13, fontWeight: '700', lineHeight: 18, height: 18 },
  gridMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  gridChapter: { fontSize: 11, fontWeight: '800' },
  gridStatusDot: { width: 8, height: 8, borderRadius: 4 },
  favoriteBadge: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(255,255,255,0.9)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
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
});
