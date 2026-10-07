/**
 * TenderBazaar Design System — Shadows
 *
 * Platform-specific shadow styles.
 * - iOS: shadowOffset + shadowRadius + shadowOpacity + shadowColor
 * - Android: elevation
 *
 * Every shadow preset returns a plain object that can be spread directly
 * into a StyleSheet definition or an inline style.
 */

import { Platform, ViewStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type ShadowPreset = ViewStyle;

function createShadow(
  offsetY: number,
  blur: number,
  opacity: number,
  elevation: number,
): ShadowPreset {
  return Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: {
      elevation,
    },
    default: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: blur,
      elevation,
    },
  }) as ShadowPreset;
}

// ---------------------------------------------------------------------------
// Shadow presets
// ---------------------------------------------------------------------------

export const shadows = {
  /** Subtle — input focus rings, list items */
  sm: createShadow(1, 3, 0.08, 2),

  /** Medium — cards, dropdowns */
  md: createShadow(4, 12, 0.12, 4),

  /** Large — modals, bottom sheets */
  lg: createShadow(8, 24, 0.16, 8),

  /** Extra-large — floating action buttons, popovers */
  xl: createShadow(12, 36, 0.2, 12),

  /** No shadow — explicit reset */
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ShadowPreset,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Shadows = typeof shadows;
