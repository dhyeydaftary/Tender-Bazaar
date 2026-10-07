import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  FadeInLeft,
  FadeIn,
  interpolate,
} from 'react-native-reanimated';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';
import { useSettingsStore } from '../../stores/settingsStore';
import { useHaptic } from '../../hooks/useHaptic';

// ─── Colors ────────────────────────────────────────────────────────────────

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const DANGER = '#EF4444';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';
const INFO = '#3B82F6';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ─── Types ─────────────────────────────────────────────────────────────────

interface ChannelItem {
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  locked?: boolean;
}

interface AlertTypeItem {
  key: string;
  label: string;
  subtitle: string;
  icon: string;
  iconColor: string;
  hasSubOption?: boolean;
}

// ─── Config Data ───────────────────────────────────────────────────────────

const CHANNELS: ChannelItem[] = [
  {
    key: 'push',
    label: 'Push Notifications',
    subtitle: 'Receive instant alerts on your device',
    icon: 'bell-outline',
    iconColor: PRIMARY,
  },
  {
    key: 'email',
    label: 'Email Notifications',
    subtitle: 'Get updates delivered to your inbox',
    icon: 'email-outline',
    iconColor: INFO,
  },
  {
    key: 'whatsapp',
    label: 'WhatsApp Notifications',
    subtitle: 'Receive alerts on WhatsApp',
    icon: 'whatsapp',
    iconColor: '#25D366',
    locked: true,
  },
  {
    key: 'sms',
    label: 'SMS Notifications',
    subtitle: 'Text message alerts for critical updates',
    icon: 'message-text-outline',
    iconColor: '#7C3AED',
    locked: true,
  },
];

const ALERT_TYPES: AlertTypeItem[] = [
  {
    key: 'new_tenders',
    label: 'New Tender Matches',
    subtitle: 'When a tender matches your saved alerts',
    icon: 'file-plus-outline',
    iconColor: ACCENT,
  },
  {
    key: 'deadlines',
    label: 'Deadline Reminders',
    subtitle: 'Reminders before bid submission deadlines',
    icon: 'clock-alert-outline',
    iconColor: DANGER,
    hasSubOption: true,
  },
  {
    key: 'corrigendum',
    label: 'Corrigendum Updates',
    subtitle: 'Changes to saved tender documents',
    icon: 'file-edit-outline',
    iconColor: WARNING,
  },
  {
    key: 'results',
    label: 'Result Announcements',
    subtitle: 'Tender award and result notifications',
    icon: 'trophy-outline',
    iconColor: '#F59E0B',
  },
  {
    key: 'subscription',
    label: 'Subscription Updates',
    subtitle: 'Plan renewals, usage alerts, billing',
    icon: 'credit-card-outline',
    iconColor: INFO,
  },
  {
    key: 'ai_reports',
    label: 'AI Eligibility Reports',
    subtitle: 'When an AI eligibility check is complete',
    icon: 'brain',
    iconColor: '#7C3AED',
  },
];

const REMINDER_OPTIONS = ['1 day', '3 days', '7 days'] as const;

// ─── Toggle Row Component ──────────────────────────────────────────────────

interface ToggleRowProps {
  icon: string;
  iconColor: string;
  label: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  locked?: boolean;
  disabled?: boolean;
}

const ToggleRow = React.memo<ToggleRowProps>(
  ({ icon, iconColor, label, subtitle, value, onToggle, locked, disabled }) => (
    <View style={[styles.toggleRow, disabled && styles.toggleRowDisabled]}>
      <View style={[styles.iconCircle, { backgroundColor: iconColor + '14' }]}>
        <Icon name={icon} size={22} color={disabled ? TEXT_TERTIARY : iconColor} />
      </View>
      <View style={styles.toggleInfo}>
        <View style={styles.toggleLabelRow}>
          <Text
            style={[styles.toggleLabel, disabled && styles.textDisabled]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {locked && (
            <View style={styles.lockBadge}>
              <Icon name="lock-outline" size={11} color={TEXT_TERTIARY} />
              <Text style={styles.lockText}>Upgrade</Text>
            </View>
          )}
        </View>
        <Text
          style={[styles.toggleSubtitle, disabled && styles.textDisabled]}
          numberOfLines={2}
        >
          {subtitle}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: BORDER, true: PRIMARY + '40' }}
        thumbColor={value ? PRIMARY : '#F4F3F4'}
        disabled={disabled || locked}
        style={styles.switchStyle}
      />
    </View>
  ),
);

// ─── Quiet Hours Section ───────────────────────────────────────────────────

interface QuietHoursSectionProps {
  dndEnabled: boolean;
  fromTime: string;
  toTime: string;
  exceptUrgent: boolean;
  onToggleDnd: () => void;
  onFromTimePress: () => void;
  onToTimePress: () => void;
  onToggleExceptUrgent: () => void;
}

const QuietHoursSection = React.memo<QuietHoursSectionProps>(
  ({
    dndEnabled,
    fromTime,
    toTime,
    exceptUrgent,
    onToggleDnd,
    onFromTimePress,
    onToTimePress,
    onToggleExceptUrgent,
  }) => {
    const expandHeight = useSharedValue(dndEnabled ? 1 : 0);

    useEffect(() => {
      expandHeight.value = withSpring(dndEnabled ? 1 : 0, {
        damping: 18,
        stiffness: 180,
      });
    }, [dndEnabled, expandHeight]);

    const expandStyle = useAnimatedStyle(() => ({
      maxHeight: interpolate(expandHeight.value, [0, 1], [0, 180]),
      opacity: expandHeight.value,
      overflow: 'hidden' as const,
    }));

    return (
      <View style={styles.card}>
        {/* DND Master Toggle */}
        <View style={styles.toggleRow}>
          <View
            style={[styles.iconCircle, { backgroundColor: SECONDARY + '14' }]}
          >
            <Icon name="moon-waning-crescent" size={22} color={SECONDARY} />
          </View>
          <View style={styles.toggleInfo}>
            <Text style={styles.toggleLabel}>Do Not Disturb</Text>
            <Text style={styles.toggleSubtitle}>
              Pause all notifications during set hours
            </Text>
          </View>
          <Switch
            value={dndEnabled}
            onValueChange={onToggleDnd}
            trackColor={{ false: BORDER, true: PRIMARY + '40' }}
            thumbColor={dndEnabled ? PRIMARY : '#F4F3F4'}
            style={styles.switchStyle}
          />
        </View>

        {/* Expanded time pickers */}
        <Animated.View style={expandStyle}>
          <View style={styles.dndContent}>
            <View style={styles.dndDivider} />

            {/* Time range */}
            <View style={styles.timeRow}>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>From</Text>
                <TouchableOpacity
                  style={styles.timePicker}
                  onPress={onFromTimePress}
                  activeOpacity={0.7}
                >
                  <Icon name="clock-outline" size={16} color={PRIMARY} />
                  <Text style={styles.timeValue}>{fromTime}</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.timeArrow}>
                <FeatherIcon name="arrow-right" size={18} color={TEXT_TERTIARY} />
              </View>
              <View style={styles.timeBlock}>
                <Text style={styles.timeLabel}>To</Text>
                <TouchableOpacity
                  style={styles.timePicker}
                  onPress={onToTimePress}
                  activeOpacity={0.7}
                >
                  <Icon name="clock-outline" size={16} color={PRIMARY} />
                  <Text style={styles.timeValue}>{toTime}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Except urgent checkbox */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={onToggleExceptUrgent}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.checkbox,
                  exceptUrgent && styles.checkboxChecked,
                ]}
              >
                {exceptUrgent && (
                  <Icon name="check" size={14} color="#FFFFFF" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>
                Except urgent deadlines ({'<'}24h)
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  },
);

// ─── Main Screen ───────────────────────────────────────────────────────────

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const haptic = useHaptic();
  const settingsStore = useSettingsStore();

  // ── Local State ────────────────────────────────────────────────────────

  const [channels, setChannels] = useState<Record<string, boolean>>({
    push: true,
    email: true,
    whatsapp: false,
    sms: false,
  });

  const [alertTypes, setAlertTypes] = useState<Record<string, boolean>>({
    new_tenders: true,
    deadlines: true,
    corrigendum: true,
    results: true,
    subscription: true,
    ai_reports: true,
  });

  const [reminderBefore, setReminderBefore] = useState<
    (typeof REMINDER_OPTIONS)[number]
  >('3 days');

  const [dndEnabled, setDndEnabled] = useState(false);
  const [fromTime, setFromTime] = useState('10:00 PM');
  const [toTime, setToTime] = useState('7:00 AM');
  const [exceptUrgent, setExceptUrgent] = useState(true);

  // ── Handlers ───────────────────────────────────────────────────────────

  const handleChannelToggle = useCallback(
    (key: string) => {
      haptic('light');
      setChannels((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [haptic],
  );

  const handleAlertTypeToggle = useCallback(
    (key: string) => {
      haptic('light');
      setAlertTypes((prev) => ({ ...prev, [key]: !prev[key] }));
    },
    [haptic],
  );

  const handleReminderChange = useCallback(() => {
    haptic('light');
    const currentIndex = REMINDER_OPTIONS.indexOf(reminderBefore);
    const nextIndex = (currentIndex + 1) % REMINDER_OPTIONS.length;
    setReminderBefore(REMINDER_OPTIONS[nextIndex]);
  }, [haptic, reminderBefore]);

  const handleDndToggle = useCallback(() => {
    haptic('medium');
    setDndEnabled((prev) => !prev);
  }, [haptic]);

  const handleFromTimePress = useCallback(() => {
    haptic('light');
    Alert.alert('Set Start Time', 'Time picker would open here', [
      { text: '9:00 PM', onPress: () => setFromTime('9:00 PM') },
      { text: '10:00 PM', onPress: () => setFromTime('10:00 PM') },
      { text: '11:00 PM', onPress: () => setFromTime('11:00 PM') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [haptic]);

  const handleToTimePress = useCallback(() => {
    haptic('light');
    Alert.alert('Set End Time', 'Time picker would open here', [
      { text: '6:00 AM', onPress: () => setToTime('6:00 AM') },
      { text: '7:00 AM', onPress: () => setToTime('7:00 AM') },
      { text: '8:00 AM', onPress: () => setToTime('8:00 AM') },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [haptic]);

  const handleExceptUrgentToggle = useCallback(() => {
    haptic('light');
    setExceptUrgent((prev) => !prev);
  }, [haptic]);

  const handleTestNotification = useCallback(() => {
    haptic('success');
    Alert.alert(
      'Test Notification Sent',
      'You should receive a test push notification shortly.',
    );
  }, [haptic]);

  const handleResetDefaults = useCallback(() => {
    haptic('warning');
    Alert.alert(
      'Reset to Defaults',
      'This will restore all notification settings to their default values. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            haptic('medium');
            setChannels({ push: true, email: true, whatsapp: false, sms: false });
            setAlertTypes({
              new_tenders: true,
              deadlines: true,
              corrigendum: true,
              results: true,
              subscription: true,
              ai_reports: true,
            });
            setReminderBefore('3 days');
            setDndEnabled(false);
            setExceptUrgent(true);
          },
        },
      ],
    );
  }, [haptic]);

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <FeatherIcon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
      >
        {/* Section 1: Channels */}
        <Animated.View entering={FadeInLeft.delay(100).duration(350)}>
          <Text style={styles.sectionTitle}>Channels</Text>
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(200).duration(350)}
          style={styles.card}
        >
          {CHANNELS.map((channel, index) => (
            <React.Fragment key={channel.key}>
              <ToggleRow
                icon={channel.icon}
                iconColor={channel.iconColor}
                label={channel.label}
                subtitle={channel.subtitle}
                value={channels[channel.key] ?? false}
                onToggle={() => handleChannelToggle(channel.key)}
                locked={channel.locked}
                disabled={channel.locked}
              />
              {index < CHANNELS.length - 1 && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Section 2: Alert Types */}
        <Animated.View entering={FadeInLeft.delay(250).duration(350)}>
          <Text style={styles.sectionTitle}>What to notify</Text>
        </Animated.View>
        <Animated.View
          entering={FadeIn.delay(350).duration(350)}
          style={styles.card}
        >
          {ALERT_TYPES.map((alertType, index) => (
            <React.Fragment key={alertType.key}>
              <View>
                <ToggleRow
                  icon={alertType.icon}
                  iconColor={alertType.iconColor}
                  label={alertType.label}
                  subtitle={alertType.subtitle}
                  value={alertTypes[alertType.key] ?? false}
                  onToggle={() => handleAlertTypeToggle(alertType.key)}
                />
                {/* Sub-option for deadline reminders */}
                {alertType.hasSubOption && alertTypes[alertType.key] && (
                  <View style={styles.subOptionRow}>
                    <Text style={styles.subOptionLabel}>Remind before:</Text>
                    <TouchableOpacity
                      style={styles.subOptionPicker}
                      onPress={handleReminderChange}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.subOptionValue}>
                        {reminderBefore}
                      </Text>
                      <FeatherIcon
                        name="chevron-down"
                        size={14}
                        color={PRIMARY}
                      />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {index < ALERT_TYPES.length - 1 && (
                <View style={styles.divider} />
              )}
            </React.Fragment>
          ))}
        </Animated.View>

        {/* Section 3: Quiet Hours */}
        <Animated.View entering={FadeInLeft.delay(400).duration(350)}>
          <Text style={styles.sectionTitle}>Quiet Hours</Text>
        </Animated.View>
        <Animated.View entering={FadeIn.delay(500).duration(350)}>
          <QuietHoursSection
            dndEnabled={dndEnabled}
            fromTime={fromTime}
            toTime={toTime}
            exceptUrgent={exceptUrgent}
            onToggleDnd={handleDndToggle}
            onFromTimePress={handleFromTimePress}
            onToTimePress={handleToTimePress}
            onToggleExceptUrgent={handleExceptUrgentToggle}
          />
        </Animated.View>

        {/* Footer Actions */}
        <View style={styles.footerActions}>
          <TouchableOpacity
            style={styles.testButton}
            onPress={handleTestNotification}
            activeOpacity={0.8}
          >
            <Icon name="bell-ring-outline" size={18} color={PRIMARY} />
            <Text style={styles.testButtonText}>Test Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resetLink}
            onPress={handleResetDefaults}
            activeOpacity={0.7}
          >
            <Text style={styles.resetLinkText}>Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        {/* Info Note */}
        <View style={styles.noteCard}>
          <Icon name="information-outline" size={18} color={INFO} />
          <Text style={styles.noteText}>
            WhatsApp and SMS notifications are available on Starter plans and
            above. Upgrade your plan to enable these channels.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: BACKGROUND,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerRight: {
    width: 40,
  },

  scrollContent: {
    padding: 20,
  },

  // Section
  sectionTitle: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: TEXT_SECONDARY,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 8,
  },

  // Card
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    ...shadows.sm,
  },

  // Toggle Row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  toggleRowDisabled: {
    opacity: 0.5,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleInfo: {
    flex: 1,
  },
  toggleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  toggleLabel: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  toggleSubtitle: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: TEXT_SECONDARY,
    lineHeight: 18,
  },
  textDisabled: {
    color: TEXT_TERTIARY,
  },
  switchStyle: {
    marginLeft: 4,
  },

  // Lock badge
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: BORDER + '80',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  lockText: {
    fontSize: 10,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_TERTIARY,
  },

  divider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 72,
  },

  // Sub-option (reminder dropdown)
  subOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 72,
    paddingBottom: 14,
    paddingTop: 2,
  },
  subOptionLabel: {
    fontSize: 13,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  subOptionPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: PRIMARY + '10',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  subOptionValue: {
    fontSize: 13,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Quiet Hours
  dndContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  dndDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginBottom: 16,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  timeBlock: {
    flex: 1,
  },
  timeLabel: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginBottom: 6,
  },
  timePicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  timeValue: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  timeArrow: {
    paddingHorizontal: 12,
    paddingTop: 18,
  },

  // Checkbox
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },

  // Footer
  footerActions: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    height: 52,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: PRIMARY,
    backgroundColor: CARD_BG,
  },
  testButtonText: {
    fontSize: 16,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
  },
  resetLink: {
    paddingVertical: 8,
  },
  resetLinkText: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    textDecorationLine: 'underline',
  },

  // Note
  noteCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: INFO + '0A',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    marginBottom: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    color: INFO,
    lineHeight: 19,
  },
});
