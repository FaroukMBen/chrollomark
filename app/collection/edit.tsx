import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';

const PRESET_COLORS = [
  '#7C3AED', '#3B82F6', '#10B981', '#F59E0B',
  '#EF4444', '#EC4899', '#06B6D4', '#8B5CF6',
];

export default function EditCollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [storyCount, setStoryCount] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      try {
        const data = await api.getCollection(id);
        setName(data.name);
        setDescription(data.description || '');
        setIsPublic(data.isPublic);
        setSelectedColor(data.color || PRESET_COLORS[0]);
        setStoryCount(data.stories?.length || 0);
      } catch (error: any) {
        Alert.alert('Error', error.message);
        router.back();
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id]);

  const handleUpdate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Collection name is required');
      return;
    }
    setIsSaving(true);
    try {
      await api.updateCollection(id, {
        name: name.trim(),
        description: description.trim(),
        isPublic,
        color: selectedColor,
      });
      Alert.alert('Success', 'Collection updated!', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <IconSymbol name="xmark" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Collection</Text>
        <TouchableOpacity onPress={handleUpdate} disabled={isSaving}>
          <Text style={[styles.saveText, { color: colors.primary, opacity: isSaving ? 0.5 : 1 }]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}>
          <View style={[styles.previewColor, { backgroundColor: selectedColor }]} />
          <View>
            <Text style={[styles.previewName, { color: colors.text }]}>
              {name || 'Collection Name'}
            </Text>
            <Text style={[styles.previewMeta, { color: colors.textSecondary }]}>
              {storyCount} stories • {isPublic ? 'Public' : 'Private'}
            </Text>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="My Awesome Collection"
            placeholderTextColor={colors.textSecondary}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="What's this collection about?"
            placeholderTextColor={colors.textSecondary}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Color</Text>
          <View style={styles.colorRow}>
            {PRESET_COLORS.map((color) => (
              <TouchableOpacity
                key={color}
                style={[
                  styles.colorDot,
                  { backgroundColor: color },
                  selectedColor === color && styles.colorDotSelected,
                ]}
                onPress={() => setSelectedColor(color)}
              />
            ))}
          </View>
        </View>

        <View style={[styles.switchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View>
            <Text style={[styles.switchLabel, { color: colors.text }]}>Public Collection</Text>
            <Text style={[styles.switchDesc, { color: colors.textSecondary }]}>
              Friends can see this collection
            </Text>
          </View>
          <Switch
            value={isPublic}
            onValueChange={setIsPublic}
            trackColor={{ false: colors.surfaceElevated, true: colors.primary }}
          />
        </View>
      </ScrollView>
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
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 40 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xl,
  },
  previewColor: { width: 6, height: 40, borderRadius: 3, marginRight: Spacing.md },
  previewName: { fontSize: 16, fontWeight: '700' },
  previewMeta: { fontSize: 12, marginTop: 2 },
  field: { marginBottom: Spacing.lg },
  label: { fontSize: 14, fontWeight: '700', marginBottom: Spacing.sm },
  input: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    fontSize: 15,
  },
  textArea: { minHeight: 80 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  colorDot: { width: 32, height: 32, borderRadius: 16 },
  colorDotSelected: { borderWidth: 3, borderColor: '#FFF' },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  switchLabel: { fontSize: 15, fontWeight: '700' },
  switchDesc: { fontSize: 12, marginTop: 2 },
});
