/**
 * TenderBazaar Design System — Spacing & Border Radius
 *
 * A linear spacing scale (in dp) plus a border-radius scale used
 * consistently across every component for uniform visual rhythm.
 */

// ---------------------------------------------------------------------------
// Spacing scale
// ---------------------------------------------------------------------------

export const spacing = {
  /** 4dp — hairline gaps, icon padding */
  xs: 4,
  /** 8dp — tight inner spacing */
  sm: 8,
  /** 12dp — default inner padding */
  md: 12,
  /** 16dp — standard spacing unit */
  base: 16,
  /** 20dp — comfortable spacing */
  lg: 20,
  /** 24dp — section padding */
  xl: 24,
  /** 32dp — large gaps between sections */
  xxl: 32,
  /** 40dp — page-level vertical margins */
  xxxl: 40,
  /** 48dp — hero / header spacing */
  huge: 48,
  /** 64dp — large visual separators */
  massive: 64,
  /** 80dp — splash / onboarding spacing */
  giant: 80,
} as const;

// ---------------------------------------------------------------------------
// Border radius scale
// ---------------------------------------------------------------------------

export const borderRadius = {
  /** 8dp — subtle rounding (inputs, small cards) */
  sm: 8,
  /** 12dp — standard card rounding */
  md: 12,
  /** 16dp — prominent rounding (bottom sheets, modals) */
  lg: 16,
  /** 24dp — pill-shaped elements */
  xl: 24,
  /** 9999dp — perfect circle / capsule */
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
