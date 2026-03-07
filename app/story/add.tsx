import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
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
import { BorderRadius, Colors, Genres, Shadows, Spacing, StatusColors, StoryTypes } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useToast } from '@/store/ToastContext';

export default function AddStoryScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();

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

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled) {
      setCoverImage(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      showToast({ message: 'Title is required', type: 'error' });
      return;
    }
    setIsLoading(true);
    try {
      // Check for duplicates by title
      const existing = await api.getStories({ search: title.trim(), limit: '5' });
      const duplicate = existing.stories?.find(
        (s: any) => s.title.toLowerCase() === title.trim().toLowerCase()
      );
      if (duplicate) {
        setIsLoading(false);
        showToast({ message: `"${duplicate.title}" already exists in the global library. Find it in Explore!`, type: 'error' });
        return;
      }

      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('type', type);
      selectedGenres.forEach(g => formData.append('genres', g));
      formData.append('author', author.trim());
      if (totalChapters) formData.append('totalChapters', totalChapters);
      
      if (coverImage) {
        if (coverImage.startsWith('file://') || coverImage.startsWith('content://')) {
          const filename = coverImage.split('/').pop() || 'cover.jpg';
          const match = /\.(\w+)$/.exec(filename);
          const fileType = match ? `image/${match[1]}` : `image`;
          // @ts-ignore
          formData.append('coverImage', { uri: coverImage, name: filename, type: fileType });
        } else {
          formData.append('coverImage', coverImage.trim());
        }
      }

      const story = await api.createStory(formData);

      await api.updateProgress({
        storyId: story._id,
        currentChapter: currentChapter ? parseInt(currentChapter) : 0,
        status,
      });

      showToast({ message: 'Story added to your library!', type: 'success' });
      router.back();
    } catch (error: any) {
      showToast({ message: error.message, type: 'error' });
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
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}>
            <IconSymbol name="xmark" size={16} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Add Story</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isLoading}
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.6 : 1 }]}
            activeOpacity={0.8}>
            {isLoading ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* Cover Preview */}
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
            {coverImage ? (
              <View style={styles.coverContainer}>
                <Image source={{ uri: coverImage }} style={styles.coverPreview} contentFit="cover" />
                <View style={[styles.coverEditBadge, { backgroundColor: colors.primary }]}>
                  <IconSymbol name="pencil" size={14} color="#FFF" />
                </View>
              </View>
            ) : (
              <View style={[styles.coverPreview, styles.coverPlaceholder, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <IconSymbol name="photo" size={36} color={colors.textSecondary} />
                <Text style={[styles.coverPlaceholderText, { color: colors.textSecondary }]}>
                  Tap to add cover image
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TITLE *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Story title"
                placeholderTextColor={colors.textSecondary + '80'}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          {/* Author */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>AUTHOR</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Author name"
                placeholderTextColor={colors.textSecondary + '80'}
                value={author}
                onChangeText={setAuthor}
              />
            </View>
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text }]}
                placeholder="What's this story about?"
                placeholderTextColor={colors.textSecondary + '80'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Type */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>TYPE</Text>
            <View style={styles.chipRow}>
              {StoryTypes.map((t) => {
                const isActive = type === t;
                return (
                  <TouchableOpacity
                    key={t}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: isActive ? colors.primary : colors.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => setType(t)}>
                    <IconSymbol
                      name={t === 'Manga' ? 'book.fill' : 'doc.text.fill'}
                      size={16}
                      color={isActive ? '#FFF' : colors.textSecondary}
                    />
                    <Text style={[styles.chipText, { color: isActive ? '#FFF' : colors.textSecondary }]}>
                      {t}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Genres */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              GENRES {selectedGenres.length > 0 && `(${selectedGenres.length})`}
            </Text>
            <View style={styles.chipWrap}>
              {Genres.map((genre) => {
                const isActive = selectedGenres.includes(genre);
                return (
                  <TouchableOpacity
                    key={genre}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isActive ? colors.primary + '20' : colors.surface,
                        borderColor: isActive ? colors.primary : colors.border,
                      },
                    ]}
                    onPress={() => toggleGenre(genre)}>
                    <Text style={[styles.chipText, { color: isActive ? colors.primary : colors.textSecondary }]}>
                      {genre}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Chapter Info */}
          <View style={styles.rowFields}>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>CURRENT CHAPTER</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={currentChapter}
                  onChangeText={setCurrentChapter}
                  keyboardType="numeric"
                />
              </View>
            </View>
            <View style={[styles.field, { flex: 1 }]}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>TOTAL CHAPTERS</Text>
              <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Ongoing"
                  placeholderTextColor={colors.textSecondary + '80'}
                  value={totalChapters}
                  onChangeText={setTotalChapters}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Reading Status */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>READING STATUS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {['Plan to Read', 'Reading', 'Completed', 'On Hold', 'Dropped'].map((s) => {
                  const isActive = status === s;
                  const statusColor = StatusColors[s] || colors.primary;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isActive ? statusColor + '20' : colors.surface,
                          borderColor: isActive ? statusColor : colors.border,
                        },
                      ]}
                      onPress={() => setStatus(s)}>
                      <Text style={[styles.chipText, { color: isActive ? statusColor : colors.textSecondary }]}>
                        {s}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>

          {/* Cover URL */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>COVER IMAGE URL</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <IconSymbol name="link" size={16} color={colors.textSecondary} />
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Or paste an image URL"
                placeholderTextColor={colors.textSecondary + '80'}
                value={coverImage}
                onChangeText={setCoverImage}
                autoCapitalize="none"
              />
            </View>
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
    borderBottomWidth: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  saveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    minWidth: 70,
    alignItems: 'center',
    ...Shadows.sm,
  },
  saveBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: 60 },
  coverContainer: { position: 'relative', marginBottom: Spacing.lg },
  coverPreview: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.lg,
  },
  coverEditBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.sm,
  },
  coverPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    marginBottom: Spacing.lg,
  },
  coverPlaceholderText: { marginTop: 8, fontSize: 13, fontWeight: '500' },
  field: { marginBottom: Spacing.lg },
  label: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginLeft: 2,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  textAreaWrapper: { alignItems: 'flex-start', paddingVertical: Spacing.sm },
  input: { flex: 1, fontSize: 15, paddingVertical: 14 },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  chipRow: { flexDirection: 'row', gap: Spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  rowFields: { flexDirection: 'row', gap: Spacing.md },
});
