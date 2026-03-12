import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { BorderRadius, Colors, Spacing, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useToast } from '@/store/ToastContext';

type Tab = 'feedback' | 'bugs';

const FEEDBACK_STATUSES = ['pending', 'reviewed', 'implemented', 'closed'];
const BUG_STATUSES = ['pending', 'reproduced', 'fixed', 'closed'];
const FEEDBACK_CATEGORIES = ['All', 'General', 'Feature Request', 'UI/UX', 'Performance', 'Other'];

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

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showFilters, setShowFilters] = useState(false);

  // Management State
  const [managementModalVisible, setManagementModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const stats = useMemo(() => {
    const data = activeTab === 'feedback' ? feedback : bugs;
    const completedStatus = activeTab === 'feedback' ? 'implemented' : 'fixed';
    return {
      total: data.length,
      pending: data.filter(item => (item.status || 'pending') === 'pending').length,
      completed: data.filter(item => item.status === completedStatus || item.status === 'closed').length,
    };
  }, [activeTab, feedback, bugs]);

  const filteredData = useMemo(() => {
    const data = activeTab === 'feedback' ? feedback : bugs;
    return data.filter((item) => {
      if (statusFilter !== 'All' && (item.status || 'pending') !== statusFilter.toLowerCase()) return false;
      if (activeTab === 'feedback' && categoryFilter !== 'All' && item.category !== categoryFilter) return false;
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      const contentMatch = activeTab === 'feedback' 
        ? item.content?.toLowerCase().includes(query)
        : (item.title?.toLowerCase().includes(query) || item.description?.toLowerCase().includes(query));
      const userMatch = item.user?.username?.toLowerCase().includes(query) || item.user?.email?.toLowerCase().includes(query);
      return contentMatch || userMatch;
    });
  }, [activeTab, feedback, bugs, searchQuery, statusFilter, categoryFilter]);

  const openManagement = (report: any) => {
    setSelectedReport(report);
    setNewStatus(report.status || 'pending');
    setAdminNotes(report.adminNotes || '');
    setManagementModalVisible(true);
  };

  const handleUpdate = async () => {
    if (!selectedReport) return;
    setIsUpdating(true);
    try {
      if (activeTab === 'feedback') {
        await api.updateFeedback(selectedReport._id, { status: newStatus, adminNotes });
      } else {
        await api.updateBugReport(selectedReport._id, { status: newStatus, adminNotes });
      }
      showToast({ message: 'Report updated successfully', type: 'success' });
      setManagementModalVisible(false);
      loadData();
    } catch (error: any) {
      showToast({ message: 'Update failed: ' + error.message, type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Report',
      'Are you sure you want to delete this report?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              if (activeTab === 'feedback') {
                await api.deleteFeedback(id);
              } else {
                await api.deleteBugReport(id);
              }
              showToast({ message: 'Report deleted', type: 'success' });
              loadData();
            } catch (error: any) {
              showToast({ message: 'Delete failed: ' + error.message, type: 'error' });
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return colors.warning;
      case 'reviewed':
      case 'reproduced': return colors.primary;
      case 'implemented':
      case 'fixed': return colors.success;
      case 'closed': return colors.textSecondary;
      default: return colors.primary;
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('All');
    setCategoryFilter('All');
  };

  const renderFeedbackItem = ({ item }: { item: any }) => (
    <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>{item.user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.username, { color: colors.text }]}>{item.user?.username}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openManagement(item)} style={styles.moreBtn}>
          <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.tagRow}>
        <View style={[styles.pill, { backgroundColor: colors.primary + '10' }]}>
          <Text style={[styles.pillText, { color: colors.primary }]}>{item.category || 'General'}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: getStatusColor(item.status) + '10' }]}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
          <Text style={[styles.pillText, { color: getStatusColor(item.status) }]}>{item.status || 'pending'}</Text>
        </View>
      </View>

      <Text style={[styles.content, { color: colors.text }]}>{item.content}</Text>

      {item.adminNotes ? (
        <View style={[styles.noteContainer, { backgroundColor: colors.surfaceElevated, borderLeftColor: colors.primary }]}>
          <View style={styles.noteHeader}>
            <IconSymbol name="pencil" size={10} color={colors.primary} />
            <Text style={[styles.noteLabel, { color: colors.primary }]}>Admin Note</Text>
          </View>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>{item.adminNotes}</Text>
        </View>
      ) : null}
    </View>
  );

  const renderBugItem = ({ item }: { item: any }) => (
    <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
      <View style={styles.cardHeader}>
        <View style={styles.userRow}>
          <View style={[styles.avatar, { backgroundColor: colors.error + '15' }]}>
            <Text style={[styles.avatarText, { color: colors.error }]}>{item.user?.username?.[0]?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={[styles.username, { color: colors.text }]}>{item.user?.username}</Text>
            <Text style={[styles.date, { color: colors.textSecondary }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
        </View>
        <TouchableOpacity onPress={() => openManagement(item)} style={styles.moreBtn}>
          <IconSymbol name="ellipsis" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={[styles.pill, { backgroundColor: getStatusColor(item.status) + '10', alignSelf: 'flex-start', marginBottom: Spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6 }]}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]} />
        <Text style={[styles.pillText, { color: getStatusColor(item.status) }]}>{item.status}</Text>
      </View>

      <Text style={[styles.bugTitle, { color: colors.text }]}>{item.title}</Text>
      <Text style={[styles.content, { color: colors.textSecondary }]}>{item.description}</Text>
      
      {item.deviceInfo && (
        <View style={[styles.deviceInfo, { backgroundColor: colors.surfaceElevated }]}>
          <IconSymbol name="desktopcomputer" size={12} color={colors.textSecondary} />
          <Text style={[styles.deviceText, { color: colors.textSecondary }]} numberOfLines={1}>{item.deviceInfo}</Text>
        </View>
      )}

      {item.adminNotes ? (
        <View style={[styles.noteContainer, { backgroundColor: colors.surfaceElevated, borderLeftColor: colors.primary }]}>
          <View style={styles.noteHeader}>
            <IconSymbol name="pencil" size={10} color={colors.primary} />
            <Text style={[styles.noteLabel, { color: colors.primary }]}>Admin Note</Text>
          </View>
          <Text style={[styles.noteText, { color: colors.textSecondary }]}>{item.adminNotes}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <IconSymbol name="chevron.left" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <IconSymbol name="shield.fill" size={18} color={colors.error} />
          <Text style={[styles.headerTitle, { color: colors.text }]}>Admin Dashboard</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <IconSymbol name="arrow.clockwise" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feedback' && { borderBottomColor: colors.primary }]}
          onPress={() => { setActiveTab('feedback'); clearFilters(); }}>
          <Text style={[styles.tabText, { color: activeTab === 'feedback' ? colors.primary : colors.textSecondary }]}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bugs' && { borderBottomColor: colors.primary }]}
          onPress={() => { setActiveTab('bugs'); clearFilters(); }}>
          <Text style={[styles.tabText, { color: activeTab === 'bugs' ? colors.primary : colors.textSecondary }]}>Bug Reports</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsOverview}>
        <View style={[styles.statItem, { backgroundColor: colors.surfaceElevated }]}>
          <Text style={[styles.statValue, { color: colors.text }]}>{stats.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.warning + '10' }]}>
          <Text style={[styles.statValue, { color: colors.warning }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Pending</Text>
        </View>
        <View style={[styles.statItem, { backgroundColor: colors.success + '10' }]}>
          <Text style={[styles.statValue, { color: colors.success }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Done</Text>
        </View>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={[styles.searchBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, flex: 1 }]}>
            <IconSymbol name="magnifyingglass" size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder={`Search reports...`}
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={[styles.clearText, { color: colors.primary }]}>Clear</Text>
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity 
            style={[styles.filterToggle, { backgroundColor: showFilters ? colors.primary : colors.surfaceElevated, borderColor: colors.border }]}
            onPress={() => setShowFilters(!showFilters)}>
            <IconSymbol name="line.3.horizontal.decrease" size={18} color={showFilters ? "#FFF" : colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Filters */}
      {showFilters && (
        <View style={[styles.collapsibleFilters, { backgroundColor: colors.surfaceElevated }]}>
          <View style={styles.filterHeader}>
            <Text style={[styles.filterTitle, { color: colors.text }]}>Active Filters</Text>
            <TouchableOpacity onPress={clearFilters}>
              <Text style={[styles.resetText, { color: colors.primary }]}>Reset All</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.filterGroup}>
            <Text style={[styles.filterGroupLabel, { color: colors.textSecondary }]}>Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
              <TouchableOpacity 
                onPress={() => setStatusFilter('All')}
                style={[styles.filterChip, statusFilter === 'All' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <Text style={[styles.filterChipText, { color: statusFilter === 'All' ? '#FFF' : colors.textSecondary }]}>All</Text>
              </TouchableOpacity>
              {(activeTab === 'feedback' ? FEEDBACK_STATUSES : BUG_STATUSES).map((status) => {
                const label = status.charAt(0).toUpperCase() + status.slice(1);
                const isActive = statusFilter === label;
                return (
                  <TouchableOpacity
                    key={status}
                    onPress={() => setStatusFilter(label)}
                    style={[
                      styles.filterChip, 
                      isActive && { backgroundColor: getStatusColor(status), borderColor: getStatusColor(status) }
                    ]}>
                    <Text style={[styles.filterChipText, { color: isActive ? '#FFF' : colors.textSecondary }]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {activeTab === 'feedback' && (
            <View style={[styles.filterGroup, { marginTop: 12 }]}>
              <Text style={[styles.filterGroupLabel, { color: colors.textSecondary }]}>Categories</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScrollContent}>
                <TouchableOpacity 
                  onPress={() => setCategoryFilter('All')}
                  style={[styles.filterChip, categoryFilter === 'All' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Text style={[styles.filterChipText, { color: categoryFilter === 'All' ? '#FFF' : colors.textSecondary }]}>All</Text>
                </TouchableOpacity>
                {FEEDBACK_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategoryFilter(cat)}
                    style={[styles.filterChip, categoryFilter === cat && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.filterChipText, { color: categoryFilter === cat ? '#FFF' : colors.textSecondary }]}>{cat}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredData}
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
                color={colors.textSecondary + '20'} 
              />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {statusFilter !== 'All' || categoryFilter !== 'All' || !!searchQuery
                  ? 'No matches found for active filters.' 
                  : `No ${activeTab === 'feedback' ? 'feedback' : 'bug reports'} found.`}
              </Text>
              {!!searchQuery && (
                <TouchableOpacity onPress={clearFilters} style={styles.clearSearchBtn}>
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Clear Search</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <Modal
        visible={managementModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setManagementModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Manage Report</Text>
              <TouchableOpacity onPress={() => setManagementModalVisible(false)} style={styles.modalCloseBtn}>
                <IconSymbol name="xmark" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Status Update</Text>
              <View style={styles.statusOptions}>
                {(activeTab === 'feedback' ? FEEDBACK_STATUSES : BUG_STATUSES).map((status) => (
                  <TouchableOpacity
                    key={status}
                    style={[
                      styles.statusOption,
                      { borderColor: colors.border },
                      newStatus === status && { backgroundColor: getStatusColor(status) + '15', borderColor: getStatusColor(status) }
                    ]}
                    onPress={() => setNewStatus(status)}>
                    <Text style={[
                      styles.statusOptionText,
                      { color: colors.textSecondary },
                      newStatus === status && { color: getStatusColor(status), fontWeight: '800' }
                    ]}>
                      {status.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.label, { color: colors.textSecondary, marginTop: Spacing.xl }]}>Admin Notes</Text>
              <TextInput
                style={[styles.notesInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                value={adminNotes}
                onChangeText={setAdminNotes}
                placeholder="Developer comments..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={5}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: colors.error + '40' }]}
                  onPress={() => { setManagementModalVisible(false); handleDelete(selectedReport._id); }}>
                  <IconSymbol name="trash" size={16} color={colors.error} />
                  <Text style={[styles.deleteBtnText, { color: colors.error }]}>Delete</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: colors.primary }]}
                  disabled={isUpdating}
                  onPress={handleUpdate}>
                  {isUpdating ? <ActivityIndicator size="small" color="#FFF" /> : <Text style={styles.saveBtnText}>Update Report</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    height: 60,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  refreshBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xs,
  },
  tab: {
    marginRight: Spacing.xl,
    paddingVertical: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 16, fontWeight: '800' },

  statsOverview: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: 12,
  },
  statItem: {
    flex: 1,
    padding: 14,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statValue: { fontSize: 18, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginTop: 2, opacity: 0.7 },
  
  searchContainer: { paddingHorizontal: Spacing.lg, marginTop: Spacing.md, marginBottom: Spacing.xs },
  searchRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: 12,
  },
  searchInput: { flex: 1, fontSize: 14, height: '100%', fontWeight: '500' },
  clearText: { fontSize: 13, fontWeight: '700' },
  filterToggle: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  collapsibleFilters: {
    marginHorizontal: Spacing.lg,
    marginTop: 8,
    marginBottom: 20,
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.1)',
  },
  filterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  filterTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  resetText: { fontSize: 13, fontWeight: '700' },
  
  filterGroup: { 
    gap: 8, 
    padding: 10, 
    borderRadius: BorderRadius.lg, 
    backgroundColor: 'rgba(128,128,128,0.05)' 
  },
  filterGroupLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', opacity: 0.5, marginLeft: 2 },
  filtersScrollContent: { gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: 'rgba(128,128,128,0.15)',
  },
  filterChipText: { fontSize: 11, fontWeight: '800' },
  filterSeparator: { width: 1, height: 20, marginHorizontal: 4 },

  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60, paddingTop: 8 },
  reportCard: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: 16,
    ...Shadows.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  moreBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900' },
  username: { fontSize: 15, fontWeight: '800' },
  date: { fontSize: 11, opacity: 0.6, marginTop: 1 },
  tagRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  pill: { 
    paddingHorizontal: 10, 
    paddingVertical: 5, 
    borderRadius: BorderRadius.full, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  pillText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5 },
  content: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bugTitle: { fontSize: 16, fontWeight: '900', marginBottom: 6 },
  deviceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: BorderRadius.lg,
  },
  deviceText: { fontSize: 12, flex: 1, fontWeight: '600', opacity: 0.7 },
  noteContainer: {
    marginTop: 16,
    padding: 14,
    borderLeftWidth: 4,
    borderRadius: BorderRadius.md,
  },
  noteHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  noteLabel: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  noteText: { fontSize: 13, lineHeight: 20, fontWeight: '500' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, paddingTop: 100, alignItems: 'center', gap: 16 },
  emptyText: { fontSize: 15, fontWeight: '600', textAlign: 'center', paddingHorizontal: 40, opacity: 0.6 },
  clearSearchBtn: { marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  modalCloseBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(128,128,128,0.1)', justifyContent: 'center', alignItems: 'center' },
  label: { fontSize: 11, fontWeight: '900', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1, opacity: 0.6 },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statusOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: BorderRadius.full, borderWidth: 2 },
  statusOptionText: { fontSize: 12, fontWeight: '800' },
  notesInput: {
    padding: 16,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    minHeight: 140,
    textAlignVertical: 'top',
    fontSize: 15,
    fontWeight: '500',
  },
  modalActions: { flexDirection: 'row', marginTop: 32, gap: 12 },
  deleteBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: BorderRadius.xl, borderWidth: 2 },
  deleteBtnText: { fontSize: 15, fontWeight: '800' },
  saveBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 16, borderRadius: BorderRadius.xl },
  saveBtnText: { color: '#FFF', fontSize: 16, fontWeight: '900' },
});
