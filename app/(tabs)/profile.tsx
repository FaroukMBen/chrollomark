import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function ProfileScreen() {
  const { user, isAuthenticated, logout } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [stats, setStats] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const [statsData, collectionsData] = await Promise.all([
        api.getProgressStats(),
        api.getMyCollections(),
      ]);
      setStats(statsData);
      setCollections(collectionsData);
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

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Logout', style: 'destructive', onPress: logout },
    ]);
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to view your profile
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <View style={[styles.largeAvatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.largeAvatarText}>
              {user?.username?.[0]?.toUpperCase()}
            </Text>
          </View>
          <Text style={[styles.profileName, { color: colors.text }]}>{user?.username}</Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
          {user?.bio ? (
            <Text style={[styles.profileBio, { color: colors.textSecondary }]}>{user.bio}</Text>
          ) : null}
        </View>

        {/* Stats Grid */}
        {stats && (
          <View style={styles.statsGrid}>
            {[
              { label: 'Total', value: stats.totalStories, color: colors.text },
              { label: 'Reading', value: stats.reading, color: StatusColors.Reading },
              { label: 'Completed', value: stats.completed, color: StatusColors.Completed },
              { label: 'Planned', value: stats.planToRead, color: StatusColors['Plan to Read'] },
              { label: 'On Hold', value: stats.onHold, color: StatusColors['On Hold'] },
              { label: 'Dropped', value: stats.dropped, color: StatusColors.Dropped },
            ].map((stat) => (
              <View key={stat.label} style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Big Stats */}
        {stats && (
          <View style={[styles.bigStatCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <View style={styles.bigStatRow}>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatValue, { color: colors.accent }]}>
                  {stats.totalChaptersRead}
                </Text>
                <Text style={[styles.bigStatLabel, { color: colors.textSecondary }]}>
                  Total Chapters Read
                </Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatValue, { color: colors.error }]}>
                  {stats.favorites}
                </Text>
                <Text style={[styles.bigStatLabel, { color: colors.textSecondary }]}>
                  Favorites
                </Text>
              </View>
              <View style={styles.bigStat}>
                <Text style={[styles.bigStatValue, { color: colors.success }]}>
                  {stats.readThisWeek}
                </Text>
                <Text style={[styles.bigStatLabel, { color: colors.textSecondary }]}>
                  Read This Week
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Collections */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>📁 My Collections</Text>
            <TouchableOpacity onPress={() => router.push('/collection/create')}>
              <IconSymbol name="plus.circle.fill" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {collections.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No collections yet
              </Text>
            </View>
          ) : (
            collections.map((collection) => (
              <TouchableOpacity
                key={collection._id}
                style={[styles.collectionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                onPress={() => router.push(`/collection/${collection._id}` as any)}>
                <View style={[styles.collectionColor, { backgroundColor: collection.color || colors.primary }]} />
                <View style={styles.collectionInfo}>
                  <Text style={[styles.collectionName, { color: colors.text }]}>
                    {collection.name}
                  </Text>
                  <Text style={[styles.collectionCount, { color: colors.textSecondary }]}>
                    {collection.stories.length} stories
                    {collection.isPublic ? ' • Public' : ' • Private'}
                  </Text>
                </View>
                <IconSymbol name="chevron.right" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.error }]}
          onPress={handleLogout}>
          <Text style={[styles.logoutText, { color: colors.error }]}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { paddingBottom: 100 },
  profileHeader: {
    alignItems: 'center',
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
  },
  largeAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  largeAvatarText: { color: '#FFF', fontSize: 32, fontWeight: '800' },
  profileName: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  profileEmail: { fontSize: 14, marginBottom: Spacing.sm },
  profileBio: { fontSize: 14, textAlign: 'center', paddingHorizontal: Spacing.xl },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statItem: {
    width: '31%',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  bigStatCard: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  bigStatRow: { flexDirection: 'row', justifyContent: 'space-around' },
  bigStat: { alignItems: 'center' },
  bigStatValue: { fontSize: 24, fontWeight: '800' },
  bigStatLabel: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  collectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  collectionColor: {
    width: 6,
    height: 36,
    borderRadius: 3,
    marginRight: Spacing.md,
  },
  collectionInfo: { flex: 1 },
  collectionName: { fontSize: 15, fontWeight: '700' },
  collectionCount: { fontSize: 12, marginTop: 2 },
  emptyCard: {
    padding: Spacing.xl,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  logoutButton: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  logoutText: { fontSize: 15, fontWeight: '700' },
});
