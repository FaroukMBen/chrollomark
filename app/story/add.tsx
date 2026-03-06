import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Genres, Spacing, StoryTypes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';

export default function AddStoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('Manga');
  const [author, setAuthor] = useState('');
  const [totalChapters, setTotalChapters] = useState('');
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [currentChapter, setCurrentChapter] = useState('');
  const [status, setStatus] = useState('Plan to Read');
  const [isLoading, setIsLoading] = useState(false);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Error', 'Title is required');
      return;
    }
    setIsLoading(true);
    try {
      const story = await api.createStory({
        title: title.trim(),
        coverImage: coverImage.trim(),
        description: description.trim(),
        type,
        genres: selectedGenres,
        author: author.trim(),
        totalChapters: totalChapters ? parseInt(totalChapters) : null,
      });

      // Add to library with progress
      await api.updateProgress({
        storyId: story._id,
        currentChapter: currentChapter ? parseInt(currentChapter) : 0,
        status,
      });

      Alert.alert('Success', 'Story added to your library!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <IconSymbol name="xmark" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Story</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={{ opacity: isLoading ? 0.5 : 1 }}>
            <Text style={[styles.saveText, { color: colors.primary }]}>
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {/* Cover Preview */}
          {coverImage ? (
            <Image source={{ uri: coverImage }} style={styles.coverPreview} contentFit="cover" />
          ) : (
            <View style={[styles.coverPreview, styles.coverPlaceholder, { backgroundColor: colors.surface }]}>
              <IconSymbol name="photo" size={40} color={colors.textSecondary} />
              <Text style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                Paste a cover image URL below
              </Text>
            </View>
          )}

          {/* Cover URL */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Cover Image URL</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="https://example.com/cover.jpg"
              placeholderTextColor={colors.textSecondary}
              value={coverImage}
              onChangeText={setCoverImage}
              autoCapitalize="none"
            />
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Title *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Story title"
              placeholderTextColor={colors.textSecondary}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Author */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Author</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="Author name"
              placeholderTextColor={colors.textSecondary}
              value={author}
              onChangeText={setAuthor}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
              placeholder="What's this story about?"
              placeholderTextColor={colors.textSecondary}
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {StoryTypes.map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: type === t ? colors.primary : colors.surface,
                        borderColor: type === t ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setType(t)}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: type === t ? '#FFF' : colors.textSecondary },
                      ]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>

          {/* Genres */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Genres</Text>
            <View style={styles.chipWrap}>
              {Genres.map((genre) => (
                <TouchableOpacity
                  key={genre}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedGenres.includes(genre) ? colors.primary : colors.surface,
                      borderColor: selectedGenres.includes(genre) ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => toggleGenre(genre)}>
                  <Text
                    style={[
                      styles.chipText,
                      { color: selectedGenres.includes(genre) ? '#FFF' : colors.textSecondary },
                    ]}>
                    {genre}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Chapter Info */}
          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>Current Chapter</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="0"
                placeholderTextColor={colors.textSecondary}
                value={currentChapter}
                onChangeText={setCurrentChapter}
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.text }]}>Total Chapters</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Ongoing"
                placeholderTextColor={colors.textSecondary}
                value={totalChapters}
                onChangeText={setTotalChapters}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Reading Status */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Reading Status</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {['Plan to Read', 'Reading', 'Completed', 'On Hold', 'Dropped'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: status === s ? colors.primary : colors.surface,
                        borderColor: status === s ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setStatus(s)}>
                    <Text
                      style={[
                        styles.chipText,
                        { color: status === s ? '#FFF' : colors.textSecondary },
                      ]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveText: { fontSize: 16, fontWeight: '700' },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },
  coverPreview: {
    width: '100%',
    height: 200,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.lg,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  coverPlaceholderText: { marginTop: Spacing.sm, fontSize: 13 },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: { minHeight: 100 },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
});
