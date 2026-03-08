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

import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useToast } from '@/store/ToastContext';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'collections' | 'mutual'>('progress');
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [profileData, collectionsData] = await Promise.all([
        api.getUserProfile(id),
        api.getUserCollections(id),
      ]);
      setProfile(profileData);
      setCollections(collectionsData);
      setMutualFriends(profileData.mutualFriends || []);

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

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setIsConfirmVisible(true);
  };

  const handleAction = async (action: 'send' | 'cancel' | 'accept' | 'decline' | 'remove') => {
    try {
      if (action === 'send') await api.sendFriendRequest(id);
      else if (action === 'cancel' || action === 'decline') await api.cancelFriendRequest(profile.requestStatus.requestId);
      else if (action === 'accept') await api.respondToFriendRequest(profile.requestStatus.requestId, 'accept');
      else if (action === 'remove') await api.removeFriend(id);
      
      await loadData();
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const cloneCollection = async (collectionId: string, name: string) => {
    try {
      await api.cloneCollection(collectionId);
      showToast({ message: `Collection "${name}" cloned!`, type: 'success' });
      router.push('/(tabs)/library' as any);
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

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
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <IconSymbol name="arrow.left" size={24} color={colors.text} />
      </TouchableOpacity>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>


        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {profile.user?.avatar ? (
            <Image source={{ uri: profile.user.avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarText}>
                {profile.user?.username?.[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={[styles.name, { color: colors.text }]}>{profile.user?.username}</Text>
          {profile.user?.bio ? (
            <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile.user.bio}</Text>
          ) : null}

          {/* Stats Cards Row */}
          <View style={styles.statsRow}>
            {[
              { label: 'Stories', value: profile.stats.totalStories, color: colors.primary, icon: 'book.fill' as const },
              { label: 'Completed', value: profile.stats.completed, color: StatusColors.Completed, icon: 'checkmark.circle.fill' as const },
              { label: 'Chapters', value: profile.stats.totalChaptersRead, color: colors.accent, icon: 'doc.text.fill' as const },
              { label: 'Friends', value: profile.friendCount, color: colors.success, icon: 'person.2.fill' as const },
            ].map((stat, i) => (
              <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <View style={[styles.statIconBg, { backgroundColor: stat.color + '15' }]}>
                  <IconSymbol name={stat.icon} size={12} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Friendship Status */}
          <View style={styles.actionRow}>
            {profile.isFriend ? (
              <>
                <View style={[styles.friendBadge, { backgroundColor: colors.success + '15' }]}>
                  <IconSymbol name="checkmark.circle.fill" size={16} color={colors.success} />
                  <Text style={[styles.friendBadgeText, { color: colors.success }]}>Friends</Text>
                </View>
                <TouchableOpacity
                  style={[styles.removeFriendBtn, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}
                  onPress={() => showConfirm('Remove Friend', `Are you sure you want to remove ${profile.user.username}?`, () => handleAction('remove'))}>
                  <IconSymbol name="person.badge.minus" size={18} color={colors.error} />
                  <Text style={[styles.removeFriendText, { color: colors.error }]}>Remove</Text>
                </TouchableOpacity>
              </>
            ) : profile.requestStatus?.sent ? (
              <TouchableOpacity
                style={[styles.addFriendBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary }]}
                onPress={() => handleAction('cancel')}>
                <IconSymbol name="xmark" size={18} color={colors.primary} />
                <Text style={[styles.addFriendText, { color: colors.primary }]}>Cancel Request</Text>
              </TouchableOpacity>
            ) : profile.requestStatus?.received ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}
                  onPress={() => handleAction('accept')}>
                  <IconSymbol name="checkmark" size={18} color="#FFF" />
                  <Text style={styles.addFriendText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.addFriendBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                  onPress={() => handleAction('decline')}>
                  <Text style={[styles.addFriendText, { color: colors.textSecondary }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}
                onPress={() => handleAction('send')}>
                <IconSymbol name="person.badge.plus" size={18} color="#FFF" />
                <Text style={styles.addFriendText}>Add Friend</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

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

        {/* Tabs */}
        <View style={[styles.tabs, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'progress' && { backgroundColor: colors.surface }]}
            onPress={() => setActiveTab('progress')}>
            <IconSymbol 
              name="book.fill" 
              size={14} 
              color={activeTab === 'progress' ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, { color: activeTab === 'progress' ? colors.text : colors.textSecondary }]}>
              Reading
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'collections' && { backgroundColor: colors.surface }]}
            onPress={() => setActiveTab('collections')}>
            <IconSymbol 
              name="folder.fill" 
              size={14} 
              color={activeTab === 'collections' ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, { color: activeTab === 'collections' ? colors.text : colors.textSecondary }]}>
              Collections
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'mutual' && { backgroundColor: colors.surface }]}
            onPress={() => setActiveTab('mutual')}>
            <IconSymbol 
              name="person.2.fill" 
              size={14} 
              color={activeTab === 'mutual' ? colors.primary : colors.textSecondary} 
            />
            <Text style={[styles.tabText, { color: activeTab === 'mutual' ? colors.text : colors.textSecondary }]}>
              Mutual {mutualFriends.length > 0 && `(${mutualFriends.length})`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'progress' && (
            profile.isFriend ? (
              progress.length === 0 ? (
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
            ) : (
              <View style={styles.locked}>
                <IconSymbol name="lock.fill" size={32} color={colors.textSecondary} />
                <Text style={[styles.lockedText, { color: colors.textSecondary }]}>
                  Add as friend to see their reading progress
                </Text>
              </View>
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
                  <TouchableOpacity
                    style={[styles.cloneBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
                    onPress={() => cloneCollection(collection._id, collection.name)}
                  >
                    <IconSymbol name="plus.square.on.square" size={16} color={colors.primary} />
                  </TouchableOpacity>
                  <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )
          )}

          {activeTab === 'mutual' && (
            mutualFriends.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No mutual friends
              </Text>
            ) : (
              mutualFriends.map((friend: any) => (
                <TouchableOpacity
                  key={friend._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => {
                    router.push(`/user/${friend._id}` as any);
                  }}>
                   {friend.avatar ? (
                    <Image source={{ uri: friend.avatar }} style={styles.avatarMini} contentFit="cover" />
                  ) : (
                    <View style={[styles.avatarMini, { backgroundColor: colors.primary + '30' }]}>
                      <Text style={[styles.avatarMiniText, { color: colors.primary }]}>{friend.username?.[0]?.toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={styles.userInfo}>
                    <Text style={[styles.userNameMini, { color: colors.text }]}>{friend.username}</Text>
                    <Text style={[styles.userBioMini, { color: colors.textSecondary }]} numberOfLines={1}>
                      {friend.bio || 'No bio'}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
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
  backButton: { position: 'absolute', top: 50, left: Spacing.md, zIndex: 10, padding: 8, borderRadius: 20 },
  profileHeader: { alignItems: 'center', paddingTop: Spacing.md, paddingBottom: Spacing.xs },
  avatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.xs },
  avatarText: { color: '#FFF', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  bio: { fontSize: 12, textAlign: 'center', paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm, lineHeight: 16 },
  statsRow: { flexDirection: 'row', gap: 6, paddingHorizontal: Spacing.lg, marginVertical: Spacing.xs },
  statCard: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: 2,
  },
  statIconBg: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '800' },
  statLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  actionRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  friendBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full },
  friendBadgeText: { fontSize: 14, fontWeight: '800' },
  addFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: 'transparent' },
  addFriendText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  removeFriendBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.full, borderWidth: 1 },
  removeFriendText: { fontSize: 14, fontWeight: '700' },
  tabs: { 
    flexDirection: 'row', 
    marginHorizontal: Spacing.lg, 
    borderRadius: BorderRadius.lg, 
    padding: 4,
    borderWidth: 1,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  tab: { 
    flex: 1, 
    paddingVertical: 10, 
    alignItems: 'center', 
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    borderRadius: BorderRadius.md,
  },
  tabText: { fontSize: 12, fontWeight: '800' },
  content: { paddingHorizontal: Spacing.lg },
  locked: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  lockedText: { fontSize: 14, textAlign: 'center', fontWeight: '500' },
  progressItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  progressCover: { width: 50, height: 70, borderRadius: BorderRadius.sm },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  progressInfo: { flex: 1, marginLeft: Spacing.md },
  progressTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  progressMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: '800' },
  chapterText: { fontSize: 12, fontWeight: '800' },
  collectionItem: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  collectionColor: { width: 6, height: 36, borderRadius: 3, marginRight: Spacing.md },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 15, fontWeight: '700' },
  collectionCount: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  cloneBtn: {
    padding: 8,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    marginRight: Spacing.sm,
  },
  userCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.sm, borderWidth: 1 },
  avatarMini: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarMiniText: { fontSize: 16, fontWeight: '800' },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userNameMini: { fontSize: 14, fontWeight: '700' },
  userBioMini: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingTop: 60, fontWeight: '500' },
});
