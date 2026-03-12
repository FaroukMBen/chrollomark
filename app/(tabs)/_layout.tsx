import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

const TabBarIcon = ({ name, color, focused }: { name: any; color: string; focused: boolean }) => (
  <IconSymbol size={focused ? 28 : 24} name={name} color={color} />
);

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'dark'];
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const tabHeight = 55 + (Platform.OS === 'ios' ? Math.max(insets.bottom, 20) : insets.bottom);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.tabIconDefault,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarStyle: {
          backgroundColor: isDark ? '#111120' : '#FFFFFF',
          borderTopColor: isDark ? 'rgba(139, 92, 246, 0.1)' : '#E2E8F0',
          borderTopWidth: 1,
          paddingTop: 6,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          height: tabHeight,
          ...(isDark ? {} : Shadows.sm),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginBottom: -2,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="house.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="book.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="magnifyingglass" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: 'Social',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person.2.fill" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon name="person.crop.circle" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
