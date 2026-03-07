import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
import { ToastProvider } from '@/store/ToastContext';

const ChrolloDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#8B5CF6',
    background: '#0B0B14',
    card: '#151525',
    text: '#F1F5F9',
    border: 'rgba(148, 163, 184, 0.15)',
    notification: '#8B5CF6',
  },
};

const ChrolloLight = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#7C3AED',
    background: '#F8FAFC',
    card: '#FFFFFF',
    text: '#1A1A2E',
    border: '#E2E8F0',
    notification: '#7C3AED',
  },
};

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutInner() {
  const colorScheme = useColorScheme();

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? ChrolloDark : ChrolloLight}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="auth/login"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="auth/register"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="story/add"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="story/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="collection/create"
            options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
          />
          <Stack.Screen
            name="collection/[id]"
            options={{ animation: 'slide_from_right' }}
          />
          <Stack.Screen
            name="user/[id]"
            options={{ animation: 'slide_from_right' }}
          />
        </Stack>
      </ToastProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutInner />
      </AuthProvider>
    </ThemeProvider>
  );
}
