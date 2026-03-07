import { useTheme } from '@/store/ThemeContext';

export function useColorScheme(): 'light' | 'dark' {
    const { theme } = useTheme();
    return theme;
}
