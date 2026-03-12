import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider } from '@/store/AuthContext';
import { ThemeProvider } from '@/store/ThemeContext';
import { ToastProvider } from '@/store/ToastContext';

import { useMemo } from 'react';
import { View } from 'react-native';

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
  
  const theme = useMemo(() => colorScheme === 'dark' ? ChrolloDark : ChrolloLight, [colorScheme]);
  const bgColor = theme.colors.background;

  return (
    <NavThemeProvider value={theme}>
      <View style={{ flex: 1, backgroundColor: bgColor }}>
        <ToastProvider>
          <Stack screenOptions={{ 
            headerShown: false,
            contentStyle: { backgroundColor: bgColor },
            animation: 'slide_from_right',
          }}>
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
            <Stack.Screen name="story/[id]" />
            <Stack.Screen
              name="collection/create"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="collection/[id]" />
            <Stack.Screen name="user/[id]" />
            <Stack.Screen name="profile/dev-log" />
            <Stack.Screen
              name="profile/feedback"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="profile/report-bug"
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
            <Stack.Screen name="profile/admin" />
          </Stack>
        </ToastProvider>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </View>
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <RootLayoutInner />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
