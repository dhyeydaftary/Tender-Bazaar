import { useCallback } from 'react';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

const options = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

type HapticFeedbackType =
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'rigid'
  | 'soft'
  | 'notificationSuccess'
  | 'notificationWarning'
  | 'notificationError'
  | 'selection';

type HapticStyle =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'success'
  | 'error'
  | 'warning';

const HAPTIC_MAP: Record<HapticStyle, HapticFeedbackType> = {
  light: 'impactLight',
  medium: 'impactMedium',
  heavy: 'impactHeavy',
  success: 'notificationSuccess',
  error: 'notificationError',
  warning: 'notificationWarning',
};

/**
 * Trigger haptic feedback programmatically.
 *
 * Usage:
 * ```ts
 * const haptic = useHaptic();
 * haptic('success');
 * ```
 */
export function useHaptic() {
  const trigger = useCallback((style: HapticStyle = 'light') => {
    const type = HAPTIC_MAP[style];
    ReactNativeHapticFeedback.trigger(type, options);
  }, []);

  return trigger;
}
