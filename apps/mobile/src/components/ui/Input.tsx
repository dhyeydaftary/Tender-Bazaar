/**
 * TenderBazaar — Premium Input Component
 *
 * Floating label animation, bottom border style,
 * error shake animation, secure text eye toggle.
 */

import React, { useCallback, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/Feather';
import { lightColors as colors } from '../../theme/colors';
import { typography, fontFamilies } from '../../theme/typography';
import { spacing } from '../../theme/spacing';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  multiline?: boolean;
  maxLength?: number;
  placeholder?: string;
  style?: ViewStyle;
  inputStyle?: TextStyle;
  onFocus?: () => void;
  onBlur?: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DURATION = 200;
const LABEL_TOP_FOCUSED = 0;
const LABEL_TOP_DEFAULT = 20;
const LABEL_SIZE_FOCUSED = 12;
const LABEL_SIZE_DEFAULT = 16;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry = false,
  keyboardType,
  autoCapitalize = 'none',
  editable = true,
  multiline = false,
  maxLength,
  placeholder,
  style,
  inputStyle,
  onFocus: onFocusProp,
  onBlur: onBlurProp,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isSecureVisible, setIsSecureVisible] = useState(false);

  // Label animation
  const labelProgress = useSharedValue(value ? 1 : 0);
  // Error shake
  const shakeX = useSharedValue(0);

  const animatedLabelStyle = useAnimatedStyle(() => {
    const top = interpolate(labelProgress.value, [0, 1], [LABEL_TOP_DEFAULT, LABEL_TOP_FOCUSED]);
    const fontSize = interpolate(
      labelProgress.value,
      [0, 1],
      [LABEL_SIZE_DEFAULT, LABEL_SIZE_FOCUSED],
    );
    return { top, fontSize };
  });

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    labelProgress.value = withTiming(1, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    onFocusProp?.();
  }, [labelProgress, onFocusProp]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    if (!value) {
      labelProgress.value = withTiming(0, { duration: DURATION, easing: Easing.out(Easing.cubic) });
    }
    onBlurProp?.();
  }, [labelProgress, value, onBlurProp]);

  // Trigger shake when error prop changes to a truthy value
  React.useEffect(() => {
    if (error) {
      shakeX.value = withSequence(
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(3, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [error, shakeX]);

  const borderColor = error
    ? colors.danger
    : isFocused
      ? colors.primary
      : colors.inputBorder;

  const labelColor = error
    ? colors.danger
    : isFocused
      ? colors.primary
      : colors.textTertiary;

  return (
    <Animated.View style={[styles.container, shakeStyle, style]}>
      <View style={[styles.inputRow, { borderBottomColor: borderColor }]}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

        <View style={styles.inputWrapper}>
          <Animated.Text
            style={[
              styles.label,
              animatedLabelStyle,
              { color: labelColor },
            ]}
            numberOfLines={1}
          >
            {label}
          </Animated.Text>

          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            secureTextEntry={secureTextEntry && !isSecureVisible}
            keyboardType={keyboardType}
            autoCapitalize={autoCapitalize}
            editable={editable}
            multiline={multiline}
            maxLength={maxLength}
            placeholder={isFocused ? placeholder : undefined}
            placeholderTextColor={colors.inputPlaceholder}
            style={[styles.input, inputStyle]}
            selectionColor={colors.primary}
          />
        </View>

        {secureTextEntry && (
          <Pressable
            onPress={() => setIsSecureVisible((v) => !v)}
            style={styles.eyeButton}
            hitSlop={8}
          >
            <Icon
              name={isSecureVisible ? 'eye' : 'eye-off'}
              size={20}
              color={colors.textTertiary}
            />
          </Pressable>
        )}

        {rightIcon && !secureTextEntry && (
          <View style={styles.rightIcon}>{rightIcon}</View>
        )}
      </View>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
    </Animated.View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.base,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1.5,
    paddingBottom: spacing.xs,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 48,
    position: 'relative',
  },
  label: {
    position: 'absolute',
    left: 0,
    fontFamily: fontFamilies.medium,
  },
  input: {
    ...typography.body,
    color: colors.inputText,
    paddingTop: 18,
    paddingBottom: 0,
    paddingHorizontal: 0,
    margin: 0,
  },
  leftIcon: {
    marginRight: spacing.sm,
    marginTop: 14,
  },
  rightIcon: {
    marginLeft: spacing.sm,
    marginTop: 14,
  },
  eyeButton: {
    marginLeft: spacing.sm,
    marginTop: 14,
    padding: spacing.xs,
  },
  errorText: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
});

export default React.memo(Input);
