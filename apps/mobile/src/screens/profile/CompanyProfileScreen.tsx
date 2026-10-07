import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Platform,
  Dimensions,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { updateCompanyProfile } from '../../services/api/profile';
import { INDIAN_STATES } from '../../utils/constants';
import { CompanyType, MSMECategory } from '../../types/user';
import type { CompanyProfile } from '../../types/user';
import { getObject, setObject } from '../../services/storage/mmkv';

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY = '#FF6B35';
const PRIMARY_LIGHT = '#FFF0E9';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const ACCENT_DARK = '#00B892';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_TERTIARY = '#9CA3AF';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const BORDER = '#E8ECF1';
const BORDER_LIGHT = '#F0F2F5';
const AMBER = '#F59E0B';
const AMBER_LIGHT = '#FEF3C7';
const ERROR = '#EF4444';
const ERROR_LIGHT = '#FEE2E2';

const DRAFT_STORAGE_KEY = 'company_profile_draft';

const STEP_LABELS = [
  'Basic Info',
  'Financial',
  'Registrations',
  'Capabilities',
  'Review',
] as const;

const TOTAL_STEPS = STEP_LABELS.length;

const COMPANY_TYPE_OPTIONS: { value: CompanyType; label: string }[] = [
  { value: CompanyType.PVT_LTD, label: 'Pvt Ltd' },
  { value: CompanyType.LLP, label: 'LLP' },
  { value: CompanyType.PROPRIETORSHIP, label: 'Proprietorship' },
  { value: CompanyType.PARTNERSHIP, label: 'Partnership' },
  { value: CompanyType.SOCIETY, label: 'Society' },
  { value: CompanyType.TRUST, label: 'Trust' },
  { value: CompanyType.GOVERNMENT, label: 'Government' },
];

const MSME_CATEGORY_OPTIONS: { value: MSMECategory; label: string }[] = [
  { value: MSMECategory.MICRO, label: 'Micro' },
  { value: MSMECategory.SMALL, label: 'Small' },
  { value: MSMECategory.MEDIUM, label: 'Medium' },
];

const ISO_CERTIFICATES = [
  'ISO 9001', 'ISO 14001', 'ISO 27001',
  'ISO 45001', 'ISO 22000', 'ISO 50001',
] as const;

const WORK_CATEGORIES = [
  'Construction', 'IT & Software', 'Medical Equipment', 'Electrical',
  'Mechanical', 'Stationery & Office', 'Vehicles & Transport', 'Consultancy',
  'Catering & Hospitality', 'Agriculture', 'Environmental', 'Textiles',
] as const;

const EMPLOYEE_PRESETS = [
  { label: '1-10', min: 1, max: 10 },
  { label: '11-50', min: 11, max: 50 },
  { label: '51-200', min: 51, max: 200 },
  { label: '201-500', min: 201, max: 500 },
  { label: '500+', min: 501, max: 999 },
] as const;

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  companyName: string;
  gstin: string;
  pan: string;
  companyType: CompanyType | null;
  registrationNumber: string;
  incorporationDate: string;
  annualTurnover: string;
  turnoverUnit: 'Lakh' | 'Cr';
  netWorth: string;
  employeeCount: number;
  yearsInBusiness: string;
  msmeRegistered: boolean;
  msmeNumber: string;
  msmeCategory: MSMECategory | null;
  gemRegistered: boolean;
  startupDpiit: boolean;
  epfRegistered: boolean;
  gstRegistered: boolean;
  isoRegistered: boolean;
  isoCertificates: string[];
  workCategories: string[];
  specializations: string[];
  specializationInput: string;
  statesOperated: string[];
  stateSearch: string;
  maxProjectCapacity: string;
}

const INITIAL_FORM: FormState = {
  companyName: '',
  gstin: '',
  pan: '',
  companyType: null,
  registrationNumber: '',
  incorporationDate: '',
  annualTurnover: '',
  turnoverUnit: 'Lakh',
  netWorth: '',
  employeeCount: 0,
  yearsInBusiness: '',
  msmeRegistered: false,
  msmeNumber: '',
  msmeCategory: null,
  gemRegistered: false,
  startupDpiit: false,
  epfRegistered: false,
  gstRegistered: false,
  isoRegistered: false,
  isoCertificates: [],
  workCategories: [],
  specializations: [],
  specializationInput: '',
  statesOperated: [],
  stateSearch: '',
  maxProjectCapacity: '',
};

// ─── Validation ───────────────────────────────────────────────────────────────

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

function validateStep(step: number, form: FormState): string[] {
  const errors: string[] = [];
  if (step === 0) {
    if (!form.companyName.trim()) errors.push('Company name is required');
    if (form.gstin && !GSTIN_REGEX.test(form.gstin)) errors.push('Invalid GSTIN format');
    if (form.pan && !PAN_REGEX.test(form.pan)) errors.push('Invalid PAN format (e.g. ABCDE1234F)');
  } else if (step === 1) {
    if (form.annualTurnover && isNaN(Number(form.annualTurnover))) errors.push('Turnover must be a number');
    if (form.netWorth && isNaN(Number(form.netWorth))) errors.push('Net worth must be a number');
    if (form.yearsInBusiness && isNaN(Number(form.yearsInBusiness))) errors.push('Years must be a number');
  } else if (step === 2) {
    if (form.msmeRegistered && !form.msmeNumber.trim()) errors.push('Udyam number is required when MSME registered');
    if (form.msmeRegistered && !form.msmeCategory) errors.push('MSME category is required');
  }
  return errors;
}

function calculateCompletion(form: FormState): number {
  const checks = [
    !!form.companyName, !!form.gstin, !!form.pan, form.companyType !== null,
    !!form.registrationNumber, !!form.incorporationDate, !!form.annualTurnover,
    !!form.netWorth, form.employeeCount > 0, !!form.yearsInBusiness,
    form.workCategories.length > 0, form.statesOperated.length > 0, !!form.maxProjectCapacity,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function CompanyProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [currentStep, setCurrentStep] = useState(0);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // ── Shared animation values ──
  const progressWidth = useSharedValue(1 / TOTAL_STEPS);
  const contentTranslateX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const submitScale = useSharedValue(1);

  // ── Load draft on mount ──
  useEffect(() => {
    const draft = getObject<FormState>(DRAFT_STORAGE_KEY);
    if (draft) setForm(draft);
  }, []);

  // ── Animated styles ──
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as `${number}%`,
  }));
  const contentAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: contentTranslateX.value }],
    opacity: contentOpacity.value,
  }));
  const submitButtonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: submitScale.value }],
  }));

  // ── Form updater ──
  const updateField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors([]);
  }, []);

  // ── Step transition animation ──
  const animateToStep = useCallback((newStep: number, direction: 'forward' | 'backward') => {
    const offsetOut = direction === 'forward' ? -SCREEN_WIDTH : SCREEN_WIDTH;
    const offsetIn = direction === 'forward' ? SCREEN_WIDTH : -SCREEN_WIDTH;

    contentOpacity.value = withTiming(0, { duration: 120 });
    contentTranslateX.value = withTiming(offsetOut, { duration: 120 }, () => {
      runOnJS(setCurrentStep)(newStep);
      contentTranslateX.value = offsetIn;
      contentOpacity.value = withTiming(1, { duration: 200 });
      contentTranslateX.value = withTiming(0, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      });
    });
    progressWidth.value = withTiming((newStep + 1) / TOTAL_STEPS, {
      duration: 400,
      easing: Easing.inOut(Easing.cubic),
    });
  }, [contentOpacity, contentTranslateX, progressWidth]);

  // ── Navigation handlers ──
  const handleNext = useCallback(() => {
    const stepErrors = validateStep(currentStep, form);
    if (stepErrors.length > 0) {
      setErrors(stepErrors);
      ReactNativeHapticFeedback.trigger('notificationError');
      return;
    }
    ReactNativeHapticFeedback.trigger('impactLight');
    if (currentStep < TOTAL_STEPS - 1) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      animateToStep(currentStep + 1, 'forward');
    }
  }, [currentStep, form, animateToStep]);

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      ReactNativeHapticFeedback.trigger('impactLight');
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      animateToStep(currentStep - 1, 'backward');
    }
  }, [currentStep, animateToStep]);

  const handleJumpToStep = useCallback((targetStep: number) => {
    if (targetStep === currentStep) return;
    ReactNativeHapticFeedback.trigger('impactLight');
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    animateToStep(targetStep, targetStep > currentStep ? 'forward' : 'backward');
  }, [currentStep, animateToStep]);

  // ── Draft ──
  const handleSaveDraft = useCallback(() => {
    setObject(DRAFT_STORAGE_KEY, form);
    ReactNativeHapticFeedback.trigger('notificationSuccess');
    Alert.alert('Saved', 'Your progress has been saved as a draft.');
  }, [form]);

  // ── Submit ──
  const handleSubmit = useCallback(async () => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    submitScale.value = withSpring(0.95, { damping: 15, stiffness: 400 }, () => {
      submitScale.value = withSpring(1, { damping: 10, stiffness: 300 });
    });

    setIsSubmitting(true);
    try {
      const turnoverMultiplier = form.turnoverUnit === 'Cr' ? 100 : 1;
      await updateCompanyProfile({
        companyName: form.companyName.trim(),
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        companyType: form.companyType ?? undefined,
        registrationNumber: form.registrationNumber || undefined,
        incorporationDate: form.incorporationDate || undefined,
        annualTurnover: form.annualTurnover
          ? Number(form.annualTurnover) * turnoverMultiplier
          : undefined,
        netWorth: form.netWorth ? Number(form.netWorth) : undefined,
        employeeCount: form.employeeCount > 0 ? form.employeeCount : undefined,
        yearsInBusiness: form.yearsInBusiness ? Number(form.yearsInBusiness) : undefined,
        msmeRegistered: form.msmeRegistered,
        msmeNumber: form.msmeRegistered ? form.msmeNumber : undefined,
        msmeCategory: form.msmeRegistered ? (form.msmeCategory ?? undefined) : undefined,
        gemRegistered: form.gemRegistered,
        startupDpiit: form.startupDpiit,
        epfRegistered: form.epfRegistered,
        gstRegistered: form.gstRegistered,
        isoRegistered: form.isoRegistered,
        isoCertificates: form.isoRegistered ? form.isoCertificates : [],
        workCategories: form.workCategories,
        specializations: form.specializations,
        statesOperated: form.statesOperated,
        maxProjectCapacity: form.maxProjectCapacity ? Number(form.maxProjectCapacity) : undefined,
      });
      setObject(DRAFT_STORAGE_KEY, undefined as unknown as FormState);
      setShowSuccess(true);
      ReactNativeHapticFeedback.trigger('notificationSuccess');
      setTimeout(() => navigation.goBack(), 1800);
    } catch {
      Alert.alert('Error', 'Failed to save profile. Please try again.');
      ReactNativeHapticFeedback.trigger('notificationError');
    } finally {
      setIsSubmitting(false);
    }
  }, [form, navigation, submitScale]);

  // ── Derived state ──
  const completionPct = useMemo(() => calculateCompletion(form), [form]);
  const filteredStates = useMemo(() => {
    if (!form.stateSearch.trim()) return INDIAN_STATES;
    const query = form.stateSearch.toLowerCase();
    return INDIAN_STATES.filter(s => s.toLowerCase().includes(query));
  }, [form.stateSearch]);
  const allStatesSelected = form.statesOperated.length === INDIAN_STATES.length;

  // ── Reusable text input field ──
  const renderInput = (
    label: string, value: string, onChange: (v: string) => void,
    opts?: { icon?: string; placeholder?: string; maxLength?: number;
      keyboardType?: TextInput['props']['keyboardType'];
      autoCapitalize?: TextInput['props']['autoCapitalize'];
      prefix?: string; required?: boolean },
  ) => (
    <Animated.View entering={FadeIn.duration(250)} style={styles.field}>
      <Text style={styles.label}>
        {label}{opts?.required && <Text style={styles.requiredStar}> *</Text>}
      </Text>
      <View style={[styles.inputWrapper, errors.length > 0 && opts?.required && !value.trim() && styles.inputError]}>
        {opts?.icon && <Icon name={opts.icon} size={20} color={TEXT_TERTIARY} style={styles.inputIcon} />}
        {opts?.prefix && <Text style={styles.inputPrefix}>{opts.prefix}</Text>}
        <TextInput
          style={styles.textInput}
          placeholder={opts?.placeholder}
          placeholderTextColor={TEXT_TERTIARY}
          value={value}
          onChangeText={onChange}
          maxLength={opts?.maxLength}
          keyboardType={opts?.keyboardType}
          autoCapitalize={opts?.autoCapitalize ?? 'none'}
        />
      </View>
    </Animated.View>
  );

  // ── Reusable toggle row ──
  const renderToggle = (
    icon: string, label: string, desc: string,
    value: boolean, onChange: (v: boolean) => void,
  ) => (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIconBox}>
        <Icon name={icon} size={22} color={PRIMARY} />
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDesc}>{desc}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={v => { ReactNativeHapticFeedback.trigger('impactLight'); onChange(v); }}
        trackColor={{ false: BORDER, true: `${PRIMARY}60` }}
        thumbColor={value ? PRIMARY : '#FFFFFF'}
        ios_backgroundColor={BORDER}
      />
    </View>
  );

  // ─── Add specialization helper ─────────────────────────────────────────────
  const addSpecialization = useCallback(() => {
    const val = form.specializationInput.trim();
    if (val && !form.specializations.includes(val)) {
      updateField('specializations', [...form.specializations, val]);
      updateField('specializationInput', '');
    }
  }, [form.specializationInput, form.specializations, updateField]);

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 1 — Basic Info
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep1 = () => (
    <View>
      <Text style={styles.stepTitle}>Basic Company Information</Text>
      <Text style={styles.stepSubtitle}>
        Tell us about your company to get better tender recommendations
      </Text>

      {renderInput('Company Name', form.companyName, v => updateField('companyName', v),
        { icon: 'office-building', placeholder: 'Enter company name', required: true })}

      {renderInput('GSTIN', form.gstin, v => updateField('gstin', v.toUpperCase()),
        { placeholder: '22AAAAA0000A1Z5', maxLength: 15, autoCapitalize: 'characters' })}

      {renderInput('PAN', form.pan, v => updateField('pan', v.toUpperCase()),
        { placeholder: 'ABCDE1234F', maxLength: 10, autoCapitalize: 'characters' })}

      <Animated.View entering={FadeIn.duration(250)} style={styles.field}>
        <Text style={styles.label}>Company Type</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScrollContent}>
          {COMPANY_TYPE_OPTIONS.map(opt => {
            const selected = form.companyType === opt.value;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  updateField('companyType', selected ? null : opt.value);
                }}
                activeOpacity={0.7}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </Animated.View>

      {renderInput('Registration Number', form.registrationNumber,
        v => updateField('registrationNumber', v),
        { placeholder: 'CIN / LLPIN / Registration No.' })}

      <Animated.View entering={FadeIn.duration(250)} style={styles.field}>
        <Text style={styles.label}>Incorporation Date</Text>
        <TouchableOpacity style={styles.dateField} activeOpacity={0.7}
          onPress={() => {
            const today = new Date().toISOString().split('T')[0];
            updateField('incorporationDate', form.incorporationDate || today!);
          }}>
          <Icon name="calendar-outline" size={20} color={TEXT_TERTIARY} />
          <Text style={[styles.dateText, !form.incorporationDate && styles.datePlaceholder]}>
            {form.incorporationDate || 'Select date'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 2 — Financial Details
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep2 = () => (
    <View>
      <Text style={styles.stepTitle}>Financial Details</Text>
      <Text style={styles.stepSubtitle}>Required for tender eligibility assessment</Text>

      {/* Annual Turnover with unit toggle */}
      <Animated.View entering={FadeIn.duration(250)} style={styles.field}>
        <Text style={styles.label}>Annual Turnover</Text>
        <View style={styles.turnoverRow}>
          <View style={[styles.inputWrapper, styles.turnoverInputFlex]}>
            <Text style={styles.inputPrefix}>{'\u20B9'}</Text>
            <TextInput style={styles.textInput} placeholder="e.g. 500"
              placeholderTextColor={TEXT_TERTIARY} value={form.annualTurnover}
              onChangeText={v => updateField('annualTurnover', v)} keyboardType="numeric" />
          </View>
          <View style={styles.unitToggle}>
            {(['Lakh', 'Cr'] as const).map(unit => (
              <TouchableOpacity key={unit}
                style={[styles.unitOption, form.turnoverUnit === unit && styles.unitOptionActive]}
                onPress={() => updateField('turnoverUnit', unit)} activeOpacity={0.7}>
                <Text style={[styles.unitText, form.turnoverUnit === unit && styles.unitTextActive]}>
                  {unit}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Animated.View>

      {renderInput('Net Worth (in Lakhs)', form.netWorth, v => updateField('netWorth', v),
        { prefix: '\u20B9', placeholder: 'e.g. 200', keyboardType: 'numeric' })}

      {/* Employee Count stepper + presets */}
      <Animated.View entering={FadeIn.duration(250)} style={styles.field}>
        <Text style={styles.label}>Employee Count</Text>
        <View style={styles.stepper}>
          <TouchableOpacity style={styles.stepperBtn}
            onPress={() => { if (form.employeeCount > 0) updateField('employeeCount', form.employeeCount - 1); }}
            activeOpacity={0.7}>
            <Icon name="minus" size={22} color={TEXT_PRIMARY} />
          </TouchableOpacity>
          <View style={styles.stepperValue}>
            <Text style={styles.stepperValueText}>{form.employeeCount}</Text>
          </View>
          <TouchableOpacity style={styles.stepperBtn}
            onPress={() => updateField('employeeCount', form.employeeCount + 1)}
            activeOpacity={0.7}>
            <Icon name="plus" size={22} color={TEXT_PRIMARY} />
          </TouchableOpacity>
        </View>
        <View style={styles.presetRow}>
          {EMPLOYEE_PRESETS.map(preset => {
            const active = form.employeeCount >= preset.min && form.employeeCount <= preset.max;
            return (
              <TouchableOpacity key={preset.label}
                style={[styles.presetChip, active && styles.presetChipActive]}
                onPress={() => updateField('employeeCount', preset.min)} activeOpacity={0.7}>
                <Text style={[styles.presetChipText, active && styles.presetChipTextActive]}>
                  {preset.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>

      {renderInput('Years in Business', form.yearsInBusiness, v => updateField('yearsInBusiness', v),
        { placeholder: 'e.g. 10', keyboardType: 'numeric' })}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 3 — Registrations & Certifications
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep3 = () => (
    <View>
      <Text style={styles.stepTitle}>Registrations & Certifications</Text>
      <Text style={styles.stepSubtitle}>Toggle your registrations for eligibility matching</Text>

      {renderToggle('certificate-outline', 'MSME Registered',
        'Udyam / Udyog Aadhaar registration', form.msmeRegistered,
        v => updateField('msmeRegistered', v))}

      {form.msmeRegistered && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.nestedSection}>
          {renderInput('Udyam Number', form.msmeNumber, v => updateField('msmeNumber', v),
            { placeholder: 'UDYAM-XX-00-0000000', required: true })}
          <Text style={styles.label}>MSME Category</Text>
          <View style={styles.chipsWrap}>
            {MSME_CATEGORY_OPTIONS.map(opt => {
              const sel = form.msmeCategory === opt.value;
              return (
                <TouchableOpacity key={opt.value} style={[styles.chip, sel && styles.chipSelected]}
                  onPress={() => updateField('msmeCategory', opt.value)} activeOpacity={0.7}>
                  <Text style={[styles.chipText, sel && styles.chipTextSelected]}>{opt.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      )}

      {renderToggle('store-outline', 'GEM Registered',
        'Government e-Marketplace registration', form.gemRegistered,
        v => updateField('gemRegistered', v))}

      {renderToggle('rocket-launch-outline', 'Startup DPIIT',
        'Recognised by DPIIT under Startup India', form.startupDpiit,
        v => updateField('startupDpiit', v))}

      {renderToggle('shield-check-outline', 'EPF Registered',
        'Employees Provident Fund registration', form.epfRegistered,
        v => updateField('epfRegistered', v))}

      {renderToggle('receipt', 'GST Registered',
        'Goods and Services Tax registration', form.gstRegistered,
        v => updateField('gstRegistered', v))}

      <View style={styles.sectionDivider} />
      <Text style={styles.sectionHeader}>ISO Certifications</Text>

      {renderToggle('medal-outline', 'ISO Certified',
        'International Organization for Standardization', form.isoRegistered,
        v => updateField('isoRegistered', v))}

      {form.isoRegistered && (
        <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)} style={styles.nestedSection}>
          {ISO_CERTIFICATES.map(cert => {
            const selected = form.isoCertificates.includes(cert);
            return (
              <TouchableOpacity key={cert} style={styles.checkboxRow}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection');
                  updateField('isoCertificates', selected
                    ? form.isoCertificates.filter(c => c !== cert)
                    : [...form.isoCertificates, cert]);
                }} activeOpacity={0.7}>
                <Icon name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                  size={24} color={selected ? PRIMARY : TEXT_TERTIARY} />
                <Text style={[styles.checkboxLabel, selected && styles.checkboxLabelActive]}>
                  {cert}
                </Text>
              </TouchableOpacity>
            );
          })}
        </Animated.View>
      )}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 4 — Capabilities & Experience
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep4 = () => (
    <View>
      <Text style={styles.stepTitle}>Capabilities & Experience</Text>
      <Text style={styles.stepSubtitle}>Define your specializations and operational areas</Text>

      {/* Work Categories grid */}
      <Text style={styles.sectionHeader}>Work Categories</Text>
      <View style={styles.categoryGrid}>
        {WORK_CATEGORIES.map(cat => {
          const selected = form.workCategories.includes(cat);
          return (
            <TouchableOpacity key={cat}
              style={[styles.categoryItem, selected && styles.categoryItemSelected]}
              onPress={() => {
                ReactNativeHapticFeedback.trigger('selection');
                updateField('workCategories', selected
                  ? form.workCategories.filter(c => c !== cat)
                  : [...form.workCategories, cat]);
              }} activeOpacity={0.7}>
              <Icon name={selected ? 'check-circle' : 'circle-outline'}
                size={20} color={selected ? PRIMARY : TEXT_TERTIARY} />
              <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}
                numberOfLines={2}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Specializations tag input */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionHeader}>Specializations</Text>
      <View style={styles.tagInputRow}>
        <TextInput style={styles.tagTextInput} placeholder="Add a specialization"
          placeholderTextColor={TEXT_TERTIARY} value={form.specializationInput}
          onChangeText={v => updateField('specializationInput', v)}
          onSubmitEditing={addSpecialization} returnKeyType="done" />
        <TouchableOpacity style={styles.tagAddButton} onPress={addSpecialization} activeOpacity={0.7}>
          <Text style={styles.tagAddText}>Add</Text>
        </TouchableOpacity>
      </View>
      {form.specializations.length > 0 && (
        <View style={styles.tagPillsWrap}>
          {form.specializations.map(spec => (
            <View key={spec} style={styles.tagPill}>
              <Text style={styles.tagPillText}>{spec}</Text>
              <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                onPress={() => updateField('specializations', form.specializations.filter(s => s !== spec))}>
                <Icon name="close-circle" size={18} color={PRIMARY} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* States Operated */}
      <View style={styles.sectionDivider} />
      <Text style={styles.sectionHeader}>States Operated</Text>
      <View style={styles.stateSearchWrap}>
        <Icon name="magnify" size={20} color={TEXT_TERTIARY} />
        <TextInput style={styles.stateSearchInput} placeholder="Search states..."
          placeholderTextColor={TEXT_TERTIARY} value={form.stateSearch}
          onChangeText={v => updateField('stateSearch', v)} />
      </View>
      <TouchableOpacity style={styles.selectAllRow}
        onPress={() => {
          ReactNativeHapticFeedback.trigger('selection');
          updateField('statesOperated', allStatesSelected ? [] : [...INDIAN_STATES]);
        }} activeOpacity={0.7}>
        <Icon name={allStatesSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
          size={24} color={allStatesSelected ? PRIMARY : TEXT_TERTIARY} />
        <Text style={styles.selectAllText}>Select All</Text>
        <Text style={styles.selectAllCount}>{form.statesOperated.length}/{INDIAN_STATES.length}</Text>
      </TouchableOpacity>
      <View style={styles.statesGrid}>
        {filteredStates.map(state => {
          const selected = form.statesOperated.includes(state);
          return (
            <TouchableOpacity key={state} style={styles.stateItem}
              onPress={() => updateField('statesOperated', selected
                ? form.statesOperated.filter(s => s !== state)
                : [...form.statesOperated, state])} activeOpacity={0.7}>
              <Icon name={selected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={20} color={selected ? PRIMARY : TEXT_TERTIARY} />
              <Text style={[styles.stateText, selected && styles.stateTextSelected]}
                numberOfLines={1}>{state}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sectionDivider} />
      {renderInput('Max Project Capacity', form.maxProjectCapacity,
        v => updateField('maxProjectCapacity', v),
        { prefix: '\u20B9', placeholder: 'In Lakhs', keyboardType: 'numeric' })}
    </View>
  );

  // ── Review section helper ──
  const renderReviewSection = (
    title: string, stepIndex: number,
    rows: { label: string; value: string; incomplete?: boolean }[],
  ) => (
    <View style={styles.reviewSection}>
      <View style={styles.reviewSectionHeader}>
        <Text style={styles.reviewSectionTitle}>{title}</Text>
        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => handleJumpToStep(stepIndex)} activeOpacity={0.7}>
          <View style={styles.editBadge}>
            <Icon name="pencil-outline" size={14} color={PRIMARY} />
            <Text style={styles.editBadgeText}>Edit</Text>
          </View>
        </TouchableOpacity>
      </View>
      {rows.map(row => (
        <View key={row.label} style={styles.reviewRow}>
          <Text style={styles.reviewLabel}>{row.label}</Text>
          <View style={styles.reviewValueWrap}>
            {row.incomplete && (
              <View style={styles.incompleteBadge}>
                <Text style={styles.incompleteBadgeText}>Incomplete</Text>
              </View>
            )}
            <Text style={[styles.reviewValue, row.incomplete && styles.reviewValueAmber]}
              numberOfLines={2}>{row.value}</Text>
          </View>
        </View>
      ))}
    </View>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // Step 5 — Review & Submit
  // ═══════════════════════════════════════════════════════════════════════════
  const renderStep5 = () => {
    const typeLabel = COMPANY_TYPE_OPTIONS.find(o => o.value === form.companyType)?.label ?? '';
    const msmeLabel = MSME_CATEGORY_OPTIONS.find(o => o.value === form.msmeCategory)?.label ?? '';
    const yn = (b: boolean) => b ? 'Yes' : 'No';
    const ns = 'Not set';

    return (
      <View>
        {/* Completion bar */}
        <View style={styles.completionCard}>
          <View style={styles.completionHeader}>
            <Text style={styles.completionTitle}>Profile Completion</Text>
            <Text style={styles.completionPct}>{completionPct}%</Text>
          </View>
          <View style={styles.completionTrack}>
            <View style={[styles.completionFill, {
              width: `${completionPct}%` as `${number}%`,
              backgroundColor: completionPct >= 80 ? ACCENT : completionPct >= 50 ? AMBER : ERROR,
            }]} />
          </View>
          <Text style={styles.completionHint}>
            {completionPct >= 80 ? 'Great! Your profile is nearly complete.' : 'Complete more fields for better tender matching.'}
          </Text>
        </View>

        {renderReviewSection('Basic Information', 0, [
          { label: 'Company Name', value: form.companyName || ns, incomplete: !form.companyName },
          { label: 'GSTIN', value: form.gstin || ns, incomplete: !form.gstin },
          { label: 'PAN', value: form.pan || ns, incomplete: !form.pan },
          { label: 'Company Type', value: typeLabel || ns, incomplete: !form.companyType },
          { label: 'Registration No.', value: form.registrationNumber || ns, incomplete: !form.registrationNumber },
          { label: 'Incorporation Date', value: form.incorporationDate || ns, incomplete: !form.incorporationDate },
        ])}

        {renderReviewSection('Financial Details', 1, [
          { label: 'Annual Turnover', value: form.annualTurnover ? `\u20B9${form.annualTurnover} ${form.turnoverUnit}` : ns, incomplete: !form.annualTurnover },
          { label: 'Net Worth', value: form.netWorth ? `\u20B9${form.netWorth} Lakh` : ns, incomplete: !form.netWorth },
          { label: 'Employees', value: form.employeeCount > 0 ? String(form.employeeCount) : ns, incomplete: form.employeeCount === 0 },
          { label: 'Years in Business', value: form.yearsInBusiness || ns, incomplete: !form.yearsInBusiness },
        ])}

        {renderReviewSection('Registrations', 2, [
          { label: 'MSME', value: yn(form.msmeRegistered) },
          ...(form.msmeRegistered ? [
            { label: 'Udyam No.', value: form.msmeNumber || ns },
            { label: 'MSME Category', value: msmeLabel || ns },
          ] : []),
          { label: 'GEM', value: yn(form.gemRegistered) },
          { label: 'Startup DPIIT', value: yn(form.startupDpiit) },
          { label: 'EPF', value: yn(form.epfRegistered) },
          { label: 'GST', value: yn(form.gstRegistered) },
          { label: 'ISO Certified', value: yn(form.isoRegistered) },
          ...(form.isoRegistered && form.isoCertificates.length > 0
            ? [{ label: 'ISO Certs', value: form.isoCertificates.join(', ') }] : []),
        ])}

        {renderReviewSection('Capabilities', 3, [
          { label: 'Work Categories', value: form.workCategories.length > 0 ? form.workCategories.join(', ') : 'None selected', incomplete: form.workCategories.length === 0 },
          { label: 'Specializations', value: form.specializations.length > 0 ? form.specializations.join(', ') : 'None added' },
          { label: 'States Operated', value: form.statesOperated.length > 0 ? `${form.statesOperated.length} state${form.statesOperated.length > 1 ? 's' : ''}` : 'None selected', incomplete: form.statesOperated.length === 0 },
          { label: 'Max Project Capacity', value: form.maxProjectCapacity ? `\u20B9${form.maxProjectCapacity} Lakh` : ns, incomplete: !form.maxProjectCapacity },
        ])}
      </View>
    );
  };

  // ── Step router ──
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: return renderStep1();
      case 1: return renderStep2();
      case 2: return renderStep3();
      case 3: return renderStep4();
      case 4: return renderStep5();
      default: return null;
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // ═══════════════════════════════════════════════════════════════════════════
  // Main Render
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={SECONDARY} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={() => navigation.goBack()}
          activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="arrow-left" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Company Profile</Text>
        <View style={styles.headerStepBadge}>
          <Text style={styles.headerStepText}>Step {currentStep + 1} of {TOTAL_STEPS}</Text>
        </View>
      </View>

      {/* Animated progress bar */}
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progressFill, progressBarStyle]} />
      </View>

      {/* Step dots row */}
      <View style={styles.dotsContainer}>
        {STEP_LABELS.map((label, index) => {
          const isActive = index === currentStep;
          const isCompleted = index < currentStep;
          return (
            <TouchableOpacity key={index} style={styles.dotItem}
              onPress={() => handleJumpToStep(index)} activeOpacity={0.7}>
              <View style={[styles.dot, isActive && styles.dotActive, isCompleted && styles.dotCompleted]}>
                {isCompleted
                  ? <Icon name="check" size={14} color="#FFFFFF" />
                  : <Text style={[styles.dotText, (isActive || isCompleted) && styles.dotTextActive]}>{index + 1}</Text>}
              </View>
              <Text style={[styles.dotLabel, isActive && styles.dotLabelActive]} numberOfLines={1}>
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Validation error bar */}
      {errors.length > 0 && (
        <Animated.View entering={FadeIn.duration(200)} style={styles.errorBar}>
          <Icon name="alert-circle-outline" size={18} color={ERROR} />
          <Text style={styles.errorBarText}>{errors[0]}</Text>
        </Animated.View>
      )}

      {/* Scrollable content */}
      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        keyboardShouldPersistTaps="handled">
        <Animated.View style={contentAnimatedStyle}>
          {renderStepContent()}
        </Animated.View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity onPress={handleSaveDraft} activeOpacity={0.7}>
          <Text style={styles.saveDraftText}>Save as Draft</Text>
        </TouchableOpacity>
        <View style={styles.bottomButtons}>
          {currentStep > 0 && (
            <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
              <Icon name="arrow-left" size={18} color={TEXT_SECONDARY} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {isLastStep ? (
            <Animated.View style={[styles.submitWrap, submitButtonAnimStyle]}>
              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}
                activeOpacity={0.85} disabled={isSubmitting}>
                {isSubmitting
                  ? <ActivityIndicator size="small" color="#FFFFFF" />
                  : <><Icon name="check-bold" size={20} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Save Company Profile</Text></>}
              </TouchableOpacity>
            </Animated.View>
          ) : (
            <TouchableOpacity
              style={[styles.nextButton, currentStep === 0 && styles.nextButtonFull]}
              onPress={handleNext} activeOpacity={0.85}>
              <Text style={styles.nextButtonText}>Next</Text>
              <Icon name="arrow-right" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Success overlay */}
      {showSuccess && (
        <Animated.View entering={FadeIn.duration(300)} style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Animated.View entering={FadeIn.delay(200).duration(400)}>
              <Icon name="check-circle" size={72} color={ACCENT} />
            </Animated.View>
            <Text style={styles.successTitle}>Profile Saved!</Text>
            <Text style={styles.successSubtitle}>
              Your company profile has been updated successfully.
            </Text>
          </View>
        </Animated.View>
      )}

      {/* Loading overlay */}
      {isSubmitting && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Saving profile...</Text>
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 14, backgroundColor: SECONDARY },
  headerBackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, marginLeft: 12, fontSize: 20, fontFamily: fontFamilies.bold, fontWeight: '700', color: '#FFFFFF', letterSpacing: -0.2 },
  headerStepBadge: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14 },
  headerStepText: { fontSize: 12, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: '#FFFFFF', letterSpacing: 0.2 },

  // Progress bar
  progressTrack: { height: 4, backgroundColor: BORDER },
  progressFill: { height: 4, backgroundColor: PRIMARY, borderTopRightRadius: 2, borderBottomRightRadius: 2 },

  // Step dots
  dotsContainer: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 14, backgroundColor: CARD_BG, borderBottomWidth: 1, borderBottomColor: BORDER },
  dotItem: { alignItems: 'center', flex: 1 },
  dot: { width: 30, height: 30, borderRadius: 15, backgroundColor: BORDER_LIGHT, borderWidth: 2, borderColor: BORDER, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  dotActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  dotCompleted: { backgroundColor: ACCENT, borderColor: ACCENT },
  dotText: { fontSize: 12, fontFamily: fontFamilies.bold, fontWeight: '700', color: TEXT_SECONDARY },
  dotTextActive: { color: '#FFFFFF' },
  dotLabel: { fontSize: 10, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_TERTIARY, textAlign: 'center' },
  dotLabelActive: { color: TEXT_PRIMARY, fontFamily: fontFamilies.semiBold, fontWeight: '600' },

  // Error bar
  errorBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: ERROR_LIGHT, paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  errorBarText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: ERROR, lineHeight: 18 },

  // Scroll
  scrollContent: { padding: 20 },

  // Step headings
  stepTitle: { fontSize: 22, fontFamily: fontFamilies.extraBold, fontWeight: '800', color: TEXT_PRIMARY, marginBottom: 6, letterSpacing: -0.3 },
  stepSubtitle: { fontSize: 15, fontFamily: fontFamilies.regular, color: TEXT_SECONDARY, lineHeight: 22, marginBottom: 24 },

  // Form fields
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 8 },
  requiredStar: { color: ERROR },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 52, paddingHorizontal: 14, ...shadows.sm },
  inputError: { borderColor: ERROR, backgroundColor: ERROR_LIGHT },
  inputIcon: { marginRight: 6 },
  inputPrefix: { fontSize: 16, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_SECONDARY, marginRight: 4 },
  textInput: { flex: 1, fontSize: 16, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY, height: 52, paddingVertical: 0 },

  // Chips
  chipsScrollContent: { gap: 8, paddingRight: 16 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER },
  chipSelected: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  chipText: { fontSize: 14, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_PRIMARY },
  chipTextSelected: { color: '#FFFFFF', fontFamily: fontFamilies.semiBold, fontWeight: '600' },

  // Date picker mock
  dateField: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 52, paddingHorizontal: 14, gap: 10, ...shadows.sm },
  dateText: { fontSize: 16, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY },
  datePlaceholder: { color: TEXT_TERTIARY },

  // Turnover row
  turnoverRow: { flexDirection: 'row', gap: 10 },
  turnoverInputFlex: { flex: 1 },
  unitToggle: { flexDirection: 'row', backgroundColor: BORDER_LIGHT, borderRadius: 12, padding: 4, alignSelf: 'center' },
  unitOption: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10 },
  unitOptionActive: { backgroundColor: CARD_BG, ...shadows.sm },
  unitText: { fontSize: 14, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_SECONDARY },
  unitTextActive: { color: PRIMARY },

  // Stepper
  stepper: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: CARD_BG, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, overflow: 'hidden', marginBottom: 12, ...shadows.sm },
  stepperBtn: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: BORDER_LIGHT },
  stepperValue: { width: 64, height: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: CARD_BG },
  stepperValueText: { fontSize: 18, fontFamily: fontFamilies.bold, fontWeight: '700', color: TEXT_PRIMARY },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  presetChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18, backgroundColor: BORDER_LIGHT, borderWidth: 1, borderColor: BORDER },
  presetChipActive: { backgroundColor: PRIMARY_LIGHT, borderColor: PRIMARY },
  presetChipText: { fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_SECONDARY },
  presetChipTextActive: { color: PRIMARY, fontFamily: fontFamilies.semiBold, fontWeight: '600' },

  // Toggle rows
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: BORDER_LIGHT, ...shadows.sm },
  toggleIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY_LIGHT, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  toggleContent: { flex: 1, marginRight: 8 },
  toggleLabel: { fontSize: 15, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 2 },
  toggleDesc: { fontSize: 12, fontFamily: fontFamilies.regular, color: TEXT_SECONDARY, lineHeight: 16 },
  nestedSection: { paddingLeft: 16, paddingBottom: 8, marginBottom: 10, borderLeftWidth: 2, borderLeftColor: PRIMARY_LIGHT },

  // Checkboxes
  checkboxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, gap: 10 },
  checkboxLabel: { fontSize: 15, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY },
  checkboxLabelActive: { color: PRIMARY, fontFamily: fontFamilies.semiBold, fontWeight: '600' },

  // Section dividers
  sectionDivider: { height: 1, backgroundColor: BORDER, marginVertical: 20 },
  sectionHeader: { fontSize: 16, fontFamily: fontFamilies.bold, fontWeight: '700', color: TEXT_PRIMARY, marginBottom: 14, letterSpacing: -0.1 },

  // Category grid
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryItem: { flexDirection: 'row', alignItems: 'center', width: (SCREEN_WIDTH - 50) / 2, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1.5, borderColor: BORDER, backgroundColor: CARD_BG, gap: 8 },
  categoryItemSelected: { borderColor: PRIMARY, backgroundColor: PRIMARY_LIGHT },
  categoryText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_PRIMARY },
  categoryTextSelected: { color: PRIMARY, fontFamily: fontFamilies.semiBold, fontWeight: '600' },

  // Tag input
  tagInputRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  tagTextInput: { flex: 1, backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 48, paddingHorizontal: 14, fontSize: 15, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY, ...shadows.sm },
  tagAddButton: { backgroundColor: PRIMARY, borderRadius: 12, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', height: 48 },
  tagAddText: { fontSize: 15, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: '#FFFFFF' },
  tagPillsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  tagPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: PRIMARY_LIGHT, borderRadius: 20, paddingLeft: 14, paddingRight: 8, paddingVertical: 7, gap: 6 },
  tagPillText: { fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: PRIMARY },

  // States
  stateSearchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: CARD_BG, borderWidth: 1.5, borderColor: BORDER, borderRadius: 12, height: 44, paddingHorizontal: 12, gap: 8, marginBottom: 12, ...shadows.sm },
  stateSearchInput: { flex: 1, fontSize: 15, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY, height: 44, paddingVertical: 0 },
  selectAllRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, marginBottom: 8, gap: 10 },
  selectAllText: { flex: 1, fontSize: 15, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_PRIMARY },
  selectAllCount: { fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_SECONDARY },
  statesGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stateItem: { flexDirection: 'row', alignItems: 'center', width: (SCREEN_WIDTH - 40) / 2, paddingVertical: 8, paddingHorizontal: 4, gap: 8 },
  stateText: { flex: 1, fontSize: 13, fontFamily: fontFamilies.regular, color: TEXT_PRIMARY },
  stateTextSelected: { fontFamily: fontFamilies.semiBold, fontWeight: '600', color: PRIMARY },

  // Review
  completionCard: { backgroundColor: CARD_BG, borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: BORDER_LIGHT, ...shadows.md },
  completionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  completionTitle: { fontSize: 16, fontFamily: fontFamilies.bold, fontWeight: '700', color: TEXT_PRIMARY },
  completionPct: { fontSize: 24, fontFamily: fontFamilies.extraBold, fontWeight: '800', color: PRIMARY },
  completionTrack: { height: 8, borderRadius: 4, backgroundColor: BORDER_LIGHT, overflow: 'hidden', marginBottom: 10 },
  completionFill: { height: 8, borderRadius: 4 },
  completionHint: { fontSize: 13, fontFamily: fontFamilies.regular, color: TEXT_SECONDARY, lineHeight: 18 },

  reviewSection: { backgroundColor: CARD_BG, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: BORDER_LIGHT, overflow: 'hidden', ...shadows.sm },
  reviewSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: BORDER_LIGHT, backgroundColor: BACKGROUND },
  reviewSectionTitle: { fontSize: 15, fontFamily: fontFamilies.bold, fontWeight: '700', color: TEXT_PRIMARY },
  editBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: PRIMARY_LIGHT, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10 },
  editBadgeText: { fontSize: 12, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: PRIMARY },
  reviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: BORDER_LIGHT },
  reviewLabel: { fontSize: 13, fontFamily: fontFamilies.regular, color: TEXT_SECONDARY, flex: 1 },
  reviewValueWrap: { flex: 1.2, flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 6 },
  reviewValue: { fontSize: 14, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_PRIMARY, textAlign: 'right' },
  reviewValueAmber: { color: AMBER },
  incompleteBadge: { backgroundColor: AMBER_LIGHT, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  incompleteBadgeText: { fontSize: 9, fontFamily: fontFamilies.bold, fontWeight: '700', color: AMBER, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Bottom bar
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12, backgroundColor: CARD_BG,
    borderTopWidth: 1, borderTopColor: BORDER,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.08, shadowRadius: 12 },
      android: { elevation: 12 },
    }),
  },
  saveDraftText: { textAlign: 'center', fontSize: 13, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_SECONDARY, textDecorationLine: 'underline', marginBottom: 10 },
  bottomButtons: { flexDirection: 'row', gap: 12 },
  backButton: { flex: 1, height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: BORDER, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: CARD_BG },
  backButtonText: { fontSize: 16, fontFamily: fontFamilies.semiBold, fontWeight: '600', color: TEXT_SECONDARY },
  nextButton: { flex: 2, height: 52, borderRadius: 14, backgroundColor: PRIMARY, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.md },
  nextButtonFull: { flex: 1 },
  nextButtonText: { fontSize: 16, fontFamily: fontFamilies.bold, fontWeight: '700', color: '#FFFFFF' },
  submitWrap: { flex: 2 },
  submitButton: { height: 52, borderRadius: 14, backgroundColor: ACCENT_DARK, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, ...shadows.md },
  submitButtonText: { fontSize: 16, fontFamily: fontFamilies.bold, fontWeight: '700', color: '#FFFFFF' },

  // Overlays
  successOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  successCard: { backgroundColor: CARD_BG, borderRadius: 24, padding: 36, alignItems: 'center', marginHorizontal: 40, ...shadows.xl },
  successTitle: { fontSize: 22, fontFamily: fontFamilies.extraBold, fontWeight: '800', color: TEXT_PRIMARY, marginTop: 16, marginBottom: 8 },
  successSubtitle: { fontSize: 15, fontFamily: fontFamilies.regular, color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 22 },
  loadingOverlay: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(255,255,255,0.85)', alignItems: 'center', justifyContent: 'center', zIndex: 99 },
  loadingText: { fontSize: 15, fontFamily: fontFamilies.medium, fontWeight: '500', color: TEXT_SECONDARY, marginTop: 12 },
});
