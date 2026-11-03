/**
 * Layout and formatting helpers for the home-page KPI cards.
 */

/** statsContainer horizontal padding (20 + 20). */
const STATS_ROW_PADDING = 40;
/** Space taken by separators between the visible cards. */
const STATS_ROW_GAPS = 24;
const MIN_CARD_WIDTH = 112;
const MAX_CARD_WIDTH = 170;

/**
 * KPI card width for the current window: ~2.75 cards visible on a phone (the
 * last one peeking to show the row scrolls), clamped so numbers stay legible on
 * narrow screens and cards don't stretch on tablets.
 */
export function getStatCardWidth(windowWidth: number): number {
  const available = windowWidth - STATS_ROW_PADDING;
  return Math.round(
    Math.min(MAX_CARD_WIDTH, Math.max(MIN_CARD_WIDTH, (available - STATS_ROW_GAPS) / 2.75)),
  );
}

/** Font size for a KPI number, scaled to the card so long values fit. */
export function getStatValueFontSize(cardWidth: number): number {
  return Math.round(Math.min(26, Math.max(18, cardWidth * 0.17)));
}

/** Indian digit grouping from 1,000 up keeps long counts readable (1,23,456). */
export function formatStatNumber(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('en-IN');
  }
  return value.toString();
}
