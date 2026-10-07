/**
 * TenderBazaar Design System — Color Palette
 *
 * Brand colors follow the project style guide:
 *   Primary   #FF6B35  (Saffron Orange)
 *   Secondary #1B2845  (Deep Navy)
 *   Accent    #00D4AA  (Teal Green)
 *
 * Every surface, text, border, semantic, category, and score token is defined
 * for both light and dark modes so the entire app can switch appearance
 * without per-component overrides.
 */

// ---------------------------------------------------------------------------
// Shared (mode-independent) tokens
// ---------------------------------------------------------------------------

const brand = {
  primary: '#FF6B35',
  primaryLight: '#FF8F66',
  primaryDark: '#E55A25',
  secondary: '#1B2845',
  secondaryLight: '#2A3D66',
  secondaryDark: '#111A2E',
  accent: '#00D4AA',
  accentLight: '#33DFBB',
  accentDark: '#00B892',
} as const;

const semantic = {
  success: '#22C55E',
  successLight: '#4ADE80',
  successDark: '#16A34A',
  warning: '#F59E0B',
  warningLight: '#FBBF24',
  warningDark: '#D97706',
  danger: '#EF4444',
  dangerLight: '#F87171',
  dangerDark: '#DC2626',
  info: '#3B82F6',
  infoLight: '#60A5FA',
  infoDark: '#2563EB',
} as const;

const category = {
  works: '#E8593C',
  goods: '#2563EB',
  services: '#0D9488',
  consultancy: '#7C3AED',
} as const;

const score = {
  high: '#22C55E',
  mid: '#F59E0B',
  low: '#EF4444',
} as const;

// ---------------------------------------------------------------------------
// Light mode
// ---------------------------------------------------------------------------

export const lightColors = {
  ...brand,
  ...semantic,
  category,
  score,

  // Surfaces
  background: '#F7F8FA',
  surface: '#FFFFFF',
  card: '#FFFFFF',
  cardElevated: '#FFFFFF',

  // Borders & dividers
  border: '#E8ECF1',
  borderLight: '#F0F2F5',
  borderFocused: '#FF6B35',
  divider: '#E8ECF1',

  // Text
  textPrimary: '#0F1117',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  textOnAccent: '#0F1117',
  textDisabled: '#D1D5DB',
  textLink: '#FF6B35',

  // Interactive states
  ripple: 'rgba(255, 107, 53, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.5)',
  disabled: '#E5E7EB',
  skeleton: '#E8ECF1',
  skeletonHighlight: '#F3F4F6',

  // Navigation
  tabBarBackground: '#FFFFFF',
  tabBarBorder: '#E8ECF1',
  tabBarActive: '#FF6B35',
  tabBarInactive: '#9CA3AF',
  headerBackground: '#FFFFFF',
  headerText: '#0F1117',
  statusBar: 'dark-content' as const,

  // Input
  inputBackground: '#F7F8FA',
  inputBorder: '#E8ECF1',
  inputBorderFocused: '#FF6B35',
  inputText: '#0F1117',
  inputPlaceholder: '#9CA3AF',

  // Misc
  badgeBackground: '#FF6B35',
  badgeText: '#FFFFFF',
  shimmer: '#E8ECF1',
  shadow: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Dark mode
// ---------------------------------------------------------------------------

export const darkColors = {
  ...brand,
  ...semantic,
  category,
  score,

  // Surfaces
  background: '#000000',
  surface: '#0F1117',
  card: '#1A1D26',
  cardElevated: '#222530',

  // Borders & dividers
  border: '#2A2D36',
  borderLight: '#1F2229',
  borderFocused: '#FF6B35',
  divider: '#2A2D36',

  // Text
  textPrimary: '#F5F5F5',
  textSecondary: '#9CA3AF',
  textTertiary: '#6B7280',
  textInverse: '#0F1117',
  textOnPrimary: '#FFFFFF',
  textOnSecondary: '#FFFFFF',
  textOnAccent: '#0F1117',
  textDisabled: '#4B5563',
  textLink: '#FF8F66',

  // Interactive states
  ripple: 'rgba(255, 107, 53, 0.18)',
  overlay: 'rgba(0, 0, 0, 0.7)',
  disabled: '#374151',
  skeleton: '#2A2D36',
  skeletonHighlight: '#363A45',

  // Navigation
  tabBarBackground: '#0F1117',
  tabBarBorder: '#2A2D36',
  tabBarActive: '#FF6B35',
  tabBarInactive: '#6B7280',
  headerBackground: '#0F1117',
  headerText: '#F5F5F5',
  statusBar: 'light-content' as const,

  // Input
  inputBackground: '#1A1D26',
  inputBorder: '#2A2D36',
  inputBorderFocused: '#FF6B35',
  inputText: '#F5F5F5',
  inputPlaceholder: '#6B7280',

  // Misc
  badgeBackground: '#FF6B35',
  badgeText: '#FFFFFF',
  shimmer: '#2A2D36',
  shadow: '#000000',
} as const;

// ---------------------------------------------------------------------------
// Exported type — mirrors the shape of both palettes
// ---------------------------------------------------------------------------

export type Colors = typeof lightColors | typeof darkColors;
