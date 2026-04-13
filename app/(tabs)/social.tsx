import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSocket } from '@/store/SocketContext';
import { useToast } from '@/store/ToastContext';

const timeAgo = (date: string) => {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);

  // If same day, show time
  if (now.toDateString() === d.toDateString()) {
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // If yesterday or older, show date
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
};

export default function SocialScreen() {
  const { isAuthenticated, user: currentUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [sentRequests, setSentRequests] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'friends' | 'requests'>('activity');
  const [requestsTab, setRequestsTab] = useState<'received' | 'sent'>('received');
  const [isInviteModalVisible, setIsInviteModalVisible] = useState(false);
  const [seenFriendIds, setSeenFriendIds] = useState<Set<string>>(new Set());
  const [isConfirmVisible, setIsConfirmVisible] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Load seen friends from storage
  useEffect(() => {
    const loadSeen = async () => {
      try {
        const stored = await AsyncStorage.getItem('seen_friend_ids');
        if (stored) {
          setSeenFriendIds(new Set(JSON.parse(stored)));
        }
      } catch (e) { console.log(e); }
    };
    loadSeen();
  }, []);

  const markFriendAsSeen = async (friendId: string) => {
    if (seenFriendIds.has(friendId)) return;
    const next = new Set(seenFriendIds).add(friendId);
    setSeenFriendIds(next);
    try {
      await AsyncStorage.setItem('seen_friend_ids', JSON.stringify(Array.from(next)));
    } catch (e) { console.log(e); }
  };

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [friendsData, requestsData, sentRequestsData, feedData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getSentFriendRequests(),
        api.getFeed().catch(() => ({ feed: [] })),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
      setSentRequests(sentRequestsData);
      setFeed(feedData.feed || []);
      setRecommendations([]); // Removed recommendations functionality as requested
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  // Real-time social updates
  useEffect(() => {
    if (socket && isAuthenticated) {
      const refreshSignals = [
        'progress_update',
        'review_update',
        'collection_update',
        'recommendation_update',
        'friend_request_received',
        'friend_request_accepted',
        'user_updated'
      ];

      const handleUpdate = () => {
        // Refresh the whole feed and friends list
        loadData();
      };

      refreshSignals.forEach(signal => socket.on(signal, handleUpdate));

      return () => {
        refreshSignals.forEach(signal => socket.off(signal, handleUpdate));
      };
    }
  }, [socket, isAuthenticated, loadData]);

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

  const cancelRequest = async (requestId: string) => {
    try {
      await api.cancelFriendRequest(requestId);
      showToast({ message: 'Request cancelled', type: 'info' });
      await loadData();
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmConfig({ title, message, onConfirm });
    setIsConfirmVisible(true);
  };

  const removeFriend = async (friendId: string, username: string) => {
    try {
      await api.removeFriend(friendId);
      showToast({ message: `${username} removed from friends`, type: 'info' });
      await loadData();
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="person.2.fill" size={48} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: Spacing.md }]}>
            Sign in to connect with friends
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const newFriendsCount = friends.filter(f => !seenFriendIds.has(f._id)).length;

  const tabs = [
    { key: 'activity' as const, label: 'Activity', count: null, icon: 'flame.fill' },
    { key: 'friends' as const, label: 'Friends', count: newFriendsCount > 0 ? newFriendsCount : null, icon: 'person.2.fill' },
    { key: 'requests' as const, label: 'Requests', count: requests.length > 0 ? requests.length : null, icon: 'envelope.fill' },
  ];

  // ─── Activity type accent colors ───
  const ACTIVITY_ACCENT = {
    review:            { color: '#A78BFA', icon: 'star.fill' as const, label: 'REVIEW' },
    progress:          { color: '#34D399', icon: 'bookmark.fill' as const, label: 'PROGRESS' },
    grouped_progress:  { color: '#60A5FA', icon: 'list.bullet' as const, label: 'BULK UPDATE' },
    recommendation:    { color: '#FBBF24', icon: 'sparkles' as const, label: 'RECOMMENDED' },
    collection_update: { color: '#F97316', icon: 'folder.fill' as const, label: 'COLLECTION' },
    dev_log:           { color: '#8B5CF6', icon: 'wrench.and.screwdriver.fill' as const, label: 'UPDATE' },
  } as const;

  // ─── Shared avatar block ───
  const ActivityAvatar = ({ user, accentColor }: { user: any; accentColor: string }) => (
    user?.avatar ? (
      <Image source={{ uri: user.avatar }} style={styles.feedAvatar} contentFit="cover" />
    ) : (
      <View style={[styles.feedAvatar, { backgroundColor: accentColor + '25', borderWidth: 1.5, borderColor: accentColor + '50' }]}>
        <Text style={[styles.feedAvatarText, { color: accentColor }]}>
          {user?.username?.[0]?.toUpperCase()}
        </Text>
      </View>
    )
  );

  // ─── Review card ───
  const renderReviewItem = (item: any) => {
    const accent = ACTIVITY_ACCENT.review;
    return (
      <View key={item.id} style={[styles.actCard, { backgroundColor: colors.surface, borderColor: accent.color + '25' }]}>
        {/* Colored left strip */}
        <View style={[styles.actStrip, { backgroundColor: accent.color }]} />

        <View style={styles.actBody}>
          {/* Header row */}
          <TouchableOpacity
            style={styles.actHeader}
            onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
            activeOpacity={0.7}>
            <ActivityAvatar user={item.user} accentColor={accent.color} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.actUsername, { color: colors.text }]}>{item.user?.username}</Text>
                {item.user?._id === currentUser?._id && (
                  <View style={[styles.meBadge, { backgroundColor: accent.color + '20' }]}>
                    <Text style={[styles.meBadgeText, { color: accent.color }]}>YOU</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={[styles.actTypePill, { backgroundColor: accent.color + '18' }]}>
                  <IconSymbol name={accent.icon} size={8} color={accent.color} />
                  <Text style={[styles.actTypeLabel, { color: accent.color }]}>{accent.label}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.actTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>

          {/* Story banner */}
          <TouchableOpacity
            style={styles.reviewBanner}
            onPress={() => item.story && router.push(`/story/${item.story._id}` as any)}
            activeOpacity={0.8}>
            {item.story?.coverImage ? (
              <Image source={{ uri: item.story.coverImage }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
            ) : null}
            {/* Dark gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.75)', 'rgba(0,0,0,0.92)']}
              style={StyleSheet.absoluteFillObject}
            />
            <View style={styles.reviewBannerContent}>
              {/* Stars */}
              <View style={styles.starsRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                  {[1,2,3,4,5].map(s => (
                    <Text key={s} style={{ fontSize: 13, color: s <= item.rating ? '#FBBF24' : 'rgba(255,255,255,0.2)' }}>★</Text>
                  ))}
                  <Text style={styles.ratingNum}>{item.rating}/5</Text>
                </View>

                {/* Optional progress point for the review */}
                {(item.currentChapter > 0 || item.status === 'Completed') && (
                  <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ fontSize: 9, fontWeight: '900', color: '#FFF' }}>
                      {item.status === 'Completed' 
                        ? 'COMPLETED' 
                        : (item.story?.type === 'Anime' 
                           ? `S${item.currentSeason || 1} E${item.currentChapter}` 
                           : `CH. ${item.currentChapter}`)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.reviewBannerTitle} numberOfLines={1}>{item.story?.title || 'Unknown'}</Text>
              {item.text ? (
                <Text style={styles.reviewBannerQuote} numberOfLines={2}>"{item.text}"</Text>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Progress card ───
  const renderProgressItem = (item: any) => {
    const sColor = StatusColors[item.status] || colors.primary;
    const isAnime = item.story?.type === 'Anime';
    const actionVerb =
      item.status === 'Completed'    ? (isAnime ? 'finished watching' : 'finished reading') :
      item.status === 'Reading'      ? (isAnime ? 'is now watching' : 'is now reading') :
      item.status === 'Plan to Read' ? (isAnime ? 'added to their watchlist' : 'added to their list') :
      item.status === 'On Hold'      ? 'put on hold' : 'dropped';

    const totalCh = item.story?.totalChapters;
    const curCh   = item.currentChapter || 0;
    const pct     = totalCh ? Math.min(Math.round((curCh / totalCh) * 100), 100) : 0;

    return (
      <View key={item.id} style={[styles.actCard, { backgroundColor: colors.surface, borderColor: sColor + '20' }]}>
        <View style={[styles.actStrip, { backgroundColor: sColor }]} />

        <View style={styles.actBody}>
          <TouchableOpacity
            style={styles.actHeader}
            onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
            activeOpacity={0.7}>
            <ActivityAvatar user={item.user} accentColor={sColor} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.actUsername, { color: colors.text }]}>{item.user?.username}</Text>
                {item.user?._id === currentUser?._id && (
                  <View style={[styles.meBadge, { backgroundColor: sColor + '20' }]}>
                    <Text style={[styles.meBadgeText, { color: sColor }]}>YOU</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.actSubline, { color: colors.textSecondary }]}>{actionVerb}</Text>
            </View>
            <Text style={[styles.actTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.progressStoryRow, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => item.story && router.push(`/story/${item.story._id}` as any)}
            activeOpacity={0.8}>
            {/* Cover */}
            {item.story?.coverImage ? (
              <Image source={{ uri: item.story.coverImage }} style={styles.progressCover} contentFit="cover" />
            ) : (
              <View style={[styles.progressCover, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                <IconSymbol name="book.fill" size={18} color={colors.textSecondary} />
              </View>
            )}
            {/* Info */}
            <View style={styles.progressInfo}>
              <Text style={[styles.actTitle, { color: colors.text }]} numberOfLines={1}>
                {item.story?.title || 'Unknown'}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                <View style={[styles.feedStatusPill, { backgroundColor: sColor + '20' }]}>
                  <Text style={[styles.feedStatusText, { color: sColor }]}>{item.status}</Text>
                </View>
                {curCh > 0 && (
                  <Text style={[styles.progressChText, { color: colors.textSecondary }]}>
                    {item.story?.type === 'Anime' ? `S${item.currentSeason || 1} E${curCh}` : `Ch. ${curCh}`}
                    {totalCh ? ` / ${totalCh}` : ''}
                  </Text>
                )}
              </View>
              {/* Progress bar */}
              {totalCh ? (
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${pct}%` as any, backgroundColor: sColor }]} />
                </View>
              ) : null}
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Recommendation card ───
  const renderRecommendationItem = (item: any) => {
    const accent = ACTIVITY_ACCENT.recommendation;
    return (
      <View key={item.id} style={[styles.actCard, { backgroundColor: colors.surface, borderColor: accent.color + '35' }]}>
        <View style={[styles.actStrip, { backgroundColor: accent.color }]} />
        <LinearGradient
          colors={[accent.color + '0D', 'transparent']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.6 }}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.actBody}>
          <TouchableOpacity
            style={styles.actHeader}
            onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
            activeOpacity={0.7}>
            <ActivityAvatar user={item.user} accentColor={accent.color} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.actUsername, { color: colors.text }]}>{item.user?.username}</Text>
                {item.user?._id === currentUser?._id && (
                  <View style={[styles.meBadge, { backgroundColor: accent.color + '20' }]}>
                    <Text style={[styles.meBadgeText, { color: accent.color }]}>YOU</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={[styles.actTypePill, { backgroundColor: accent.color + '18' }]}>
                  <IconSymbol name={accent.icon} size={8} color={accent.color} />
                  <Text style={[styles.actTypeLabel, { color: accent.color }]}>{accent.label}</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.actTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.recoStoryRow}
            onPress={() => item.story && router.push(`/story/${item.story._id}` as any)}
            activeOpacity={0.8}>
            {item.story?.coverImage ? (
              <Image source={{ uri: item.story.coverImage }} style={styles.recoCover} contentFit="cover" />
            ) : (
              <View style={[styles.recoCover, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                <IconSymbol name="book.fill" size={20} color={colors.textSecondary} />
              </View>
            )}
            <View style={styles.recoInfo}>
              <View style={[styles.mustReadBadge, { backgroundColor: accent.color + '20', borderColor: accent.color + '40' }]}>
                <IconSymbol name="sparkles" size={9} color={accent.color} />
                <Text style={[styles.mustReadText, { color: accent.color }]}>MUST READ</Text>
              </View>
              <Text style={[styles.actTitle, { color: colors.text }]} numberOfLines={2}>
                {item.story?.title || 'Unknown'}
              </Text>
              <Text style={[styles.actSubline, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.story?.author || ''}
              </Text>
              {item.message ? (
                <View style={[styles.recoQuoteBox, { borderColor: accent.color + '30', backgroundColor: accent.color + '08' }]}>
                  <Text style={[styles.recoQuoteText, { color: colors.text }]} numberOfLines={3}>
                    "{item.message}"
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Grouped progress card ───
  const renderGroupedProgressItem = (item: any) => {
    const accent = ACTIVITY_ACCENT.grouped_progress;
    return (
      <View key={item.id} style={[styles.actCard, { backgroundColor: colors.surface, borderColor: accent.color + '25' }]}>
        <View style={[styles.actStrip, { backgroundColor: accent.color }]} />

        <View style={styles.actBody}>
          <TouchableOpacity
            style={styles.actHeader}
            onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
            activeOpacity={0.7}>
            <ActivityAvatar user={item.user} accentColor={accent.color} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.actUsername, { color: colors.text }]}>{item.user?.username}</Text>
                {item.user?._id === currentUser?._id && (
                  <View style={[styles.meBadge, { backgroundColor: accent.color + '20' }]}>
                    <Text style={[styles.meBadgeText, { color: accent.color }]}>YOU</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={[styles.actTypePill, { backgroundColor: accent.color + '18' }]}>
                  <IconSymbol name={accent.icon} size={8} color={accent.color} />
                  <Text style={[styles.actTypeLabel, { color: accent.color }]}>{item.itemsCount} TITLES UPDATED</Text>
                </View>
              </View>
            </View>
            <Text style={[styles.actTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>

          {/* Cover grid */}
          <View style={styles.groupGrid}>
            {(item.stories || []).slice(0, expandedGroups.has(item.id) ? undefined : 4).map((subItem: any, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={styles.groupGridCell}
                onPress={() => subItem.story?._id && router.push(`/story/${subItem.story._id}` as any)}
                activeOpacity={0.8}>
                {subItem.story?.coverImage ? (
                  <Image source={{ uri: subItem.story.coverImage }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
                ) : (
                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated, justifyContent: 'center', alignItems: 'center' }]}>
                    <IconSymbol name="book.fill" size={16} color={colors.textSecondary} />
                  </View>
                )}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.75)']}
                  style={StyleSheet.absoluteFillObject}
                />
                <View style={styles.groupCellLabel}>
                  <Text style={styles.groupCellTitle} numberOfLines={2}>
                    {subItem.story?.title}
                  </Text>
                  <Text style={[styles.groupCellCh, { color: accent.color }]}>
                    {subItem.status === 'Completed' 
                      ? '✓ Done' 
                      : (subItem.story?.type === 'Anime' 
                        ? `S${subItem.currentSeason || 1} E${subItem.currentChapter}` 
                        : `Ch.${subItem.currentChapter}`)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {item.itemsCount > 4 && (
            <TouchableOpacity
              style={[styles.moreActivityBtn, { borderTopWidth: 1, borderTopColor: colors.border + '30' }]}
              onPress={() => toggleGroup(item.id)}>
              <Text style={[styles.moreActivityText, { color: accent.color }]}>
                {expandedGroups.has(item.id)
                  ? 'Show less'
                  : `+ ${item.itemsCount - 4} more updates`}
              </Text>
              <IconSymbol
                name={expandedGroups.has(item.id) ? 'chevron.up' : 'chevron.down'}
                size={12}
                color={accent.color}
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ─── Collection update card ───
  const renderCollectionUpdateItem = (item: any) => {
    const accent = ACTIVITY_ACCENT.collection_update;
    return (
      <View key={item.id} style={[styles.actCard, { backgroundColor: colors.surface, borderColor: accent.color + '25' }]}>
        <View style={[styles.actStrip, { backgroundColor: accent.color }]} />

        <View style={styles.actBody}>
          <TouchableOpacity
            style={styles.actHeader}
            onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
            activeOpacity={0.7}>
            <ActivityAvatar user={item.user} accentColor={accent.color} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.actUsername, { color: colors.text }]}>{item.user?.username}</Text>
                {item.user?._id === currentUser?._id && (
                  <View style={[styles.meBadge, { backgroundColor: accent.color + '20' }]}>
                    <Text style={[styles.meBadgeText, { color: accent.color }]}>YOU</Text>
                  </View>
                )}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <View style={[styles.actTypePill, { backgroundColor: accent.color + '18' }]}>
                  <IconSymbol name={accent.icon} size={8} color={accent.color} />
                  <Text style={[styles.actTypeLabel, { color: accent.color }]}>
                    {item.isNew ? 'NEW COLLECTION' : 'COLLECTION'}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={[styles.actTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.collectionRowCard, { backgroundColor: colors.surfaceElevated, borderColor: accent.color + '30' }]}
            onPress={() => item.collectionId && router.push(`/collection/${item.collectionId}` as any)}
            activeOpacity={0.8}>
            <View style={[styles.collIconBg, { backgroundColor: accent.color + '18' }]}>
              <IconSymbol name="folder.fill" size={22} color={accent.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.actTitle, { color: colors.text }]} numberOfLines={1}>
                {item.name || 'A Collection'}
              </Text>
              <Text style={[styles.actSubline, { color: colors.textSecondary }]}>
                {item.isNew ? 'Just created' : 'Updated'} · Tap to explore
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // ─── Dev Log card ───
  const renderDevLogItem = (item: any) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.devLogCard, { borderColor: colors.primary + '35' }]}
      onPress={() => router.push('/profile/dev-log')}
      activeOpacity={0.9}>
      <LinearGradient
        colors={[colors.primary + '25', colors.primary + '08', 'transparent']}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />
      {/* Decorative corner glow */}
      <View style={[styles.devLogGlow, { backgroundColor: colors.primary }]} />

      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <View style={[styles.devLogBadge, { backgroundColor: colors.primary }]}>
          <IconSymbol name="wrench.and.screwdriver.fill" size={9} color="#FFF" />
          <Text style={styles.devLogBadgeText}>PATCH NOTES</Text>
        </View>
        <Text style={[styles.devLogDate, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </View>

      <Text style={[styles.devLogTitle, { color: colors.text }]} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={[styles.devLogSnippet, { color: colors.textSecondary }]} numberOfLines={2}>
        {item.content}
      </Text>

      <View style={[styles.devLogFooter, { borderTopColor: colors.primary + '25' }]}>
        <Text style={[styles.viewDevLogText, { color: colors.primary }]}>Read full notes</Text>
        <IconSymbol name="chevron.right" size={11} color={colors.primary} />
      </View>
    </TouchableOpacity>
  );
  
  const renderDateSeparator = (timestamp: string) => {
    const d = new Date(timestamp);
    const now = new Date();
    const yesterday = new Date();
    yesterday.setDate(now.getDate() - 1);

    let dateLabel = '';
    if (d.toDateString() === now.toDateString()) {
      dateLabel = 'Today';
    } else if (d.toDateString() === yesterday.toDateString()) {
      dateLabel = 'Yesterday';
    } else {
      dateLabel = d.toLocaleDateString([], { month: 'long', day: 'numeric', year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined });
    }

    return (
      <View key={`sep-${timestamp}`} style={styles.dateSeparator}>
        <Text style={[styles.dateSeparatorLabel, { color: colors.textSecondary }]}>{dateLabel.toUpperCase()}</Text>
        <View style={styles.dateSeparatorLine} />
      </View>
    );
  };


  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.fixedHeader}>
        <View style={styles.header}>
          <Text style={[styles.pageTitle, { color: colors.text }]}>Social</Text>
          <TouchableOpacity
            style={[styles.inviteBtn, { backgroundColor: colors.primary }]}
            onPress={() => setIsInviteModalVisible(true)}>
            <IconSymbol name="person.badge.plus" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>

        {/* Horizontal Sub-Navigation (Scrollable) */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={[styles.tabBar, { borderBottomColor: 'rgba(148, 163, 184, 0.1)' }]}
          contentContainerStyle={styles.tabBarContainer}
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <IconSymbol name={tab.icon as any} size={15} color={isActive ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.tabLabel, { color: isActive ? colors.text : colors.textSecondary }]}>
                    {tab.label}
                  </Text>
                  {tab.count !== null && (
                    <View style={[styles.tabCounter, { backgroundColor: isActive ? colors.primary : colors.textSecondary + '40' }]}>
                      <Text style={styles.tabCounterText}>{tab.count}</Text>
                    </View>
                  )}
                </View>
                {isActive && <View style={[styles.activeIndicator, { backgroundColor: colors.primary }]} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

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
              {feed.length === 0 ? (
                <View style={styles.emptyState}>
                  <View style={[styles.actEmptyIconWrap, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    <IconSymbol name="flame.fill" size={36} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>Your feed is quiet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Add friends to see their reading progress, reviews and recommendations here.
                  </Text>
                </View>
              ) : (
                <>
                  <View style={styles.feedSectionHeader}>
                    <Text style={[styles.feedSectionTitle, { color: colors.textSecondary }]}>RECENT ACTIVITY</Text>
                    <Text style={[styles.feedCountBadge, { color: colors.primary, backgroundColor: colors.primary + '15' }]}>
                      {feed.length}
                    </Text>
                  </View>
                  {(() => {
                    let lastDateString = '';
                    return feed.map((item) => {
                      const itemDate = new Date(item.timestamp);
                      const currentDateString = itemDate.toDateString();
                      const showSeparator = currentDateString !== lastDateString;
                      lastDateString = currentDateString;

                      return (
                        <View key={item.id}>
                          {showSeparator && renderDateSeparator(item.timestamp)}
                          {item.type === 'review' && renderReviewItem(item)}
                          {item.type === 'progress' && renderProgressItem(item)}
                          {item.type === 'recommendation' && renderRecommendationItem(item)}
                          {item.type === 'grouped_progress' && renderGroupedProgressItem(item)}
                          {item.type === 'collection_update' && renderCollectionUpdateItem(item)}
                          {item.type === 'dev_log' && renderDevLogItem(item)}
                        </View>
                      );
                    });
                  })()}
                </>
              )}
            </>
          )}

          {/* ===  FRIENDS TAB  === */}
          {activeTab === 'friends' && (
            <>
              <View style={styles.friendsHeader}>
                <Text style={[styles.friendsCountText, { color: colors.textSecondary }]}>{friends.length} {friends.length === 1 ? 'Friend' : 'Friends'}</Text>
              </View>
              {friends.length === 0 ? (
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
                  onPress={() => setIsInviteModalVisible(true)}
                  activeOpacity={0.8}>
                  <IconSymbol name="person.badge.plus" size={16} color="#FFF" />
                  <Text style={styles.emptyBtnText}>Invite Friends</Text>
                </TouchableOpacity>
              </View>
              ) : (
                friends.map((friend) => {
                  const isNew = !seenFriendIds.has(friend._id);
                  return (
                    <TouchableOpacity
                      key={friend._id}
                      style={[
                        styles.userCard, 
                        { backgroundColor: colors.surface, borderColor: isNew ? colors.primary + '60' : colors.cardBorder },
                        isNew && { borderWidth: 1.5 }
                      ]}
                      onPress={() => {
                        markFriendAsSeen(friend._id);
                        router.push(`/user/${friend._id}` as any);
                      }}
                      activeOpacity={0.7}>
                      {friend.avatar ? (
                        <Image source={{ uri: friend.avatar }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                          <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {friend.username?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userInfo}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={[styles.userName, { color: colors.text }]}>{friend.username}</Text>
                          {isNew && (
                            <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                              <Text style={styles.newBadgeText}>NEW</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
                          {friend.bio || 'No bio'}
                        </Text>
                      </View>
                      <TouchableOpacity 
                        style={[styles.removeFriendMiniBtn, { borderColor: colors.border }]}
                        onPress={() => showConfirm('Remove Friend', `Are you sure you want to remove ${friend.username}?`, () => removeFriend(friend._id, friend.username))}
                      >
                        <IconSymbol name="person.badge.minus" size={14} color={colors.textSecondary} />
                      </TouchableOpacity>
                      <IconSymbol name="chevron.right" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  );
                })
              )}
            </>
          )}

          {/* ===  REQUESTS TAB  === */}
          {activeTab === 'requests' && (
            <>
              <View style={[styles.segmentedControl, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <TouchableOpacity
                  style={[styles.segmentBtn, requestsTab === 'received' && { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => setRequestsTab('received')}>
                  <Text style={[styles.segmentBtnText, { color: requestsTab === 'received' ? colors.text : colors.textSecondary }]}>
                    Received {requests.length > 0 && `(${requests.length})`}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segmentBtn, requestsTab === 'sent' && { backgroundColor: colors.surfaceElevated }]}
                  onPress={() => setRequestsTab('sent')}>
                  <Text style={[styles.segmentBtnText, { color: requestsTab === 'sent' ? colors.text : colors.textSecondary }]}>
                    Sent {sentRequests.length > 0 && `(${sentRequests.length})`}
                  </Text>
                </TouchableOpacity>
              </View>

              {requestsTab === 'received' ? (
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
                      {request.from.avatar ? (
                        <Image source={{ uri: request.from.avatar }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.accent + '30' }]}>
                          <Text style={[styles.avatarText, { color: colors.accent }]}>
                            {request.from.username?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
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
              ) : (
                sentRequests.length === 0 ? (
                  <View style={styles.emptyState}>
                    <View style={[styles.emptyIconBg, { backgroundColor: colors.surfaceElevated }]}>
                      <IconSymbol name="paperplane.fill" size={40} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>No sent requests</Text>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      You haven't sent any friend requests
                    </Text>
                  </View>
                ) : (
                  sentRequests.map((request) => (
                    <View
                      key={request._id}
                      style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                      {request.to.avatar ? (
                        <Image source={{ uri: request.to.avatar }} style={styles.avatar} contentFit="cover" />
                      ) : (
                        <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                          <Text style={[styles.avatarText, { color: colors.primary }]}>
                            {request.to.username?.[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: colors.text }]}>
                          {request.to.username}
                        </Text>
                        <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                          Pending Request
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => cancelRequest(request._id)}
                        activeOpacity={0.8}>
                        <Text style={[styles.actionBtnText, { color: colors.textSecondary }]}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )
              )}
            </>
          )}

      {/* Invite/Add Friend Modal */}
      <Modal
        visible={isInviteModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Invite Friends</Text>
              <TouchableOpacity onPress={() => { setIsInviteModalVisible(false); setSearchQuery(''); setSearchResults([]); }}>
                <IconSymbol name="xmark" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <View style={[styles.searchBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <IconSymbol name="magnifyingglass" size={18} color={colors.textSecondary} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by username..."
                placeholderTextColor={colors.textSecondary + '80'}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={searchUsers}
                returnKeyType="search"
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
              {searchResults.length === 0 && searchQuery.length > 0 && !isLoading && (
                <Text style={[styles.modalEmptyText, { color: colors.textSecondary }]}>No users found.</Text>
              )}
              
               {searchResults.map((user) => {
                const isFriend = friends.some(f => f._id === user._id);
                const sentReq = sentRequests.find(r => r.to._id === user._id);
                const receivedReq = requests.find(r => r.from._id === user._id);
                
                return (
                  <View
                    key={user._id}
                    style={[styles.userCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
                    {user.avatar ? (
                      <Image source={{ uri: user.avatar }} style={styles.avatar} contentFit="cover" />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: colors.primary + '30' }]}>
                        <Text style={[styles.avatarText, { color: colors.primary }]}>{user.username?.[0]?.toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.userName, { color: colors.text }]}>{user.username}</Text>
                        {isFriend && (
                          <View style={[styles.statusTag, { backgroundColor: colors.success + '20' }]}>
                            <Text style={[styles.statusTagText, { color: colors.success }]}>FRIEND</Text>
                          </View>
                        )}
                        {sentReq && (
                          <View style={[styles.statusTag, { backgroundColor: colors.primary + '20' }]}>
                            <Text style={[styles.statusTagText, { color: colors.primary }]}>SENT</Text>
                          </View>
                        )}
                        {receivedReq && (
                          <View style={[styles.statusTag, { backgroundColor: colors.accent + '20' }]}>
                            <Text style={[styles.statusTagText, { color: colors.accent }]}>RECEIVED</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.userBio, { color: colors.textSecondary }]} numberOfLines={1}>
                        {user.bio || 'No bio'}
                      </Text>
                    </View>

                    {isFriend ? (
                      <TouchableOpacity
                        style={[styles.addFriendBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => showConfirm('Remove Friend', `Are you sure you want to remove ${user.username}?`, () => removeFriend(user._id, user.username))}
                        activeOpacity={0.8}>
                        <IconSymbol name="person.badge.minus" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ) : sentReq ? (
                      <TouchableOpacity
                        style={[styles.addFriendBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => cancelRequest(sentReq._id)}
                        activeOpacity={0.8}>
                        <IconSymbol name="xmark" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    ) : receivedReq ? (
                      <View style={{ flexDirection: 'row', gap: 4 }}>
                        <TouchableOpacity
                          style={[styles.addFriendBtnMini, { backgroundColor: colors.primary }]}
                          onPress={() => respondToRequest(receivedReq._id, 'accept')}
                          activeOpacity={0.8}>
                          <IconSymbol name="checkmark" size={12} color="#FFF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.addFriendBtnMini, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}
                          onPress={() => respondToRequest(receivedReq._id, 'decline')}
                          activeOpacity={0.8}>
                          <IconSymbol name="xmark" size={12} color={colors.textSecondary} />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.addFriendBtn, { backgroundColor: colors.primary }]}
                        onPress={() => sendRequest(user._id)}
                        activeOpacity={0.8}>
                        <IconSymbol name="person.badge.plus" size={16} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </ScrollView>
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
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  fixedHeader: {
    paddingTop: Spacing.xs,
    backgroundColor: 'transparent',
  },
  pageTitle: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  inviteBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  tabBar: {
    borderBottomWidth: 1,
    height: 52,
  },
  tabBarContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    flexGrow: 1,
    alignItems: 'center',
  },
  tabItem: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    flex: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeIndicator: {
    position: 'absolute',
    bottom: -1,
    width: '100%',
    height: 3,
    borderRadius: 2,
  },
  tabCounter: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 16,
    alignItems: 'center',
  },
  tabCounterText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '900',
  },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: 100 },

  // ─── Activity Feed Styles ───
  feedSectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md, marginTop: Spacing.xs },
  feedSectionTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5 },
  feedCountBadge: { fontSize: 11, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  actEmptyIconWrap: { width: 88, height: 88, borderRadius: BorderRadius.xl, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.md, borderWidth: 1 },

  // Activity card shell
  actCard: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    marginBottom: 12,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.sm,
  },
  actStrip: { width: 3, flexShrink: 0 },
  actBody: { flex: 1, padding: Spacing.md },
  actHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  feedAvatar: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  feedAvatarText: { fontSize: 15, fontWeight: '800' },
  actUsername: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  actSubline: { fontSize: 12, marginTop: 1, fontWeight: '500' },
  actTime: { fontSize: 11, fontWeight: '500', marginTop: 2 },
  actTitle: { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  actTypePill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full },
  actTypeLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },

  // Review card
  reviewBanner: { height: 160, borderRadius: BorderRadius.lg, overflow: 'hidden', justifyContent: 'flex-end' },
  reviewBannerContent: { padding: 12 },
  starsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  ratingNum: { fontSize: 11, fontWeight: '800', color: '#FBBF24', marginLeft: 4 },
  reviewBannerTitle: { fontSize: 16, fontWeight: '900', color: '#FFF', letterSpacing: -0.3, marginBottom: 3 },
  reviewBannerQuote: { fontSize: 12, color: 'rgba(255,255,255,0.75)', fontStyle: 'italic', lineHeight: 17 },

  // Progress card
  progressStoryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: BorderRadius.lg },
  progressCover: { width: 50, height: 70, borderRadius: BorderRadius.md },
  progressInfo: { flex: 1 },
  progressChText: { fontSize: 11, fontWeight: '600' },
  progressBarTrack: { height: 3, borderRadius: 2, backgroundColor: 'rgba(148,163,184,0.15)', marginTop: 8, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 2 },
  feedProgressMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  feedStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  feedStatusText: { fontSize: 10, fontWeight: '800' },
  feedChapter: { fontSize: 12, fontWeight: '600' },

  // Recommendation card
  recoStoryRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  recoCover: { width: 80, height: 110, borderRadius: BorderRadius.md },
  recoInfo: { flex: 1, gap: 5 },
  mustReadBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 3, borderRadius: BorderRadius.full, borderWidth: 1 },
  mustReadText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  recoQuoteBox: { marginTop: 4, padding: 9, borderRadius: BorderRadius.md, borderWidth: 1 },
  recoQuoteText: { fontSize: 12, lineHeight: 17, fontStyle: 'italic' },

  // Grouped (bulk update) card
  groupGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  groupGridCell: { width: '47.5%', aspectRatio: 0.75, borderRadius: BorderRadius.md, overflow: 'hidden', justifyContent: 'flex-end' },
  groupCellLabel: { padding: 6 },
  groupCellTitle: { fontSize: 11, fontWeight: '800', color: '#FFF', lineHeight: 14, marginBottom: 2 },
  groupCellCh: { fontSize: 10, fontWeight: '700' },
  moreActivityBtn: { width: '100%', paddingVertical: Spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  moreActivityText: { fontSize: 12, fontWeight: '700' },

  // Collection card
  collectionRowCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: BorderRadius.lg, borderWidth: 1 },
  collIconBg: { width: 42, height: 42, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },

  // Dev Log card
  devLogCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    ...Shadows.md,
  },
  devLogGlow: { position: 'absolute', top: -30, right: -30, width: 80, height: 80, borderRadius: 40, opacity: 0.08 },
  devLogBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: BorderRadius.full },
  devLogBadgeText: { color: '#FFF', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  devLogDate: { fontSize: 11, fontWeight: '600' },
  devLogTitle: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4, marginBottom: 6 },
  devLogSnippet: { fontSize: 13, lineHeight: 18, marginBottom: 14 },
  devLogFooter: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 10, borderTopWidth: 1 },
  viewDevLogText: { fontSize: 12, fontWeight: '700' },

  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  dateSeparatorLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
  },
  dateSeparatorLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.5,
  },

  meBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  meBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  feedReviewText: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 4 },
  // kept for legacy compat
  feedStoryCard: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  feedStoryCover: { width: '100%', height: 160, borderRadius: BorderRadius.sm },
  feedStoryInfo: { padding: Spacing.sm, gap: 4 },
  feedStoryTitle: { fontSize: 16, fontWeight: '800' },
  feedStoryAuthor: { fontSize: 12, fontWeight: '500', color: '#94A3B8', marginBottom: 2 },
  feedStoryRow: { flexDirection: 'row', borderRadius: BorderRadius.md, padding: Spacing.sm, gap: Spacing.md, alignItems: 'center' },
  feedStoryThumb: { width: 60, height: 85, borderRadius: BorderRadius.md },
  feedStoryThumbSmall: { width: '100%', aspectRatio: 0.7, borderRadius: BorderRadius.sm },
  feedStoryTitleSmall: { fontSize: 13, fontWeight: '800' },
  feedChapterSmall: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  typeText: { fontSize: 10, fontWeight: '800' },
  feedUserName: { fontSize: 14, fontWeight: '700' },
  feedAction: { fontSize: 12 },
  feedTime: { fontSize: 11 },
  feedCard: { padding: Spacing.md, borderRadius: BorderRadius.lg, marginBottom: Spacing.md, borderWidth: 1, overflow: 'hidden' },
  recoHighlightCard: { borderWidth: 1.5, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  groupedContainer: { marginTop: Spacing.xs, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  groupedStoryRow: { width: '48%', padding: 4, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  feedRecoMessage: { marginTop: 8, padding: 10, borderRadius: BorderRadius.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(245, 158, 11, 0.4)' },



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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { height: '80%', borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontSize: 24, fontWeight: '800' },
  modalScroll: { paddingBottom: 40 },
  modalEmptyText: { textAlign: 'center', marginTop: 40, fontSize: 14 },
  friendsHeader: { marginBottom: Spacing.md, paddingHorizontal: 4 },
  friendsCountText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  newBadge: { paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 4 },
  newBadgeText: { color: '#FFF', fontSize: 8, fontWeight: '900' },
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
  segmentedControl: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  segmentBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  removeFriendMiniBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  statusTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusTagText: {
    fontSize: 8,
    fontWeight: '800',
  },
  addFriendBtnMini: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  confirmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  confirmContent: { width: '100%', borderRadius: BorderRadius.xl, padding: Spacing.xl },
  confirmTitle: { fontSize: 18, fontWeight: '800', marginBottom: Spacing.sm },
  confirmMessage: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.xl },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.md },
  confirmBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: BorderRadius.md },
  confirmBtnDestructive: { borderRadius: BorderRadius.md },
  confirmBtnText: { fontSize: 14, fontWeight: '600' },
  confirmBtnTextMain: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
