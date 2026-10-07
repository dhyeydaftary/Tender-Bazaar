import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Alert,
  ActionSheetIOS,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withSequence,
  withRepeat,
  FadeIn,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useAuthStore } from '../../stores/authStore';
import { updateProfile } from '../../services/api/profile';
import { lightColors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface FieldErrors {
  name?: string;
  phone?: string;
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

const STAGGER_DELAY = 50;

// ---------------------------------------------------------------------------
// Password-strength helper
// ---------------------------------------------------------------------------

function getPasswordStrength(pw: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score: 1, label: 'Weak', color: lightColors.danger };
  if (score <= 2) return { score: 2, label: 'Fair', color: lightColors.warning };
  if (score <= 3) return { score: 3, label: 'Good', color: lightColors.warningLight };
  if (score <= 4) return { score: 4, label: 'Strong', color: lightColors.success };
  return { score: 5, label: 'Excellent', color: lightColors.accent };
}

// ---------------------------------------------------------------------------
// Animated form field
// ---------------------------------------------------------------------------

const AnimatedField = React.memo(function AnimatedField({
  index,
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  error,
  editable = true,
  keyboardType = 'default',
  autoCapitalize = 'none',
  maxLength,
  secureTextEntry = false,
  prefix,
  verifiedBadge = false,
  children,
}: {
  index: number;
  label: string;
  icon?: string;
  value: string;
  onChangeText?: (t: string) => void;
  placeholder: string;
  error?: string;
  editable?: boolean;
  keyboardType?: TextInput['props']['keyboardType'];
  autoCapitalize?: TextInput['props']['autoCapitalize'];
  maxLength?: number;
  secureTextEntry?: boolean;
  prefix?: string;
  verifiedBadge?: boolean;
  children?: React.ReactNode;
}) {
  const shakeX = useSharedValue(0);
  const prevError = useRef(error);

  useEffect(() => {
    if (error && error !== prevError.current) {
      shakeX.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-6, { duration: 50 }),
        withTiming(6, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
    }
    prevError.current = error;
  }, [error, shakeX]);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const [isFocused, setIsFocused] = useState(false);

  return (
    <Animated.View
      entering={FadeIn.delay(index * STAGGER_DELAY + 200)
        .duration(350)}
      style={styles.fieldContainer}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Animated.View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          !editable && styles.inputWrapperDisabled,
          error ? styles.inputWrapperError : undefined,
          shakeStyle,
        ]}>
        {icon && (
          <Icon
            name={icon}
            size={20}
            color={
              error
                ? lightColors.danger
                : isFocused
                  ? lightColors.primary
                  : lightColors.textTertiary
            }
            style={styles.inputIcon}
          />
        )}
        {prefix && (
          <>
            <Text style={styles.phonePrefix}>{prefix}</Text>
            <View style={styles.phoneDivider} />
          </>
        )}
        <TextInput
          style={[
            styles.input,
            !editable && styles.inputDisabled,
          ]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={lightColors.inputPlaceholder}
          editable={editable}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {verifiedBadge && (
          <View style={styles.verifiedInline}>
            <Icon
              name="check-decagram"
              size={18}
              color={lightColors.success}
            />
          </View>
        )}
        {children}
      </Animated.View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// EditProfileScreen
// ---------------------------------------------------------------------------

export default function EditProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // --- Form state ---
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const email = user?.email ?? '';

  // --- Password section ---
  const [passwordExpanded, setPasswordExpanded] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // --- Saving ---
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  // --- Delete ---
  const [deleteText, setDeleteText] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // --- Dirty tracking ---
  const isDirty = useMemo(() => {
    const nameChanged = name !== (user?.name ?? '');
    const phoneChanged = phone !== (user?.phone ?? '');
    const passwordChanged =
      passwordExpanded &&
      (currentPassword.length > 0 ||
        newPassword.length > 0 ||
        confirmPassword.length > 0);
    return nameChanged || phoneChanged || passwordChanged;
  }, [name, phone, user, passwordExpanded, currentPassword, newPassword, confirmPassword]);

  // --- Initials ---
  const initials = useMemo(() => {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, [name]);

  // --- Password strength ---
  const pwStrength = useMemo(
    () => (newPassword.length > 0 ? getPasswordStrength(newPassword) : null),
    [newPassword],
  );

  // --- Save button pulse ---
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (isDirty) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isDirty, pulseScale]);

  const saveButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // --- Success animation ---
  const successOpacity = useSharedValue(0);
  const successAnimStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
  }));

  // --- Password section expand/collapse ---
  const passwordHeight = useSharedValue(0);
  const passwordAnimStyle = useAnimatedStyle(() => ({
    height: passwordHeight.value,
    overflow: 'hidden' as const,
    opacity: passwordHeight.value > 0 ? 1 : 0,
  }));

  useEffect(() => {
    passwordHeight.value = withSpring(passwordExpanded ? 380 : 0, {
      damping: 18,
      stiffness: 120,
    });
  }, [passwordExpanded, passwordHeight]);

  // --- Chevron rotation ---
  const chevronRotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  useEffect(() => {
    chevronRotation.value = withTiming(passwordExpanded ? 180 : 0, {
      duration: 250,
    });
  }, [passwordExpanded, chevronRotation]);

  // --- Validation ---
  const validate = useCallback((): boolean => {
    const errs: FieldErrors = {};
    if (!name.trim()) {
      errs.name = 'Full name is required';
    }
    if (phone.length > 0 && phone.length !== 10) {
      errs.phone = 'Phone number must be 10 digits';
    }
    if (phone.length > 0 && !/^\d+$/.test(phone)) {
      errs.phone = 'Phone number must contain only digits';
    }

    if (passwordExpanded) {
      if (newPassword.length > 0 || confirmPassword.length > 0) {
        if (!currentPassword) {
          errs.currentPassword = 'Current password is required';
        }
        if (newPassword.length < 8) {
          errs.newPassword = 'Password must be at least 8 characters';
        }
        if (newPassword !== confirmPassword) {
          errs.confirmPassword = 'Passwords do not match';
        }
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [name, phone, passwordExpanded, currentPassword, newPassword, confirmPassword]);

  // --- Save ---
  const handleSave = useCallback(async () => {
    if (!validate()) {
      ReactNativeHapticFeedback.trigger('notificationError', HAPTIC_OPTIONS);
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateProfile({
        name: name.trim(),
        phone: phone.trim() || undefined,
      });

      if (res.success && res.data) {
        setUser(res.data);
      } else if (user) {
        // Fallback: update local state if API returns no data
        setUser({ ...user, name: name.trim(), phone: phone.trim() || undefined });
      }

      ReactNativeHapticFeedback.trigger('notificationSuccess', HAPTIC_OPTIONS);

      // Show success toast
      setShowSuccess(true);
      successOpacity.value = withTiming(1, { duration: 300 });

      setTimeout(() => {
        successOpacity.value = withTiming(0, { duration: 300 });
        setTimeout(() => {
          setShowSuccess(false);
          navigation.goBack();
        }, 350);
      }, 1200);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [validate, name, phone, user, setUser, navigation, successOpacity]);

  // --- Photo action sheet ---
  const handleChangePhoto = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library', 'Remove Photo'],
          destructiveButtonIndex: 3,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          // Mock: no actual image picker integration
          if (buttonIndex === 1 || buttonIndex === 2 || buttonIndex === 3) {
            // noop
          }
        },
      );
    } else {
      Alert.alert('Change Photo', 'Choose an option', [
        { text: 'Take Photo' },
        { text: 'Choose from Library' },
        { text: 'Remove Photo', style: 'destructive' },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, []);

  // --- Delete account ---
  const handleDeleteAccount = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
    setShowDeleteDialog(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteText === 'DELETE') {
      setShowDeleteDialog(false);
      Alert.alert('Account Deleted', 'Your account has been scheduled for deletion.');
    }
  }, [deleteText]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={lightColors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}>
          <Icon
            name="arrow-left"
            size={24}
            color={lightColors.textPrimary}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <Animated.View style={saveButtonAnimStyle}>
          <TouchableOpacity
            style={[
              styles.saveHeaderBtn,
              !isDirty && styles.saveHeaderBtnDisabled,
            ]}
            onPress={handleSave}
            disabled={!isDirty || isSaving}
            activeOpacity={0.7}>
            {isSaving ? (
              <ActivityIndicator color={lightColors.textOnPrimary} size="small" />
            ) : (
              <Text
                style={[
                  styles.saveHeaderBtnText,
                  !isDirty && styles.saveHeaderBtnTextDisabled,
                ]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + 52}>
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          keyboardShouldPersistTaps="handled">
          {/* ── Avatar Section ── */}
          <Animated.View
            entering={FadeIn.duration(400)}
            style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {user?.avatarUrl ? (
                <Animated.Image
                  source={{ uri: user.avatarUrl }}
                  style={styles.avatarImage}
                />
              ) : (
                <View style={styles.avatarInitials}>
                  <Text style={styles.avatarInitialsText}>{initials}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.cameraOverlay}
                onPress={handleChangePhoto}
                activeOpacity={0.7}>
                <Icon
                  name="camera"
                  size={16}
                  color={lightColors.textOnPrimary}
                />
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.changePhotoBtn}
              onPress={handleChangePhoto}
              activeOpacity={0.7}>
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* ── Form Fields ── */}
          <AnimatedField
            index={0}
            label="Full Name"
            icon="account-outline"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
            }}
            placeholder="Your full name"
            error={errors.name}
            autoCapitalize="words"
          />

          <AnimatedField
            index={1}
            label="Email"
            icon="email-outline"
            value={email}
            placeholder="your@email.com"
            editable={false}
            verifiedBadge={user?.isEmailVerified ?? false}
          />

          <AnimatedField
            index={2}
            label="Phone"
            value={phone}
            onChangeText={(t) => {
              const digits = t.replace(/\D/g, '');
              setPhone(digits);
              if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
            }}
            placeholder="9876543210"
            error={errors.phone}
            keyboardType="phone-pad"
            maxLength={10}
            prefix="+91"
          />

          {/* ── Password Section ── */}
          <Animated.View
            entering={FadeIn.delay(3 * STAGGER_DELAY + 200).duration(350)}
            style={styles.passwordSection}>
            <TouchableOpacity
              style={styles.passwordToggle}
              onPress={() => setPasswordExpanded((v) => !v)}
              activeOpacity={0.7}>
              <View style={styles.passwordToggleLeft}>
                <Icon
                  name="lock-outline"
                  size={20}
                  color={lightColors.textSecondary}
                />
                <Text style={styles.passwordToggleText}>Change Password</Text>
              </View>
              <Animated.View style={chevronStyle}>
                <Icon
                  name="chevron-down"
                  size={22}
                  color={lightColors.textTertiary}
                />
              </Animated.View>
            </TouchableOpacity>

            <Animated.View style={passwordAnimStyle}>
              <View style={styles.passwordFields}>
                <AnimatedField
                  index={0}
                  label="Current Password"
                  icon="lock-outline"
                  value={currentPassword}
                  onChangeText={(t) => {
                    setCurrentPassword(t);
                    if (errors.currentPassword)
                      setErrors((e) => ({ ...e, currentPassword: undefined }));
                  }}
                  placeholder="Enter current password"
                  error={errors.currentPassword}
                  secureTextEntry={!showCurrentPw}>
                  <TouchableOpacity
                    onPress={() => setShowCurrentPw((v) => !v)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Icon
                      name={showCurrentPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={lightColors.textTertiary}
                    />
                  </TouchableOpacity>
                </AnimatedField>

                <AnimatedField
                  index={1}
                  label="New Password"
                  icon="lock-plus-outline"
                  value={newPassword}
                  onChangeText={(t) => {
                    setNewPassword(t);
                    if (errors.newPassword)
                      setErrors((e) => ({ ...e, newPassword: undefined }));
                  }}
                  placeholder="Enter new password"
                  error={errors.newPassword}
                  secureTextEntry={!showNewPw}>
                  <TouchableOpacity
                    onPress={() => setShowNewPw((v) => !v)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Icon
                      name={showNewPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={lightColors.textTertiary}
                    />
                  </TouchableOpacity>
                </AnimatedField>

                {/* Password strength */}
                {pwStrength && (
                  <View style={styles.strengthRow}>
                    <View style={styles.strengthBarBg}>
                      {[1, 2, 3, 4, 5].map((seg) => (
                        <View
                          key={seg}
                          style={[
                            styles.strengthSegment,
                            {
                              backgroundColor:
                                seg <= pwStrength.score
                                  ? pwStrength.color
                                  : lightColors.border,
                            },
                          ]}
                        />
                      ))}
                    </View>
                    <Text
                      style={[
                        styles.strengthLabel,
                        { color: pwStrength.color },
                      ]}>
                      {pwStrength.label}
                    </Text>
                  </View>
                )}

                <AnimatedField
                  index={2}
                  label="Confirm Password"
                  icon="lock-check-outline"
                  value={confirmPassword}
                  onChangeText={(t) => {
                    setConfirmPassword(t);
                    if (errors.confirmPassword)
                      setErrors((e) => ({ ...e, confirmPassword: undefined }));
                  }}
                  placeholder="Confirm new password"
                  error={errors.confirmPassword}
                  secureTextEntry={!showConfirmPw}>
                  <TouchableOpacity
                    onPress={() => setShowConfirmPw((v) => !v)}
                    hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                    <Icon
                      name={showConfirmPw ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={lightColors.textTertiary}
                    />
                  </TouchableOpacity>
                </AnimatedField>
              </View>
            </Animated.View>
          </Animated.View>

          {/* ── Danger Zone ── */}
          <Animated.View
            entering={FadeIn.delay(4 * STAGGER_DELAY + 200).duration(350)}
            style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}>
              <Icon name="delete-outline" size={20} color={lightColors.danger} />
              <Text style={styles.deleteBtnText}>Delete Account</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success Toast ── */}
      {showSuccess && (
        <Animated.View style={[styles.successToast, successAnimStyle]}>
          <Icon
            name="check-circle"
            size={22}
            color={lightColors.success}
          />
          <Text style={styles.successToastText}>Profile updated successfully</Text>
        </Animated.View>
      )}

      {/* ── Delete Confirmation Dialog ── */}
      {showDeleteDialog && (
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Icon
              name="alert-circle-outline"
              size={48}
              color={lightColors.danger}
              style={styles.dialogIcon}
            />
            <Text style={styles.dialogTitle}>Delete Account</Text>
            <Text style={styles.dialogMessage}>
              This action is irreversible. All your data, saved tenders, and
              documents will be permanently deleted.
            </Text>
            <Text style={styles.dialogPrompt}>
              Type <Text style={styles.dialogDeleteWord}>DELETE</Text> to
              confirm
            </Text>
            <TextInput
              style={styles.dialogInput}
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="Type DELETE"
              placeholderTextColor={lightColors.inputPlaceholder}
              autoCapitalize="characters"
            />
            <View style={styles.dialogActions}>
              <TouchableOpacity
                style={styles.dialogCancelBtn}
                onPress={() => {
                  setShowDeleteDialog(false);
                  setDeleteText('');
                }}
                activeOpacity={0.7}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.dialogConfirmBtn,
                  deleteText !== 'DELETE' && styles.dialogConfirmBtnDisabled,
                ]}
                onPress={confirmDelete}
                disabled={deleteText !== 'DELETE'}
                activeOpacity={0.7}>
                <Text
                  style={[
                    styles.dialogConfirmText,
                    deleteText !== 'DELETE' && styles.dialogConfirmTextDisabled,
                  ]}>
                  Delete Account
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 52,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  saveHeaderBtn: {
    backgroundColor: lightColors.primary,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    minWidth: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveHeaderBtnDisabled: {
    backgroundColor: lightColors.disabled,
  },
  saveHeaderBtnText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textOnPrimary,
  },
  saveHeaderBtnTextDisabled: {
    color: lightColors.textDisabled,
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  // Avatar
  avatarSection: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 32,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarInitials: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 38,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: lightColors.textOnPrimary,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: lightColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: lightColors.background,
  },
  changePhotoBtn: {
    borderWidth: 1.5,
    borderColor: lightColors.primary,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  changePhotoText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.primary,
  },

  // Form fields
  fieldContainer: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.card,
    borderWidth: 1.5,
    borderColor: lightColors.inputBorder,
    borderRadius: 14,
    height: 54,
    paddingHorizontal: 16,
  },
  inputWrapperFocused: {
    borderColor: lightColors.inputBorderFocused,
    ...shadows.sm,
  },
  inputWrapperDisabled: {
    backgroundColor: lightColors.inputBackground,
    borderColor: lightColors.borderLight,
  },
  inputWrapperError: {
    borderColor: lightColors.danger,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: lightColors.inputText,
    height: '100%',
  },
  inputDisabled: {
    color: lightColors.textTertiary,
  },
  phonePrefix: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
    marginRight: 8,
  },
  phoneDivider: {
    width: 1,
    height: 24,
    backgroundColor: lightColors.border,
    marginRight: 12,
  },
  verifiedInline: {
    marginLeft: 8,
  },
  errorText: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.danger,
    marginTop: 6,
    marginLeft: 4,
  },

  // Password section
  passwordSection: {
    backgroundColor: lightColors.card,
    borderRadius: 16,
    marginBottom: 24,
    ...shadows.sm,
    overflow: 'hidden',
  },
  passwordToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  passwordToggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  passwordToggleText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  passwordFields: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },

  // Strength indicator
  strengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
    marginTop: -8,
  },
  strengthBarBg: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
  },

  // Danger zone
  dangerZone: {
    marginTop: 8,
    marginBottom: 16,
  },
  dangerTitle: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.danger,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: lightColors.danger,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: lightColors.danger + '06',
  },
  deleteBtnText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.danger,
  },

  // Success toast
  successToast: {
    position: 'absolute',
    top: 100,
    left: 20,
    right: 20,
    backgroundColor: lightColors.card,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    ...shadows.lg,
    borderLeftWidth: 4,
    borderLeftColor: lightColors.success,
  },
  successToastText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },

  // Delete dialog
  dialogOverlay: {
    ...(StyleSheet.absoluteFill as object),
    backgroundColor: lightColors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    zIndex: 100,
  },
  dialogCard: {
    backgroundColor: lightColors.card,
    borderRadius: 20,
    padding: 28,
    width: '100%',
    alignItems: 'center',
    ...shadows.xl,
  },
  dialogIcon: {
    marginBottom: 12,
  },
  dialogTitle: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: lightColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  dialogPrompt: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textPrimary,
    marginBottom: 12,
  },
  dialogDeleteWord: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.danger,
  },
  dialogInput: {
    width: '100%',
    height: 48,
    borderWidth: 1.5,
    borderColor: lightColors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  dialogActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  dialogCancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: lightColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogCancelText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  dialogConfirmBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: lightColors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialogConfirmBtnDisabled: {
    backgroundColor: lightColors.disabled,
  },
  dialogConfirmText: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textOnPrimary,
  },
  dialogConfirmTextDisabled: {
    color: lightColors.textDisabled,
  },
});
