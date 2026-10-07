/**
 * TenderBazaar Design System — Theme Provider & Hook
 *
 * Re-exports every token module and exposes:
 *   - `lightTheme` / `darkTheme` — complete theme objects
 *   - `ThemeProvider`             — React context provider
 *   - `useTheme()`               — hook to consume theme values
 *
 * Usage:
 *   // App root
 *   import { ThemeProvider } from '@/theme';
 *   <ThemeProvider><App /></ThemeProvider>
 *
 *   // Any component
 *   import { useTheme } from '@/theme';
 *   const { colors, typography, spacing, shadows, isDark, toggleTheme } = useTheme();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, ColorSchemeName, StatusBar } from 'react-native';

// Token modules — re-exported for direct imports
export { lightColors, darkColors } from './colors';
export type { Colors } from './colors';
export {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  typography,
} from './typography';
export type { Typography } from './typography';
export { spacing, borderRadius } from './spacing';
export type { Spacing, BorderRadius } from './spacing';
export { shadows } from './shadows';
export type { Shadows } from './shadows';
export {
  springConfig,
  bouncySpring,
  gentleSpring,
  snappySpring,
  quickTiming,
  standardTiming,
  slowTiming,
  durations,
} from './animations';
export type { SpringConfig, TimingConfig } from './animations';

// Local imports for theme construction
import { lightColors, darkColors, Colors } from './colors';
import { typography, Typography } from './typography';
import { spacing, borderRadius, Spacing, BorderRadius } from './spacing';
import { shadows, Shadows } from './shadows';

// ---------------------------------------------------------------------------
// Theme objects
// ---------------------------------------------------------------------------

export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  borderRadius: BorderRadius;
  shadows: Shadows;
  isDark: boolean;
}

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  isDark: false,
};

export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
  shadows,
  isDark: true,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeContextValue extends Theme {
  toggleTheme: () => void;
  setTheme: (mode: 'light' | 'dark' | 'system') => void;
  themeMode: 'light' | 'dark' | 'system';
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helper — resolve system preference
// ---------------------------------------------------------------------------

function resolveScheme(
  mode: 'light' | 'dark' | 'system',
  system: ColorSchemeName,
): boolean {
  if (mode === 'system') {
    return system === 'dark';
  }
  return mode === 'dark';
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  /** Initial mode.  Defaults to 'system'. */
  initialMode?: 'light' | 'dark' | 'system';
  children: React.ReactNode;
}

export function ThemeProvider({
  initialMode = 'system',
  children,
}: ThemeProviderProps): React.JSX.Element {
  const [mode, setMode] = useState<'light' | 'dark' | 'system'>(initialMode);
  const [systemScheme, setSystemScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme() ?? 'light',
  );

  // Listen for OS appearance changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });
    return () => subscription.remove();
  }, []);

  const isDark = resolveScheme(mode, systemScheme);
  const theme = isDark ? darkTheme : lightTheme;

  const toggleTheme = useCallback(() => {
    setMode(prev => {
      if (prev === 'system') {
        return isDark ? 'light' : 'dark';
      }
      return prev === 'dark' ? 'light' : 'dark';
    });
  }, [isDark]);

  const setThemeMode = useCallback((newMode: 'light' | 'dark' | 'system') => {
    setMode(newMode);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...theme,
      isDark,
      toggleTheme,
      setTheme: setThemeMode,
      themeMode: mode,
    }),
    [theme, isDark, toggleTheme, setThemeMode, mode],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={theme.colors.background}
      />
      {children}
    </ThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access the current theme.
 *
 * Returns `{ colors, typography, spacing, borderRadius, shadows, isDark, toggleTheme, setTheme, themeMode }`.
 *
 * Must be called inside a `<ThemeProvider>`.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error(
      'useTheme() must be used within a <ThemeProvider>. ' +
        'Wrap your app root with <ThemeProvider> from @/theme.',
    );
  }
  return ctx;
}
