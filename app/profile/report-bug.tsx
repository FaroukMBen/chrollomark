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
import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { api } from '@/services/api';
import { useToast } from '@/store/ToastContext';

export default function ReportBugScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const router = useRouter();
  const { showToast } = useToast();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const pickImage = async () => {
    if (images.length >= 2) {
      showToast({ message: 'Maximum 2 images allowed', type: 'error' });
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.7,
    });

    if (!result.canceled) {
      setImages([...images, result.assets[0].uri]);
    }
  };

  const removeImage = (uri: string) => {
    setImages(images.filter((item) => item !== uri));
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      showToast({ message: 'Please fill in all required fields', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      // In a real app, you'd upload images to a storage service first
      // For this demo, we'll just send the URIs or paths
      await api.submitBugReport({ 
        title, 
        description, 
        images,
        deviceInfo: `${Platform.OS} ${Platform.Version}`
      });
      showToast({ message: 'Bug reported successfully. We will look into it!', type: 'success' });
      router.back();
    } catch (error: any) {
      showToast({ message: error.message || 'Failed to report bug', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.backBtn, { backgroundColor: colors.surface }]}
            onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Report a Bug</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>BUG TITLE *</Text>
            <View style={[styles.inputWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.text }]}
                placeholder="Briefly describe the bug"
                placeholderTextColor={colors.textSecondary + '80'}
                value={title}
                onChangeText={setTitle}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>DESCRIPTION *</Text>
            <View style={[styles.inputWrapper, styles.textAreaWrapper, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, styles.textArea, { color: colors.text }]}
                placeholder="What happened and how can we reproduce it?"
                placeholderTextColor={colors.textSecondary + '80'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>ATTACHMENTS (OPTIONAL, MAX 2)</Text>
            <View style={styles.imageRow}>
              {images.map((uri) => (
                <View key={uri} style={styles.imageContainer}>
                  <Image source={{ uri }} style={styles.attachedImage} contentFit="cover" />
                  <TouchableOpacity 
                    style={[styles.removeImageBtn, { backgroundColor: colors.error }]}
                    onPress={() => removeImage(uri)}>
                    <IconSymbol name="xmark" size={12} color="#FFF" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 2 && (
                <TouchableOpacity 
                  style={[styles.addImageBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={pickImage}>
                  <IconSymbol name="plus" size={24} color={colors.textSecondary} />
                  <Text style={[styles.addImageText, { color: colors.textSecondary }]}>Add Image</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, { backgroundColor: colors.error, opacity: isSubmitting ? 0.7 : 1 }]}
            onPress={handleSubmit}
            disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Text style={styles.submitBtnText}>Submit Bug Report</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: { padding: Spacing.lg },
  field: { marginBottom: Spacing.xl },
  label: { fontSize: 11, fontWeight: '800', marginBottom: Spacing.sm, letterSpacing: 0.5 },
  inputWrapper: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  textAreaWrapper: { paddingVertical: Spacing.sm },
  input: { fontSize: 15, paddingVertical: 12 },
  textArea: { minHeight: 120 },
  imageRow: { flexDirection: 'row', gap: 12 },
  imageContainer: { width: 100, height: 100, borderRadius: BorderRadius.md, overflow: 'hidden', position: 'relative' },
  attachedImage: { width: '100%', height: '100%' },
  removeImageBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addImageBtn: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  addImageText: { fontSize: 10, fontWeight: '700' },
  submitBtn: {
    height: 54,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  submitBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
