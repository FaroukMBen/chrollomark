import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function SocialScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [friends, setFriends] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'friends' | 'requests' | 'search'>('friends');

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [friendsData, requestsData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsData);
      setRequests(requestsData);
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
      Alert.alert('Sent!', 'Friend request sent');
      setSearchResults((prev) => prev.filter((u) => u._id !== userId));
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const respondToRequest = async (requestId: string, action: 'accept' | 'decline') => {
    try {
      await api.respondToFriendRequest(requestId, action);
      await loadData();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to connect with friends
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Social</Text>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { borderColor: colors.border }]}>
        {(['friends', 'requests', 'search'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}>
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary },
              ]}>
              {tab === 'friends' ? `Friends (${friends.length})` : tab === 'requests' ? `Requests (${requests.length})` : 'Search'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          contentContainerStyle={styles.content}>
          {/* Friends Tab */}
          {activeTab === 'friends' && (
            friends.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>👥</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No friends yet. Search for users to add!
                </Text>
              </View>
            ) : (
              friends.map((friend) => (
                <TouchableOpacity
                  key={friend._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  onPress={() => router.push(`/user/${friend._id}` as any)}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {friend.username?.[0]?.toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{friend.username}</Text>
                    <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                      {friend.bio || 'No bio'}
                    </Text>
                  </View>
                  <View style={[styles.onlineDot, { backgroundColor: friend.isOnline ? colors.success : colors.textSecondary }]} />
                </TouchableOpacity>
              ))
            )
          )}

          {/* Requests Tab */}
          {activeTab === 'requests' && (
            requests.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48 }}>📬</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  No pending friend requests
                </Text>
              </View>
            ) : (
              requests.map((request) => (
                <View
                  key={request._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
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
                        onPress={() => respondToRequest(request._id, 'accept')}>
                        <Text style={styles.actionBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: colors.error }]}
                        onPress={() => respondToRequest(request._id, 'decline')}>
                        <Text style={styles.actionBtnText}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))
            )
          )}

          {/* Search Tab */}
          {activeTab === 'search' && (
            <>
              <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by username..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={searchUsers}
                  returnKeyType="search"
                />
              </View>
              {searchResults.map((user) => (
                <View
                  key={user._id}
                  style={[styles.userCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>{user.username?.[0]?.toUpperCase()}</Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={[styles.userName, { color: colors.text }]}>{user.username}</Text>
                    <Text style={[styles.userBio, { color: colors.textSecondary }]}>
                      {user.bio || 'No bio'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => sendRequest(user._id)}>
                    <IconSymbol name="person.badge.plus" size={18} color="#FFF" />
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
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    marginBottom: Spacing.md,
  },
  tab: { flex: 1, paddingVertical: Spacing.md, alignItems: 'center' },
  tabText: { fontSize: 13, fontWeight: '700' },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  userInfo: { flex: 1, marginLeft: Spacing.md },
  userName: { fontSize: 15, fontWeight: '700' },
  userBio: { fontSize: 12, marginTop: 2 },
  onlineDot: { width: 10, height: 10, borderRadius: 5 },
  requestActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: BorderRadius.sm },
  actionBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  searchInput: { flex: 1, fontSize: 15 },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 15, textAlign: 'center', marginTop: Spacing.md },
});
