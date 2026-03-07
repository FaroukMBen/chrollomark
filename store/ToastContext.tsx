import { IconSymbol } from '@/components/ui/icon-symbol';
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextData {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextData>({ showToast: () => {} });

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const insets = useSafeAreaInsets();

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: -20,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => setToast(null));
  }, [fadeAnim, slideAnim]);

  const showToast = useCallback(
    ({ message, type = 'info', duration = 3000 }: ToastOptions) => {
      if (timerRef.current) clearTimeout(timerRef.current);

      setToast({ message, type, duration });

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        hideToast();
      }, duration);
    },
    [fadeAnim, slideAnim, hideToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            { top: Math.max(insets.top + Spacing.md, 40) },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}>
          <View style={[styles.toast, { backgroundColor: colors.surface }]}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor:
                    toast.type === 'error'
                      ? colors.error + '20'
                      : toast.type === 'success'
                        ? colors.success + '20'
                        : toast.type === 'warning'
                          ? colors.warning + '20'
                          : colors.primary + '20',
                },
              ]}>
              <IconSymbol
                name={
                  toast.type === 'error'
                    ? 'xmark.circle.fill'
                    : toast.type === 'success'
                      ? 'checkmark'
                      : toast.type === 'warning'
                        ? 'exclamationmark.triangle'
                        : 'ellipsis'
                }
                size={20}
                color={
                  toast.type === 'error'
                    ? colors.error
                    : toast.type === 'success'
                      ? colors.success
                      : toast.type === 'warning'
                        ? colors.warning
                        : colors.primary
                }
              />
            </View>
            <Text style={[styles.message, { color: colors.text }]}>{toast.message}</Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
    paddingHorizontal: Spacing.xl,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.1)',
    ...Shadows.lg,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
});
