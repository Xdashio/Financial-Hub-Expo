import React, { createContext, useContext, useMemo, useState, useEffect } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { lightColors, darkColors, ColorPalette } from './palettes';

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
  const [mode, setMode] = useState<ThemeMode>('system');
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'light'
  );

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