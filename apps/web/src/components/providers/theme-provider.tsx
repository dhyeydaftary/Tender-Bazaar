'use client';

import type { ComponentProps } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';

// Derive the props from the component instead of importing them from a deep
// path inside the package.
//
// next-themes 0.3 exports ThemeProviderProps ONLY from
// 'next-themes/dist/types' - its package root re-exports just ThemeProvider
// and useTheme - while 0.4 removed that subpath altogether. So neither the
// deep import nor a root import compiles against both versions, and the
// Dependabot bump to 0.4.6 failed CI with
// "TS2307: Cannot find module 'next-themes/dist/types'" (run 39414327872).
//
// ComponentProps reads the props off the component itself, so it compiles on
// 0.3 and 0.4 alike and cannot break again when the package reorganises its
// internal files.
type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
