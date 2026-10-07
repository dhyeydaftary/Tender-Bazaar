/**
 * TenderBazaar — BiometricScreen
 *
 * Shown when a previously logged-in user returns to the app and has
 * biometric authentication enabled.  Displays the user avatar, a pulsing
 * fingerprint / face-id icon, and auto-triggers the biometric prompt
 * after a short delay.
 */

import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import Avatar from '../../components/ui/Avatar';
import { useAuthStore } from '../../stores/authStore';
import { useBiometric } from '../../hooks/useBiometric';
import { getCredentials } from '../../services/storage/secureStore';
import type { AuthStackParamList } from '../../types/navigation';
import { fontFamilies } from '../../theme/typography';

// ─── Brand Constants ────────────────────────────────────────────────────────

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const BACKGROUND = '#F7F8FA';

// ─── Helpers ────────────────────────────────────────────────────────────────

type AuthNavProp = NativeStackNavigationProp<AuthStackParamList>;

function getBiometricIcon(biometryType: string | null): string {
  if (biometryType === 'FaceID') return 'face-recognition';
  return 'fingerprint';
}

function getBiometricLabel(biometryType: string | null): string {
  if (biometryType === 'FaceID') return 'Look to unlock';
  return 'Touch to unlock';
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function BiometricScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<AuthNavProp>();
  const { biometryType, authenticate } = useBiometric();

  const user = useAuthStore((s) => s.user);
  const login = useAuthStore((s) => s.login);

  // ── Pulsing animation ──────────────────────────────────────────────────
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1, // infinite
      true, // reverse
    );
  }, [scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // ── Biometric prompt ───────────────────────────────────────────────────
  const handleBiometric = useCallback(async () => {
    const success = await authenticate('Verify your identity');
    if (success) {
      const creds = await getCredentials();
      if (creds && user) {
        await login(user, creds.token, creds.refreshToken);
        // Auth state change will navigate to MainTabs via RootNavigator
      } else {
        Alert.alert(
          'Session expired',
          'Please log in again.',
          [{ text: 'OK', onPress: () => navigation.navigate('Login') }],
        );
      }
    } else {
      Alert.alert(
        'Authentication failed',
        'Biometric verification was not successful. Please try again or use your password.',
      );
    }
  }, [authenticate, user, login, navigation]);

  // Auto-trigger biometric prompt on mount (500ms delay)
  useEffect(() => {
    const timer = setTimeout(() => {
      handleBiometric();
    }, 500);
    return () => clearTimeout(timer);
  }, [handleBiometric]);

  // ── Actions ────────────────────────────────────────────────────────────
  const handleUsePassword = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const handleSwitchAccount = useCallback(async () => {
    const logout = useAuthStore.getState().logout;
    await logout();
    navigation.navigate('Login');
  }, [navigation]);

  // ── Render ─────────────────────────────────────────────────────────────
  const displayName = user?.name ?? 'User';
  const displayEmail = user?.email ?? '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      <View style={styles.content}>
        {/* Avatar */}
        <Avatar
          name={displayName}
          imageUri={user?.avatarUrl}
          size="xl"
          style={styles.avatar}
        />

        {/* Welcome text */}
        <Text style={styles.welcomeText}>Welcome back, {displayName}</Text>
        <Text style={styles.emailText}>{displayEmail}</Text>

        {/* Pulsing biometric icon */}
        <TouchableOpacity
          onPress={handleBiometric}
          activeOpacity={0.7}
          style={styles.iconTouchable}
        >
          <Animated.View style={[styles.iconContainer, pulseStyle]}>
            <Icon
              name={getBiometricIcon(biometryType)}
              size={80}
              color={PRIMARY}
            />
          </Animated.View>
        </TouchableOpacity>

        <Text style={styles.unlockText}>
          {getBiometricLabel(biometryType)}
        </Text>

        {/* Use password instead */}
        <TouchableOpacity
          onPress={handleUsePassword}
          style={styles.passwordButton}
          activeOpacity={0.7}
        >
          <Text style={styles.passwordButtonText}>Use password instead</Text>
        </TouchableOpacity>
      </View>

      {/* Switch account at bottom */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 24 }]}>
        <TouchableOpacity
          onPress={handleSwitchAccount}
          activeOpacity={0.7}
        >
          <Text style={styles.switchAccountText}>Switch account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  avatar: {
    marginBottom: 20,
  },
  welcomeText: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    fontSize: 22,
    color: SECONDARY,
    textAlign: 'center',
    marginBottom: 4,
  },
  emailText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 40,
  },
  iconTouchable: {
    marginBottom: 12,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 107, 53, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unlockText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: TEXT_SECONDARY,
    textAlign: 'center',
    marginBottom: 32,
  },
  passwordButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  passwordButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    fontSize: 15,
    color: PRIMARY,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  switchAccountText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    color: TEXT_SECONDARY,
    textDecorationLine: 'underline',
  },
});
