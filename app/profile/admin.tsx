import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
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
import { useToast } from '@/store/ToastContext';

type Tab = 'feedback' | 'bugs';

export default function AdminDashboard() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>('feedback');
  const [feedback, setFeedback] = useState<any[]>([]);
  const [bugs, setBugs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const [feedbackData, bugsData] = await Promise.all([
        api.getAllFeedback(),
        api.getAllBugReports(),
      ]);
      setFeedback(feedbackData);
      setBugs(bugsData);
    } catch (error: any) {
      showToast({ message: 'Failed to load reports: ' + error.message, type: 'error' });
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const renderFeedbackItem = ({ item }: { item: any }) => (
    <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{item.user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.username, { color: colors.text }]}>{item.user?.username}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={[styles.categoryPill, { backgroundColor: colors.primary + '15' }]}>
          <Text style={[styles.categoryText, { color: colors.primary }]}>{item.category}</Text>
        </View>
      </View>
      <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>
    </View>
  );

  const renderBugItem = ({ item }: { item: any }) => (
    <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.error + '20' }]}>
            <Text style={[styles.avatarText, { color: colors.error }]}>{item.user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.username, { color: colors.text }]}>{item.user?.username}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <View style={[styles.statusPill, { 
          backgroundColor: (item.status === 'pending' ? colors.warning : colors.success) + '15' 
        }]}>
          <Text style={[styles.statusText, { 
            color: item.status === 'pending' ? colors.warning : colors.success 
          }]}>{item.status}</Text>
        </View>
      </View>
      <Text style={[styles.bugTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.content, { color: colors.textSecondary }]}>{item.description}</Text>
      {item.deviceInfo && (
        <View style={[styles.deviceInfo, { backgroundColor: colors.surfaceElevated }]}>
          <IconSymbol name="desktopcomputer" size={12} color={colors.textSecondary} />
          <Text style={[styles.deviceText, { color: colors.textSecondary }]} numberOfLines={1}>{item.deviceInfo}</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feedback' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('feedback')}>
          <Text style={[styles.tabText, { color: activeTab === 'feedback' ? colors.primary : colors.textSecondary }]}>
            Feedback ({feedback.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bugs' && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab('bugs')}>
          <Text style={[styles.tabText, { color: activeTab === 'bugs' ? colors.primary : colors.textSecondary }]}>
            Bug Reports ({bugs.length})
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={activeTab === 'feedback' ? feedback : bugs}
          renderItem={activeTab === 'feedback' ? renderFeedbackItem : renderBugItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <IconSymbol 
                name={activeTab === 'feedback' ? 'bubble.left.fill' : 'ant.fill'} 
                size={48} 
                color={colors.textSecondary + '40'} 
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                No {activeTab === 'feedback' ? 'feedback' : 'bug reports'} found.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    height: 56,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  tab: {
    paddingVertical: Spacing.md,
    marginRight: Spacing.xl,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '700' },
  listContent: { padding: Spacing.lg },
  reportCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  avatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '800' },
  username: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 11 },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  categoryText: { fontSize: 10, fontWeight: '700' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  content: { fontSize: 14, lineHeight: 20 },
  bugTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: Spacing.md,
    padding: 8,
    borderRadius: BorderRadius.md,
  },
  deviceText: { fontSize: 11, flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, paddingTop: 100, alignItems: 'center', gap: Spacing.md },
  emptyText: { fontSize: 14, fontWeight: '500' },
});
