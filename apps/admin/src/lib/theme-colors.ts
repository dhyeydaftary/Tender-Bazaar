/**
 * Brand color CSS variables for the admin theme (Settings → Appearance).
 *
 * Each brand color is published twice:
 *   --color-<token>       the hex value, for inline styles and chart libraries;
 *   --color-<token>-rgb   space-separated channels ("0 212 170"), which the
 *                         Tailwind tokens use as rgb(var(...) / <alpha-value>).
 *
 * Tailwind cannot apply an opacity modifier to a `var(--x, #hex)` color, so
 * classes such as `bg-accent-500/10` or `from-secondary-900/40` were silently
 * never generated — which is why changing Accent or Secondary had (almost) no
 * visible effect. The channel variables make those classes real and live.
 */

export const DEFAULT_BRAND_COLORS = {
  primary: '#FF6B35',
  secondary: '#1B2845',
  accent: '#00D4AA',
} as const;

export const SECONDARY_VAR = '--color-secondary-900';
export const ACCENT_VAR = '--color-accent-500';

/** '#00D4AA' → '0 212 170'; also accepts '#0da'. Null for anything else. */
export function hexToRgbChannels(hex: string): string | null {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return null;
  let digits = match[1];
  if (digits.length === 3) digits = digits.split('').map((c) => c + c).join('');
  const n = parseInt(digits, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** The CSS custom properties to set for a brand color; empty when the value is not a hex color. */
export function brandColorProperties(cssVar: string, hex: string): Record<string, string> {
  const channels = hexToRgbChannels(hex);
  if (!channels) return {};
  return { [cssVar]: hex, [`${cssVar}-rgb`]: channels };
}
