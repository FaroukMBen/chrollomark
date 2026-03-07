import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
    theme: 'light' | 'dark';
    themeMode: ThemeMode;
    setThemeMode: (mode: ThemeMode) => void;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: 'dark',
    themeMode: 'system',
    setThemeMode: () => {},
    toggleTheme: () => {},
});

const THEME_STORAGE_KEY = '@theme_mode';

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
    const systemScheme = useSystemColorScheme();
    const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(THEME_STORAGE_KEY).then((stored) => {
            if (stored === 'light' || stored === 'dark' || stored === 'system') {
                setThemeModeState(stored);
            }
            setIsLoaded(true);
        });
    }, []);

    const setThemeMode = useCallback((mode: ThemeMode) => {
        setThemeModeState(mode);
        AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    }, []);

    const toggleTheme = useCallback(() => {
        setThemeMode(themeMode === 'dark' ? 'light' : themeMode === 'light' ? 'dark' : 'light');
    }, [themeMode, setThemeMode]);

    const resolvedTheme: 'light' | 'dark' =
        themeMode === 'system' ? (systemScheme ?? 'dark') : themeMode;

    const value = useMemo(
        () => ({ theme: resolvedTheme, themeMode, setThemeMode, toggleTheme }),
        [resolvedTheme, themeMode, setThemeMode, toggleTheme]
    );

    if (!isLoaded) return null;

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    return useContext(ThemeContext);
}
