import { ConfirmModal } from '@/components/ui/confirm-modal';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import * as Updates from 'expo-updates';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useTheme } from '@/store/ThemeContext';
import { useToast } from '@/store/ToastContext';

// ─── App Update System (OTA via expo-updates + changelog from version.json) ───
const APP_VERSION = '2.0.0';
const CHANGELOG_URL = 'https://raw.githubusercontent.com/FaroukMBen/chrollomark/main/version.json';

interface UpdateInfo {
  version: string;
  changelog: string[];
  downloadUrl: string;
  mandatory: boolean;
  isOTA?: boolean; // true when detected via expo-updates
}

export default function ProfileScreen() {
  const { user, isAuthenticated, logout, updateUser } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { themeMode, setThemeMode } = useTheme();

  const [stats, setStats] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const { showToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Update system
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [applyingUpdate, setApplyingUpdate] = useState(false);
  const [isLogoutConfirmVisible, setIsLogoutConfirmVisible] = useState(false);

  useEffect(() => {
    if (user) {
      setEditUsername(user.username);
      setEditBio(user.bio || '');
      setEditAvatar(user.avatar || null);
    }
  }, [user]);

  const loadData = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const statsData = await api.getProgressStats();
      setStats(statsData);
    } catch (error) {
      console.log('Error:', error);
    }
  }, [isAuthenticated]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const checkForUpdates = async () => {
    setCheckingUpdate(true);
    try {
      // Try OTA update first (works in production builds)
      if (!__DEV__) {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            // Fetch changelog from version.json
            let changelog: string[] = [];
            let version = 'New';
            let mandatory = false;
            try {
              const r = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
              const data = await r.json();
              changelog = data.changelog || [];
              version = data.version || 'New';
              mandatory = data.mandatory || false;
            } catch { /* no changelog available */ }
            setUpdateInfo({ version, changelog, downloadUrl: '', mandatory, isOTA: true });
            
            if (mandatory) {
               applyOTAUpdate(); // Trigger auto-download
            }
            setCheckingUpdate(false);
            return;
          }
        } catch (e) {
          console.log('Native update check failed, using fallback:', e);
        }
      }

      // Fallback: check version.json for APK updates or in dev mode
      const response = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
      if (!response.ok) throw new Error('Network error');
      const data: UpdateInfo = await response.json();
      if (data.version && data.version !== APP_VERSION) {
        setUpdateInfo({ ...data, isOTA: false });
      } else {
        showToast({ message: 'You are on the latest version!', type: 'success' });
        setUpdateInfo(null);
      }
    } catch {
      // In dev mode, version.json might not exist on GitHub yet
      showToast({ message: __DEV__ ? 'Update check skipped in dev mode' : 'Could not check for updates', type: 'error' });
    } finally {
      setCheckingUpdate(false);
    }
  };

  const applyOTAUpdate = async () => {
    setApplyingUpdate(true);
    try {
      // First, fetch the actual bundle
      await Updates.fetchUpdateAsync();
      
      showToast({ message: 'Update downloaded! Restarting...', type: 'success' });
      
      // Give the user a 2-second buffer to see the success state
      setTimeout(async () => {
        await Updates.reloadAsync();
      }, 2000);
    } catch (e: any) {
      showToast({ message: `Update failed: ${e.message}. Try manual download.`, type: 'error' });
      setApplyingUpdate(false);
    }
  };

  // Auto-check on mount (silent, no error toast)
  useEffect(() => {
    if (!isAuthenticated) return;
    (async () => {
      try {
        if (!__DEV__) {
          try {
            const update = await Updates.checkForUpdateAsync();
            if (update.isAvailable) {
              let changelog: string[] = [];
              let version = 'New';
              let mandatory = false;
              try {
                const r = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
                const d = await r.json();
                changelog = d.changelog || [];
                version = d.version || 'New';
                mandatory = d.mandatory || false;
              } catch { /* */ }
              
              setUpdateInfo({ version, changelog, downloadUrl: '', mandatory, isOTA: true });

              // If mandatory, update itself (download and prompt)
              if (mandatory) {
                await Updates.fetchUpdateAsync();
                Alert.alert(
                  "Mandatory Update", 
                  "A critical update (v" + version + ") has been downloaded and is required to continue.",
                  [{ text: "Restart Now", onPress: () => Updates.reloadAsync() }]
                );
              }
              return;
            }
          } catch (e) {
             console.log('Silent update check failed:', e);
          }
        }
        const r = await fetch(CHANGELOG_URL, { cache: 'no-cache' });
        const data = await r.json();
        if (data.version && data.version !== APP_VERSION) {
          setUpdateInfo({ ...data, isOTA: false });
        }
      } catch { /* silent */ }
    })();
  }, [isAuthenticated, APP_VERSION]);

  const handleLogout = () => {
    setIsLogoutConfirmVisible(true);
  };

  const handleSync = async () => {
    try {
      const count = await api.syncMutations();
      showToast({ message: `Synced ${count} changes!`, type: 'success' });
      await loadData();
    } catch (e: any) {
      showToast({ message: `Sync failed: ${e.message}`, type: 'error' });
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      setEditAvatar(result.assets[0].uri);
    }
  };

  const saveProfile = async () => {
    setIsSaving(true);
    try {
      const formData = new FormData();
      if (editUsername !== user?.username) formData.append('username', editUsername.trim());
      if (editBio !== user?.bio) formData.append('bio', editBio.trim());

      if (editAvatar && editAvatar !== user?.avatar) {
        if (editAvatar.startsWith('file://') || editAvatar.startsWith('content://')) {
          const filename = editAvatar.split('/').pop() || 'avatar.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const fileType = match ? `image/${match[1]}` : 'image';
          // @ts-ignore
          formData.append('avatar', { uri: editAvatar, name: filename, type: fileType });
        } else {
          formData.append('avatar', editAvatar.trim());
        }
      }

      const updatedUser = await api.updateProfile(formData);
      updateUser(updatedUser);
      setIsEditing(false);
      showToast({ message: 'Profile updated!', type: 'success' });
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const completionRate = stats && stats.totalStories > 0
    ? Math.round((stats.completed / stats.totalStories) * 100)
    : 0;

  if (!isAuthenticated) {
    return (
      <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <IconSymbol name="person.crop.circle" size={64} color={colors.textSecondary} />
          <Text style={[styles.welcomeTitle, { color: colors.text }]}>Welcome to ChrolloMark</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to track your reading progress, connect with friends, and more
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const overviewStats = [
    { label: 'Chapters', value: stats?.totalChaptersRead ?? 0, color: colors.primary },
    { label: 'Favorites', value: stats?.favorites ?? 0, color: colors.accent },
    { label: 'Completion', value: `${completionRate}%`, color: colors.success },
    { label: 'This Week', value: stats?.readThisWeek ?? 0, color: colors.error },
  ];

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}>

        {/* ─── PROFILE HEADER ─── */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={styles.profileTop}>
            {isEditing ? (
              <TouchableOpacity onPress={pickImage} style={[styles.avatar, { backgroundColor: colors.primary }]}>
                {editAvatar ? (
                  <Image source={{ uri: editAvatar }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <IconSymbol name="photo" size={28} color="#FFF" />
                )}
                <View style={[styles.editBadge, { backgroundColor: colors.accent }]}>
                  <IconSymbol name="pencil" size={10} color="#FFF" />
                </View>
              </TouchableOpacity>
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                {user?.avatar ? (
                  <Image source={{ uri: user.avatar }} style={styles.avatarImage} contentFit="cover" />
                ) : (
                  <Text style={styles.avatarText}>{user?.username?.[0]?.toUpperCase()}</Text>
                )}
              </View>
            )}

            <View style={styles.profileInfo}>
              {isEditing ? (
                <TextInput
                  style={[styles.editInput, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                  value={editUsername}
                  onChangeText={setEditUsername}
                  placeholder="Username"
                  placeholderTextColor={colors.textSecondary}
                />
              ) : (
                <>
                  <Text style={[styles.profileName, { color: colors.text }]}>{user?.username}</Text>
                  <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>{user?.email}</Text>
                </>
              )}
            </View>

            {!isEditing && (
              <View style={styles.headerRightActions}>
                 <TouchableOpacity 
                   style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]} 
                   onPress={() => setIsEditing(true)}>
                   <IconSymbol name="pencil" size={16} color={colors.text} />
                 </TouchableOpacity>
              </View>
            )}
          </View>

          {isEditing ? (
            <View style={styles.editSection}>
              <TextInput
                style={[styles.editInput, styles.textArea, { backgroundColor: colors.surfaceElevated, borderColor: colors.border, color: colors.text }]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="Write a short bio..."
                placeholderTextColor={colors.textSecondary}
                multiline
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.editBtn, { borderColor: colors.border }]} onPress={() => setIsEditing(false)}>
                  <Text style={{ color: colors.text, fontWeight: '600', fontSize: 13 }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]} onPress={saveProfile}>
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 13 }}>{isSaving ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              {user?.bio ? <Text style={[styles.bio, { color: colors.textSecondary }]}>{user.bio}</Text> : null}
              <TouchableOpacity 
                style={[styles.viewPublicBtn, { backgroundColor: colors.primary + '10', borderColor: colors.primary + '20' }]} 
                onPress={() => user?._id && router.push(`/user/${user._id}` as any)}>
                <IconSymbol name="eye.fill" size={14} color={colors.primary} />
                <Text style={[styles.viewPublicText, { color: colors.primary }]}>View Public Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ─── STATS OVERVIEW (fixed 4-column grid) ─── */}
        {stats && (
          <>
            <View style={[styles.overviewCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
              {overviewStats.map((stat, i) => (
                <React.Fragment key={stat.label}>
                  {i > 0 && <View style={[styles.overviewDivider, { backgroundColor: colors.border }]} />}
                  <View style={styles.overviewStat}>
                    <Text style={[styles.overviewValue, { color: stat.color }]}>{stat.value}</Text>
                    <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* Status Grid */}
            <View style={styles.statusGrid}>
              {[
                { label: 'Total', value: stats.totalStories, color: colors.text, icon: 'book.fill' as const },
                { label: 'Reading', value: stats.reading, color: StatusColors.Reading, icon: 'book.fill' as const },
                { label: 'Completed', value: stats.completed, color: StatusColors.Completed, icon: 'checkmark.circle.fill' as const },
                { label: 'Planned', value: stats.planToRead, color: StatusColors['Plan to Read'], icon: 'bookmark.fill' as const },
                { label: 'On Hold', value: stats.onHold, color: StatusColors['On Hold'], icon: 'pause.circle.fill' as const },
                { label: 'Dropped', value: stats.dropped, color: StatusColors.Dropped, icon: 'xmark.circle.fill' as const },
              ].map((stat) => (
                <View key={stat.label} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
                  <View style={[styles.statIconBg, { backgroundColor: stat.color + '15' }]}>
                    <IconSymbol name={stat.icon} size={14} color={stat.color} />
                  </View>
                  <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ─── UPDATE AVAILABLE ─── */}
        {updateInfo && (
          <View style={[styles.updateCard, { 
            backgroundColor: updateInfo.mandatory ? colors.error + '10' : '#FF674015', 
            borderColor: updateInfo.mandatory ? colors.error : '#FF6740',
            borderWidth: updateInfo.mandatory ? 2 : 1
          }]}>
            <View style={styles.updateHeader}>
              <View style={styles.updateTitleRow}>
                <IconSymbol name={updateInfo.mandatory ? "exclamationmark.triangle.fill" : "sparkles"} size={18} color={updateInfo.mandatory ? colors.error : "#FF6740"} />
                <Text style={[styles.updateTitle, { color: colors.text, fontWeight: updateInfo.mandatory ? '900' : '800' }]}>
                  {updateInfo.mandatory ? 'MANDATORY UPDATE' : 'Update Available'}
                </Text>
              </View>
              <View style={[styles.versionBadge, { backgroundColor: '#FF674025' }]}>
                <Text style={styles.versionText}>v{updateInfo.version}</Text>
              </View>
            </View>
            {updateInfo.changelog?.length > 0 && (
              <View style={styles.changelogList}>
                {updateInfo.changelog.map((item, i) => (
                  <View key={i} style={styles.changelogItem}>
                    <Text style={[styles.changelogBullet, { color: '#FF6740' }]}>•</Text>
                    <Text style={[styles.changelogText, { color: colors.textSecondary }]}>{item}</Text>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[
                styles.updateBtn, 
                { backgroundColor: updateInfo.mandatory ? colors.error : colors.primary, opacity: applyingUpdate ? 0.6 : 1 }
              ]}
              disabled={applyingUpdate}
              onPress={() => {
                if (updateInfo.isOTA) {
                  applyOTAUpdate();
                } else if (updateInfo.downloadUrl) {
                  Linking.openURL(updateInfo.downloadUrl);
                }
              }}>
              <IconSymbol name={applyingUpdate ? "arrow.2.circlepath" : (updateInfo.isOTA ? "sparkles" : "arrow.down.doc.fill")} size={14} color="#FFF" />
              <Text style={styles.updateBtnText}>
                {applyingUpdate ? 'Implementing Changes...' : 
                 updateInfo.isOTA ? 'Agree & Update Now' : 
                 'Update to Latest Version'}
              </Text>
            </TouchableOpacity>
            {updateInfo.mandatory && !applyingUpdate && (
              <Text style={[styles.mandatoryHint, { color: colors.textSecondary }]}>
                This update is required for real-time social features.
              </Text>
            )}
          </View>
        )}


        {/* ─── DEVELOPER HUB ─── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <IconSymbol name="terminal.fill" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Developer Hub</Text>
          </View>
          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/profile/dev-log')}>
            <View style={styles.settingHeader}>
              <IconSymbol name="list.bullet.rectangle.portrait" size={15} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dev Log & Roadmaps</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
        
        {/* ─── ADMIN PANEL ─── */}
        {user?.role === 'admin' && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <IconSymbol name="lock.fill" size={16} color={colors.error} />
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Admin Panel</Text>
            </View>
            <TouchableOpacity
              style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
              onPress={() => router.push('/profile/admin')}>
              <View style={styles.settingHeader}>
                <IconSymbol name="shield.fill" size={15} color={colors.error} />
                <Text style={[styles.settingLabel, { color: colors.text }]}>Admin Dashboard</Text>
              </View>
              <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ─── SUPPORT ─── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <IconSymbol name="questionmark.circle.fill" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Support & Feedback</Text>
          </View>
          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/profile/feedback')}>
            <View style={styles.settingHeader}>
              <IconSymbol name="bubble.left.fill" size={15} color={colors.success} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Give Feedback</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={() => router.push('/profile/report-bug')}>
            <View style={styles.settingHeader}>
              <IconSymbol name="ant.fill" size={15} color={colors.error} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Report a Bug</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* ─── SETTINGS ─── */}
        <View style={styles.section}>
          <View style={styles.sectionTitleRow}>
            <IconSymbol name="gear" size={16} color={colors.text} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
          </View>

          {/* Appearance */}
          <View style={[styles.settingCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
            <View style={styles.settingHeader}>
              <IconSymbol name="paintbrush.fill" size={15} color={colors.primary} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Appearance</Text>
            </View>
            <View style={styles.themeOptions}>
              {([['light', 'sun.max.fill', 'Light'], ['dark', 'moon.fill', 'Dark'], ['system', 'gear', 'System']] as const).map(([mode, icon, label]) => (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeOption, {
                    backgroundColor: themeMode === mode ? colors.primary + '15' : 'transparent',
                    borderColor: themeMode === mode ? colors.primary : colors.border,
                  }]}
                  onPress={() => setThemeMode(mode)}>
                  <IconSymbol name={icon as any} size={16} color={themeMode === mode ? colors.primary : colors.textSecondary} />
                  <Text style={[styles.themeText, { color: themeMode === mode ? colors.primary : colors.textSecondary }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Check for Updates */}
          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={checkForUpdates}
            disabled={checkingUpdate}>
            <View style={styles.settingHeader}>
              <IconSymbol name="sparkles" size={15} color="#FF6740" />
              <Text style={[styles.settingLabel, { color: colors.text }]}>
                {checkingUpdate ? 'Checking...' : 'Check for Updates'}
              </Text>
            </View>
            <Text style={[styles.versionLabel, { color: colors.textSecondary }]}>v{APP_VERSION}</Text>
          </TouchableOpacity>

          {/* Sync */}
          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
            onPress={handleSync}>
            <View style={styles.settingHeader}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={15} color={colors.success} />
              <Text style={[styles.settingLabel, { color: colors.text }]}>Sync Offline Changes</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Logout */}
          <TouchableOpacity
            style={[styles.settingCard, styles.actionCard, { backgroundColor: colors.surface, borderColor: colors.error + '20' }]}
            onPress={handleLogout}>
            <View style={styles.settingHeader}>
              <IconSymbol name="rectangle.portrait.and.arrow.right" size={15} color={colors.error} />
              <Text style={[styles.settingLabel, { color: colors.error }]}>Logout</Text>
            </View>
            <IconSymbol name="chevron.right" size={14} color={colors.error} />
          </TouchableOpacity>
        </View>
      <ConfirmModal
        visible={isLogoutConfirmVisible}
        title="Logout"
        message="Are you sure you want to logout?"
        onConfirm={() => {
          setIsLogoutConfirmVisible(false);
          logout();
        }}
        onCancel={() => setIsLogoutConfirmVisible(false)}
      />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.xl },
  welcomeTitle: { fontSize: 22, fontWeight: '800', marginTop: Spacing.lg, marginBottom: Spacing.sm },
  scrollContent: { paddingBottom: 100 },

  // Profile Card
  profileCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  profileTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 34 },
  avatarText: { color: '#FFF', fontSize: 26, fontWeight: '800' },
  editBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  profileEmail: { fontSize: 12, marginTop: 2, fontWeight: '500' },
  bio: { fontSize: 13, marginTop: Spacing.md, lineHeight: 18 },
  viewPublicBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  viewPublicText: { fontSize: 13, fontWeight: '700' },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'absolute',
    top: 0,
    right: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSection: { marginTop: Spacing.md, gap: Spacing.sm },
  editInput: { padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, fontSize: 14 },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: Spacing.sm },
  editBtn: { flex: 1, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: 'center' },

  // Overview Card — fixed uniform grid
  overviewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  overviewStat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overviewValue: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  overviewLabel: { fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center' },
  overviewDivider: { width: 1, height: 28 },

  // Status Grid
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  statCard: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: 3,
  },
  statIconBg: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 9, fontWeight: '600' },

  // Update Card
  updateCard: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
  },
  updateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  updateTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  updateTitle: { fontSize: 15, fontWeight: '700' },
  versionBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.full },
  versionText: { color: '#FF6740', fontSize: 11, fontWeight: '700' },
  changelogList: { gap: 4, marginBottom: Spacing.sm },
  changelogItem: { flexDirection: 'row', gap: 6, paddingRight: Spacing.md },
  changelogBullet: { fontSize: 14, fontWeight: '700' },
  changelogText: { fontSize: 12, lineHeight: 17, flex: 1 },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
  },
  updateBtnText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Section
  section: { paddingHorizontal: Spacing.lg, marginTop: Spacing.xl },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  newCollectionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  newCollectionText: { fontSize: 11, fontWeight: '700' },


  // Empty
  emptyCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    borderWidth: 1,
    gap: 6,
  },
  emptyCardText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Settings
  settingCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  actionCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settingHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settingLabel: { fontSize: 13, fontWeight: '600' },
  versionLabel: { fontSize: 12, fontWeight: '500' },
  themeOptions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 4,
  },
  themeText: { fontSize: 11, fontWeight: '600' },
  mandatoryHint: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
    opacity: 0.7
  },
});
