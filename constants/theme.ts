/**
 * ChrolloMark Theme
 * Dark-first design with purple accent for manga/webtoon readers
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#1A1A2E',
    textSecondary: '#64748B',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceElevated: '#F1F5F9',
    primary: '#7C3AED',
    primaryLight: '#A78BFA',
    primaryDark: '#5B21B6',
    accent: '#F59E0B',
    accentLight: '#FDE68A',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    tint: '#7C3AED',
    icon: '#64748B',
    tabIconDefault: '#94A3B8',
    tabIconSelected: '#7C3AED',
    card: '#FFFFFF',
    cardBorder: 'rgba(124, 58, 237, 0.1)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    skeleton: '#E2E8F0',
  },
  dark: {
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    background: '#0B0B14',
    surface: '#151525',
    surfaceElevated: '#1E1E35',
    primary: '#8B5CF6',
    primaryLight: '#A78BFA',
    primaryDark: '#6D28D9',
    accent: '#F59E0B',
    accentLight: '#FDE68A',
    border: 'rgba(148, 163, 184, 0.15)',
    borderLight: 'rgba(148, 163, 184, 0.08)',
    success: '#34D399',
    error: '#F87171',
    warning: '#FBBF24',
    tint: '#A78BFA',
    icon: '#94A3B8',
    tabIconDefault: '#64748B',
    tabIconSelected: '#A78BFA',
    card: 'rgba(30, 30, 53, 0.8)',
    cardBorder: 'rgba(139, 92, 246, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    skeleton: '#1E1E35',
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const Shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: {
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
};

export const StoryTypes = ['Manga', 'Webtoon', 'Manhwa', 'Manhua', 'Light Novel', 'Other'] as const;

export const ReadingStatuses = [
  'Reading',
  'Completed',
  'Plan to Read',
  'On Hold',
  'Dropped',
] as const;

export const Genres = [
  'Action',
  'Adventure',
  'Comedy',
  'Drama',
  'Fantasy',
  'Horror',
  'Isekai',
  'Martial Arts',
  'Mystery',
  'Psychological',
  'Romance',
  'Sci-Fi',
  'Slice of Life',
  'Sports',
  'Supernatural',
  'Thriller',
  'Tragedy',
] as const;

export const StatusColors: Record<string, string> = {
  Reading: '#8B5CF6',
  Completed: '#10B981',
  'Plan to Read': '#3B82F6',
  'On Hold': '#F59E0B',
  Dropped: '#EF4444',
};
