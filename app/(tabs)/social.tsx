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
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

const timeAgo = (date: string) => {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
};

export default function SocialScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'friends' | 'requests' | 'search'>('activity');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [friendsData, requestsData, feedData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getFeed().catch(() => ({ feed: [], recommendations: [] })),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
      setFeed(feedData.feed || []);
      setRecommendations(feedData.recommendations || []);
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const searchUsers = async () => {
    if (searchQuery.length < 2) return;
    try {
      const data = await api.searchUsers(searchQuery);
      setSearchResults(data);
    } catch (error) {
      console.log('Search error:', error);
    }
  };

  const sendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      showToast({ message: 'Friend request sent!', type: 'success' });
      setSearchResults((prev) => prev.filter((u) => u._id !== userId));
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await api.respondToFriendRequest(requestId, action);
      showToast({ message: action === 'accept' ? 'Friend added!' : 'Request declined', type: action === 'accept' ? 'success' : 'info' });
      await loadData();
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="person.2.fill" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
            Sign in to connect with friends
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const tabs = [
    { key: 'activity' as const, label: 'Activity', count: null, icon: 'flame.fill' },
    { key: 'friends' as const, label: 'Friends', count: friends.length, icon: 'person.2.fill' },
    { key: 'requests' as const, label: 'Requests', count: requests.length, icon: 'envelope.fill' },
    { key: 'search' as const, label: 'Search', count: null, icon: 'magnifyingglass' },
  ];

  // --- Feed renderers ---
  const renderReviewItem = (item: any) => (
    <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.feedHeader}>
        <View style={[styles.feedAvatar, { backgroundColor: colors.primary + '30' }]}>
          <Text style={[styles.feedAvatarText, { color: colors.primary }]}>
            {item.user?.username?.[0]?.toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
          <Text style={[styles.feedAction, { color: colors.textSecondary }]}>reviewed a story</Text>
        </View>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </View>

      <TouchableOpacity
        style={[styles.feedStoryCard, { backgroundColor: colors.surfaceElevated }]}
        onPress={() => item.story && router.push(`/story/${item.story._id}` as any)}
        activeOpacity={0.7}>
        {item.story?.coverImage ? (
          <Image source={{ uri: item.story.coverImage }} style={styles.feedStoryCover} contentFit="cover" />
        ) : (
          <View style={[styles.feedStoryCover, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
            <IconSymbol name="book.fill" size={20} color={colors.textSecondary} />
          </View>
        )}
        <View style={styles.feedStoryInfo}>
          <Text style={[styles.feedStoryTitle, { color: colors.text }]} numberOfLines={1}>
            {item.story?.title || 'Unknown'}
          </Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Text key={star} style={{ fontSize: 14, color: star <= item.rating ? colors.accent : colors.textSecondary + '40' }}>
                ★
              </Text>
            ))}
          </View>
          {item.text ? (
            <Text style={[styles.feedReviewText, { color: colors.textSecondary }]} numberOfLines={3}>
              "{item.text}"
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderProgressItem = (item: any) => {
    const statusColor = StatusColors[item.status] || colors.primary;
    const actionVerb = item.status === 'Completed' ? 'completed' :
                       item.status === 'Reading' ? 'is reading' :
                       item.status === 'Plan to Read' ? 'plans to read' :
                       item.status === 'On Hold' ? 'put on hold' : 'dropped';

    return (
      <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <View style={styles.feedHeader}>
          <View style={[styles.feedAvatar, { backgroundColor: statusColor + '30' }]}>
            <Text style={[styles.feedAvatarText, { color: statusColor }]}>
              {item.user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
            <Text style={[styles.feedAction, { color: colors.textSecondary }]}>{actionVerb}</Text>
          </View>
          <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
        </View>

        <TouchableOpacity
          style={[styles.feedStoryRow, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => item.story && router.push(`/story/${item.story._id}` as any)}
          activeOpacity={0.7}>
          {item.story?.coverImage ? (
            <Image source={{ uri: item.story.coverImage }} style={styles.feedStoryThumb} contentFit="cover" />
          ) : (
            <View style={[styles.feedStoryThumb, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
              <IconSymbol name="book.fill" size={16} color={colors.textSecondary} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={[styles.feedStoryTitle, { color: colors.text }]} numberOfLines={1}>
              {item.story?.title || 'Unknown'}
            </Text>
            <View style={styles.feedProgressMeta}>
              <View style={[styles.feedStatusPill, { backgroundColor: statusColor + '20' }]}>
                <Text style={[styles.feedStatusText, { color: statusColor }]}>{item.status}</Text>
              </View>
              {item.currentChapter > 0 && (
                <Text style={[styles.feedChapter, { color: colors.textSecondary }]}>Ch. {item.currentChapter}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Social</Text>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabContainer}>
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.primary + '15' : 'transparent',
                  borderColor: isActive ? colors.primary : 'transparent',
                },
              ]}
              onPress={() => setActiveTab(tab.key)}>
              <IconSymbol name={tab.icon as any} size={15} color={isActive ? colors.primary : colors.textSecondary} />
              <Text style={[styles.tabText, { color: isActive ? colors.primary : colors.textSecondary }]}>
                {tab.label}
              </Text>
              {tab.count !== null && tab.count > 0 && (
                <View style={[styles.tabBadge, { backgroundColor: isActive ? colors.primary : colors.textSecondary }]}>
                  <Text style={styles.tabBadgeText}>{tab.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.content}>

          {/* ===  ACTIVITY TAB  === */}
          {activeTab === 'activity' && (
            <>
              {/* Recommendations */}
              {recommendations.length > 0 && (
                <View style={styles.recoSection}>
                  <View style={styles.recoHeader}>
                    <IconSymbol name="sparkles" size={18} color={colors.accent} />
                    <Text style={[styles.recoTitle, { color: colors.text }]}>Recommended by Friends</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recoList}>
                    {recommendations.map((rec) => (
                      <TouchableOpacity
                        key={rec.story._id}
                        style={[styles.recoCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                        onPress={() => router.push(`/story/${rec.story._id}` as any)}
                        activeOpacity={0.7}>
                        {rec.story.coverImage ? (
                          <Image source={{ uri: rec.story.coverImage }} style={styles.recoCover} contentFit="cover" />
                        ) : (
                          <View style={[styles.recoCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                            <IconSymbol name="book.fill" size={24} color={colors.textSecondary} />
                          </View>
                        )}
                        <Text style={[styles.recoStoryTitle, { color: colors.text }]} numberOfLines={2}>
                          {rec.story.title}
                        </Text>
                        <View style={styles.recoFriends}>
                          <IconSymbol name="person.2.fill" size={11} color={colors.primary} />
                          <Text style={[styles.recoFriendsText, { color: colors.primary }]}>
                            {rec.friendCount} {rec.friendCount === 1 ? 'friend' : 'friends'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {/* Feed */}
              {feed.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                    <IconSymbol name="flame.fill" size={40} color={colors.textSecondary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No activity yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Add friends to see their reading activity, reviews, and recommendations
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={[styles.feedSectionTitle, { color: colors.textSecondary }]}>RECENT ACTIVITY</Text>
                  {feed.map((item) => {
                    if (item.type === 'review') return renderReviewItem(item);
                    if (item.type === 'progress') return renderProgressItem(item);
                    return null;
                  })}
                </>
              )}
            </>
          )}

          {/* ===  FRIENDS TAB  === */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                  <IconSymbol name="person.2.fill" size={40} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No friends yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  Search for users to send friend requests
                </Text>
                <TouchableOpacity
                  style={[styles.emptyBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab('search')}
                  activeOpacity={0.8}>
                  <IconSymbol name="magnifyingglass" size={16} color="#FFF" />
                  <Text style={styles.emptyBtnText}>Find Friends</Text>
                </TouchableOpacity>
              </View>
            ) : (
              friends.map((friend) => (
                <TouchableOpacity
                  key={friend._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => router.push(`/user/${friend._id}` as any)}
                  activeOpacity={0.7}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {friend.username?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{friend.username}</Text>
                    <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                      {friend.bio || 'No bio'}
                    </Text>
                  </View>
                  <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                </TouchableOpacity>
              ))
            )
          )}

          {/* ===  REQUESTS TAB  === */}
          {activeTab === 'requests' && (
            requests.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                  <IconSymbol name="envelope.fill" size={40} color={colors.textSecondary} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No pending requests</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  You will see friend requests here
                </Text>
              </View>
            ) : (
              requests.map((request) => (
                <View
                  key={request._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.accent + '30' }]}>
                    <Text style={[styles.avatarText, { color: colors.accent }]}>
                      {request.from.username?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>
                      {request.from.username}
                    </Text>
                    <View style={styles.requestActions}>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                        onPress={() => respondToRequest(request._id, 'accept')}
                        activeOpacity={0.8}>
                        <IconSymbol name="checkmark" size={14} color="#FFF" />
                        <Text style={styles.actionBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => respondToRequest(request._id, 'decline')}
                        activeOpacity={0.8}>
                        <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )
          )}

          {/* ===  SEARCH TAB  === */}
          {activeTab === 'search' && (
            <>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="magnifyingglass" size={18} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by username..."
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={searchUsers}
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                    <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {searchResults.length === 0 && searchQuery.length === 0 && (
                <View style={styles.emptyState}>
                  <IconSymbol name="magnifyingglass" size={40} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
                    Search for users by their username
                  </Text>
                </View>
              )}
              {searchResults.map((user) => (
                <View
                  key={user._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>{user.username?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{user.username}</Text>
                    <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                      {user.bio || 'No bio'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}
                    onPress={() => sendRequest(user._id)}
                    activeOpacity={0.8}>
                    <IconSymbol name="person.badge.plus" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  title: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  tabScroll: { maxHeight: 50, marginBottom: Spacing.sm },
  tabContainer: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  tabText: { fontSize: 13, fontWeight: '600' },
  tabBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  tabBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '800' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },

  // --- Feed Styles ---
  feedSectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: Spacing.md, marginTop: Spacing.sm },
  feedCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
  },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  feedAvatarText: { fontSize: 15, fontWeight: '800' },
  feedUserName: { fontSize: 14, fontWeight: '700' },
  feedAction: { fontSize: 12 },
  feedTime: { fontSize: 11 },
  feedStoryCard: { borderRadius: BorderRadius.md, overflow: 'hidden', padding: Spacing.sm },
  feedStoryCover: { width: '100%', height: 120, borderRadius: BorderRadius.sm, marginBottom: Spacing.sm },
  feedStoryInfo: { gap: 4 },
  feedStoryTitle: { fontSize: 14, fontWeight: '700' },
  feedReviewText: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 4 },
  starsRow: { flexDirection: 'row', gap: 2 },
  feedStoryRow: { flexDirection: 'row', borderRadius: BorderRadius.md, padding: Spacing.sm, gap: Spacing.sm, alignItems: 'center' },
  feedStoryThumb: { width: 48, height: 65, borderRadius: BorderRadius.sm },
  feedProgressMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  feedStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  feedStatusText: { fontSize: 10, fontWeight: '700' },
  feedChapter: { fontSize: 12, fontWeight: '600' },

  // --- Recommendations ---
  recoSection: { marginBottom: Spacing.lg },
  recoHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md },
  recoTitle: { fontSize: 16, fontWeight: '700' },
  recoList: { gap: Spacing.md },
  recoCard: { width: 130, borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden' },
  recoCover: { width: '100%', height: 175 },
  recoStoryTitle: { fontSize: 13, fontWeight: '700', paddingHorizontal: 8, paddingTop: 8, height: 50, lineHeight: 17 },
  recoFriends: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 10 },
  recoFriendsText: { fontSize: 11, fontWeight: '600' },

  // --- User Cards ---
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  avatar: { width: 48, height: 48, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userName: { fontSize: 15, fontWeight: '700' },
  userBio: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  requestActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15 },
  addFriendBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: Spacing.xl },
  emptyIconBg: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.lg,
    ...Shadows.sm,
  },
  emptyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
});
