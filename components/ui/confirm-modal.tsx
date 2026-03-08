import React from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { BorderRadius, Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export function ConfirmModal({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
}: ConfirmModalProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btn} onPress={onCancel}>
              <Text style={[styles.btnText, { color: colors.textSecondary }]}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity 
               style={[styles.btn, isDestructive && { backgroundColor: colors.error }]} 
               onPress={onConfirm}>
              <Text style={[styles.btnText, isDestructive && styles.btnTextMain]}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: Spacing.xl 
  },
  content: { 
    width: '100%', 
    borderRadius: BorderRadius.xl, 
    padding: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  title: { 
    fontSize: 18, 
    fontWeight: '800', 
    marginBottom: Spacing.sm 
  },
  message: { 
    fontSize: 14, 
    lineHeight: 20, 
    marginBottom: Spacing.xl 
  },
  actions: { 
    flexDirection: 'row', 
    justifyContent: 'flex-end', 
    gap: Spacing.md 
  },
  btn: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: BorderRadius.md 
  },
  btnText: { 
    fontSize: 14, 
    fontWeight: '600' 
  },
  btnTextMain: { 
    color: '#FFF', 
    fontSize: 14, 
    fontWeight: '700' 
  },
});
