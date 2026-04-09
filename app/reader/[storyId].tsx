import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Platform,
  StatusBar,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  withTiming,
  useSharedValue,
  withSpring,
  runOnJS,
  useAnimatedRef,
  scrollTo,
  useAnimatedReaction,
  withDecay,
  cancelAnimation
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useToast } from '@/store/ToastContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// --- MANGA PAGE COMPONENT (Optimized) ---
const MangaPage = React.memo(function MangaPage({
  uri,
  index,
  total
}: {
  uri: string;
  index: number;
  total: number;
}) {
  const [aspectRatio, setAspectRatio] = useState(0.7);

  return (
    <View style={styles.pageWrapper}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri }}
          style={{ width: SCREEN_WIDTH, height: undefined, aspectRatio }}
          contentFit="contain"
          onLoad={(e) => {
            const { width, height } = e.source;
            if (width && height) setAspectRatio(width / height);
          }}
          cachePolicy="memory-disk"
          recyclingKey={uri}
        />
      </View>
    </View>
  );
});

export default function ReaderScreen() {
  const { storyId, mangadexId } = useLocalSearchParams<{ storyId: string; mangadexId: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const { showToast } = useToast();
  const { user } = useAuth();

  const [chapters, setChapters] = useState<any[]>([]);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isChapterLoading, setIsChapterLoading] = useState(false);
  const [showChapterList, setShowChapterList] = useState(true);
  const [displayScale, setDisplayScale] = useState(100);
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [totalChapters, setTotalChapters] = useState(0);
  const [isMoreChaptersLoading, setIsMoreChaptersLoading] = useState(false);
  const [showAllLanguages, setShowAllLanguages] = useState(false);
  const [showAllHudLanguages, setShowAllHudLanguages] = useState(false);
  const [userProgress, setUserProgress] = useState<any>(null);

  const flatListRef = useAnimatedRef<FlatList>();
  const isScrolling = useSharedValue(0);

  // --- GLOBAL ZOOM STATE ---
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const currentScrollY = useSharedValue(0);
  const lastTranslationY = useSharedValue(0);

  // Frame-perfect physics sync
  useAnimatedReaction(
    () => currentScrollY.value,
    (scrollY) => {
      scrollTo(flatListRef, 0, scrollY, false);
    }
  );

  const resetZoom = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    setDisplayScale(100);
  }, []);

  // HUD Visibility
  const isUiVisible = useSharedValue(1);
  const lastScrollY = useRef(0);

  // Track scroll position for progress bar
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentPageIndex(viewableItems[0].index || 0);
    }
  }).current;

  useEffect(() => {
    StatusBar.setHidden(true);
    return () => StatusBar.setHidden(false);
  }, []);

  useEffect(() => {
    const loadChaptersAndProgress = async () => {
      try {
        if (!mangadexId) {
          showToast({ message: 'Missing MangaDex ID', type: 'error' });
          router.back();
          return;
        }

        // Fetch User Progress
        if (storyId && storyId.length === 24) { // Basic ObjectId check
          api.getStory(storyId).then(data => {
            if (data.userProgress) {
              setUserProgress(data.userProgress);
            }
          }).catch(() => { /* silent fail if story not in lib */ });
        }

        const data = await api.getMangaDexChapters(mangadexId);
        setChapters(data.chapters || []);
        setTotalChapters(data.total || 0);
      } catch (error: any) {
        showToast({ message: error.message, type: 'error' });
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    loadChaptersAndProgress();
  }, [mangadexId, storyId]);

  const loadChapterPages = async (chapter: any) => {
    setIsChapterLoading(true);
    setShowChapterList(false);
    setCurrentChapter(chapter);
    setCurrentPageIndex(0);
    isUiVisible.value = 0;
    // Reset zoom on chapter change
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    try {
      const data = await api.getMangaDexPages(chapter.id);
      setPages(data.pages || []);
      if (chapter.chapter) {
        const chapterNum = Number.parseFloat(chapter.chapter);
        if (!isNaN(chapterNum)) {
          await api.updateProgress({ storyId, currentChapter: chapterNum }).catch(console.warn);
        }
      }
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
    } finally {
      setIsChapterLoading(false);
    }
  };

  const toggleUi = useCallback(() => {
    isUiVisible.value = isUiVisible.value === 0 ? 1 : 0;
    Haptics.selectionAsync().catch(() => { });
  }, []);

  const handleNextChapter = () => {
    if (!currentChapter) return;
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex < chapters.length - 1) {
      loadChapterPages(chapters[currentIndex + 1]);
    } else {
      showToast({ message: 'No more chapters!', type: 'info' });
    }
  };

  const handlePrevChapter = () => {
    if (!currentChapter) return;
    const currentIndex = chapters.findIndex(c => c.id === currentChapter.id);
    if (currentIndex > 0) {
      loadChapterPages(chapters[currentIndex - 1]);
    }
  };

  const loadMoreChapters = async () => {
    if (chapters.length >= totalChapters || isMoreChaptersLoading) return;
    setIsMoreChaptersLoading(true);
    try {
      const data = await api.getMangaDexChapters(mangadexId, 'all', chapters.length.toString());
      setChapters(prev => [...prev, ...(data.chapters || [])]);
    } catch (error) {
      console.warn('Failed to load more chapters:', error);
    } finally {
      setIsMoreChaptersLoading(false);
    }
  };

  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
    })
    .onUpdate((e) => {
      const nextScale = Math.max(1, savedScale.value * e.scale);
      scale.value = nextScale;
      runOnJS(setDisplayScale)(Math.round(nextScale * 100));
    })
    .onEnd(() => {
      if (scale.value < 1.1) {
        runOnJS(resetZoom)();
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onStart((e) => {
      lastTranslationY.value = e.translationY;
      // Stop any existing momentum
      cancelAnimation(currentScrollY);
    })
    .onUpdate((e) => {
      const maxTranslateX = (SCREEN_WIDTH * scale.value - SCREEN_WIDTH) / 2;
      let nextX = savedTranslateX.value + e.translationX;
      translateX.value = Math.min(Math.max(nextX, -maxTranslateX), maxTranslateX);

      // Manual physics tracking - Adjusted for scale to maintain 1:1 visual movement
      const deltaY = e.translationY - lastTranslationY.value;
      lastTranslationY.value = e.translationY;
      
      currentScrollY.value -= deltaY / scale.value;
    })
    .onEnd((e) => {
      savedTranslateX.value = translateX.value;
      
      // Momentum decay adjusted for scale
      currentScrollY.value = withDecay({
        velocity: -(e.velocityY / scale.value),
        clamp: [0, 999999],
      });
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .maxDistance(10)
    .onEnd(() => {
      if (scale.value > 1.1) {
        runOnJS(resetZoom)();
      } else {
        scale.value = withSpring(1.5);
        savedScale.value = 1.5;
        translateX.value = withSpring(0);
        savedTranslateX.value = 0;
        runOnJS(setDisplayScale)(150);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Medium);
      }
    });

  const tapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .maxDistance(10)
    .onEnd(() => {
      if (scale.value < 1.1) {
        runOnJS(toggleUi)();
      }
    });

  // Compose Gestures
  const composed = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    Gesture.Exclusive(doubleTapGesture, tapGesture)
  );

  const contentStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: scale.value },
    ] as any,
  }));

  const hudStyle = useAnimatedStyle(() => ({
    opacity: withTiming(isUiVisible.value, { duration: 250 }),
    pointerEvents: isUiVisible.value === 0 ? 'none' : 'auto',
  }));

  const zoomBadgeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scale.value > 1.05 ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(scale.value > 1.05 ? 1 : 0.8) }],
  }));

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const currentY = event.nativeEvent.contentOffset.y;
    if (currentY > lastScrollY.current + 30 && isUiVisible.value === 1) {
      isUiVisible.value = 0;
    }
    lastScrollY.current = currentY;
  };

  const filteredChapters = chapters.filter(c => c.translatedLanguage === selectedLanguage);

  const allAvailableLanguages = Array.from(new Set(chapters.map(c => c.translatedLanguage))).sort();
  const priorityLanguages = ['en', 'fr', 'ar'].filter(l => allAvailableLanguages.includes(l));
  const otherLanguages = allAvailableLanguages.filter(l => !priorityLanguages.includes(l));

  const displayedLanguages = showAllLanguages ? allAvailableLanguages : priorityLanguages;

  const getLanguageFlag = (lang: string) => {
    const flags: any = {
      en: '🇺🇸', fr: '🇫🇷', ar: '🇸🇦', ja: '🇯🇵', ko: '🇰🇷',
      zh: '🇨🇳', es: '🇪🇸', pt: '🇧🇷', it: '🇮🇹', de: '🇩🇪',
      ru: '🇷🇺', tr: '🇹🇷', id: '🇮🇩', vi: '🇻🇳', th: '🇹🇭'
    };
    return flags[lang] || lang.toUpperCase();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const chapterProgress = pages.length > 0 ? (currentPageIndex + 1) / pages.length : 0;

  return (
    <View style={[styles.container, { backgroundColor: '#000' }]}>
      {showChapterList ? (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 10 }}>
              <IconSymbol name="xmark" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Chapters</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={{ padding: Spacing.sm, borderBottomWidth: 0.5, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={displayedLanguages}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    onPress={() => setSelectedLanguage(item)}
                    style={{
                      padding: 8,
                      marginHorizontal: 4,
                      borderRadius: 8,
                      backgroundColor: selectedLanguage === item ? colors.primary : colors.card,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{ marginRight: 4 }}>{getLanguageFlag(item)}</Text>
                    <Text style={{ color: selectedLanguage === item ? '#FFF' : colors.text, fontWeight: '600', fontSize: 12 }}>
                      {item.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                )}
              />
              {!showAllLanguages && otherLanguages.length > 0 && (
                <TouchableOpacity
                  onPress={() => setShowAllLanguages(true)}
                  style={{ padding: 8, backgroundColor: colors.card, borderRadius: 8, marginLeft: 4 }}
                >
                  <IconSymbol name="plus" size={16} color={colors.text} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <FlatList
            data={filteredChapters}
            keyExtractor={item => item.id}
            contentContainerStyle={{ padding: Spacing.md }}
            onEndReached={loadMoreChapters}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              chapters.length < totalChapters ? (
                <TouchableOpacity
                  onPress={loadMoreChapters}
                  style={{ padding: 20, alignItems: 'center' }}
                  disabled={isMoreChaptersLoading}
                >
                  {isMoreChaptersLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Load More Chapters ({totalChapters - chapters.length} left)</Text>
                  )}
                </TouchableOpacity>
              ) : null
            }
            renderItem={({ item }) => {
              const isCurrent = currentChapter?.id === item.id;
              const chapterNum = Number(item.chapter);
              const isRead = !isNaN(chapterNum) && userProgress && chapterNum <= userProgress.currentChapter && !isCurrent;
              
              return (
              <TouchableOpacity
                style={[
                  styles.chapterItem, 
                  { 
                    borderColor: isCurrent ? colors.primary : colors.border, 
                    borderWidth: isCurrent ? 2 : 1,
                    backgroundColor: isCurrent ? colors.primary + '15' : (isRead ? colors.surfaceElevated : colors.card),
                    borderRadius: 12,
                    marginBottom: Spacing.sm,
                    padding: Spacing.md,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: isRead ? 0.7 : 1
                  }
                ]}
                onPress={() => loadChapterPages(item)}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                  <View style={{
                    width: 40, 
                    height: 40, 
                    borderRadius: 20, 
                    backgroundColor: isCurrent ? colors.primary : (isRead ? '#10B98115' : colors.surfaceElevated),
                    justifyContent: 'center', 
                    alignItems: 'center',
                    marginRight: 12
                  }}>
                    <IconSymbol 
                      name={isCurrent ? "book.fill" : (isRead ? "checkmark.circle.fill" : "doc.text.fill")} 
                      size={20} 
                      color={isCurrent ? '#FFF' : (isRead ? '#10B981' : colors.textSecondary)} 
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.chapterItemText, { color: isRead ? colors.textSecondary : colors.text, fontWeight: isCurrent ? '700' : '600' }]} numberOfLines={1}>
                      Chapter {item.chapter || '?'}
                    </Text>
                    {item.title ? (
                      <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }} numberOfLines={1}>
                        {item.title}
                      </Text>
                    ) : null}
                  </View>
                </View>
                <View style={{ backgroundColor: isRead ? colors.background : colors.surfaceElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 14, opacity: isRead ? 0.7 : 1 }}>{getLanguageFlag(item.translatedLanguage)}</Text>
                </View>
              </TouchableOpacity>
            )}}

          />
        </SafeAreaView>
      ) : (
        <View style={{ flex: 1 }}>
          <GestureDetector gesture={composed}>
            <Animated.View style={[{ flex: 1 }, contentStyle]}>
              <FlatList
                ref={flatListRef}
                data={pages}
                keyExtractor={(item) => item}
                showsVerticalScrollIndicator={false}
                bounces={false}
                removeClippedSubviews={true}
                initialNumToRender={5}
                maxToRenderPerBatch={5}
                windowSize={11}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                onScroll={handleScroll}
                scrollEventThrottle={1}
                contentContainerStyle={isChapterLoading && { flex: 1, justifyContent: 'center', alignItems: 'center' }}
                renderItem={({ item, index }) => (
                  <MangaPage
                    uri={item}
                    index={index}
                    total={pages.length}
                  />
                )}
                ListEmptyComponent={
                  isChapterLoading ? <ActivityIndicator size="large" color={colors.primary} /> : <Text style={{ color: 'white' }}>No pages found.</Text>
                }
              />
            </Animated.View>
          </GestureDetector>

          {/* Floating Page Indicator */}
          <View style={styles.floatingPageIndicator}>
            <Text style={styles.floatingPageText}>{currentPageIndex + 1} / {pages.length}</Text>
          </View>

          {/* Zoom Indicator Badge */}
          <Animated.View style={[styles.zoomBadge, zoomBadgeStyle]}>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={resetZoom}
              style={{ flexDirection: 'row', alignItems: 'center' }}
            >
              <IconSymbol name="magnifyingglass" size={14} color="#FFF" />
              <Text style={styles.zoomBadgeText}>
                {displayScale}%
              </Text>
            </TouchableOpacity>
          </Animated.View>

          {/* HUD Overlay */}
          <Animated.View style={[StyleSheet.absoluteFillObject, hudStyle]}>
            <View style={[styles.hudTop, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
              <SafeAreaView edges={['top']} style={{ paddingBottom: Spacing.sm }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.md }}>
                  <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
                    <IconSymbol name="arrow.left" size={24} color="#FFF" />
                  </TouchableOpacity>
                  <View style={{ flex: 1, alignItems: 'center', marginHorizontal: 10 }}>
                    <Text style={styles.hudChapterNum}>Chapter {currentChapter?.chapter || 'Unknown'}</Text>
                    {currentChapter?.title && (
                      <Text style={styles.hudChapterTitle} numberOfLines={1}>{currentChapter.title}</Text>
                    )}
                  </View>
                  <TouchableOpacity onPress={() => setShowChapterList(true)} style={{ padding: 8 }}>
                    <IconSymbol name="list.bullet" size={24} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {/* Quick Language Selector in HUD */}
                <View style={{ paddingVertical: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <FlatList
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      data={showAllHudLanguages ? allAvailableLanguages : priorityLanguages}
                      keyExtractor={item => 'hud-' + item}
                      contentContainerStyle={{ paddingHorizontal: Spacing.md }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          onPress={() => setSelectedLanguage(item)}
                          style={{
                            padding: 6,
                            marginHorizontal: 3,
                            borderRadius: 6,
                            backgroundColor: selectedLanguage === item ? colors.primary : 'rgba(255,255,255,0.1)',
                            minWidth: 40,
                            alignItems: 'center'
                          }}
                        >
                          <Text style={{ fontSize: 16 }}>{getLanguageFlag(item)}</Text>
                        </TouchableOpacity>
                      )}
                    />
                    {!showAllHudLanguages && otherLanguages.length > 0 && (
                      <TouchableOpacity
                        onPress={() => setShowAllHudLanguages(true)}
                        style={{ padding: 6, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, marginRight: Spacing.md }}
                      >
                        <IconSymbol name="plus" size={16} color="#FFF" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </SafeAreaView>
            </View>

            <View style={[styles.hudBottom, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBarFill, { width: `${chapterProgress * 100}%`, backgroundColor: colors.primary }]} />
              </View>

              <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: Spacing.md }}>
                <TouchableOpacity onPress={handlePrevChapter} style={styles.hudBtn}>
                  <IconSymbol name="chevron.left" size={28} color="#FFF" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.hudProgressText}>
                    Page {currentPageIndex + 1} / {pages.length}
                  </Text>
                  <Text style={styles.hudChapterCount}>
                    Chapter {currentChapter?.chapter} of {chapters.length}
                  </Text>
                </View>

                <TouchableOpacity onPress={handleNextChapter} style={styles.hudBtn}>
                  <IconSymbol name="chevron.right" size={28} color="#FFF" />
                </TouchableOpacity>
              </SafeAreaView>
            </View>
          </Animated.View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pageWrapper: {
    backgroundColor: '#000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    backgroundColor: '#000',
  },
  floatingPageIndicator: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  floatingPageText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  chapterItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  chapterItemText: {
    fontSize: 16,
    fontWeight: '600',
  },
  hudTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  hudBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  hudChapterNum: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
  hudChapterTitle: {
    color: '#BBB',
    fontSize: 12,
    fontWeight: '600',
  },
  hudProgressText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hudChapterCount: {
    color: '#AAA',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  hudBtn: {
    padding: Spacing.sm,
  },
  progressBarContainer: {
    height: 4,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  progressBarFill: {
    height: '100%',
  },
  zoomBadge: {
    position: 'absolute',
    top: 100,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 100,
  },
  zoomBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  }
});
