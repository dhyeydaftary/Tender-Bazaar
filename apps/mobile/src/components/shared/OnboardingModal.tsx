/**
 * TenderBazaar — OnboardingModal
 *
 * 3-step onboarding modal shown to new users after their first login.
 * Collects company info, capabilities, and initial alert preferences,
 * then persists a draft to MMKV for later sync to the API.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { spacing, borderRadius } from '../../theme/spacing';
import { CompanyType } from '../../types/user';
import { CATEGORIES, INDIAN_STATES } from '../../utils/constants';
import {
  getString,
  setString,
  setObject,
  StorageKeys,
} from '../../services/storage/mmkv';
import { useAuthStore } from '../../stores/authStore';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const BRAND = {
  primary: '#FF6B35',
  secondary: '#1B2845',
  accent: '#00D4AA',
} as const;

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: CompanyType.PVT_LTD, label: 'Pvt Ltd' },
  { value: CompanyType.LLP, label: 'LLP' },
  { value: CompanyType.PROPRIETORSHIP, label: 'Proprietorship' },
  { value: CompanyType.PARTNERSHIP, label: 'Partnership' },
  { value: CompanyType.SOCIETY, label: 'Society' },
  { value: CompanyType.TRUST, label: 'Trust' },
  { value: CompanyType.GOVERNMENT, label: 'Government' },
];

const WORK_CATEGORIES = [
  { value: 'construction', label: 'Construction', icon: 'office-building' },
  { value: 'it_software', label: 'IT & Software', icon: 'laptop' },
  { value: 'medical', label: 'Medical Equipment', icon: 'medical-bag' },
  { value: 'electrical', label: 'Electrical', icon: 'flash' },
  { value: 'supply', label: 'Supply', icon: 'truck-delivery' },
  { value: 'consultancy', label: 'Consultancy', icon: 'account-tie' },
] as const;

const TOP_STATES = INDIAN_STATES.slice(0, 8);

const FREQUENCIES = [
  { value: 'instant', label: 'Instant', desc: 'As they are published', icon: 'lightning-bolt' },
  { value: 'daily', label: 'Daily Digest', desc: 'Once every morning', icon: 'weather-sunny' },
  { value: 'weekly', label: 'Weekly Summary', desc: 'Every Monday', icon: 'calendar-week' },
] as const;

const SPRING_BOUNCE = { damping: 12, stiffness: 180 };
const SPRING_GENTLE = { damping: 20, stiffness: 120 };

const KEYWORD_SUGGESTIONS_MAP: Record<string, string[]> = {
  construction: ['road construction', 'building', 'civil works'],
  it_software: ['software development', 'IT services', 'cloud computing'],
  medical: ['medical equipment', 'hospital supplies', 'pharmaceuticals'],
  electrical: ['electrical works', 'power supply', 'wiring'],
  supply: ['material supply', 'goods procurement', 'stationery'],
  consultancy: ['consulting services', 'project management', 'advisory'],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingModalProps {
  visible: boolean;
  onDismiss: () => void;
}

interface OnboardingData {
  companyName: string;
  companyType: CompanyType | null;
  gstin: string;
  workCategories: string[];
  states: string[];
  isMSME: boolean;
  keywords: string[];
  customKeyword: string;
  frequency: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
}

// ---------------------------------------------------------------------------
// Animated wrappers
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Step Icon Component
// ---------------------------------------------------------------------------

interface StepIconProps {
  name: string;
  color: string;
  isActive: boolean;
}

const StepIcon: React.FC<StepIconProps> = React.memo(({ name, color, isActive }) => {
  const iconScale = useSharedValue(0.5);
  const iconOpacity = useSharedValue(0);

  useEffect(() => {
    if (isActive) {
      iconScale.value = 0.5;
      iconOpacity.value = 0;
      iconScale.value = withSpring(1, SPRING_BOUNCE);
      iconOpacity.value = withTiming(1, { duration: 300 });
    }
  }, [isActive, iconScale, iconOpacity]);

  const animatedIcon = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
    opacity: iconOpacity.value,
  }));

  return (
    <Animated.View style={[styles.stepIconWrapper, { backgroundColor: `${color}15` }, animatedIcon]}>
      <View style={[styles.stepIconCircle, { backgroundColor: color }]}>
        <Icon name={name} size={40} color="#FFFFFF" />
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

const OnboardingModal: React.FC<OnboardingModalProps> = ({ visible, onDismiss }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Step state
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllStates, setShowAllStates] = useState(false);

  // Form data
  const [data, setData] = useState<OnboardingData>({
    companyName: '',
    companyType: null,
    gstin: '',
    workCategories: [],
    states: [],
    isMSME: false,
    keywords: [],
    customKeyword: '',
    frequency: 'daily',
    pushEnabled: true,
    emailEnabled: false,
  });

  // Animation shared values
  const modalTranslateY = useSharedValue(SCREEN_HEIGHT);
  const modalOpacity = useSharedValue(0);
  const contentTranslateX = useSharedValue(0);
  const dotScales = [useSharedValue(1), useSharedValue(1), useSharedValue(1)];
  const buttonPulse = useSharedValue(1);

  // Entrance / exit animation
  useEffect(() => {
    if (visible) {
      modalOpacity.value = withTiming(1, { duration: 200 });
      modalTranslateY.value = withSpring(0, SPRING_GENTLE);
    } else {
      modalOpacity.value = withTiming(0, { duration: 300 });
      modalTranslateY.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
    }
  }, [visible, modalOpacity, modalTranslateY]);

  // Dot bounce on step change
  useEffect(() => {
    dotScales.forEach((dot, i) => {
      dot.value = i === currentStep
        ? withSequence(withSpring(1.4, SPRING_BOUNCE), withSpring(1, SPRING_BOUNCE))
        : withSpring(1, SPRING_GENTLE);
    });
  }, [currentStep]);

  // Pulse button on last step
  useEffect(() => {
    if (currentStep === 2) {
      buttonPulse.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        true,
      );
    } else {
      buttonPulse.value = withTiming(1, { duration: 200 });
    }
  }, [currentStep, buttonPulse]);

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: modalTranslateY.value }],
    opacity: modalOpacity.value,
  }));

  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTranslateX.value }],
  }));

  const dot0Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScales[0].value }],
  }));
  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScales[1].value }],
  }));
  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dotScales[2].value }],
  }));
  const dotStyles = [dot0Style, dot1Style, dot2Style];

  const buttonPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPulse.value }],
  }));

  // Keyword suggestions based on selected categories
  const suggestedKeywords = useMemo(() => {
    const kws: string[] = [];
    data.workCategories.forEach((cat) => {
      const suggestions = KEYWORD_SUGGESTIONS_MAP[cat];
      if (suggestions) {
        kws.push(...suggestions.slice(0, 1));
      }
    });
    return kws.length > 0 ? kws.slice(0, 3) : ['construction', 'IT services', 'supply'];
  }, [data.workCategories]);

  // Handlers
  const handleDismiss = useCallback(() => {
    setString('onboarding.completed', 'true');
    onDismiss();
  }, [onDismiss]);

  const goToStep = useCallback(
    (step: number) => {
      const direction = step > currentStep ? -1 : 1;
      contentTranslateX.value = withTiming(direction * SCREEN_WIDTH, { duration: 150 }, () => {
        contentTranslateX.value = -direction * SCREEN_WIDTH;
        runOnJS(setCurrentStep)(step);
        contentTranslateX.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
      });
    },
    [currentStep, contentTranslateX],
  );

  const handleNext = useCallback(() => {
    if (currentStep < 2) {
      goToStep(currentStep + 1);
    } else {
      // Final step — save and dismiss
      const draft = {
        companyName: data.companyName,
        companyType: data.companyType,
        gstin: data.gstin,
        workCategories: data.workCategories,
        states: data.states,
        isMSME: data.isMSME,
        alertKeywords: [...data.keywords, ...(data.customKeyword ? [data.customKeyword] : [])],
        alertFrequency: data.frequency,
        pushEnabled: data.pushEnabled,
        emailEnabled: data.emailEnabled,
      };
      setObject('onboarding.draft', draft);
      setString('onboarding.completed', 'true');
      onDismiss();
    }
  }, [currentStep, data, goToStep, onDismiss]);

  const toggleCategory = useCallback((value: string) => {
    setData((prev) => ({
      ...prev,
      workCategories: prev.workCategories.includes(value)
        ? prev.workCategories.filter((c) => c !== value)
        : [...prev.workCategories, value],
    }));
  }, []);

  const toggleState = useCallback((state: string) => {
    setData((prev) => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter((s) => s !== state)
        : [...prev.states, state],
    }));
  }, []);

  const toggleKeyword = useCallback((keyword: string) => {
    setData((prev) => ({
      ...prev,
      keywords: prev.keywords.includes(keyword)
        ? prev.keywords.filter((k) => k !== keyword)
        : [...prev.keywords, keyword],
    }));
  }, []);

  // ---- Step 1: Company Info ----
  const renderStep1 = useCallback(() => (
    <View style={styles.stepContent}>
      <StepIcon name="domain" color={BRAND.primary} isActive={currentStep === 0} />
      <Text style={styles.stepTitle}>Tell us about your company</Text>
      <Text style={styles.stepSubtitle}>This helps us find the right tenders for you</Text>

      {/* Company Name */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Company Name *</Text>
        <TextInput
          style={styles.textInput}
          value={data.companyName}
          onChangeText={(text) => setData((prev) => ({ ...prev, companyName: text }))}
          placeholder="Enter your company name"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="words"
        />
      </View>

      {/* Company Type */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Company Type</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {COMPANY_TYPES.map((type) => {
            const isSelected = data.companyType === type.value;
            return (
              <Pressable
                key={type.value}
                onPress={() => setData((prev) => ({ ...prev, companyType: type.value }))}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {type.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* GSTIN */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>GSTIN (optional)</Text>
        <TextInput
          style={styles.textInput}
          value={data.gstin}
          onChangeText={(text) => setData((prev) => ({ ...prev, gstin: text.toUpperCase() }))}
          placeholder="e.g. 22AAAAA0000A1Z5"
          placeholderTextColor="#9CA3AF"
          autoCapitalize="characters"
          maxLength={15}
        />
      </View>

      <Pressable onPress={() => goToStep(1)}>
        <Text style={styles.skipLink}>I'll do this later</Text>
      </Pressable>
    </View>
  ), [currentStep, data.companyName, data.companyType, data.gstin, goToStep]);

  // ---- Step 2: Capabilities ----
  const renderStep2 = useCallback(() => {
    const visibleStates = showAllStates ? INDIAN_STATES : TOP_STATES;

    return (
      <View style={styles.stepContent}>
        <StepIcon name="crosshairs-gps" color={BRAND.accent} isActive={currentStep === 1} />
        <Text style={styles.stepTitle}>What do you work on?</Text>
        <Text style={styles.stepSubtitle}>Select your areas of expertise</Text>

        {/* Work Categories — 2-column grid */}
        <View style={styles.fieldGroup}>
          <View style={styles.categoryGrid}>
            {WORK_CATEGORIES.map((cat) => {
              const isSelected = data.workCategories.includes(cat.value);
              return (
                <Pressable
                  key={cat.value}
                  onPress={() => toggleCategory(cat.value)}
                  style={[styles.categoryChip, isSelected && styles.categoryChipSelected]}
                >
                  <Icon
                    name={cat.icon}
                    size={20}
                    color={isSelected ? '#FFFFFF' : BRAND.secondary}
                  />
                  <Text
                    style={[
                      styles.categoryChipText,
                      isSelected && styles.categoryChipTextSelected,
                    ]}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* States */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Where do you operate?</Text>
          <View style={styles.stateChipWrap}>
            {visibleStates.map((state) => {
              const isSelected = data.states.includes(state);
              return (
                <Pressable
                  key={state}
                  onPress={() => toggleState(state)}
                  style={[styles.stateChip, isSelected && styles.stateChipSelected]}
                >
                  <Text
                    style={[
                      styles.stateChipText,
                      isSelected && styles.stateChipTextSelected,
                    ]}
                  >
                    {state}
                  </Text>
                </Pressable>
              );
            })}
            {!showAllStates && (
              <Pressable
                onPress={() => setShowAllStates(true)}
                style={[styles.stateChip, styles.moreChip]}
              >
                <Text style={[styles.stateChipText, styles.moreChipText]}>
                  +{INDIAN_STATES.length - TOP_STATES.length} More
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* MSME Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelWrap}>
            <Icon name="certificate" size={20} color={BRAND.secondary} />
            <Text style={styles.toggleLabel}>Are you MSME registered?</Text>
          </View>
          <Switch
            value={data.isMSME}
            onValueChange={(val) => setData((prev) => ({ ...prev, isMSME: val }))}
            trackColor={{ false: '#E5E7EB', true: `${BRAND.accent}80` }}
            thumbColor={data.isMSME ? BRAND.accent : '#FFFFFF'}
          />
        </View>
      </View>
    );
  }, [currentStep, data.workCategories, data.states, data.isMSME, showAllStates, toggleCategory, toggleState]);

  // ---- Step 3: Alert Setup ----
  const renderStep3 = useCallback(() => (
    <View style={styles.stepContent}>
      <StepIcon name="bell-ring-outline" color="#3B82F6" isActive={currentStep === 2} />
      <Text style={styles.stepTitle}>Never miss a tender</Text>
      <Text style={styles.stepSubtitle}>Get notified when matching tenders are published</Text>

      {/* Keywords */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Keywords</Text>
        <View style={styles.stateChipWrap}>
          {suggestedKeywords.map((kw) => {
            const isSelected = data.keywords.includes(kw);
            return (
              <Pressable
                key={kw}
                onPress={() => toggleKeyword(kw)}
                style={[styles.chip, isSelected && styles.chipSelected]}
              >
                <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                  {kw}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={[styles.textInput, { marginTop: spacing.sm }]}
          value={data.customKeyword}
          onChangeText={(text) => setData((prev) => ({ ...prev, customKeyword: text }))}
          placeholder="Add custom keyword..."
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Frequency */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Notification Frequency</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((freq) => {
            const isSelected = data.frequency === freq.value;
            return (
              <Pressable
                key={freq.value}
                onPress={() => setData((prev) => ({ ...prev, frequency: freq.value }))}
                style={[styles.frequencyCard, isSelected && styles.frequencyCardSelected]}
              >
                <Icon
                  name={freq.icon}
                  size={22}
                  color={isSelected ? BRAND.primary : '#6B7280'}
                />
                <Text
                  style={[
                    styles.frequencyLabel,
                    isSelected && styles.frequencyLabelSelected,
                  ]}
                >
                  {freq.label}
                </Text>
                <Text style={styles.frequencyDesc}>{freq.desc}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Channel toggles */}
      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Channels</Text>
        <View style={styles.toggleRow}>
          <View style={styles.toggleLabelWrap}>
            <Icon name="bell-outline" size={18} color={BRAND.secondary} />
            <Text style={styles.toggleLabel}>Push Notifications</Text>
          </View>
          <Switch
            value={data.pushEnabled}
            onValueChange={(val) => setData((prev) => ({ ...prev, pushEnabled: val }))}
            trackColor={{ false: '#E5E7EB', true: `${BRAND.primary}80` }}
            thumbColor={data.pushEnabled ? BRAND.primary : '#FFFFFF'}
          />
        </View>
        <View style={[styles.toggleRow, { marginTop: spacing.sm }]}>
          <View style={styles.toggleLabelWrap}>
            <Icon name="email-outline" size={18} color={BRAND.secondary} />
            <Text style={styles.toggleLabel}>Email</Text>
          </View>
          <Switch
            value={data.emailEnabled}
            onValueChange={(val) => setData((prev) => ({ ...prev, emailEnabled: val }))}
            trackColor={{ false: '#E5E7EB', true: `${BRAND.primary}80` }}
            thumbColor={data.emailEnabled ? BRAND.primary : '#FFFFFF'}
          />
        </View>
      </View>

      <Pressable onPress={handleDismiss}>
        <Text style={styles.skipLink}>I'll set this up later</Text>
      </Pressable>
    </View>
  ), [currentStep, data.keywords, data.customKeyword, data.frequency, data.pushEnabled, data.emailEnabled, suggestedKeywords, toggleKeyword, handleDismiss]);

  // Render step content
  const renderCurrentStep = useCallback(() => {
    switch (currentStep) {
      case 0:
        return renderStep1();
      case 1:
        return renderStep2();
      case 2:
        return renderStep3();
      default:
        return null;
    }
  }, [currentStep, renderStep1, renderStep2, renderStep3]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View style={[styles.modalContainer, modalAnimatedStyle]}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.flex}
          >
            {/* Header: close button */}
            <View style={styles.header}>
              <View style={styles.headerSpacer} />
              <Pressable onPress={handleDismiss} style={styles.closeButton} hitSlop={12}>
                <Icon name="close" size={22} color="#6B7280" />
              </Pressable>
            </View>

            {/* Step dots */}
            <View style={styles.dotsRow}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[
                    styles.dot,
                    i === currentStep ? styles.dotActive : styles.dotInactive,
                    dotStyles[i],
                  ]}
                />
              ))}
            </View>

            {/* Animated content */}
            <ScrollView
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={contentAnimatedStyle}>
                {renderCurrentStep()}
              </Animated.View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable onPress={handleDismiss}>
                <Text style={styles.skipForNow}>Skip for now</Text>
              </Pressable>

              <View style={styles.footerButtons}>
                {currentStep > 0 && (
                  <Pressable
                    onPress={() => goToStep(currentStep - 1)}
                    style={styles.backButton}
                  >
                    <Icon name="chevron-left" size={20} color={BRAND.secondary} />
                    <Text style={styles.backButtonText}>Back</Text>
                  </Pressable>
                )}

                <AnimatedPressable
                  onPress={handleNext}
                  style={[
                    styles.nextButton,
                    currentStep === 2 && styles.getStartedButton,
                    currentStep === 2 ? buttonPulseStyle : undefined,
                  ]}
                >
                  <Text style={styles.nextButtonText}>
                    {currentStep === 2 ? 'Get Started' : 'Next'}
                  </Text>
                  {currentStep < 2 && (
                    <Icon name="chevron-right" size={20} color="#FFFFFF" />
                  )}
                </AnimatedPressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: borderRadius.lg,
    borderTopRightRadius: borderRadius.lg,
    marginTop: Platform.OS === 'ios' ? 50 : 24,
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.base,
    paddingBottom: spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: BRAND.primary,
    width: 24,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: '#E5E7EB',
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  // Step content
  stepContent: {
    alignItems: 'center',
  },
  stepIconWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  stepIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
    color: '#1B2845',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },

  // Fields
  fieldGroup: {
    width: '100%',
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: '#1B2845',
    marginBottom: spacing.sm,
  },
  textInput: {
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    fontWeight: '400',
    color: '#0F1117',
    backgroundColor: '#F7F8FA',
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: Platform.OS === 'ios' ? spacing.md : spacing.sm,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    backgroundColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  chipText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    width: (SCREEN_WIDTH - spacing.lg * 2 - spacing.sm) / 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    backgroundColor: '#F7F8FA',
  },
  categoryChipSelected: {
    backgroundColor: BRAND.primary,
    borderColor: BRAND.primary,
  },
  categoryChipText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: BRAND.secondary,
    flex: 1,
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },

  // State chips
  stateChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  stateChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    backgroundColor: 'transparent',
  },
  stateChipSelected: {
    backgroundColor: BRAND.accent,
    borderColor: BRAND.accent,
  },
  stateChipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  stateChipTextSelected: {
    color: '#FFFFFF',
  },
  moreChip: {
    borderColor: BRAND.primary,
    borderStyle: 'dashed',
  },
  moreChipText: {
    color: BRAND.primary,
  },

  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: spacing.sm,
  },
  toggleLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toggleLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: BRAND.secondary,
  },

  // Frequency cards
  frequencyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  frequencyCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: '#E8ECF1',
    backgroundColor: '#F7F8FA',
  },
  frequencyCardSelected: {
    borderColor: BRAND.primary,
    backgroundColor: `${BRAND.primary}08`,
  },
  frequencyLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  frequencyLabelSelected: {
    color: BRAND.primary,
  },
  frequencyDesc: {
    fontFamily: fontFamilies.regular,
    fontSize: 10,
    fontWeight: '400',
    color: '#9CA3AF',
    marginTop: 2,
    textAlign: 'center',
  },

  // Skip link
  skipLink: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
    textDecorationLine: 'underline',
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E8ECF1',
    backgroundColor: '#FFFFFF',
  },
  skipForNow: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: '#9CA3AF',
  },
  footerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  backButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: BRAND.secondary,
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: BRAND.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
    ...shadows.sm,
  },
  getStartedButton: {
    backgroundColor: BRAND.accent,
    paddingHorizontal: spacing.xl,
  },
  nextButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default React.memo(OnboardingModal);
