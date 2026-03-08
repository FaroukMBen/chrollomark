import { Image } from 'expo-image';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
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
      const data = await api.getCollection(id);
      setCollection(data);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <IconSymbol name="arrow.left" size={24} color={colors.text} />
        </TouchableOpacity>
        
        <View style={styles.headerActions}>
           {isOwner && (
            <>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push({ pathname: '/collection/edit', params: { id } })}>
                <IconSymbol name="pencil" size={20} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionBtn}
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
                <IconSymbol name="trash" size={20} color={colors.error} />
              </TouchableOpacity>
            </>
          )}
          {!isOwner && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={async () => {
                try {
                  await api.cloneCollection(id);
                  showToast({ message: 'Collection cloned successfully!', type: 'success' });
                  router.push('/(tabs)/library' as any);
                } catch (error: any) {
                  showToast({ message: error.message, type: 'error' });
                }
              }}>
              <IconSymbol name="plus.square.on.square" size={20} color={colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Collection Info */}
        <View style={styles.info}>
          <View style={[styles.colorStrip, { backgroundColor: collection.color || colors.primary }]} />
          <Text style={[styles.name, { color: colors.text }]}>{collection.name}</Text>
          {collection.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {collection.description}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <View style={[styles.metaBadge, { backgroundColor: colors.surfaceElevated }]}>
              <IconSymbol name={collection.isPublic ? 'globe' : 'lock.fill'} size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {collection.isPublic ? 'Public' : 'Private'}
              </Text>
            </View>
            <View style={[styles.metaBadge, { backgroundColor: colors.surfaceElevated }]}>
              <IconSymbol name="books.vertical.fill" size={12} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {collection.stories?.length || 0} stories
              </Text>
            </View>
          </View>
        </View>

        {/* List Header / Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.sortBtn} onPress={toggleSort}>
            <IconSymbol name={getSortIcon() as any} size={16} color={colors.primary} />
            <Text style={[styles.sortText, { color: colors.primary }]}>
              {sortBy === 'az' ? 'A-Z' : sortBy === 'za' ? 'Z-A' : sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
            </Text>
          </TouchableOpacity>

          {isOwner && (
             <TouchableOpacity
             style={[styles.addStoriesBtn, { backgroundColor: colors.primary }]}
             onPress={() => {
               loadLibrary();
               setIsManageModalVisible(true);
             }}>
             <IconSymbol name="plus" size={14} color="#FFF" />
             <Text style={styles.addStoriesText}>Add Stories</Text>
           </TouchableOpacity>
          )}
        </View>

        {/* Stories */}
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
          sortedStories.map((story: any) => (
            <TouchableOpacity
              key={story._id}
              style={[styles.storyItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
              onPress={() => router.push(`/story/${story._id}` as any)}>
              {story.coverImage ? (
                <Image source={{ uri: story.coverImage }} style={styles.storyCover} contentFit="cover" />
              ) : (
                <View style={[styles.storyCover, styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
                  <IconSymbol name="book.fill" size={24} color={colors.textSecondary} />
                </View>
              )}
              <View style={styles.storyInfo}>
                <Text style={[styles.storyTitle, { color: colors.text }]} numberOfLines={1}>
                  {story.title}
                </Text>
                <View style={styles.storyMeta}>
                  <Text style={[styles.storyType, { color: colors.primary }]}>{story.type}</Text>
                  <Text style={[styles.dot, { color: colors.textSecondary }]}>•</Text>
                  <Text style={[styles.storyAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
                    {story.author || 'Unknown'}
                  </Text>
                </View>
              </View>
              {isOwner && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveFromCollection(story._id)}>
                  <IconSymbol name="minus.circle.fill" size={20} color={colors.error} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}
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
                    <Image source={{ uri: item.story.coverImage }} style={styles.modalCover} contentFit="cover" />
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  headerActions: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  info: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  colorStrip: { width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  name: { fontSize: 28, fontWeight: '800', marginBottom: Spacing.sm },
  description: { fontSize: 14, lineHeight: 22, marginBottom: Spacing.md },
  metaRow: { flexDirection: 'row', gap: Spacing.sm },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  metaText: { fontSize: 12, fontWeight: '600' },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sortText: { fontSize: 14, fontWeight: '700' },
  addStoriesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
  },
  addStoriesText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  storyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  storyCover: { width: 55, height: 80, borderRadius: BorderRadius.md },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  storyInfo: { flex: 1, marginLeft: Spacing.md },
  storyTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  storyMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  storyType: { fontSize: 11, fontWeight: '800' },
  dot: { fontSize: 12 },
  storyAuthor: { fontSize: 12, flex: 1 },
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
