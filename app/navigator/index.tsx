import { WebView, WebViewNavigation } from 'react-native-webview';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInDown, 
  SlideOutDown, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withRepeat,
  withSequence,
  useSharedValue
} from 'react-native-reanimated';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { ADBLOCK_DOMAIN_LIST, ADBLOCK_INJECTED_JS } from '@/services/adblock';
import { useToast } from '@/store/ToastContext';
import { useAuth } from '@/store/AuthContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_TABS = 5;

interface Tab {
  id: string;
  url: string;
  title: string;
  isLoading: boolean;
  progress: number;
  canGoBack: boolean;
  canGoForward: boolean;
}

interface Bookmark {
  _id: string;
  title: string;
  url: string;
  icon?: string;
}

export default function NavigatorScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();
  const { user, updateUser } = useAuth();
  
  // Tab Management
  const [tabs, setTabs] = useState<Tab[]>([{
    id: 'initial',
    url: '',
    title: 'New Tab',
    isLoading: false,
    progress: 0,
    canGoBack: false,
    canGoForward: false,
  }]);
  const [activeTabId, setActiveTabId] = useState('initial');
  const [showTabManager, setShowTabManager] = useState(false);
  
  // Browser UI State
  const [inputUrl, setInputUrl] = useState('');
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [isSyncingBookmarks, setIsSyncingBookmarks] = useState(false);
  const [isAdBlockEnabled, setIsAdBlockEnabled] = useState(true);
  
  const shieldPulse = useSharedValue(1);
  const coreScale = useSharedValue(1);

  useEffect(() => {
    if (isAdBlockEnabled) {
        shieldPulse.value = withRepeat(
            withSequence(
                withTiming(1.2, { duration: 1500 }),
                withTiming(1, { duration: 1500 })
            ),
            -1,
            true
        );
    } else {
        shieldPulse.value = withTiming(1);
    }
  }, [isAdBlockEnabled]);

  const auraStyle = useAnimatedStyle(() => ({
    transform: [{ scale: shieldPulse.value }],
    opacity: withTiming(isAdBlockEnabled ? 0.4 : 0),
  }));

  const coreAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: coreScale.value }],
  }));

  // Pop-up Shield State
  const [popupRequest, setPopupRequest] = useState<{ url: string; origin: string } | null>(null);

  const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId)!, [tabs, activeTabId]);
  const isBookmarked = useMemo(() => {
    if (!activeTab.url) return false;
    return bookmarks.some(b => {
        // Simple domain matching or path matching
        const bUrl = b.url.replace(/\/$/, '');
        const aUrl = activeTab.url.replace(/\/$/, '');
        return aUrl.startsWith(bUrl);
    });
  }, [bookmarks, activeTab.url]);

  useEffect(() => {
    loadBookmarks();
    if (activeTab.url) setInputUrl(activeTab.url);
  }, []);

  const loadBookmarks = async () => {
    setIsSyncingBookmarks(true);
    try {
      const data = await api.getBookmarks();
      setBookmarks(data);
    } catch (err) {
      console.log('Load bookmarks error:', err);
    } finally {
      setIsSyncingBookmarks(false);
    }
  };

  // ─── Tab Operations ───
  const createTab = (targetUrl: string = '') => {
    if (tabs.length >= MAX_TABS) {
      showToast({ message: 'Max tabs reached', type: 'error' });
      return;
    }
    const newId = Math.random().toString(36).substring(7);
    const newTab = {
      id: newId,
      url: targetUrl,
      title: 'New Tab',
      isLoading: false,
      progress: 0,
      canGoBack: false,
      canGoForward: false,
    };
    setTabs([...tabs, newTab]);
    setActiveTabId(newId);
    setInputUrl(targetUrl);
    setShowTabManager(false);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) {
      // If closing last tab, reset it
      setTabs([{
        id: 'initial',
        url: '',
        title: 'New Tab',
        isLoading: false,
        progress: 0,
        canGoBack: false,
        canGoForward: false,
      }]);
      setActiveTabId('initial');
      setInputUrl('');
      return;
    }

    const index = tabs.findIndex(t => t.id === id);
    const newTabs = tabs.filter(t => t.id !== id);
    setTabs(newTabs);

    if (id === activeTabId) {
      const nextTab = newTabs[Math.min(index, newTabs.length - 1)];
      setActiveTabId(nextTab.id);
      setInputUrl(nextTab.url);
    }
  };

  const updateTab = (id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const navigateTo = (newUrl: string) => {
    let target = newUrl;
    if (!target.startsWith('http')) {
      target = `https://${target}`;
    }
    updateTab(activeTabId, { url: target });
    setInputUrl(target);
    Keyboard.dismiss();
  };

  const handleUrlSubmit = () => {
    if (inputUrl.trim()) {
      let finalUrl = inputUrl.trim();
      if (!finalUrl.includes('.') && !finalUrl.startsWith('http')) {
        // Google search logic
        finalUrl = `https://www.google.com/search?q=${encodeURIComponent(finalUrl)}`;
      } else if (!finalUrl.startsWith('http')) {
        finalUrl = `https://${finalUrl}`;
      }
      updateTab(activeTabId, { url: finalUrl });
      setInputUrl(finalUrl);
      Keyboard.dismiss();
    }
  };

  // ─── Pop-up & Shield Logic ───
  const handleOpenWindow = (event: any) => {
    const { targetUrl } = event.nativeEvent;
    if (!targetUrl) return;

    // 1. Auto-block obvious ad redirects
    const isKnownAd = ADBLOCK_DOMAIN_LIST.some(d => targetUrl.includes(d));
    if (isKnownAd) return;

    // 2. Check if host is pre-blocked
    let domain = '';
    const match = activeTab.url.match(/^(?:https?:\/\/)?(?:www\.)?([^/]+)/i);
    if (match) domain = match[1];
    
    if (user?.blockedDomains?.includes(domain)) {
        console.log('Pop-up auto-blocked for:', domain);
        return;
    }

    // 3. Request confirmation
    setPopupRequest({ url: targetUrl, origin: domain });
  };

  const handleBlockDomain = async (domain: string) => {
    try {
        const newList = [...(user?.blockedDomains || []), domain];
        await api.updateProfile({ blockedDomains: newList });
        updateUser({ blockedDomains: newList });
        setPopupRequest(null);
        showToast({ message: `Pop-ups blocked for ${domain}`, type: 'info' });
    } catch (err) {
        showToast({ message: 'Failed to block domain', type: 'error' });
    }
  };

  // ─── Browser UI Helpers ───
  const handleAddBookmark = async () => {
    if (!activeTab.url) return;
    try {
      const title = activeTab.title !== 'New Tab' ? activeTab.title : activeTab.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0];
      await api.addBookmark({ title, url: activeTab.url });
      showToast({ message: 'Added to Speed Dial', type: 'success' });
      loadBookmarks();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to add', type: 'error' });
    }
  };

  const webViewRefs = useRef<Record<string, WebView | null>>({});

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ─── Browser Header ─── */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => activeTab.url ? updateTab(activeTabId, { url: '' }) : router.back()}>
          <IconSymbol name={activeTab.url ? "xmark" : "chevron.left"} size={20} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.shieldToggle, { backgroundColor: isAdBlockEnabled ? colors.primary + '20' : colors.border }]} 
          onPress={() => {
            setIsAdBlockEnabled(!isAdBlockEnabled);
            showToast({ 
                message: isAdBlockEnabled ? 'Ad-Shield Disabled' : 'Ad-Shield Enabled', 
                type: isAdBlockEnabled ? 'info' : 'success' 
            });
          }}>
          <IconSymbol 
            name={isAdBlockEnabled ? "shield.fill" : "shield"} 
            size={18} 
            color={isAdBlockEnabled ? colors.primary : colors.textSecondary} 
          />
        </TouchableOpacity>

        <View style={[styles.urlBarContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="lock.fill" size={10} color={colors.success} style={{ marginRight: 8 }} />
          <TextInput
            style={[styles.urlInput, { color: colors.text }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            onSubmitEditing={handleUrlSubmit}
            placeholder="Search with Google"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            selectTextOnFocus
          />
        </View>

        <TouchableOpacity style={styles.iconBtn} onPress={handleAddBookmark}>
          <IconSymbol 
            name={isBookmarked ? "star.fill" : "star"} 
            size={20} 
            color={isBookmarked ? colors.primary : colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>

      {/* ─── WebView Stack (Multi-Tab) ─── */}
      <View style={{ flex: 1 }}>
        {tabs.map((tab) => (
          <View 
            key={tab.id} 
            style={[
              StyleSheet.absoluteFill, 
              { zIndex: tab.id === activeTabId ? 1 : 0, opacity: tab.id === activeTabId ? 1 : 0 },
              tab.id !== activeTabId && { pointerEvents: 'none' }
            ]}
          >
            {tab.url ? (
              <WebView
                ref={el => { webViewRefs.current[tab.id] = el; }}
                source={{ uri: tab.url }}
                style={{ flex: 1, backgroundColor: colors.background }}
                onNavigationStateChange={(s) => {
                  if (tab.id === activeTabId) {
                      updateTab(tab.id, { 
                          canGoBack: s.canGoBack, 
                          canGoForward: s.canGoForward, 
                          title: s.title || tab.title 
                      });
                      setInputUrl(s.url);
                  }
                }}
                onLoadStart={() => updateTab(tab.id, { isLoading: true, progress: 0 })}
                onLoadProgress={(e) => updateTab(tab.id, { progress: e.nativeEvent.progress })}
                onLoadEnd={() => updateTab(tab.id, { isLoading: false })}
                onShouldStartLoadWithRequest={(request) => {
                  if (!isAdBlockEnabled) return true;
                  const isAd = ADBLOCK_DOMAIN_LIST.some(d => request.url.includes(d));
                  return !isAd;
                }}
                setSupportMultipleWindows={true}
                javaScriptCanOpenWindowsAutomatically={true}
                onOpenWindow={handleOpenWindow}
                injectedJavaScript={isAdBlockEnabled ? ADBLOCK_INJECTED_JS : ""}
                allowsBackForwardNavigationGestures={true}
                userAgent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
              />
            ) : (
                /* Speed Dial View */
                <View style={styles.homeContent}>
                <View style={styles.homeHero}>
                  <View style={styles.homeHeroRow}>
                    <TouchableOpacity 
                        onPressIn={() => coreScale.value = withSpring(0.9)}
                        onPressOut={() => coreScale.value = withSpring(1)}
                        onPress={() => setIsAdBlockEnabled(!isAdBlockEnabled)}
                        style={styles.shieldCoreAnchor}
                        activeOpacity={1}>
                        
                        <Animated.View style={[
                            styles.shieldAura, 
                            { backgroundColor: colors.primary },
                            auraStyle
                        ]} />

                        <Animated.View style={[
                            styles.shieldCore,
                            { 
                                backgroundColor: isAdBlockEnabled ? colors.primary : colors.surfaceElevated,
                                borderColor: isAdBlockEnabled ? colors.primaryLight + '50' : colors.border
                            },
                            coreAnimatedStyle
                        ]}>
                            <IconSymbol 
                                name={isAdBlockEnabled ? "shield.fill" : "shield"} 
                                size={32} 
                                color={isAdBlockEnabled ? '#FFF' : colors.textSecondary} 
                            />
                        </Animated.View>
                    </TouchableOpacity>

                    <View style={styles.heroTextContainer}>
                         <Text style={[styles.homeTitle, { color: colors.text }]}>Safe Navigator</Text>
                         <View style={[styles.shieldStatusBadge, { backgroundColor: isAdBlockEnabled ? colors.success + '20' : colors.border + '40' }]}>
                            <Text style={[styles.shieldStatusText, { color: isAdBlockEnabled ? colors.success : colors.textSecondary }]}>
                                {isAdBlockEnabled ? 'ACTIVE' : 'DORMANT'}
                            </Text>
                        </View>
                    </View>
                  </View>

                  {/* Quick Actions Row */}
                  <View style={styles.quickActionsRow}>
                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/(tabs)/library')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: colors.surfaceElevated }]}>
                            <IconSymbol name="book.fill" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>Library</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/(tabs)/social')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: colors.surfaceElevated }]}>
                            <IconSymbol name="person.2.fill" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>Social</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.quickActionBtn} onPress={() => router.push('/(tabs)/profile')}>
                        <View style={[styles.quickActionIcon, { backgroundColor: colors.surfaceElevated }]}>
                            <IconSymbol name="person.crop.circle" size={24} color={colors.primary} />
                        </View>
                        <Text style={[styles.quickActionLabel, { color: colors.textSecondary }]}>Profile</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.bookmarkSection}>
                    <FlatList
                        data={bookmarks}
                        keyExtractor={item => item._id}
                        numColumns={4}
                        columnWrapperStyle={styles.bookmarkRow}
                        renderItem={({ item }) => (
                        <TouchableOpacity style={styles.bookmarkItem} onPress={() => navigateTo(item.url)} activeOpacity={0.7}>
                            <View style={[styles.bookmarkIconContainer, { backgroundColor: colors.surfaceElevated, borderColor: colors.cardBorder }]}>
                                <Text style={[styles.bookmarkInitial, { color: colors.primary }]}>{item.title.charAt(0).toUpperCase()}</Text>
                            </View>
                            <Text style={[styles.bookmarkTitle, { color: colors.text }]} numberOfLines={1}>{item.title}</Text>
                        </TouchableOpacity>
                        )}
                        ListHeaderComponent={<Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SPEED DIAL</Text>}
                    />
                </View>
              </View>
            )}
            
            {/* Progress bar per tab */}
            {tab.isLoading && tab.url && tab.id === activeTabId && (
              <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
                <View style={[styles.progressBar, { width: `${tab.progress * 100}%`, backgroundColor: colors.primary }]} />
              </View>
            )}
          </View>
        ))}
      </View>

      {/* ─── Tab Manager Modal ─── */}
      <Modal visible={showTabManager} transparent animationType="none">
        <BlurView intensity={20} tint={colorScheme === 'dark' ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
          <SafeAreaView style={styles.tabManagerOverlay}>
            <Animated.View entering={SlideInDown} exiting={SlideOutDown} style={[styles.tabManagerContainer, { backgroundColor: colors.surface }]}>
              <View style={styles.tabManagerHeader}>
                <Text style={[styles.tabManagerTitle, { color: colors.text }]}>Tabs ({tabs.length}/5)</Text>
                <TouchableOpacity onPress={() => setShowTabManager(false)}>
                  <IconSymbol name="xmark" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={styles.tabGrid}>
                {tabs.map((tab) => (
                  <TouchableOpacity 
                    key={tab.id} 
                    style={[styles.tabCard, { borderColor: tab.id === activeTabId ? colors.primary : colors.border }]}
                    onPress={() => { setActiveTabId(tab.id); setShowTabManager(false); }}>
                    <View style={[styles.tabCardHeader, { backgroundColor: colors.surfaceElevated }]}>
                        <Text style={[styles.tabCardTitle, { color: colors.text }]} numberOfLines={1}>{tab.title}</Text>
                        <TouchableOpacity onPress={() => closeTab(tab.id)}>
                            <IconSymbol name="xmark.circle.fill" size={16} color={colors.textSecondary} />
                        </TouchableOpacity>
                    </View>
                    <View style={[styles.tabCardPreview, { backgroundColor: colors.background }]}>
                        <IconSymbol name="globe" size={32} color={colors.textSecondary} />
                        <Text style={[styles.tabCardUrl, { color: colors.textSecondary }]} numberOfLines={1}>{tab.url || 'Speed Dial'}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
                
                {tabs.length < MAX_TABS && (
                    <TouchableOpacity style={[styles.newTabCard, { borderColor: colors.border }]} onPress={() => createTab()}>
                        <IconSymbol name="plus" size={32} color={colors.primary} />
                        <Text style={[styles.newTabText, { color: colors.primary }]}>New Tab</Text>
                    </TouchableOpacity>
                )}
              </ScrollView>
            </Animated.View>
          </SafeAreaView>
        </BlurView>
      </Modal>

      {/* ─── Pop-up Confirmation Modal ─── */}
      <Modal visible={!!popupRequest} transparent animationType="fade">
        <View style={styles.popupOverlay}>
            <View style={[styles.popupDialog, { backgroundColor: colors.surface }]}>
                <View style={styles.popupHeader}>
                    <IconSymbol name="exclamationmark.shield.fill" size={24} color={colors.primary} />
                    <Text style={[styles.popupTitle, { color: colors.text }]}>Pop-up Blocked</Text>
                </View>
                <Text style={[styles.popupText, { color: colors.textSecondary }]}>
                    The website <Text style={{ fontWeight: '700', color: colors.text }}>{popupRequest?.origin}</Text> is trying to open a new tab.
                </Text>
                <View style={[styles.urlBox, { backgroundColor: colors.background }]}>
                    <Text style={[styles.urlText, { color: colors.textSecondary }]} numberOfLines={1}>{popupRequest?.url}</Text>
                </View>
                
                <View style={styles.popupActions}>
                    <TouchableOpacity style={[styles.popupBtn, { backgroundColor: colors.primary }]} onPress={() => { createTab(popupRequest!.url); setPopupRequest(null); }}>
                        <Text style={styles.popupBtnText}>Allow Once</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.popupBtn, { backgroundColor: colors.surfaceElevated }]} onPress={() => setPopupRequest(null)}>
                        <Text style={[styles.popupBtnText, { color: colors.text }]}>Deny</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.popupBlockAll} onPress={() => handleBlockDomain(popupRequest!.origin)}>
                        <Text style={[styles.popupBlockAllText, { color: colors.textSecondary }]}>Always Block for this Site</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      {/* ─── Footer Controls ─── */}
      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity disabled={!activeTab.canGoBack} onPress={() => webViewRefs.current[activeTabId]?.goBack()} style={[styles.footerBtn, !activeTab.canGoBack && { opacity: 0.3 }]}>
          <IconSymbol name="chevron.left" size={22} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setShowTabManager(true)} style={styles.footerTabBtn}>
           <View style={[styles.tabCountBox, { borderColor: colors.text }]}>
                <Text style={[styles.tabCountText, { color: colors.text }]}>{tabs.length}</Text>
           </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => updateTab(activeTabId, { url: '' })} style={[styles.footerHomeBtn, { backgroundColor: colors.primary }]}>
            <IconSymbol name="house.fill" size={20} color="#FFF" />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => webViewRefs.current[activeTabId]?.reload()} style={styles.footerBtn}>
          <IconSymbol name="arrow.clockwise" size={20} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity onPress={() => webViewRefs.current[activeTabId]?.goForward()} disabled={!activeTab.canGoForward} style={[styles.footerBtn, !activeTab.canGoForward && { opacity: 0.3 }]}>
          <IconSymbol name="chevron.right" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  shieldToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  urlBarContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', height: 42, borderRadius: BorderRadius.full, paddingHorizontal: 16, borderWidth: 1 },
  urlInput: { flex: 1, fontSize: 13, height: '100%', fontWeight: '500' },
  progressBarContainer: { height: 2, width: '100%', position: 'absolute', top: 0 },
  progressBar: { height: '100%' },
  homeContent: { flex: 1, padding: Spacing.xl },
  homeHero: { alignItems: 'center', marginBottom: Spacing.xl },
  homeHeroRow: { flexDirection: 'row', alignItems: 'center', gap: 20, width: '100%', marginBottom: Spacing.xl },
  heroTextContainer: { flex: 1 },
  homeTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5, marginBottom: 4 },
  shieldText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  shieldCoreAnchor: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shieldAura: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    filter: Platform.OS === 'ios' ? 'blur(15px)' : undefined,
  },
  shieldCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    ...Shadows.md,
  },
  shieldStatusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginTop: 4,
  },
  shieldStatusText: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.08)',
    marginBottom: Spacing.xl,
  },
  quickActionBtn: {
    alignItems: 'center',
    gap: 8,
    width: (SCREEN_WIDTH - Spacing.xl * 2) / 3,
  },
  quickActionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  sectionTitle: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: Spacing.lg, opacity: 0.6 },
  bookmarkSection: { flex: 1 },
  bookmarkRow: { justifyContent: 'flex-start', gap: (SCREEN_WIDTH - Spacing.xl * 2 - 60 * 4) / 3, marginBottom: Spacing.xl },
  bookmarkItem: { width: 60, alignItems: 'center', gap: 8 },
  bookmarkIconContainer: { width: 60, height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, ...Shadows.sm },
  bookmarkInitial: { fontSize: 22, fontWeight: '800' },
  bookmarkTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', height: 64, borderTopWidth: 1, paddingHorizontal: Spacing.xl, paddingBottom: Platform.OS === 'ios' ? 10 : 0 },
  footerBtn: { padding: 10 },
  footerTabBtn: { padding: 10, justifyContent: 'center', alignItems: 'center' },
  tabCountBox: { width: 20, height: 20, borderWidth: 1.5, borderRadius: 4, justifyContent: 'center', alignItems: 'center' },
  tabCountText: { fontSize: 10, fontWeight: '800' },
  footerHomeBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginTop: -10, ...Shadows.md },
  tabManagerOverlay: { flex: 1, justifyContent: 'flex-end' },
  tabManagerContainer: { height: SCREEN_HEIGHT * 0.85, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: Spacing.xl, ...Shadows.lg },
  tabManagerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xl },
  tabManagerTitle: { fontSize: 20, fontWeight: '800' },
  tabGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingBottom: 40 },
  tabCard: { width: (SCREEN_WIDTH - 64) / 2, height: 220, borderRadius: 16, borderWidth: 2, overflow: 'hidden' },
  tabCardHeader: { height: 36, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 10 },
  tabCardTitle: { fontSize: 12, fontWeight: '700', flex: 1, marginRight: 8 },
  tabCardPreview: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 10 },
  tabCardUrl: { fontSize: 10, marginTop: 8, textAlign: 'center' },
  newTabCard: { width: (SCREEN_WIDTH - 64) / 2, height: 220, borderRadius: 16, borderWidth: 2, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center' },
  newTabText: { fontSize: 14, fontWeight: '700', marginTop: 10 },
  popupOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  popupDialog: { width: '100%', borderRadius: 24, padding: Spacing.xl, ...Shadows.lg },
  popupHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: Spacing.lg },
  popupTitle: { fontSize: 20, fontWeight: '800' },
  popupText: { fontSize: 14, lineHeight: 20, marginBottom: Spacing.md },
  urlBox: { padding: 12, borderRadius: 12, marginBottom: Spacing.xl },
  urlText: { fontSize: 12, fontStyle: 'italic' },
  popupActions: { gap: 12 },
  popupBtn: { height: 52, borderRadius: BorderRadius.lg, justifyContent: 'center', alignItems: 'center' },
  popupBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  popupBlockAll: { marginTop: 8, alignItems: 'center' },
  popupBlockAllText: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
