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

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ConfirmModal } from '@/components/ui/confirm-modal';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSocket } from '@/store/SocketContext';
import { useToast } from '@/store/ToastContext';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const { user: currentUser } = useAuth();

  const [profile, setProfile] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [mutualFriends, setMutualFriends] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'progress' | 'collections' | 'mutual'>('progress');
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'compact'>('list');
  const [showHidden, setShowHidden] = useState(false);
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
        const progressData = await api.getUserProgress(id, showHidden);
        setProgress(progressData);
      } catch {
        // Not friends, can't see progress
      }
    } catch (error) {
      console.log('Error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [id, showHidden]);

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

  // Listen for real-time progress updates from this user
  useEffect(() => {
    if (socket && id) {
      const handleProgressUpdate = (update: any) => {
        if (update.userId === id) {
          // The user we are viewing updated their progress
          loadData();
        }
      };

      socket.on('progress_update', handleProgressUpdate);
      return () => {
        socket.off('progress_update', handleProgressUpdate);
      };
    }
  }, [socket, id, loadData]);

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        stickyHeaderIndices={[1]}
      >
        {/* Cinematic Header Block */}
        <View style={styles.immersiveHeaderContainer}>
          {/* Immersive Background */}
          <View style={styles.immersiveBackground}>
            {progress?.[0]?.story?.coverImage ? (
              <Image
                source={{ uri: api.resolveImageUrl(progress[0].story.coverImage) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                blurRadius={60}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary }]} />
            )}
            <LinearGradient
              colors={['transparent', colors.background]}
              style={StyleSheet.absoluteFill}
            />
          </View>

          {/* Floating Actions Overlay */}
          <View style={styles.floatingHeaderActions}>
            <TouchableOpacity style={styles.headerCircleBtn} onPress={() => router.back()}>
              <IconSymbol name="arrow.left" size={20} color={colors.text} />
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {currentUser?.role === 'admin' && (
                <TouchableOpacity
                  style={[styles.headerCircleBtn, { backgroundColor: showHidden ? colors.error + '30' : 'rgba(0,0,0,0.3)' }]}
                  onPress={() => setShowHidden(!showHidden)}>
                  <IconSymbol name={showHidden ? "eye.fill" : "eye.slash.fill"} size={18} color={showHidden ? colors.error : colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Core Profile Info */}
          <View style={styles.heroInfoContent}>
            {profile.user?.avatar ? (
              <Image source={{ uri: api.resolveImageUrl(profile.user.avatar) }} style={[styles.heroAvatar, { borderColor: colors.primary }]} contentFit="cover" />
            ) : (
              <View style={[styles.heroAvatar, { backgroundColor: colors.primary, borderColor: colors.primary, justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={styles.heroAvatarText}>{profile.user?.username?.[0]?.toUpperCase()}</Text>
              </View>
            )}

            <Text style={[styles.heroName, { color: colors.text }]}>{profile.user?.username}</Text>

            {profile.user?.bio ? (
              <Text style={[styles.heroBio, { color: colors.textSecondary }]}>{profile.user.bio}</Text>
            ) : null}

            {/* Glassmorphic Stats Row */}
            <View style={styles.glassStatRow}>
              {[
                { label: 'Stories', value: profile.stats.totalStories, color: colors.primary, icon: 'book.fill' as const },
                { label: 'Finished', value: profile.stats.completed, color: StatusColors.Completed, icon: 'checkmark.circle.fill' as const },
                { label: 'Chapters', value: profile.stats.totalChaptersRead, color: colors.accent, icon: 'doc.text.fill' as const },
                { label: 'Friends', value: profile.friendCount, color: colors.success, icon: 'person.2.fill' as const },
              ].map((stat) => (
                <View key={stat.label} style={[styles.glassStatCard, { backgroundColor: colors.surfaceElevated + '80' }]}>
                  <Text style={[styles.glassStatValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.glassStatLabel, { color: colors.textSecondary }]}>{stat.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>

            {/* Friendship Action */}
            {currentUser?._id !== id && (
              <View style={styles.heroActionRow}>
                {profile.isFriend ? (
                  <TouchableOpacity
                    style={[styles.premiumActionBtn, { backgroundColor: colors.surfaceElevated + '80', borderColor: colors.border }]}
                    onPress={() => showConfirm('Remove Friend', `Are you sure?`, () => handleAction('remove'))}>
                    <IconSymbol name="person.badge.minus" size={16} color={colors.error} />
                    <Text style={[styles.premiumActionText, { color: colors.error }]}>REMOVE FRIEND</Text>
                  </TouchableOpacity>
                ) : profile.requestStatus?.sent ? (
                  <TouchableOpacity style={styles.premiumActionBtn} onPress={() => handleAction('cancel')}>
                    <Text style={styles.premiumActionText}>CANCEL REQUEST</Text>
                  </TouchableOpacity>
                ) : profile.requestStatus?.received ? (
                  <TouchableOpacity style={[styles.premiumActionBtn, { backgroundColor: colors.primary }]} onPress={() => handleAction('accept')}>
                    <Text style={styles.premiumActionText}>ACCEPT REQUEST</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={[styles.premiumActionBtn, { backgroundColor: colors.primary }]} onPress={() => handleAction('send')}>
                    <IconSymbol name="person.badge.plus" size={16} color="#FFF" />
                    <Text style={styles.premiumActionText}>ADD FRIEND</Text>
                  </TouchableOpacity>
                )}
              </View>
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

        {/* Modern Segmented Tab Selector */}
        <View style={[styles.tabContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.tabs, { backgroundColor: colors.surfaceElevated + '50' }]}>
            {[
              { id: 'progress', label: 'READING', icon: 'book.fill' as const },
              { id: 'collections', label: 'COLLECTIONS', icon: 'folder.fill' as const },
              { id: 'mutual', label: 'MUTUAL', icon: 'person.2.fill' as const },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TouchableOpacity
                  key={tab.id}
                  style={[styles.tab, isActive && { backgroundColor: colors.primary }]}
                  onPress={() => setActiveTab(tab.id as any)}
                  activeOpacity={0.8}
                >
                  <IconSymbol
                    name={tab.icon}
                    size={14}
                    color={isActive ? '#FFF' : colors.textSecondary}
                  />
                  <Text style={[styles.tabText, { color: isActive ? '#FFF' : colors.textSecondary }]}>
                    {tab.label}
                    {tab.id === 'mutual' && mutualFriends.length > 0 && ` (${mutualFriends.length})`}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Content */}
        <View style={styles.content}>
          {activeTab === 'progress' && (
            (profile.isFriend || currentUser?._id === id) ? (
              <View>
                <View style={styles.sectionTabHeader}>
                  <Text style={[styles.sectionTitleSmall, { color: colors.textSecondary }]}>
                    {progress.length} {progress.length === 1 ? 'Title' : 'Titles'}
                  </Text>
                  <View style={[styles.viewToggle, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    {[
                      { mode: 'list', icon: 'list.bullet' as const },
                      { mode: 'grid', icon: 'square.grid.2x2.fill' as const },
                      { mode: 'compact', icon: 'square.grid.3x3.fill' as const }
                    ].map((item) => (
                      <TouchableOpacity
                        key={item.mode}
                        style={[styles.toggleBtn, viewMode === item.mode && { backgroundColor: colors.surface }]}
                        onPress={() => setViewMode(item.mode as any)}>
                        <IconSymbol
                          name={item.icon}
                          size={16}
                          color={viewMode === item.mode ? colors.primary : colors.textSecondary}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {(() => {
                  const filteredProgress = showHidden
                    ? progress.filter(p => p.isPrivate)
                    : progress;

                  if (filteredProgress.length === 0) {
                    return (
                      <View style={styles.emptyContainer}>
                        <IconSymbol
                          name={showHidden ? "eye.slash.fill" : "tray.fill"}
                          size={40}
                          color={colors.textSecondary + '40'}
                        />
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          {showHidden ? 'This user has no hidden stories' : 'No public stories found'}
                        </Text>
                      </View>
                    );
                  }

                  return (
                    <View style={viewMode === 'grid' ? styles.gridContainer : viewMode === 'compact' ? styles.compactGrid : null}>
                      {filteredProgress.map((item: any) => {
                        const itemKey = `${viewMode}-${item._id}`;
                        return (
                          <TouchableOpacity
                            key={itemKey}
                            style={[
                              viewMode === 'grid' && [styles.gridCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }],
                              viewMode === 'compact' && styles.compactCard
                            ]}
                            onPress={() => router.push(`/story/${item.story?._id}` as any)}>

                            {viewMode === 'list' ? (
                              <View style={[styles.libListCard, { borderColor: colors.border + '20' }]}>
                                {/* Full-bleed cover background */}
                                {item.story?.coverImage ? (
                                  <Image
                                    source={{ uri: api.resolveImageUrl(item.story.coverImage) }}
                                    style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                                    contentFit="cover"
                                    blurRadius={1}
                                  />
                                ) : (
                                  <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.surfaceElevated }]} />
                                )}

                                {/* Cinematic gradient */}
                                <LinearGradient
                                  colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.92)']}
                                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                  style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%' }]}
                                />

                                {/* Content overlay */}
                                <View style={styles.libListOverlay}>
                                  {/* Left: cover thumbnail + status accent */}
                                  <View style={styles.libListLeft}>
                                    {item.story?.coverImage ? (
                                      <Image source={{ uri: api.resolveImageUrl(item.story.coverImage) }} style={styles.libListThumb} contentFit="cover" />
                                    ) : (
                                      <View style={[styles.libListThumb, { backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' }]}>
                                        <IconSymbol name="book.fill" size={20} color="rgba(255,255,255,0.5)" />
                                      </View>
                                    )}
                                    {/* Status accent bar under thumbnail */}
                                    <View style={[styles.libListThumbAccent, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
                                  </View>

                                  {/* Right: text info */}
                                  <View style={styles.libListInfo}>
                                    <Text style={styles.libListTitle} numberOfLines={1}>
                                      {item.story?.title}
                                    </Text>
                                    <Text style={styles.libListAuthor} numberOfLines={1}>
                                      {item.story?.author || (item.story?.type || 'Story')}
                                    </Text>

                                    <View style={styles.libListMeta}>
                                      <View style={[styles.libListStatusPill, { backgroundColor: (StatusColors[item.status] || colors.primary) + '50' }]}>
                                        <Text style={styles.libListStatusText}>{item.status.toUpperCase()}</Text>
                                      </View>
                                      <Text style={styles.libListChapter}>
                                        {item.story?.type === 'Anime' ? `S${item.currentSeason || 1} E${item.currentChapter || 0}` : `Ch. ${item.currentChapter || 0}`}
                                        {item.story?.totalChapters ? ` / ${item.story.totalChapters}` : ''}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* Badges */}
                                {item.isMutual && (
                                  <View style={styles.libListFavBadge}>
                                    <IconSymbol name="person.2.fill" size={10} color={colors.primary} />
                                  </View>
                                )}
                                {item.isPrivate && (
                                  <View style={styles.libListLockBadge}>
                                    <IconSymbol name="lock.fill" size={9} color="rgba(255,255,255,0.8)" />
                                  </View>
                                )}
                              </View>
                            ) : (
                              <View>
                                {item.story?.coverImage ? (
                                  <Image
                                    source={{ uri: api.resolveImageUrl(item.story?.coverImage) }}
                                    style={[
                                      viewMode === 'grid' && styles.gridCover,
                                      viewMode === 'compact' && styles.compactCover,
                                      { borderColor: colors.cardBorder }
                                    ]}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={[
                                    viewMode === 'grid' && styles.gridCover,
                                    viewMode === 'compact' && styles.compactCover,
                                    styles.placeholderCover,
                                    { backgroundColor: colors.surfaceElevated }
                                  ]}>
                                    <IconSymbol name="book.fill" size={viewMode === 'compact' ? 20 : 24} color={colors.textSecondary} />
                                  </View>
                                )}

                                {/* Mutual Badge */}
                                {item.isMutual && (
                                  <View style={[
                                    styles.mutualBadge,
                                    { backgroundColor: colors.primary },
                                    viewMode === 'compact' && styles.mutualBadgeMini
                                  ]}>
                                    <IconSymbol name="person.2.fill" size={viewMode === 'compact' ? 8 : 10} color="#FFF" />
                                  </View>
                                )}

                                {/* Private Badge */}
                                {item.isPrivate && (
                                  <View style={[
                                    styles.privateBadge,
                                    { backgroundColor: colors.error },
                                    viewMode === 'compact' && styles.privateBadgeMini
                                  ]}>
                                    <IconSymbol name="lock.fill" size={viewMode === 'compact' ? 8 : 10} color="#FFF" />
                                  </View>
                                )}
                              </View>
                            )}

                            {/* Info Section for Grid/Compact */}
                            {viewMode === 'grid' && (
                              <View style={styles.gridInfo}>
                                <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={1}>{item.story?.title}</Text>
                                <View style={styles.gridMeta}>
                                  <View style={[styles.miniStatusDot, { backgroundColor: StatusColors[item.status] || colors.primary }]} />
                                  <Text style={[styles.gridChapter, { color: colors.primary }]}>Ch. {item.currentChapter}</Text>
                                </View>
                              </View>
                            )}

                            {viewMode === 'compact' && (
                              <Text style={[styles.compactTitle, { color: colors.text }]} numberOfLines={1}>
                                {item.story?.title}
                              </Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </View>
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
                    <Image source={{ uri: api.resolveImageUrl(friend.avatar) }} style={styles.avatarMini} contentFit="cover" />
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
  immersiveHeaderContainer: {
    paddingTop: 20,
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  immersiveBackground: {
    ...StyleSheet.absoluteFillObject,
    zIndex: -1,
  },
  floatingHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: 20,
  },
  headerCircleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroInfoContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 10,
    alignItems: 'center',
  },
  heroAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    ...Shadows.md,
  },
  heroAvatarText: { color: '#FFF', fontSize: 32, fontWeight: '900' },
  heroName: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  heroBio: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.xl,
    opacity: 0.7,
  },
  glassStatRow: {
    flexDirection: 'row',
    gap: 8,
    width: '100%',
    justifyContent: 'center',
    marginBottom: 20,
  },
  glassStatCard: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  glassStatValue: { fontSize: 16, fontWeight: '900' },
  glassStatLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 },
  heroActionRow: { width: '100%', alignItems: 'center' },
  premiumActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  premiumActionText: { color: '#FFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    padding: 4,
    borderRadius: 14,
    gap: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 10,
  },
  tabText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  tabContainer: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.05)',
    zIndex: 10,
  },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  locked: { alignItems: 'center', paddingTop: 60, gap: Spacing.md },
  lockedText: { fontSize: 14, textAlign: 'center', fontWeight: '500' },
  sectionTabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitleSmall: { fontSize: 12, fontWeight: '900', opacity: 0.5, letterSpacing: 1 },
  viewToggle: { flexDirection: 'row', borderRadius: 8, padding: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  toggleBtn: { width: 32, height: 32, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  libListCard: {
    height: 120,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
    width: '100%',
    position: 'relative',
    backgroundColor: '#000',
    ...Shadows.md,
  },
  libListOverlay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    paddingRight: 10,
    gap: 15,
  },
  libListLeft: { alignItems: 'center', gap: 6 },
  libListThumb: { width: 65, height: 90, borderRadius: BorderRadius.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  libListThumbAccent: { width: 30, height: 4, borderRadius: 2 },
  libListInfo: { flex: 1, justifyContent: 'center' },
  libListTitle: { color: '#FFF', fontSize: 16, fontWeight: '900', letterSpacing: -0.3, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  libListAuthor: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  libListMeta: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  libListStatusPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4 },
  libListStatusText: { color: '#FFF', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
  libListChapter: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800' },
  libListFavBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255,255,255,0.9)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  libListLockBadge: { position: 'absolute', top: 8, right: 34, backgroundColor: 'rgba(0,0,0,0.5)', width: 20, height: 20, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  placeholderCover: { justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  emptyText: { fontSize: 13, textAlign: 'center', fontWeight: '800', opacity: 0.5 },
  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  gridCard: { width: '48%', borderRadius: BorderRadius.lg, borderWidth: 1, overflow: 'hidden', marginBottom: Spacing.md },
  gridCover: { width: '100%', height: 180 },
  gridInfo: { padding: Spacing.sm },
  gridTitle: { fontSize: 13, fontWeight: '700', marginBottom: 6 },
  gridMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniStatusDot: { width: 8, height: 8, borderRadius: 4 },
  gridChapter: { fontSize: 11, fontWeight: '800' },
  compactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  compactCard: { width: '31%', marginBottom: Spacing.sm },
  compactCover: { width: '100%', height: 140, borderRadius: BorderRadius.md, borderWidth: 1 },
  compactTitle: { fontSize: 10, fontWeight: '600', marginTop: 4, textAlign: 'center' },
  mutualBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  mutualBadgeMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    top: 4,
    right: 4,
    borderWidth: 1.5,
  },
  privateBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  privateBadgeMini: {
    width: 16,
    height: 16,
    borderRadius: 8,
    top: 4,
    left: 4,
    borderWidth: 1.5,
  },
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
});
