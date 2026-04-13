import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

type SortOption = 'newest' | 'oldest' | 'az' | 'za';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { user } = useAuth();

  const [collection, setCollection] = useState<any>(null);
  const [userProgressMap, setUserProgressMap] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [isManageModalVisible, setIsManageModalVisible] = useState(false);
  const [libraryStories, setLibraryStories] = useState<any[]>([]);
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const { showToast } = useToast();
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [collData, progData] = await Promise.all([
        api.getCollection(id),
        api.getMyProgress().catch(() => [])
      ]);
      
      setCollection(collData);
      
      // Create a map of storyId -> progress for quick lookup
      const progMap: Record<string, any> = {};
      progData.forEach((p: any) => {
        if (p.story?._id) progMap[p.story._id] = p;
      });
      setUserProgressMap(progMap);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const loadLibrary = async () => {
    setIsLibraryLoading(true);
    try {
      const data = await api.getMyProgress();
      // Filter out stories already in collection
      const existingIds = new Set((collection?.stories || []).map((s: any) => s._id));
      setLibraryStories(data.filter((p: any) => !existingIds.has(p.story._id)));
    } catch (err) {
      console.log(err);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const sortedStories = React.useMemo(() => {
    if (!collection?.stories) return [];
    const stories = [...collection.stories];
    switch (sortBy) {
      case 'az': return stories.sort((a, b) => a.title.localeCompare(b.title));
      case 'za': return stories.sort((a, b) => b.title.localeCompare(a.title));
      case 'newest': return stories.reverse();
      case 'oldest': return stories;
      default: return stories;
    }
  }, [collection?.stories, sortBy]);

  const toggleSort = () => {
    const options: SortOption[] = ['newest', 'oldest', 'az', 'za'];
    const nextIndex = (options.indexOf(sortBy) + 1) % options.length;
    setSortBy(options[nextIndex]);
  };

  const getSortIcon = () => {
    switch (sortBy) {
      case 'az': return 'textformat.abc';
      case 'za': return 'textformat.abc';
      case 'newest': return 'arrow.down';
      case 'oldest': return 'arrow.up';
    }
  };

  const handleAddToCollection = async (storyId: string) => {
    try {
      await api.addToCollection(id, storyId);
      loadData();
      setIsManageModalVisible(false);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setIsConfirmVisible(true);
  };

  const handleRemoveFromCollection = async (storyId: string) => {
    showConfirm('Remove Story', 'Are you sure you want to remove this story from the collection?', async () => {
      try {
        await api.removeFromCollection(id, storyId);
        setCollection((prev: any) => ({
          ...prev,
          stories: prev.stories.filter((s: any) => s._id !== storyId),
        }));
        showToast({ message: 'Story removed', type: 'info' });
      } catch (error: any) {
        showToast({ message: error.message, type: 'error' });
      }
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!collection) return null;

  const isOwner = collection.user?._id === user?._id || collection.user === user?._id;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[1]}
      >
        {/* Cinematic Header Block */}
        <View style={styles.immersiveHeaderContainer}>
          {/* Immersive Background */}
          <View style={styles.immersiveBackground}>
            {collection.stories?.[0]?.coverImage ? (
              <Image
                source={{ uri: api.resolveImageUrl(collection.stories[0].coverImage) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={60}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: collection.color || colors.primary }]} />
            )}
            <LinearGradient
              colors={['transparent', colors.background]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Floating Actions Overlay */}
          <View style={styles.floatingHeaderActions}>
            <TouchableOpacity style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]} onPress={() => router.back()}>
              <IconSymbol name="arrow.left" size={20} color={colors.text} />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {isOwner ? (
                <>
                  <TouchableOpacity
                    style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]}
                    onPress={() => router.push({ pathname: '/collection/edit', params: { id } })}>
                    <IconSymbol name="pencil" size={18} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]}
                    onPress={() => {
                      showConfirm('Delete Collection', 'This action cannot be undone. Are you sure?', async () => {
                        try {
                          await api.deleteCollection(id);
                          showToast({ message: 'Collection deleted', type: 'info' });
                          router.back();
                        } catch (error: any) {
                          showToast({ message: error.message, type: 'error' });
                        }
                      });
                    }}>
                    <IconSymbol name="trash" size={18} color={colors.error} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.headerCircleBtn, { backgroundColor: colors.surface + '80' }]}
                  onPress={async () => {
                    try {
                      await api.cloneCollection(id);
                      showToast({ message: 'Collection cloned successfully!', type: 'success' });
                      router.push('/(tabs)/library' as any);
                    } catch (error: any) {
                      showToast({ message: error.message, type: 'error' });
                    }
                  }}>
                  <IconSymbol name="plus.square.on.square" size={18} color={colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Core Collection Info */}
          <View style={styles.heroInfoContent}>
            {/* Theme Glow Accent */}
            <View style={[styles.glowAccent, { backgroundColor: collection.color || colors.primary }]} />
            
            <Text style={[styles.heroName, { color: colors.text }]}>{collection.name}</Text>
            
            {collection.description ? (
              <Text style={[styles.heroDescription, { color: colors.textSecondary }]}>
                {collection.description}
              </Text>
            ) : null}

            {/* Glassmorphic Stats Bar */}
            <View style={styles.glassStatBar}>
              <View style={[styles.glassBadge, { backgroundColor: colors.surfaceElevated + '80' }]}>
                <IconSymbol name={collection.isPublic ? 'globe' : 'lock.fill'} size={12} color={colors.textSecondary} />
                <Text style={[styles.glassBadgeText, { color: colors.textSecondary }]}>
                  {collection.isPublic ? 'PUBLIC' : 'PRIVATE'}
                </Text>
              </View>
              <View style={[styles.glassBadge, { backgroundColor: colors.surfaceElevated + '80' }]}>
                <IconSymbol name="books.vertical.fill" size={12} color={colors.textSecondary} />
                <Text style={[styles.glassBadgeText, { color: colors.textSecondary }]}>
                  {collection.stories?.length || 0} STORIES
                </Text>
              </View>
              <View style={[styles.glassBadge, { backgroundColor: colors.surfaceElevated + '80' }]}>
                <IconSymbol name="person" size={12} color={colors.textSecondary} />
                <Text style={[styles.glassBadgeText, { color: colors.textSecondary }]}>
                  {collection.user?.username?.toUpperCase() || 'USER'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Sticky Toolbar Section */}
        <View style={[styles.stickyToolbar, { backgroundColor: colors.background + 'CC' }]}>
          <View style={styles.toolbarContent}>
            <TouchableOpacity 
              style={[styles.minimalControl, { borderColor: colors.border }]} 
              onPress={toggleSort}
              activeOpacity={0.7}
            >
              <IconSymbol name={getSortIcon() as any} size={16} color={colors.textSecondary} />
              <Text style={[styles.minimalText, { color: colors.textSecondary }]}>
                {sortBy.toUpperCase()}
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity
                style={[styles.premiumAddBtn, { backgroundColor: colors.primary }]}
                onPress={() => {
                  loadLibrary();
                  setIsManageModalVisible(true);
                }}
                activeOpacity={0.8}
              >
                <IconSymbol name="plus" size={16} color="#FFF" />
                <Text style={styles.premiumAddText}>ADD STORIES</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stories list follows header directly */}
        <View style={{ paddingBottom: 40 }}>
          {sortedStories.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                <IconSymbol name="folder.fill" size={40} color={colors.textSecondary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                Your collection is empty
              </Text>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Tap the "Add Stories" button to start organizing your manga.
              </Text>
            </View>
          ) : (
          sortedStories.map((story: any) => {
            const userProg = userProgressMap[story._id];
            const sColor = (userProg && StatusColors[userProg.status]) || colors.primary;

            return (
              <TouchableOpacity
                key={story._id}
                style={[styles.libListCard, { borderColor: colors.border + '20' }]}
                onPress={() => router.push(`/story/${story._id}` as any)}
                activeOpacity={0.8}>

                {/* Full-bleed cover background */}
                {story.coverImage ? (
                  <Image
                    source={{ uri: api.resolveImageUrl(story.coverImage) }}
                    style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                    contentFit="cover"
                    blurRadius={1}
                  />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated }]} />
                )}

                {/* Cinematic gradient */}
                <LinearGradient
                  colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                />

                {/* Content overlay */}
                <View style={styles.libListOverlay}>
                  {/* Left: cover thumbnail + status accent */}
                  <View style={styles.libListLeft}>
                    {story.coverImage ? (
                      <Image source={{ uri: api.resolveImageUrl(story.coverImage) }} style={styles.libListThumb} contentFit="cover" />
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
                      {story.title}
                    </Text>
                    <Text style={styles.libListAuthor} numberOfLines={1}>
                      {story.author || (story.type || 'Story')}
                    </Text>

                    <View style={styles.libListMeta}>
                      <View style={[styles.libListStatusPill, { backgroundColor: sColor + '50' }]}>
                        <Text style={styles.libListStatusText}>{(userProg?.status || 'NOT IN LIBRARY').toUpperCase()}</Text>
                      </View>
                      <Text style={styles.libListChapter}>
                        {story.type === 'Anime' ? `S${userProg?.currentSeason || 1} E${userProg?.currentChapter || 0}` : `Ch. ${userProg?.currentChapter || 0}`}
                        {story.totalChapters ? ` / ${story.totalChapters}` : ''}
                      </Text>
                    </View>
                  </View>

                  {/* Quick Remove (If owner) / Actions */}
                  {isOwner && (
                    <TouchableOpacity
                      style={[styles.libListPlusBtn, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        handleRemoveFromCollection(story._id);
                      }}>
                      <IconSymbol name="minus" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Badges */}
                {userProg?.isFavorite && (
                  <View style={styles.libListFavBadge}>
                    <IconSymbol name="heart.fill" size={10} color="#EF4444" />
                  </View>
                )}
                {userProg?.isPrivate && (
                  <View style={styles.libListLockBadge}>
                    <IconSymbol name="lock.fill" size={9} color="rgba(255,255,255,0.8)" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
      </ScrollView>

      {/* Add Stories Modal */}
      <Modal
        visible={isManageModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsManageModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Add to Collection</Text>
              <TouchableOpacity onPress={() => setIsManageModalVisible(false)}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            {isLibraryLoading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ margin: 20 }} />
            ) : libraryStories.length === 0 ? (
              <View style={styles.modalEmpty}>
                <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>
                  All stories from your library are already in this collection.
                </Text>
              </View>
            ) : (
              <FlatList
                data={libraryStories}
                keyExtractor={(item) => item._id}
                contentContainerStyle={styles.modalList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.modalItem, { borderColor: colors.border }]}
                    onPress={() => handleAddToCollection(item.story._id)}>
                    <Image source={{ uri: api.resolveImageUrl(item.story.coverImage) }} style={styles.modalCover} contentFit="cover" />
                    <View style={styles.modalItemInfo}>
                      <Text style={[styles.modalItemTitle, { color: colors.text }]} numberOfLines={1}>
                        {item.story.title}
                      </Text>
                      <Text style={[styles.modalItemSub, { color: colors.textSecondary }]}>
                        {item.status} • Ch. {item.currentChapter}
                      </Text>
                    </View>
                    <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={isConfirmVisible}
        title={confirmConfig?.title || ''}
        message={confirmConfig?.message || ''}
        onConfirm={() => {
          confirmConfig?.onConfirm();
          setIsConfirmVisible(false);
        }}
        onCancel={() => setIsConfirmVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  immersiveHeaderContainer: {
    paddingTop: 50,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: Spacing.lg,
  },
  immersiveBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  floatingHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: 40,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  heroInfoContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 30,
    alignItems: 'center',
  },
  glowAccent: {
    width: 40,
    height: 6,
    borderRadius: 3,
    marginBottom: Spacing.md,
    opacity: 0.8,
    ...Shadows.md,
  },
  heroName: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: Spacing.xs,
    letterSpacing: -0.5,
  },
  heroDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    opacity: 0.8,
  },
  glassStatBar: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  glassBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  glassBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  stickyToolbar: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
    marginBottom: Spacing.md,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  toolbarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
  },
  minimalControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  minimalText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  premiumAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    ...Shadows.md,
  },
  premiumAddText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  libListCard: {
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    marginHorizontal: Spacing.lg,
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
  removeBtn: { padding: Spacing.sm },
  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22 },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '70%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalList: { paddingBottom: 40 },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
  },
  modalCover: { width: 45, height: 60, borderRadius: BorderRadius.sm },
  modalItemInfo: { flex: 1, marginLeft: Spacing.md },
  modalItemTitle: { fontSize: 14, fontWeight: '700' },
  modalItemSub: { fontSize: 12, marginTop: 2 },
  modalEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalEmptyText: { textAlign: 'center', fontSize: 14 },
});
