import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'collections'>('progress');

  const loadData = useCallback(async () => {
    try {
      const [profileData, collectionsData] = await Promise.all([
        api.getUserProfile(id),
        api.getUserCollections(id),
      ]);
      setProfile(profileData);
      setCollections(collectionsData);

      // Try to load progress (requires friendship)
      try {
        const progressData = await api.getUserProgress(id);
        setProgress(progressData);
      } catch {
        // Not friends, can't see progress
      }
    } catch (error) {
      console.log('Error:', error);
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

  if (!profile) return null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <IconSymbol name="arrow.left" size={24} color={colors.text} />
        </TouchableOpacity>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {profile.user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>{profile.user?.username}</Text>
          {profile.user?.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.user.bio}</Text>
          ) : null}

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{profile.stats?.totalStories || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Stories</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.success }]}>{profile.stats?.completed || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Completed</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.accent }]}>{profile.stats?.totalChaptersRead || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Chapters</Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{profile.friendCount || 0}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Friends</Text>
            </View>
          </View>

          {/* Friendship Status */}
          {profile.isFriend ? (
            <View style={[styles.friendBadge, { backgroundColor: colors.success + '20' }]}>
              <Text style={[styles.friendBadgeText, { color: colors.success }]}>✓ Friends</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}
              onPress={async () => {
                try {
                  await api.sendFriendRequest(id);
                  loadData();
                } catch (error: any) {
                  console.log(error.message);
                }
              }}>
              <IconSymbol name="person.badge.plus" size={18} color="#FFF" />
              <Text style={styles.addFriendText}>Add Friend</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('progress')}>
            <Text style={[styles.tabText, { color: activeTab === 'progress' ? colors.primary : colors.textSecondary }]}>
              Reading
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'collections' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab('collections')}>
            <Text style={[styles.tabText, { color: activeTab === 'collections' ? colors.primary : colors.textSecondary }]}>
              Collections ({collections.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'progress' && (
            !profile.isFriend ? (
              <View style={styles.locked}>
                <IconSymbol name="lock.fill" size={32} color={colors.textSecondary} />
                <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
                  Add as friend to see their reading progress
                </Text>
              </View>
            ) : progress.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No reading progress to show
              </Text>
            ) : (
              progress.map((item: any) => (
                <TouchableOpacity
                  key={item._id}
                  style={[styles.progressItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => router.push(`/story/${item.story._id}` as any)}>
                  {item.story.coverImage ? (
                    <Image source={{ uri: item.story.coverImage }} style={styles.progressCover} contentFit="cover" />
                  ) : (
                    <View style={[styles.progressCover, styles.placeholderCover, { backgroundColor: colors.surfaceElevated }]}>
                      <IconSymbol name="book.fill" size={24} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.progressInfo}>
                    <Text style={[styles.progressTitle, { color: colors.text }]} numberOfLines={1}>{item.story.title}</Text>
                    <View style={styles.progressMeta}>
                      <View style={[styles.statusBadge, { backgroundColor: (StatusColors[item.status] || colors.primary) + '20' }]}>
                        <Text style={[styles.statusText, { color: StatusColors[item.status] || colors.primary }]}>{item.status}</Text>
                      </View>
                      <Text style={[styles.chapterText, { color: colors.primary }]}>Ch. {item.currentChapter}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )
          )}

          {activeTab === 'collections' && (
            collections.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No public collections
              </Text>
            ) : (
              collections.map((collection: any) => (
                <TouchableOpacity
                  key={collection._id}
                  style={[styles.collectionItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => router.push(`/collection/${collection._id}` as any)}>
                  <View style={[styles.collectionColor, { backgroundColor: collection.color || colors.primary }]} />
                  <View style={styles.collectionInfo}>
                    <Text style={[styles.collectionName, { color: colors.text }]}>{collection.name}</Text>
                    <Text style={[styles.collectionCount, { color: colors.textSecondary }]}>
                      {collection.stories?.length || 0} stories
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingBottom: 60 },
  backButton: { padding: Spacing.lg },
  profileHeader: { alignItems: 'center', paddingBottom: Spacing.lg },
  avatar: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  bio: { fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  statsRow: { flexDirection: 'row', gap: Spacing.xl, marginVertical: Spacing.md },
  stat: { alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2 },
  friendBadge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: BorderRadius.full },
  friendBadgeText: { fontSize: 14, fontWeight: '700' },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: BorderRadius.full },
  addFriendText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  tabs: { flexDirection: 'row', marginHorizontal: Spacing.lg, borderBottomWidth: 1, marginBottom: Spacing.md },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '700' },
  content: { paddingHorizontal: Spacing.lg },
  locked: { alignItems: 'center', paddingTop: 40, gap: Spacing.md },
  lockedText: { fontSize: 14, textAlign: 'center' },
  progressItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1 },
  progressCover: { width: 50, height: 70, borderRadius: BorderRadius.sm },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  progressInfo: { flex: 1, marginLeft: Spacing.md },
  progressTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 11, fontWeight: '700' },
  chapterText: { fontSize: 12, fontWeight: '700' },
  collectionItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm, borderWidth: 1 },
  collectionColor: { width: 6, height: 36, borderRadius: 3, marginRight: Spacing.md },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 15, fontWeight: '700' },
  collectionCount: { fontSize: 12, marginTop: 2 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 40 },
});
