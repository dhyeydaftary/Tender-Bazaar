/**
 * TenderBazaar — ErrorState Component
 *
 * Similar to EmptyState but specifically for errors with a retry button.
 */

import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { lightColors as colors } from '../../theme/colors';
import { typography } from '../../theme/typography';
import { spacing } from '../../theme/spacing';
import Button from './Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  icon?: React.ReactNode;
  title?: string;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const ErrorState: React.FC<ErrorStateProps> = ({
  message = 'Something went wrong. Please try again.',
  onRetry,
  icon,
  title = 'Oops!',
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.iconWrapper}>
        {icon || (
          <View style={styles.iconCircle}>
            <Icon name="alert-circle" size={36} color={colors.danger} />
          </View>
        )}
      </View>

      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>

      {onRetry && (
        <View style={styles.actionWrapper}>
          <Button
            title="Retry"
            onPress={onRetry}
            variant="solid"
            size="md"
            leftIcon={<Icon name="refresh-cw" size={16} color="#FFFFFF" />}
          />
        </View>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.huge,
  },
  iconWrapper: {
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.danger + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  actionWrapper: {
    marginTop: spacing.xl,
  },
});

export default React.memo(ErrorState);
