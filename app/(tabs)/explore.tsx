import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing, StoryTypes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useAuth } from '@/store/AuthContext';

export default function ExploreScreen() {
  const { isAuthenticated } = useAuth();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [search, setSearch] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>('');

  const doSearch = async () => {
    if (!search.trim() && !typeFilter) return;
    setIsSearching(true);
    setHasSearched(true);
    try {
      const params: any = {};
      if (search.trim()) params.search = search.trim();
      if (typeFilter) params.type = typeFilter;
      const data = await api.getStories(params);
      setResults(data.stories);
    } catch (error) {
      console.log('Search error:', error);
    } finally {
      setIsSearching(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Sign in to explore stories
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Explore</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <IconSymbol name="magnifyingglass" size={20} color={colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search manga, webtoon..."
            placeholderTextColor={colors.textSecondary}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={doSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <IconSymbol name="xmark.circle.fill" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Type Filters */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}>
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: !typeFilter ? colors.primary : colors.surface,
              borderColor: !typeFilter ? colors.primary : colors.border,
            },
          ]}
          onPress={() => {
            setTypeFilter('');
            if (search.trim()) doSearch();
          }}>
          <Text style={[styles.filterText, { color: !typeFilter ? '#FFF' : colors.textSecondary }]}>
            All
          </Text>
        </TouchableOpacity>
        {StoryTypes.map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterChip,
              {
                backgroundColor: typeFilter === type ? colors.primary : colors.surface,
                borderColor: typeFilter === type ? colors.primary : colors.border,
              },
            ]}
            onPress={() => {
              setTypeFilter(type);
              setTimeout(doSearch, 100);
            }}>
            <Text
              style={[
                styles.filterText,
                { color: typeFilter === type ? '#FFF' : colors.textSecondary },
              ]}>
              {type}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Results */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.resultsContent}>
        {isSearching ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : !hasSearched ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>🔍</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Search for manga, webtoons, and more
            </Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.center}>
            <Text style={{ fontSize: 48, marginBottom: Spacing.md }}>😔</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No results found
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {results.map((story) => (
              <TouchableOpacity
                key={story._id}
                style={[styles.gridItem, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                onPress={() => router.push(`/story/${story._id}` as any)}
                activeOpacity={0.7}>
                {story.coverImage ? (
                  <Image source={{ uri: story.coverImage }} style={styles.gridCover} contentFit="cover" />
                ) : (
                  <View style={[styles.gridCover, styles.placeholder, { backgroundColor: colors.surfaceElevated }]}>
                    <Text style={{ fontSize: 36 }}>📖</Text>
                  </View>
                )}
                <View style={styles.gridInfo}>
                  <Text style={[styles.gridTitle, { color: colors.text }]} numberOfLines={2}>
                    {story.title}
                  </Text>
                  <Text style={[styles.gridType, { color: colors.primary }]}>{story.type}</Text>
                  {story.averageRating > 0 && (
                    <View style={styles.ratingRow}>
                      <Text style={{ color: colors.accent }}>★</Text>
                      <Text style={[styles.ratingText, { color: colors.textSecondary }]}>
                        {story.averageRating.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, fontWeight: '800' },
  searchContainer: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, fontSize: 15 },
  filterRow: { maxHeight: 50, marginBottom: Spacing.sm },
  filterContent: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: '600' },
  resultsContent: { paddingHorizontal: Spacing.lg, paddingBottom: 100 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  gridItem: {
    width: '47%' as unknown as number,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
  },
  gridCover: { width: '100%', height: 180 },
  placeholder: { justifyContent: 'center', alignItems: 'center' },
  gridInfo: { padding: Spacing.sm },
  gridTitle: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  gridType: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, fontWeight: '600' },
  emptyText: { fontSize: 15, textAlign: 'center' },
});
