/**
 * TenderBazaar -- DeadlineBadge Component (Premium)
 *
 * Smart deadline countdown pill with urgency coloring and animations.
 * - Displays: "2d left", "12h left", "3d 5h", "Expired"
 * - Red (<3d), Amber (<7d), Green (>7d), Gray (expired)
 * - Icons: clock-outline (active), alert-circle (urgent <24h), close-circle (expired)
 * - Background: color at 10% opacity
 * - Pill shape with rounded-full
 * - <24h: pulsing animation (opacity 0.7 -> 1.0)
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  red: '#EF4444',
  amber: '#F59E0B',
  green: '#22C55E',
  gray: '#9CA3AF',
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DeadlineBadgeProps {
  deadline: string | Date;
  style?: ViewStyle;
}

interface DeadlineInfo {
  label: string;
  color: string;
  bgColor: string;
  iconName: string;
  isUrgent: boolean; // <24 hours
  isExpired: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getDeadlineInfo(deadline: string | Date): DeadlineInfo {
  const now = new Date();
  const deadlineDate = typeof deadline === 'string' ? new Date(deadline) : deadline;
  const diffMs = deadlineDate.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      label: 'Expired',
      color: COLORS.gray,
      bgColor: COLORS.gray + '1A',
      iconName: 'close-circle-outline',
      isUrgent: false,
      isExpired: true,
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const totalDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const remainingHours = totalHours % 24;

  // Build label
  let label: string;
  if (totalDays === 0) {
    label = `${totalHours}h left`;
  } else if (totalDays < 7 && remainingHours > 0) {
    label = `${totalDays}d ${remainingHours}h`;
  } else {
    label = `${totalDays}d left`;
  }

  // Determine color tier
  let color: string;
  let iconName: string;
  const isUrgent = totalHours < 24;

  if (isUrgent) {
    color = COLORS.red;
    iconName = 'alert-circle-outline';
  } else if (totalDays < 3) {
    color = COLORS.red;
    iconName = 'clock-outline';
  } else if (totalDays < 7) {
    color = COLORS.amber;
    iconName = 'clock-outline';
  } else {
    color = COLORS.green;
    iconName = 'clock-outline';
  }

  return {
    label,
    color,
    bgColor: color + '1A',
    iconName,
    isUrgent,
    isExpired: false,
  };
}

// ---------------------------------------------------------------------------
// Pulsing wrapper for urgent deadlines
// ---------------------------------------------------------------------------

const PulsingWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const opacity = useSharedValue(1);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={animatedStyle}>{children}</Animated.View>;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DeadlineBadge: React.FC<DeadlineBadgeProps> = ({ deadline, style }) => {
  const info = useMemo(() => getDeadlineInfo(deadline), [deadline]);

  const pill = (
    <View style={[styles.container, { backgroundColor: info.bgColor }, style]}>
      <MCIcon
        name={info.iconName}
        size={13}
        color={info.color}
        style={styles.icon}
      />
      <Text style={[styles.label, { color: info.color }]}>
        {info.label}
      </Text>
    </View>
  );

  // Wrap in pulsing animation if <24h and not expired
  if (info.isUrgent && !info.isExpired) {
    return <PulsingWrapper>{pill}</PulsingWrapper>;
  }

  return pill;
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  icon: {
    marginRight: 4,
  },
  label: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

export default React.memo(DeadlineBadge);
