/**
 * Format a number as Indian currency (INR) with Lakhs/Cr notation.
 *
 * Examples:
 *   formatCurrency(1500)      => "₹1,500"
 *   formatCurrency(150000)    => "₹1.5 Lakh"
 *   formatCurrency(15000000)  => "₹1.5 Cr"
 */
export function formatCurrency(value: number | undefined | null): string {
  if (value === undefined || value === null) {
    return '₹0';
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_00_00_000) {
    // Crores (1 Cr = 10,000,000)
    const crores = absValue / 1_00_00_000;
    const formatted =
      crores % 1 === 0 ? crores.toFixed(0) : crores.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}₹${formatted} Cr`;
  }

  if (absValue >= 1_00_000) {
    // Lakhs (1 Lakh = 100,000)
    const lakhs = absValue / 1_00_000;
    const formatted =
      lakhs % 1 === 0 ? lakhs.toFixed(0) : lakhs.toFixed(2).replace(/\.?0+$/, '');
    return `${sign}₹${formatted} Lakh`;
  }

  // Below 1 Lakh — use Indian number system grouping
  return `${sign}₹${formatIndianNumber(absValue)}`;
}

/**
 * Format a number using the Indian numbering system (e.g. 12,34,567).
 */
function formatIndianNumber(num: number): string {
  const str = Math.round(num).toString();
  if (str.length <= 3) {
    return str;
  }

  let lastThree = str.slice(-3);
  const remaining = str.slice(0, -3);
  const formatted = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${formatted},${lastThree}`;
}

/**
 * Format an ISO date string to DD MMM YYYY.
 *
 * Example: formatDate("2026-03-15T10:00:00Z") => "15 Mar 2026"
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Return a relative "time ago" string.
 *
 * Examples: "just now", "5m ago", "3h ago", "2d ago", "1w ago", "15 Mar 2026"
 */
export function timeAgo(dateStr: string | undefined | null): string {
  if (!dateStr) return '';

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  const diffWeek = Math.floor(diffDay / 7);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;

  return formatDate(dateStr);
}

/**
 * Format a tender value for display. Handles null/undefined and zero values.
 *
 * Examples:
 *   formatTenderValue(5000000) => "₹50 Lakh"
 *   formatTenderValue(0)       => "Not Disclosed"
 *   formatTenderValue(null)    => "Not Disclosed"
 */
export function formatTenderValue(value: number | undefined | null): string {
  if (value === undefined || value === null || value === 0) {
    return 'Not Disclosed';
  }
  return formatCurrency(value);
}
