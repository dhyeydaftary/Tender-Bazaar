/**
 * TenderBazaar — Badge Component
 *
 * Variants:
 *  - status  : rounded pill with semantic color
 *  - category: colored text + light background based on category
 *  - count   : small circle with number
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle, type TextStyle } from 'react-native';
import { lightColors as colors } from '../../theme/colors';
import { typography, fontFamilies } from '../../theme/typography';
import { borderRadius, spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BadgeVariant = 'status' | 'category' | 'count';

type TenderStatus = 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
type TenderCategory = 'Works' | 'Goods' | 'Services' | 'Consultancy';

interface BadgeProps {
  variant?: BadgeVariant;
  label?: string;
  count?: number;
  status?: TenderStatus;
  category?: TenderCategory;
  color?: string;
  backgroundColor?: string;
  size?: 'sm' | 'md';
  style?: ViewStyle;
  textStyle?: TextStyle;
}

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<TenderStatus, { bg: string; text: string }> = {
  ACTIVE: { bg: '#DCFCE7', text: colors.success },
  CLOSED: { bg: '#FEE2E2', text: colors.danger },
  AWARDED: { bg: '#DBEAFE', text: colors.info },
  CANCELLED: { bg: '#F3F4F6', text: colors.textTertiary },
};

const CATEGORY_COLORS: Record<TenderCategory, { bg: string; text: string }> = {
  Works: { bg: '#FDECE7', text: colors.category.works },
  Goods: { bg: '#DBEAFE', text: colors.category.goods },
  Services: { bg: '#CCFBF1', text: colors.category.services },
  Consultancy: { bg: '#EDE9FE', text: colors.category.consultancy },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Badge: React.FC<BadgeProps> = ({
  variant = 'status',
  label,
  count,
  status,
  category,
  color,
  backgroundColor,
  size = 'md',
  style,
  textStyle,
}) => {
  // --- count variant ---
  if (variant === 'count') {
    const displayCount = count !== undefined ? (count > 99 ? '99+' : String(count)) : '0';
    return (
      <View
        style={[
          styles.countContainer,
          size === 'sm' ? styles.countSm : styles.countMd,
          backgroundColor ? { backgroundColor } : null,
          style,
        ]}
      >
        <Text
          style={[
            styles.countText,
            size === 'sm' ? styles.countTextSm : null,
            color ? { color } : null,
            textStyle,
          ]}
          numberOfLines={1}
        >
          {displayCount}
        </Text>
      </View>
    );
  }

  // --- status / category variant ---
  let bg = backgroundColor || colors.primary + '1A';
  let fg = color || colors.primary;
  let displayLabel = label || '';

  if (variant === 'status' && status) {
    const mapped = STATUS_COLORS[status];
    bg = backgroundColor || mapped.bg;
    fg = color || mapped.text;
    displayLabel = label || status.charAt(0) + status.slice(1).toLowerCase();
  }

  if (variant === 'category' && category) {
    const mapped = CATEGORY_COLORS[category];
    bg = backgroundColor || mapped.bg;
    fg = color || mapped.text;
    displayLabel = label || category;
  }

  return (
    <View
      style={[
        styles.pillContainer,
        size === 'sm' ? styles.pillSm : styles.pillMd,
        { backgroundColor: bg },
        style,
      ]}
    >
      <Text
        style={[
          styles.pillText,
          size === 'sm' ? styles.pillTextSm : null,
          { color: fg },
          textStyle,
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Pill (status + category)
  pillContainer: {
    alignSelf: 'flex-start',
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillMd: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  pillSm: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  pillTextSm: {
    fontSize: 10,
  },

  // Count
  countContainer: {
    backgroundColor: colors.danger,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countMd: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
  },
  countSm: {
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
  },
  countText: {
    fontFamily: fontFamilies.bold,
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  countTextSm: {
    fontSize: 9,
  },
});

export default React.memo(Badge);
