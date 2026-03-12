import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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

  useEffect(() => { loadData(); }, [loadData]);

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

  // --- Feed renderers ---
  const renderReviewItem = (item: any) => (
    <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <TouchableOpacity 
        style={styles.feedHeader} 
        onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
        activeOpacity={0.7}
      >
        {item.user?.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.feedAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.feedAvatar, { backgroundColor: colors.primary + '30' }]}>
            <Text style={[styles.feedAvatarText, { color: colors.primary }]}>
              {item.user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
            {item.user?._id === currentUser?._id && (
              <View style={[styles.meBadge, { backgroundColor: colors.primary + '15' }]}>
                <Text style={[styles.meBadgeText, { color: colors.primary }]}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={[styles.feedAction, { color: colors.textSecondary }]}>reviewed a story</Text>
        </View>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </TouchableOpacity>

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
        <TouchableOpacity 
          style={styles.feedHeader}
          onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
          activeOpacity={0.7}
        >
          {item.user?.avatar ? (
            <Image source={{ uri: item.user.avatar }} style={styles.feedAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.feedAvatar, { backgroundColor: statusColor + '30' }]}>
              <Text style={[styles.feedAvatarText, { color: statusColor }]}>
                {item.user?.username?.[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
              {item.user?._id === currentUser?._id && (
                <View style={[styles.meBadge, { backgroundColor: statusColor + '15' }]}>
                  <Text style={[styles.meBadgeText, { color: statusColor }]}>YOU</Text>
                </View>
              )}
            </View>
            <Text style={[styles.feedAction, { color: colors.textSecondary }]}>{actionVerb}</Text>
          </View>
          <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
        </TouchableOpacity>

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

  const renderRecommendationItem = (item: any) => (
    <View key={item.id} style={[styles.feedCard, styles.recoHighlightCard, { backgroundColor: colors.surface, borderColor: colors.accent + '40' }]}>
      <LinearGradient 
        colors={[colors.accent + '15', 'transparent']} 
        start={{ x: 0, y: 0 }} 
        end={{ x: 1, y: 1 }} 
        style={StyleSheet.absoluteFill} 
      />
      <TouchableOpacity 
        style={styles.feedHeader}
        onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
        activeOpacity={0.7}
      >
        {item.user?.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.feedAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.feedAvatar, { backgroundColor: colors.accent + '30' }]}>
            <Text style={[styles.feedAvatarText, { color: colors.accent }]}>
              {item.user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
            {item.user?._id === currentUser?._id && (
              <View style={[styles.meBadge, { backgroundColor: colors.accent + '15' }]}>
                <Text style={[styles.meBadgeText, { color: colors.accent }]}>YOU</Text>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconSymbol name="sparkles" size={10} color={colors.accent} />
            <Text style={[styles.feedAction, { color: colors.accent, fontWeight: '700' }]}>RECOMMENDED THIS STORY</Text>
          </View>
        </View>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.feedStoryCard, { backgroundColor: colors.surfaceElevated, borderLeftWidth: 3, borderLeftColor: colors.accent }]}
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
          <Text style={[styles.feedStoryAuthor, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.story?.author || 'Unknown Author'}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: colors.accent + '20', alignSelf: 'flex-start', marginTop: 4, marginBottom: item.message ? 8 : 0 }]}>
              <Text style={[styles.typeText, { color: colors.accent }]}>MUST READ</Text>
          </View>
          {item.message && (
            <View style={styles.feedRecoMessage}>
              <Text style={[styles.feedReviewText, { color: colors.text, marginTop: 0, fontStyle: 'normal' }]}>"{item.message}"</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderGroupedProgressItem = (item: any) => {
    const statusColor = colors.primary;
    
    return (
      <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
        <TouchableOpacity 
          style={styles.feedHeader}
          onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
          activeOpacity={0.7}
        >
          {item.user?.avatar ? (
            <Image source={{ uri: item.user.avatar }} style={styles.feedAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.feedAvatar, { backgroundColor: statusColor + '30' }]}>
              <Text style={[styles.feedAvatarText, { color: statusColor }]}>
                {item.user?.username?.[0]?.toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
              {item.user?._id === currentUser?._id && (
                <View style={[styles.meBadge, { backgroundColor: statusColor + '15' }]}>
                  <Text style={[styles.meBadgeText, { color: statusColor }]}>YOU</Text>
                </View>
              )}
            </View>
            <Text style={[styles.feedAction, { color: colors.textSecondary }]}>updated {item.itemsCount} titles</Text>
          </View>
          <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
        </TouchableOpacity>

        <View style={styles.groupedContainer}>
          {(item.stories || []).slice(0, expandedGroups.has(item.id) ? undefined : 2).map((subItem: any, idx: number) => (
            <TouchableOpacity
              key={idx}
              style={[styles.groupedStoryRow, { backgroundColor: colors.surfaceElevated }]}
              onPress={() => subItem.story?._id && router.push(`/story/${subItem.story._id}` as any)}
              activeOpacity={0.7}>
              {subItem.story?.coverImage ? (
                <Image source={{ uri: subItem.story.coverImage }} style={styles.feedStoryThumbSmall} contentFit="cover" />
              ) : (
                <View style={[styles.feedStoryThumbSmall, { backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }]}>
                  <IconSymbol name="book.fill" size={16} color={colors.textSecondary} />
                </View>
              )}
              <View style={{ flex: 1, width: '100%' }}>
                <Text style={[styles.feedStoryTitleSmall, { color: colors.text, marginTop: 6 }]} numberOfLines={1}>
                  {subItem.story?.title || 'Unknown'}
                </Text>
                <Text style={[styles.feedChapterSmall, { color: colors.primary }]}>
                   {subItem.status === 'Completed' ? 'Completed' : `Chapter ${subItem.currentChapter}`}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
          {item.itemsCount > 2 && (
            <TouchableOpacity 
              style={[styles.moreActivityBtn, { borderTopWidth: 1, borderTopColor: colors.border + '30' }]}
              onPress={() => toggleGroup(item.id)}>
              <Text style={[styles.moreActivityText, { color: colors.primary }]}>
                {expandedGroups.has(item.id) 
                  ? 'Show less' 
                  : `Show ${item.itemsCount - 2} more updates`}
              </Text>
              <IconSymbol 
                name={expandedGroups.has(item.id) ? 'chevron.up' : 'chevron.down'} 
                size={12} 
                color={colors.primary} 
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderCollectionUpdateItem = (item: any) => (
    <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <TouchableOpacity 
        style={styles.feedHeader}
        onPress={() => item.user?._id && router.push(`/user/${item.user._id}` as any)}
        activeOpacity={0.7}
      >
        {item.user?.avatar ? (
          <Image source={{ uri: item.user.avatar }} style={styles.feedAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.feedAvatar, { backgroundColor: '#F59E0B' + '30' }]}>
            <Text style={[styles.feedAvatarText, { color: '#F59E0B' }]}>
              {item.user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={[styles.feedUserName, { color: colors.text }]}>{item.user?.username}</Text>
            {item.user?._id === currentUser?._id && (
              <View style={[styles.meBadge, { backgroundColor: '#F59E0B' + '15' }]}>
                <Text style={[styles.meBadgeText, { color: '#F59E0B' }]}>YOU</Text>
              </View>
            )}
          </View>
          <Text style={[styles.feedAction, { color: colors.textSecondary }]}>
            {item.isNew ? 'created a new collection' : 'updated a collection'}
          </Text>
        </View>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.collectionActivityCard, { backgroundColor: colors.surfaceElevated, borderLeftWidth: 3, borderLeftColor: '#F59E0B' }]}
        onPress={() => item.collectionId && router.push(`/collection/${item.collectionId}` as any)}
        activeOpacity={0.7}>
        <View style={[styles.collIconBg, { backgroundColor: '#F59E0B' + '20' }]}>
          <IconSymbol name="folder.fill" size={24} color="#F59E0B" />
        </View>
        <View style={styles.feedStoryInfo}>
          <Text style={[styles.feedStoryTitle, { color: colors.text }]} numberOfLines={1}>
            {item.name || 'Personal Collection'}
          </Text>
          <Text style={[styles.feedStoryAuthor, { color: colors.textSecondary }]}>
            Click to view collection
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderDevLogItem = (item: any) => (
    <TouchableOpacity 
      key={item.id} 
      style={[styles.feedCard, styles.devLogCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
      onPress={() => router.push('/profile/dev-log')}
      activeOpacity={0.9}>
      <View style={styles.feedHeader}>
        <View style={[styles.devLogIcon, { backgroundColor: colors.primary + '30' }]}>
          <IconSymbol name="hammer.fill" size={12} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.feedUserName, { color: colors.text }]}>SYSTEM UPDATE</Text>
          <Text style={[styles.feedAction, { color: colors.textSecondary }]}>Patch Notes Released</Text>
        </View>
        <Text style={[styles.feedTime, { color: colors.textSecondary }]}>{timeAgo(item.timestamp)}</Text>
      </View>
      
      <View style={[styles.devLogContent, { backgroundColor: colors.surfaceElevated, borderRadius: BorderRadius.md, padding: Spacing.sm }]}>
        <Text style={[styles.devLogTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
        <Text style={[styles.devLogSnippet, { color: colors.textSecondary }]} numberOfLines={2}>{item.content}</Text>
        
        <TouchableOpacity style={[styles.moreActivityBtn, { borderTopWidth: 1, borderTopColor: colors.border + '30' }]} activeOpacity={0.7}>
           <Text style={[styles.viewDevLogText, { color: colors.primary }]}>View roadmap & changes</Text>
           <IconSymbol name="arrow.right" size={12} color={colors.primary} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );


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
                    if (item.type === 'recommendation') return renderRecommendationItem(item);
                    if (item.type === 'grouped_progress') return renderGroupedProgressItem(item);
                    if (item.type === 'collection_update') return renderCollectionUpdateItem(item);
                    if (item.type === 'dev_log') return renderDevLogItem(item);
                    return null;
                  })}
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

  // --- Feed Styles ---
  feedSectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: Spacing.md, marginTop: Spacing.sm },
  feedCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  recoHighlightCard: {
    borderWidth: 1.5,
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 5,
  },
  feedHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  feedAvatarText: { fontSize: 15, fontWeight: '800' },
  feedUserName: { fontSize: 14, fontWeight: '700' },
  feedAction: { fontSize: 12 },
  feedTime: { fontSize: 11 },
  feedStoryCard: { borderRadius: BorderRadius.md, overflow: 'hidden' },
  feedStoryCover: { width: '100%', height: 160, borderRadius: BorderRadius.sm },
  feedStoryInfo: { padding: Spacing.sm, gap: 4 },
  feedStoryTitle: { fontSize: 16, fontWeight: '800' },
  feedStoryAuthor: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
    marginBottom: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  feedReviewText: { fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginTop: 4 },
  starsRow: { flexDirection: 'row', gap: 2 },
  feedStoryRow: { flexDirection: 'row', borderRadius: BorderRadius.md, padding: Spacing.sm, gap: Spacing.md, alignItems: 'center' },
  feedStoryThumb: { width: 60, height: 85, borderRadius: BorderRadius.md },
  feedProgressMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  feedStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.full },
  feedStatusText: { fontSize: 10, fontWeight: '800' },
  // Grouped Progress Styles
  groupedContainer: { marginTop: Spacing.xs, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  groupedStoryRow: { width: '48%', padding: 4, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  feedStoryThumbSmall: { width: '100%', aspectRatio: 0.7, borderRadius: BorderRadius.sm },
  feedStoryTitleSmall: { fontSize: 13, fontWeight: '800' },
  feedChapterSmall: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  moreActivityBtn: { width: '100%', paddingVertical: Spacing.sm, alignItems: 'center' },
  moreActivityText: { fontSize: 12, fontWeight: '600' },
  // Collection Activity Styles
  collectionActivityCard: { flexDirection: 'row', alignItems: 'center', padding: Spacing.md, borderRadius: BorderRadius.lg, gap: Spacing.md },
  collIconBg: { width: 44, height: 44, borderRadius: BorderRadius.md, justifyContent: 'center', alignItems: 'center' },
  // Dev Log Styles
  devLogCard: { overflow: 'hidden' },
  devLogIcon: { width: 24, height: 24, borderRadius: BorderRadius.full, justifyContent: 'center', alignItems: 'center' },
  devLogContent: { marginHorizontal: Spacing.sm },
  devLogTitle: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  devLogSnippet: { fontSize: 13, lineHeight: 18 },
  devLogFooter: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center' },
  viewDevLogText: { fontSize: 12, fontWeight: '700' },
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
  feedChapter: { fontSize: 12, fontWeight: '600' },
  feedRecoMessage: {
    marginTop: 8,
    padding: 10,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },

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
