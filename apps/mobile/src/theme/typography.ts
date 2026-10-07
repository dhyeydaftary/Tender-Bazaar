/**
 * TenderBazaar Design System — Typography
 *
 * Primary font: Plus Jakarta Sans (with system fallback).
 * On iOS the custom font file name is used directly; on Android the
 * family name registered in assets is used.  If Plus Jakarta Sans is
 * not bundled yet, the styles fall back to System gracefully.
 */

import { Platform, TextStyle } from 'react-native';

// ---------------------------------------------------------------------------
// Font families
// ---------------------------------------------------------------------------

// Use system font until Plus Jakarta Sans is bundled.
// On iOS the system font (SF Pro) renders beautifully and avoids crashes
// caused by referencing a font family that isn't installed.
const FONT_FAMILY_BASE = Platform.select({
  ios: 'System',
  android: 'System',
  default: 'System',
}) as string;

export const fontFamilies = {
  regular: FONT_FAMILY_BASE,
  medium: FONT_FAMILY_BASE,
  semiBold: FONT_FAMILY_BASE,
  bold: FONT_FAMILY_BASE,
  extraBold: FONT_FAMILY_BASE,
} as const;

// ---------------------------------------------------------------------------
// Raw scale values
// ---------------------------------------------------------------------------

export const fontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
  xxxl: 28,
  display: 34,
} as const;

export const fontWeights = {
  regular: '400' as TextStyle['fontWeight'],
  medium: '500' as TextStyle['fontWeight'],
  semiBold: '600' as TextStyle['fontWeight'],
  bold: '700' as TextStyle['fontWeight'],
  extraBold: '800' as TextStyle['fontWeight'],
};

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.7,
} as const;

// ---------------------------------------------------------------------------
// Pre-built text styles
// ---------------------------------------------------------------------------

export const typography = {
  /** 28px / ExtraBold / tight — page titles */
  h1: {
    fontFamily: fontFamilies.extraBold,
    fontSize: fontSizes.xxxl,
    fontWeight: fontWeights.extraBold,
    lineHeight: fontSizes.xxxl * lineHeights.tight,
    letterSpacing: -0.5,
  } as TextStyle,

  /** 24px / Bold / tight — section headers */
  h2: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.xxl,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.xxl * lineHeights.tight,
    letterSpacing: -0.3,
  } as TextStyle,

  /** 20px / SemiBold / tight — card titles */
  h3: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.xl,
    fontWeight: fontWeights.semiBold,
    lineHeight: fontSizes.xl * lineHeights.tight,
    letterSpacing: -0.2,
  } as TextStyle,

  /** 18px / SemiBold / normal — sub-headers */
  h4: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.lg,
    fontWeight: fontWeights.semiBold,
    lineHeight: fontSizes.lg * lineHeights.normal,
    letterSpacing: 0,
  } as TextStyle,

  /** 16px / Regular / normal — default body text */
  body: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.base * lineHeights.normal,
    letterSpacing: 0,
  } as TextStyle,

  /** 16px / Medium / normal — emphasized body text */
  bodyMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.base * lineHeights.normal,
    letterSpacing: 0,
  } as TextStyle,

  /** 14px / Regular / normal — secondary body text */
  bodySmall: {
    fontFamily: fontFamilies.regular,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.regular,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: 0.1,
  } as TextStyle,

  /** 14px / Medium / normal — labels, metadata */
  bodySmallMedium: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: 0.1,
  } as TextStyle,

  /** 12px / Medium / normal — captions, badges */
  caption: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.sm * lineHeights.normal,
    letterSpacing: 0.2,
  } as TextStyle,

  /** 12px / Bold / tight — uppercase labels */
  overline: {
    fontFamily: fontFamilies.bold,
    fontSize: fontSizes.sm,
    fontWeight: fontWeights.bold,
    lineHeight: fontSizes.sm * lineHeights.tight,
    letterSpacing: 1,
    textTransform: 'uppercase' as TextStyle['textTransform'],
  } as TextStyle,

  /** 10px / Medium / normal — tiny helper text */
  tiny: {
    fontFamily: fontFamilies.medium,
    fontSize: fontSizes.xs,
    fontWeight: fontWeights.medium,
    lineHeight: fontSizes.xs * lineHeights.normal,
    letterSpacing: 0.2,
  } as TextStyle,

  /** 16px / SemiBold / normal — buttons */
  button: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.base,
    fontWeight: fontWeights.semiBold,
    lineHeight: fontSizes.base * lineHeights.normal,
    letterSpacing: 0.3,
  } as TextStyle,

  /** 14px / SemiBold / normal — small buttons */
  buttonSmall: {
    fontFamily: fontFamilies.semiBold,
    fontSize: fontSizes.md,
    fontWeight: fontWeights.semiBold,
    lineHeight: fontSizes.md * lineHeights.normal,
    letterSpacing: 0.3,
  } as TextStyle,
} as const;

export type Typography = typeof typography;
