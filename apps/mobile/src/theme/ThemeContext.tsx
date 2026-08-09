import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightColors, darkColors, ColorPalette } from './palettes';

const THEME_STORAGE_KEY = '@financial_hub_theme_mode';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextValue {
  // The resolved scheme actually in effect right now ('light' | 'dark') —
  // always concrete, never 'system', so consumers never have to resolve it
  // themselves.
  scheme: 'light' | 'dark';
  // The user's preference. 'system' means "follow the OS setting".
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ColorPalette;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'light'
  );
  const [isLoaded, setIsLoaded] = useState(false);

  // Load saved theme preference on mount
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode && (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system')) {
          setModeState(savedMode as ThemeMode);
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsLoaded(true);
      }
    };

    loadThemePreference();
  }, []);

  // Save theme preference when it changes
  const setMode = async (newMode: ThemeMode) => {
    setModeState(newMode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch (error) {
      console.error('Failed to save theme preference:', error);
    }
  };

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => sub.remove();
  }, []);

  const scheme: 'light' | 'dark' =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const colors = scheme === 'dark' ? darkColors : lightColors;

  const value = useMemo(
    () => ({ scheme, mode, setMode, colors }),
    [scheme, mode, colors]
  );

  // Don't render children until theme preference is loaded
  if (!isLoaded) {
    return null;
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// Primary hook for theme-aware screens/components:
//
//   const { colors } = useTheme();
//   const styles = makeStyles(colors); // build styles inline or via a
//                                       // small factory instead of a
//                                       // module-level StyleSheet.create,
//                                       // since StyleSheet.create only runs
//                                       // once and won't react to theme
//                                       // changes.
//
// To switch the user's preference (e.g. from a Settings screen):
//   const { setMode } = useTheme();
//   setMode('dark' | 'light' | 'system')
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() must be used within a <ThemeProvider>');
  }
  return ctx;
}