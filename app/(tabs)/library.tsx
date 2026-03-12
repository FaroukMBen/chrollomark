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
  const [activeSection, setActiveSection] = useState<'Stories' | 'Collections' | 'Favorites'>('Stories');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');

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
        
        const progressData = await api.getMyProgress(Object.keys(params).length > 0 ? params : undefined);
        setProgress(progressData);
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

  const getSectionIcon = (section: string) => {
    const iconsCustom: Record<string, string> = {
      'Stories': 'books.vertical.fill',
      'Collections': 'folder.fill',
      'Favorites': 'heart.fill',
    };
    return iconsCustom[section] || 'book.fill';
  };

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

  const renderCollectionCard = (coll: any) => (
    <TouchableOpacity
      key={coll._id}
      style={[styles.fullCollCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      onPress={() => router.push(`/collection/${coll._id}` as any)}>
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
              <View style={styles.previewMoreOverlay}>
                <Text style={styles.previewMoreText}>+{coll.stories.length - 4}</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.previewEmpty}>
            <IconSymbol name="folder.fill" size={32} color={colors.textSecondary} />
            <View style={[styles.collStripe, { backgroundColor: coll.color || colors.primary, width: 30, marginTop: 12 }]} />
          </View>
        )}
      </View>
      <View style={styles.collDetails}>
        <Text style={[styles.collName, { color: colors.text }]} numberOfLines={1}>{coll.name}</Text>
        <View style={styles.collMetaRow}>
          <IconSymbol name="books.vertical.fill" size={12} color={colors.textSecondary} />
          <Text style={[styles.collCount, { color: colors.textSecondary, marginLeft: 4 }]}>
            {coll.stories?.length || 0} titles
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

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="book.fill" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>Sign in to view your library</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>My Library</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {activeSection === 'Collections' ? `${collections.length} collections` : `${progress.length} titles`}
          </Text>
        </View>
      </View>

      <View style={[styles.tabContainer, { borderBottomColor: colors.border }]}>
        <View style={styles.tabContent}>
          {['Stories', 'Collections', 'Favorites'].map((section) => {
            const isActive = activeSection === section;
            let activeColor = colors.primary;
            if (section === 'Favorites') activeColor = '#EF4444';
            if (section === 'Collections') activeColor = '#F59E0B';
            return (
              <TouchableOpacity
                key={section}
                style={[styles.tabItem, isActive && { borderBottomColor: activeColor }]}
                onPress={() => { setActiveSection(section as any); setIsLoading(true); }}>
                <IconSymbol name={getSectionIcon(section) as any} size={16} color={isActive ? activeColor : colors.textSecondary} />
                <Text style={[styles.tabText, { color: isActive ? colors.text : colors.textSecondary }, isActive && { fontWeight: '700' }]}>{section}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeSection !== 'Collections' && (
        <View style={styles.filterWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
            {['All', ...ReadingStatuses].map((filter) => {
              const isActive = statusFilter === filter;
              const filterColor = filter === 'All' ? colors.primary : (StatusColors[filter] || colors.primary);
              return (
                <TouchableOpacity
                  key={filter}
                  style={[styles.filterChip, { backgroundColor: isActive ? filterColor + '15' : 'transparent', borderColor: isActive ? filterColor : colors.border }]}
                  onPress={() => { setStatusFilter(filter); setIsLoading(true); }}>
                  {filter !== 'All' && <View style={[styles.filterDot, { backgroundColor: StatusColors[filter] || colors.primary }]} />}
                  <Text style={[styles.filterText, { color: isActive ? filterColor : colors.textSecondary }]}>{filter}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

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
                <TouchableOpacity style={[styles.newCollBtn, { backgroundColor: colors.primary + '15' }]} onPress={() => router.push('/collection/create')}>
                  <IconSymbol name="plus" size={14} color={colors.primary} />
                  <Text style={[styles.newCollText, { color: colors.primary, fontSize: 13 }]}>New Collection</Text>
                </TouchableOpacity>
              </View>
              {collections.length === 0 ? (
                <View style={styles.emptyCenter}>
                  <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}><IconSymbol name="folder.fill" size={40} color={colors.textSecondary} /></View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No collections yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Create collections to organize your favorite stories</Text>
                </View>
              ) : (
                <View style={[styles.gridContainer, { marginTop: Spacing.md }]}>
                  {collections.map(renderCollectionCard)}
                </View>
              )}
            </View>
          ) : (
            <>
              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>{statusFilter === 'All' ? activeSection : statusFilter}</Text>
                <View style={[styles.viewToggle, { backgroundColor: colors.surfaceElevated }]}>
                  {(['list', 'grid', 'compact'] as const).map(mode => (
                    <TouchableOpacity key={mode} onPress={() => setViewMode(mode)} style={[styles.toggleBtn, viewMode === mode && { backgroundColor: colors.primary }]}>
                      <IconSymbol name={mode === 'list' ? 'list.bullet' : mode === 'grid' ? 'square.grid.2x2.fill' : 'square.grid.3x3.fill'} size={16} color={viewMode === mode ? '#FFF' : colors.textSecondary} />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {progress.length === 0 ? (
                <View style={styles.emptyCenter}>
                  <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}><IconSymbol name="books.vertical.fill" size={40} color={colors.textSecondary} /></View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>{statusFilter === 'All' ? 'Library is empty' : `No "${statusFilter}" titles`}</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{statusFilter === 'All' ? 'Start by exploring and adding stories to your library' : `You don't have any stories with "${statusFilter}" status`}</Text>
                </View>
              ) : (
                <View style={viewMode !== 'list' && styles.gridContainer}>
                  {progress.map(renderStoryItem)}
                </View>
              )}
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
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full, borderWidth: 1, gap: 8 },
  filterDot: { width: 8, height: 8, borderRadius: 4 },
  filterText: { fontSize: 13, fontWeight: '600' },
  collectionsFullSection: { paddingBottom: 20, paddingTop: Spacing.sm },
  collectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  collectionTitleRow: { flexDirection: 'row', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  newCollBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: BorderRadius.full },
  newCollText: { fontSize: 11, fontWeight: '700' },
  fullCollCard: { width: '48%', borderRadius: BorderRadius.lg, borderWidth: 1, marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.sm },
  collPreviewContainer: { width: '100%', height: 120, overflow: 'hidden' },
  previewGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  previewImg: { width: '50%', height: '50%', borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)' },
  previewImgFull: { width: '100%', height: '100%' },
  previewImgHalf: { width: '50%', height: '100%' },
  previewImgHalfHeight: { width: '100%', height: '50%' },
  previewMoreOverlay: { position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', width: '50%', height: '50%', justifyContent: 'center', alignItems: 'center' },
  previewMoreText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  previewEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  collStripe: { width: 24, height: 3, borderRadius: 2, marginBottom: 8 },
  collDetails: { padding: Spacing.sm },
  collName: { fontSize: 13, fontWeight: '700', marginBottom: 2 },
  collMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  collCount: { fontSize: 11, fontWeight: '500' },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
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
});
