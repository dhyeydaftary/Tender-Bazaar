/**
 * TenderBazaar — Header Component
 *
 * Custom navigation header.
 * Back arrow (left), title (center), right action.
 * Background configurable (transparent or card color).
 */

import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import { lightColors as colors } from '../../theme/colors';
import { typography, fontFamilies } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: () => void;
  rightIcon?: React.ReactNode;
  leftIcon?: React.ReactNode;
  transparent?: boolean;
  titleAlign?: 'center' | 'left';
  subtitle?: string;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Header: React.FC<HeaderProps> = ({
  title,
  showBack = false,
  onBack,
  rightAction,
  rightIcon,
  leftIcon,
  transparent = false,
  titleAlign = 'center',
  subtitle,
  style,
}) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top || (Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44) },
        transparent ? styles.transparent : styles.opaque,
        style,
      ]}
    >
      <View style={styles.row}>
        {/* Left section */}
        <View style={styles.leftSection}>
          {showBack && (
            <Pressable
              onPress={onBack}
              style={styles.backButton}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Icon name="arrow-left" size={24} color={colors.textPrimary} />
            </Pressable>
          )}
          {leftIcon && !showBack && (
            <View style={styles.backButton}>{leftIcon}</View>
          )}
        </View>

        {/* Title section */}
        <View
          style={[
            styles.titleSection,
            titleAlign === 'left' && styles.titleLeft,
          ]}
        >
          {title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>

        {/* Right section */}
        <View style={styles.rightSection}>
          {rightIcon && rightAction && (
            <Pressable
              onPress={rightAction}
              style={styles.rightButton}
              hitSlop={12}
              accessibilityRole="button"
            >
              {rightIcon}
            </Pressable>
          )}
          {rightIcon && !rightAction && (
            <View style={styles.rightButton}>{rightIcon}</View>
          )}
        </View>
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const HEADER_HEIGHT = 56;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  opaque: {
    backgroundColor: colors.headerBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  transparent: {
    backgroundColor: 'transparent',
  },
  row: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
  },
  leftSection: {
    width: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  titleSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleLeft: {
    alignItems: 'flex-start',
    paddingLeft: spacing.xs,
  },
  rightSection: {
    width: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backButton: {
    padding: spacing.xs,
  },
  rightButton: {
    padding: spacing.xs,
  },
  title: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: colors.headerText,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
});

export default React.memo(Header);
