import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';

export default function CollectionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [collection, setCollection] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  if (!collection) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="arrow.left" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Alert.alert('Delete Collection', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await api.deleteCollection(id);
                    router.back();
                  },
                },
              ]);
            }}>
            <IconSymbol name="trash" size={22} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Collection Info */}
        <View style={styles.info}>
          <View style={[styles.colorStrip, { backgroundColor: collection.color || colors.primary }]} />
          <Text style={[styles.name, { color: colors.text }]}>{collection.name}</Text>
          {collection.description ? (
            <Text style={[styles.description, { color: colors.textSecondary }]}>
              {collection.description}
            </Text>
          ) : null}
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {collection.stories?.length || 0} stories • {collection.isPublic ? 'Public' : 'Private'}
          </Text>
        </View>

        {/* Stories */}
        {collection.stories?.length === 0 ? (
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <IconSymbol name="books.vertical.fill" size={40} color={colors.textSecondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              Collection is empty
            </Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Add stories from the Explore page or from a story's detail page using the "Collection" button.
            </Text>
            <View style={styles.emptyActions}>
              <TouchableOpacity
                style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/explore')}>
                <IconSymbol name="globe" size={16} color="#FFF" />
                <Text style={styles.emptyBtnText}>Browse MangaDex</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.emptyBtnOutline, { borderColor: colors.primary }]}
                onPress={() => router.push('/(tabs)/library')}>
                <IconSymbol name="books.vertical.fill" size={16} color={colors.primary} />
                <Text style={[styles.emptyBtnOutlineText, { color: colors.primary }]}>My Library</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          collection.stories?.map((story: any) => (
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
                <Text style={[styles.storyType, { color: colors.primary }]}>{story.type}</Text>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await api.removeFromCollection(id, story._id);
                    setCollection((prev: any) => ({
                      ...prev,
                      stories: prev.stories.filter((s: any) => s._id !== story._id),
                    }));
                  } catch (error: any) {
                    Alert.alert('Error', error.message);
                  }
                }}>
                <IconSymbol name="xmark" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
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
    padding: Spacing.lg,
  },
  info: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
  colorStrip: { width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.md },
  name: { fontSize: 28, fontWeight: '800', marginBottom: Spacing.sm },
  description: { fontSize: 14, lineHeight: 22, marginBottom: Spacing.sm },
  meta: { fontSize: 13 },
  storyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  storyCover: { width: 50, height: 70, borderRadius: BorderRadius.sm },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  storyInfo: { flex: 1, marginLeft: Spacing.md },
  storyTitle: { fontSize: 15, fontWeight: '700' },
  storyType: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 50, paddingHorizontal: Spacing.xl },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: Spacing.lg },
  emptyActions: { flexDirection: 'row', gap: Spacing.sm },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  emptyBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },
  emptyBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  emptyBtnOutlineText: { fontSize: 13, fontWeight: '700' },
});
