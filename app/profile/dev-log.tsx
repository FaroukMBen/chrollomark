import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
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

interface DevLog {
  _id: string;
  title: string;
  content: string;
  category: string;
  date: string;
}

export default function DevLogScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const [logs, setLogs] = useState<DevLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<DevLog | null>(null);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const data = await api.getDevLogs();
      setLogs(data);
    } catch (error) {
      console.error('Fetch logs error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const groupedLogs = useMemo(() => {
    const groups: { [date: string]: DevLog[] } = {};
    logs.forEach(log => {
      const dateKey = new Date(log.date).toLocaleDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(log);
    });
    return Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).map(date => ({
      date,
      items: groups[date]
    }));
  }, [logs]);

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'patch notes': return colors.textSecondary;
      case 'news': return colors.primary;
      case 'regular update': return colors.success;
      case 'planning for next update': return colors.accent;
      default: return colors.primary;
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.surface }]}
          onPress={() => router.back()}>
          <IconSymbol name="chevron.left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dev Log & Roadmaps</Text>
        <View style={{ width: 40 }} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {groupedLogs.length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="terminal.fill" size={48} color={colors.textSecondary + '40'} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No updates posted yet.</Text>
            </View>
          ) : (
            groupedLogs.map((group) => (
              <View key={group.date} style={styles.dateGroup}>
                <Text style={[styles.articleDate, { color: colors.textSecondary }]}>
                  {formatDate(group.items[0].date)}
                </Text>
                
                <View style={styles.timelineSection}>
                  {/* Vertical Timeline Line */}
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  
                  <View style={styles.cardsContainer}>
                    {group.items.map((log) => (
                      <View key={log._id} style={styles.timelineItem}>
                        {/* Timeline Dot */}
                        <View style={[styles.timelineDot, { backgroundColor: colors.primary, borderColor: colors.background }]} />
                        
                        <TouchableOpacity 
                          activeOpacity={0.8}
                          onPress={() => setSelectedLog(log)}
                          style={[styles.articleCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                          <View style={styles.articleHeader}>
                            <Text style={[styles.categoryTag, { color: getCategoryColor(log.category), borderColor: getCategoryColor(log.category) + '40' }]}>
                              {log.category.toUpperCase()}
                            </Text>
                            <Text style={[styles.articleTitle, { color: colors.text }]}>{log.title}</Text>
                          </View>
                          <View style={styles.clickPrompt}>
                            <Text style={[styles.clickPromptText, { color: colors.primary }]}>Read more</Text>
                            <IconSymbol name="chevron.right" size={12} color={colors.primary} />
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Article Detail Modal (Same as before) */}
      <Modal
        visible={!!selectedLog}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedLog(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
               <Text style={[styles.modalHeaderText, { color: colors.textSecondary }]}>
                 {selectedLog ? formatDate(selectedLog.date) : ''}
               </Text>
               <TouchableOpacity 
                 style={[styles.closeModalBtn, { backgroundColor: colors.surface }]}
                 onPress={() => setSelectedLog(null)}>
                 <IconSymbol name="xmark" size={20} color={colors.text} />
               </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {selectedLog && (
                <>
                  <Text style={[styles.categoryTag, { color: getCategoryColor(selectedLog.category), borderColor: getCategoryColor(selectedLog.category) + '40', marginBottom: 12 }]}>
                    {selectedLog.category.toUpperCase()}
                  </Text>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedLog.title}</Text>
                  <View style={[styles.modalDivider, { backgroundColor: colors.border }]} />
                  <Text style={[styles.modalText, { color: colors.text }]}>{selectedLog.content}</Text>
                </>
              )}
            </ScrollView>
          </View>
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
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  scrollContent: { padding: Spacing.md, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: '500' },
  
  dateGroup: { marginBottom: Spacing.xl },
  articleDate: { 
    fontSize: 12, 
    fontWeight: '800', 
    marginBottom: 16, 
    marginLeft: 6, 
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  
  timelineSection: { flexDirection: 'row', position: 'relative' },
  timelineLine: {
    position: 'absolute',
    left: 6,
    top: 0,
    bottom: 20,
    width: 2,
    borderRadius: 1,
  },
  cardsContainer: { flex: 1, paddingLeft: 24 },
  timelineItem: { position: 'relative', marginBottom: Spacing.md },
  timelineDot: {
    position: 'absolute',
    left: -22,
    top: 24,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    zIndex: 2,
  },
  
  articleCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  articleHeader: { marginBottom: Spacing.xs },
  categoryTag: {
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  articleTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  clickPrompt: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  clickPromptText: { fontSize: 12, fontWeight: '700' },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '85%',
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: 1,
  },
  modalHeaderText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  closeModalBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalScroll: { padding: Spacing.xl },
  modalTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, marginBottom: 16 },
  modalDivider: { height: 1, width: 40, marginBottom: 20 },
  modalText: { fontSize: 16, lineHeight: 26, fontWeight: '500' },
});
