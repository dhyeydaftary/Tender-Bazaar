import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx for conditional classes
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Indian notation
 * ₹10+ Cr → "₹X.XX Cr"
 * ₹1-10L → "₹X.XX L"
 * Below 1L → "₹X,XX,XXX"
 */
export function formatCurrency(value: number | null | undefined): string {
  if (value == null || value <= 0) return 'Refer Document';
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN')}`;
}

/**
 * Format a compact number (e.g., 52438 → "52.4K")
 */
export function formatCompact(value: number): string {
  if (value >= 10000000) return `${parseFloat((value / 10000000).toFixed(1))} Cr`;
  if (value >= 100000) return `${parseFloat((value / 100000).toFixed(1))} L`;
  if (value >= 1000) return `${parseFloat((value / 1000).toFixed(1))}K`;
  return value.toLocaleString('en-IN');
}

/**
 * Format Indian number with comma grouping (1,23,45,678)
 */
export function formatIndianNumber(value: number): string {
  return value.toLocaleString('en-IN');
}

/**
 * Format date in Indian style
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(date));
}

/**
 * Format relative time (e.g., "2 hours ago", "5 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = new Date(date);
  const diffMs = now.getTime() - target.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return formatDate(date);
}

/**
 * Get deadline countdown info with urgency color
 */
export function getDeadlineInfo(deadline: string): {
  days: number;
  hours: number;
  text: string;
  color: string;
  urgency: 'expired' | 'critical' | 'warning' | 'normal';
} {
  const now = new Date();
  const end = new Date(deadline);
  const diffMs = end.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs <= 0) {
    return { days: 0, hours: 0, text: 'Closed', color: 'text-muted-foreground', urgency: 'expired' };
  }
  if (diffDays === 0) {
    return { days: 0, hours: diffHours, text: `${diffHours}h left`, color: 'text-red-500', urgency: 'critical' };
  }
  if (diffDays <= 3) {
    return { days: diffDays, hours: diffHours % 24, text: `${diffDays}d left`, color: 'text-red-500', urgency: 'critical' };
  }
  if (diffDays <= 7) {
    return { days: diffDays, hours: diffHours % 24, text: `${diffDays}d left`, color: 'text-amber-500', urgency: 'warning' };
  }
  return { days: diffDays, hours: diffHours % 24, text: `${diffDays}d left`, color: 'text-accent-500', urgency: 'normal' };
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Get category display info
 */
export function getCategoryInfo(category: string): { label: string; color: string; bgColor: string } {
  const map: Record<string, { label: string; color: string; bgColor: string }> = {
    WORKS: { label: 'Works', color: 'text-[#E8593C]', bgColor: 'bg-[#E8593C]/10' },
    GOODS: { label: 'Goods', color: 'text-[#2563EB]', bgColor: 'bg-[#2563EB]/10' },
    SERVICES: { label: 'Services', color: 'text-[#0D9488]', bgColor: 'bg-[#0D9488]/10' },
    CONSULTANCY: { label: 'Consultancy', color: 'text-[#7C3AED]', bgColor: 'bg-[#7C3AED]/10' },
  };
  return map[category] ?? { label: category, color: 'text-muted-foreground', bgColor: 'bg-muted' };
}

/**
 * Score color based on value
 */
export function getScoreColor(score: number): string {
  if (score >= 70) return 'text-score-high';
  if (score >= 40) return 'text-score-mid';
  return 'text-score-low';
}

export function getScoreStrokeColor(score: number): string {
  if (score >= 70) return '#22C55E';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
}
