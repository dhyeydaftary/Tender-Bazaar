/**
 * ThemeProvider — Re-exports the full theme provider from @/theme
 *
 * This file exists so the providers/ directory has a co-located entry point.
 * The actual implementation (context, hook, light/dark themes) lives in
 * src/theme/index.ts which already provides ThemeProvider and useTheme.
 *
 * Consumers that import from '@/app/providers/ThemeProvider' get the same
 * provider and hook that '@/theme' exposes.
 */

export { ThemeProvider, useTheme } from '../../theme';
export type { Theme } from '../../theme';
