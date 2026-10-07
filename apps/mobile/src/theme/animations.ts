/**
 * TenderBazaar Design System — Animation Configs
 *
 * Reusable spring and timing configurations for react-native-reanimated.
 *
 * Usage:
 *   import { withSpring, withTiming } from 'react-native-reanimated';
 *   import { springConfig, quickTiming } from '@/theme/animations';
 *
 *   style.value = withSpring(1, springConfig);
 *   style.value = withTiming(0, quickTiming);
 */

import { Easing } from 'react-native-reanimated';

// ---------------------------------------------------------------------------
// Spring configs — used with `withSpring(target, config)`
// ---------------------------------------------------------------------------

/** Standard interaction spring (buttons, toggles, cards) */
export const springConfig = {
  damping: 15,
  stiffness: 150,
} as const;

/** Bouncy spring (tab switches, success animations) */
export const bouncySpring = {
  damping: 10,
  stiffness: 200,
} as const;

/** Gentle spring (layout shifts, page transitions) */
export const gentleSpring = {
  damping: 20,
  stiffness: 100,
} as const;

/** Snappy spring (drag-release, swipe-to-dismiss) */
export const snappySpring = {
  damping: 18,
  stiffness: 250,
} as const;

// ---------------------------------------------------------------------------
// Timing configs — used with `withTiming(target, config)`
// ---------------------------------------------------------------------------

/** Quick 200ms ease-in-out (micro-interactions, opacity fades) */
export const quickTiming = {
  duration: 200,
  easing: Easing.inOut(Easing.ease),
} as const;

/** Standard 300ms ease-in-out (default animation) */
export const standardTiming = {
  duration: 300,
  easing: Easing.inOut(Easing.ease),
} as const;

/** Slow 500ms ease-out (entrance animations, modals) */
export const slowTiming = {
  duration: 500,
  easing: Easing.out(Easing.ease),
} as const;

// ---------------------------------------------------------------------------
// Duration constants (ms) — for non-Reanimated uses (Animated API, delays)
// ---------------------------------------------------------------------------

export const durations = {
  instant: 100,
  fast: 200,
  normal: 300,
  slow: 500,
  slower: 700,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpringConfig = typeof springConfig;
export type TimingConfig = typeof quickTiming;
