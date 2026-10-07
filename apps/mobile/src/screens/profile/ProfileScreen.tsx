import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Alert,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  SlideInRight,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { useAuthStore } from '../../stores/authStore';
import { getBoolean, setBoolean } from '../../services/storage/mmkv';
import { lightColors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import type { RootStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NavProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItem {
  icon: string;
  label: string;
  route?: keyof RootStackParamList;
  iconBg?: string;
  iconColor?: string;
  badge?: string;
  isDanger?: boolean;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DISMISSAL_KEY = 'profile.completionBannerDismissed';

const HAPTIC_OPTIONS = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Animated menu-item wrapper
// ---------------------------------------------------------------------------

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

const MenuItemRow = React.memo(function MenuItemRow({
  item,
  onPress,
}: {
  item: MenuItem;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  }, [scale]);

  const handlePress = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', HAPTIC_OPTIONS);
    onPress();
  }, [onPress]);

  return (
    <AnimatedTouchable
      style={[styles.menuItem, animatedStyle]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}>
      <View style={styles.menuItemLeft}>
        <View
          style={[
            styles.menuIconCircle,
            {
              backgroundColor: item.isDanger
                ? lightColors.danger + '10'
                : (item.iconBg ?? lightColors.primary + '10'),
            },
          ]}>
          <Icon
            name={item.icon}
            size={20}
            color={
              item.isDanger
                ? lightColors.danger
                : (item.iconColor ?? lightColors.primary)
            }
          />
        </View>
        <Text
          style={[
            styles.menuItemLabel,
            item.isDanger && { color: lightColors.danger },
          ]}>
          {item.label}
        </Text>
      </View>
      <View style={styles.menuItemRight}>
        {item.badge && (
          <View style={styles.menuBadge}>
            <Text style={styles.menuBadgeText}>{item.badge}</Text>
          </View>
        )}
        <Icon
          name="chevron-right"
          size={20}
          color={lightColors.textTertiary}
        />
      </View>
    </AnimatedTouchable>
  );
});

// ---------------------------------------------------------------------------
// Quick-stat card
// ---------------------------------------------------------------------------

const QuickStatCard = React.memo(function QuickStatCard({
  icon,
  count,
  label,
  color,
}: {
  icon: string;
  count: number;
  label: string;
  color: string;
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: color + '0A' }]}>
      <Icon name={icon} size={22} color={color} />
      <Text style={[styles.statCount, { color }]}>{count}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
});

// ---------------------------------------------------------------------------
// ProfileScreen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [bannerDismissed, setBannerDismissed] = useState(() => {
    return getBoolean(DISMISSAL_KEY) ?? false;
  });

  // --- Profile completion ---
  const completionPercentage = useMemo(() => {
    if (!user) return 0;
    let score = 0;
    if (user.name) score += 20;
    if (user.email) score += 20;
    if (user.phone) score += 20;
    if (user.avatarUrl) score += 20;
    // Company profile counts as final 20% — assume incomplete for now
    return score;
  }, [user]);

  const showBanner = completionPercentage < 100 && !bannerDismissed;

  // --- Animations ---
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    progressWidth.value = withSpring(completionPercentage, {
      damping: 18,
      stiffness: 90,
    });
  }, [completionPercentage, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // --- Initials ---
  const initials = useMemo(() => {
    if (!user?.name) return 'U';
    const parts = user.name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }, [user?.name]);

  // --- Member since ---
  const memberSince = useMemo(() => {
    if (!user?.createdAt) return '';
    const date = new Date(user.createdAt);
    return `Joined ${date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}`;
  }, [user?.createdAt]);

  // --- Menu sections ---
  const menuSections: MenuSection[] = useMemo(
    () => [
      {
        title: 'Account',
        items: [
          {
            icon: 'account-edit-outline',
            label: 'Edit Profile',
            route: 'EditProfile',
            iconBg: lightColors.info + '10',
            iconColor: lightColors.info,
          },
          {
            icon: 'domain',
            label: 'Company Profile',
            route: 'CompanyProfile',
            iconBg: lightColors.accent + '10',
            iconColor: lightColors.accent,
            badge: completionPercentage < 100 ? 'Incomplete' : undefined,
          },
          {
            icon: 'file-document-multiple-outline',
            label: 'Documents',
            route: 'Documents',
            iconBg: '#7C3AED10',
            iconColor: '#7C3AED',
          },
        ],
      },
      {
        title: 'Subscription',
        items: [
          {
            icon: 'crown-outline',
            label: 'Current Plan',
            route: 'Subscription',
            iconBg: lightColors.warning + '10',
            iconColor: lightColors.warning,
          },
          {
            icon: 'rocket-launch-outline',
            label: 'Upgrade Plans',
            route: 'Plans',
            iconBg: lightColors.primary + '10',
            iconColor: lightColors.primary,
          },
        ],
      },
      {
        title: 'Preferences',
        items: [
          {
            icon: 'bell-cog-outline',
            label: 'Notification Settings',
            route: 'NotificationSettings',
            iconBg: lightColors.info + '10',
            iconColor: lightColors.info,
          },
          {
            icon: 'theme-light-dark',
            label: 'Appearance',
            iconBg: lightColors.secondary + '10',
            iconColor: lightColors.secondary,
          },
        ],
      },
      {
        title: 'Support',
        items: [
          {
            icon: 'help-circle-outline',
            label: 'Help & Support',
            iconBg: lightColors.success + '10',
            iconColor: lightColors.success,
          },
          {
            icon: 'file-document-outline',
            label: 'Terms of Service',
            iconBg: lightColors.textSecondary + '10',
            iconColor: lightColors.textSecondary,
          },
          {
            icon: 'shield-check-outline',
            label: 'Privacy Policy',
            iconBg: lightColors.textSecondary + '10',
            iconColor: lightColors.textSecondary,
          },
          {
            icon: 'information-outline',
            label: 'About TenderBazaar',
            iconBg: lightColors.textSecondary + '10',
            iconColor: lightColors.textSecondary,
          },
        ],
      },
    ],
    [completionPercentage],
  );

  // --- Handlers ---
  const handleLogout = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium', HAPTIC_OPTIONS);
    Alert.alert(
      'Logout',
      'Are you sure you want to logout of your account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: () => logout(),
        },
      ],
    );
  }, [logout]);

  const handleDismissBanner = useCallback(() => {
    setBannerDismissed(true);
    setBoolean(DISMISSAL_KEY, true);
  }, []);

  const handleMenuPress = useCallback(
    (item: MenuItem) => {
      if (item.route) {
        navigation.navigate(item.route as any);
      }
    },
    [navigation],
  );

  // --- Mock stats ---
  const stats = useMemo(
    () => ({
      saved: 23,
      aiChecks: 5,
      activeAlerts: 3,
    }),
    [],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={lightColors.background}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerPlaceholder} />
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity style={styles.headerIconBtn} activeOpacity={0.7}>
          <Icon name="cog-outline" size={24} color={lightColors.textPrimary} />
        </TouchableOpacity>
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}>
        {/* ── Hero / User Info Card ── */}
        <Animated.View
          entering={FadeIn.duration(400)}
          style={styles.heroCard}>
          <View style={styles.avatarContainer}>
            {user?.avatarUrl ? (
              <Image
                source={{ uri: user.avatarUrl }}
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatarInitials}>
                <Text style={styles.avatarInitialsText}>{initials}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.cameraOverlay} activeOpacity={0.7}>
              <Icon name="camera" size={14} color={lightColors.textOnPrimary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userEmail}>{user?.email || 'user@email.com'}</Text>

          {user?.phone && (
            <View style={styles.phoneRow}>
              <Text style={styles.phoneText}>+91 {user.phone}</Text>
              {user.isPhoneVerified && (
                <View style={styles.verifiedBadge}>
                  <Icon
                    name="check-decagram"
                    size={16}
                    color={lightColors.success}
                  />
                </View>
              )}
            </View>
          )}

          <View style={styles.planPill}>
            <Icon name="crown" size={14} color={lightColors.primary} />
            <Text style={styles.planPillText}>Free Plan</Text>
          </View>

          {memberSince !== '' && (
            <Text style={styles.memberSince}>{memberSince}</Text>
          )}
        </Animated.View>

        {/* ── Profile Completion Banner ── */}
        {showBanner && (
          <Animated.View
            entering={SlideInRight.springify().damping(18).stiffness(120)}
            style={styles.completionBanner}>
            <TouchableOpacity
              style={styles.dismissBtn}
              onPress={handleDismissBanner}
              hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <Icon name="close" size={16} color={lightColors.textTertiary} />
            </TouchableOpacity>

            <View style={styles.completionHeader}>
              <Text style={styles.completionTitle}>Profile Completion</Text>
              <Text style={styles.completionPercent}>
                {completionPercentage}%
              </Text>
            </View>

            <View style={styles.completionBarBg}>
              <Animated.View style={[styles.completionBarFill, progressStyle]} />
            </View>

            <Text style={styles.completionHint}>
              Complete your profile to get accurate AI eligibility scores
            </Text>

            <TouchableOpacity
              style={styles.completeNowBtn}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('CompanyProfile' as any)}>
              <Text style={styles.completeNowText}>Complete Now</Text>
              <Icon
                name="arrow-right"
                size={16}
                color={lightColors.primary}
              />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* ── Quick Stats Row ── */}
        <Animated.View
          entering={FadeIn.delay(150).duration(400)}
          style={styles.statsRow}>
          <QuickStatCard
            icon="bookmark-outline"
            count={stats.saved}
            label="Saved Tenders"
            color={lightColors.primary}
          />
          <QuickStatCard
            icon="brain"
            count={stats.aiChecks}
            label="AI Checks"
            color={lightColors.accent}
          />
          <QuickStatCard
            icon="bell-ring-outline"
            count={stats.activeAlerts}
            label="Active Alerts"
            color={lightColors.info}
          />
        </Animated.View>

        {/* ── Menu Sections ── */}
        {menuSections.map((section, sectionIdx) => (
          <Animated.View
            key={section.title}
            entering={FadeIn.delay(200 + sectionIdx * 80).duration(350)}
            style={styles.menuSection}>
            <Text style={styles.menuSectionTitle}>{section.title}</Text>
            <View style={styles.menuCard}>
              {section.items.map((item, index) => (
                <React.Fragment key={item.label}>
                  <MenuItemRow
                    item={item}
                    onPress={() => handleMenuPress(item)}
                  />
                  {index < section.items.length - 1 && (
                    <View style={styles.menuDivider} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </Animated.View>
        ))}

        {/* ── Logout ── */}
        <Animated.View
          entering={FadeIn.delay(600).duration(350)}
          style={styles.logoutSection}>
          <View style={styles.menuCard}>
            <MenuItemRow
              item={{
                icon: 'logout',
                label: 'Logout',
                isDanger: true,
              }}
              onPress={handleLogout}
            />
          </View>
        </Animated.View>

        <Text style={styles.version}>TenderBazaar v1.0.0</Text>
      </Animated.ScrollView>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    height: 52,
  },
  headerPlaceholder: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },

  scrollContent: {
    paddingHorizontal: 20,
  },

  // Hero card
  heroCard: {
    alignItems: 'center',
    backgroundColor: lightColors.card,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    ...shadows.md,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarInitials: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: lightColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitialsText: {
    fontSize: 30,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: lightColors.textOnPrimary,
  },
  cameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: lightColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: lightColors.card,
  },
  userName: {
    fontSize: 22,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.textPrimary,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: lightColors.textSecondary,
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  phoneText: {
    fontSize: 14,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textSecondary,
  },
  verifiedBadge: {
    marginLeft: 2,
  },
  planPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: lightColors.primary + '14',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  planPillText: {
    fontSize: 13,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.primary,
  },
  memberSince: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textTertiary,
    marginTop: 10,
  },

  // Completion banner
  completionBanner: {
    backgroundColor: lightColors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    ...shadows.sm,
  },
  dismissBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 1,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingRight: 20,
  },
  completionTitle: {
    fontSize: 15,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.textPrimary,
  },
  completionPercent: {
    fontSize: 15,
    fontFamily: fontFamilies.extraBold,
    fontWeight: '800',
    color: lightColors.primary,
  },
  completionBarBg: {
    height: 8,
    backgroundColor: lightColors.border,
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  completionBarFill: {
    height: 8,
    backgroundColor: lightColors.primary,
    borderRadius: 4,
  },
  completionHint: {
    fontSize: 13,
    fontFamily: fontFamilies.regular,
    fontWeight: '400',
    color: lightColors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  completeNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  completeNowText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: lightColors.primary,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 6,
  },
  statCount: {
    fontSize: 20,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 11,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textSecondary,
    textAlign: 'center',
  },

  // Menu
  menuSection: {
    marginBottom: 20,
  },
  menuSectionTitle: {
    fontSize: 12,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: lightColors.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...shadows.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemLabel: {
    fontSize: 15,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textPrimary,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  menuBadgeText: {
    fontSize: 11,
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: lightColors.warningDark,
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: lightColors.border,
    marginLeft: 70,
  },

  // Logout section
  logoutSection: {
    marginBottom: 16,
  },

  version: {
    fontSize: 12,
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: lightColors.textTertiary,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
});
