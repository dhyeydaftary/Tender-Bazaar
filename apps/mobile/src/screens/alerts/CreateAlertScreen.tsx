/**
 * TenderBazaar -- CreateAlertScreen (Premium)
 *
 * 3-step wizard to create a new tender alert:
 *   Step 1 — What to monitor (name, keywords, category, state)
 *   Step 2 — Value & Delivery (value range, org, source portal)
 *   Step 3 — How to notify (frequency, channels, preview)
 *
 * Animated step transitions, progress bar, keyword tag input with
 * suggestions, multi-select chips, and haptic feedback.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  StatusBar,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideInLeft,
  SlideOutLeft,
  SlideOutRight,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { RootStackParamList } from '../../types/navigation';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { INDIAN_STATES } from '../../utils/constants';
import { useSubscriptionStore } from '../../stores/subscriptionStore';
import { UpgradeBanner } from '../../components/subscription';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const ACCENT = '#00D4AA';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#E8ECF1';
const DANGER = '#EF4444';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TOTAL_STEPS = 3;

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CATEGORIES = [
  { key: 'Works', label: 'Works', icon: 'hammer-wrench' },
  { key: 'Goods', label: 'Goods', icon: 'package-variant' },
  { key: 'Services', label: 'Services', icon: 'briefcase-outline' },
  { key: 'Consultancy', label: 'Consultancy', icon: 'account-tie' },
];

const VALUE_RANGES = [
  { key: 'under_10l', label: 'Under \u20B910L' },
  { key: '10l_1cr', label: '\u20B910L - 1Cr' },
  { key: '1cr_10cr', label: '\u20B91 - 10Cr' },
  { key: '10cr_100cr', label: '\u20B910 - 100Cr' },
  { key: '100cr_plus', label: '\u20B9100Cr+' },
];

const SOURCE_PORTALS = [
  { key: 'all', label: 'All' },
  { key: 'cppp', label: 'CPPP' },
  { key: 'gem', label: 'GeM' },
  { key: 'state', label: 'State Portal' },
  { key: 'ireps', label: 'IREPS' },
];

const FREQUENCIES = [
  { key: 'instant', label: 'Instant', icon: 'lightning-bolt', description: 'As soon as published' },
  { key: 'daily', label: 'Daily Digest', icon: 'calendar-today', description: 'Once per day at 9 AM' },
  { key: 'weekly', label: 'Weekly Summary', icon: 'calendar-week', description: 'Every Monday at 9 AM' },
];

const KEYWORD_SUGGESTIONS: Record<string, string[]> = {
  high: ['highway', 'high-speed rail', 'high tension'],
  road: ['road construction', 'road widening', 'road maintenance'],
  soft: ['software', 'software development', 'software testing'],
  it: ['IT services', 'IT infrastructure', 'IT equipment'],
  sol: ['solar', 'solar power', 'solar panel'],
  med: ['medical', 'medical equipment', 'medical supplies'],
  con: ['construction', 'consultancy', 'concrete'],
  bri: ['bridge', 'bridge construction'],
  wat: ['water supply', 'water treatment', 'waterway'],
  ele: ['electrical', 'electricity', 'electronic'],
};

const TOP_STATES = INDIAN_STATES.slice(0, 8);

const ORG_SUGGESTIONS = [
  'NHAI',
  'ISRO',
  'Indian Railways',
  'CPWD',
  'Power Grid Corporation',
  'BHEL',
  'NTPC',
  'ONGC',
  'GAIL',
  'Delhi Jal Board',
  'BSNL',
  'HAL',
];

// ---------------------------------------------------------------------------
// Animated Components
// ---------------------------------------------------------------------------

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ---------------------------------------------------------------------------
// KeywordInput
// ---------------------------------------------------------------------------

interface KeywordInputProps {
  keywords: string[];
  onAdd: (kw: string) => void;
  onRemove: (kw: string) => void;
}

const KeywordInput: React.FC<KeywordInputProps> = React.memo(
  ({ keywords, onAdd, onRemove }) => {
    const [input, setInput] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);

    const handleInputChange = useCallback(
      (text: string) => {
        setInput(text);
        if (text.length >= 2) {
          const lower = text.toLowerCase();
          const matched: string[] = [];
          Object.entries(KEYWORD_SUGGESTIONS).forEach(([prefix, options]) => {
            if (lower.startsWith(prefix) || prefix.startsWith(lower)) {
              options.forEach((opt) => {
                if (!keywords.includes(opt) && !matched.includes(opt)) {
                  matched.push(opt);
                }
              });
            }
          });
          setSuggestions(matched.slice(0, 4));
        } else {
          setSuggestions([]);
        }
      },
      [keywords],
    );

    const handleAdd = useCallback(() => {
      const trimmed = input.trim();
      if (trimmed && !keywords.includes(trimmed)) {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
        onAdd(trimmed);
        setInput('');
        setSuggestions([]);
      }
    }, [input, keywords, onAdd]);

    const handleSuggestionPress = useCallback(
      (suggestion: string) => {
        ReactNativeHapticFeedback.trigger('impactLight', {
          enableVibrateFallback: true,
          ignoreAndroidSystemSettings: false,
        });
        onAdd(suggestion);
        setInput('');
        setSuggestions([]);
      },
      [onAdd],
    );

    return (
      <View>
        <View style={styles.tagInputRow}>
          <TextInput
            style={styles.tagInput}
            placeholder="Type keyword..."
            placeholderTextColor={TEXT_MUTED}
            value={input}
            onChangeText={handleInputChange}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[styles.addButton, !input.trim() && styles.addButtonDisabled]}
            onPress={handleAdd}
            activeOpacity={0.7}
            disabled={!input.trim()}>
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.suggestionsRow}>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionChip}
                onPress={() => handleSuggestionPress(s)}
                activeOpacity={0.7}>
                <Icon name="plus" size={12} color={PRIMARY} />
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <View style={styles.keywordPills}>
            {keywords.map((kw) => (
              <Animated.View
                key={kw}
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
                style={styles.keywordPill}>
                <Text style={styles.keywordPillText}>{kw}</Text>
                <TouchableOpacity
                  onPress={() => {
                    ReactNativeHapticFeedback.trigger('impactLight', {
                      enableVibrateFallback: true,
                      ignoreAndroidSystemSettings: false,
                    });
                    onRemove(kw);
                  }}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name="close-circle" size={16} color={PRIMARY + '80'} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// MultiSelectChips
// ---------------------------------------------------------------------------

interface MultiSelectChipsProps {
  items: { key: string; label: string; icon?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}

const MultiSelectChips: React.FC<MultiSelectChipsProps> = React.memo(
  ({ items, selected, onToggle }) => (
    <View style={styles.chipsWrap}>
      {items.map((item) => {
        const isSelected = selected.includes(item.key);
        return (
          <TouchableOpacity
            key={item.key}
            style={[styles.chip, isSelected && styles.chipSelected]}
            onPress={() => {
              ReactNativeHapticFeedback.trigger('selection', {
                enableVibrateFallback: true,
                ignoreAndroidSystemSettings: false,
              });
              onToggle(item.key);
            }}
            activeOpacity={0.7}>
            {item.icon && (
              <Icon
                name={item.icon}
                size={16}
                color={isSelected ? '#FFFFFF' : TEXT_SECONDARY}
                style={{ marginRight: 6 }}
              />
            )}
            <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  ),
);

// ---------------------------------------------------------------------------
// StateSelector
// ---------------------------------------------------------------------------

interface StateSelectorProps {
  selected: string[];
  onToggle: (state: string) => void;
}

const StateSelector: React.FC<StateSelectorProps> = React.memo(
  ({ selected, onToggle }) => {
    const [showAll, setShowAll] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const displayStates = useMemo(() => {
      const stateList = showAll ? [...INDIAN_STATES] : [...TOP_STATES];
      if (searchQuery.trim()) {
        return stateList.filter((s) =>
          s.toLowerCase().includes(searchQuery.toLowerCase()),
        );
      }
      return stateList;
    }, [showAll, searchQuery]);

    return (
      <View>
        {showAll && (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={styles.stateSearchBar}>
              <FeatherIcon name="search" size={16} color={TEXT_MUTED} />
              <TextInput
                style={styles.stateSearchInput}
                placeholder="Search states..."
                placeholderTextColor={TEXT_MUTED}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </Animated.View>
        )}
        <View style={styles.chipsWrap}>
          {displayStates.map((state) => {
            const isSelected = selected.includes(state);
            return (
              <TouchableOpacity
                key={state}
                style={[styles.stateChip, isSelected && styles.stateChipSelected]}
                onPress={() => {
                  ReactNativeHapticFeedback.trigger('selection', {
                    enableVibrateFallback: true,
                    ignoreAndroidSystemSettings: false,
                  });
                  onToggle(state);
                }}
                activeOpacity={0.7}>
                {isSelected && (
                  <Icon name="check" size={12} color="#FFFFFF" style={{ marginRight: 4 }} />
                )}
                <Text
                  style={[
                    styles.stateChipText,
                    isSelected && styles.stateChipTextSelected,
                  ]}>
                  {state}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {!showAll && (
          <TouchableOpacity
            style={styles.showAllButton}
            onPress={() => setShowAll(true)}
            activeOpacity={0.7}>
            <Text style={styles.showAllText}>Show all states</Text>
            <Icon name="chevron-down" size={16} color={PRIMARY} />
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// OrgInput with autocomplete
// ---------------------------------------------------------------------------

interface OrgInputProps {
  value: string;
  onChangeText: (text: string) => void;
  selectedOrgs: string[];
  onAddOrg: (org: string) => void;
  onRemoveOrg: (org: string) => void;
}

const OrgInput: React.FC<OrgInputProps> = React.memo(
  ({ value, onChangeText, selectedOrgs, onAddOrg, onRemoveOrg }) => {
    const suggestions = useMemo(() => {
      if (value.length < 2) return [];
      const lower = value.toLowerCase();
      return ORG_SUGGESTIONS.filter(
        (org) => org.toLowerCase().includes(lower) && !selectedOrgs.includes(org),
      ).slice(0, 4);
    }, [value, selectedOrgs]);

    return (
      <View>
        <TextInput
          style={styles.textInput}
          placeholder="Search organization..."
          placeholderTextColor={TEXT_MUTED}
          value={value}
          onChangeText={onChangeText}
        />
        {suggestions.length > 0 && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.orgSuggestions}>
            {suggestions.map((org) => (
              <TouchableOpacity
                key={org}
                style={styles.orgSuggestionItem}
                onPress={() => {
                  onAddOrg(org);
                  onChangeText('');
                }}
                activeOpacity={0.7}>
                <FeatherIcon name="briefcase" size={14} color={TEXT_SECONDARY} />
                <Text style={styles.orgSuggestionText}>{org}</Text>
                <Icon name="plus" size={16} color={PRIMARY} />
              </TouchableOpacity>
            ))}
          </Animated.View>
        )}
        {selectedOrgs.length > 0 && (
          <View style={styles.keywordPills}>
            {selectedOrgs.map((org) => (
              <Animated.View
                key={org}
                entering={FadeIn.duration(250)}
                exiting={FadeOut.duration(200)}
                style={styles.keywordPill}>
                <Text style={styles.keywordPillText}>{org}</Text>
                <TouchableOpacity
                  onPress={() => onRemoveOrg(org)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                  <Icon name="close-circle" size={16} color={PRIMARY + '80'} />
                </TouchableOpacity>
              </Animated.View>
            ))}
          </View>
        )}
      </View>
    );
  },
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function CreateAlertScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();

  // --- Step state ---
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  // --- Form state (Step 1) ---
  const [alertName, setAlertName] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);

  // --- Form state (Step 2) ---
  const [selectedValueRanges, setSelectedValueRanges] = useState<string[]>([]);
  const [orgInput, setOrgInput] = useState('');
  const [selectedOrgs, setSelectedOrgs] = useState<string[]>([]);
  const [selectedPortals, setSelectedPortals] = useState<string[]>(['all']);

  // --- Form state (Step 3) ---
  const [frequency, setFrequency] = useState('daily');
  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [whatsappEnabled, setWhatsappEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);

  // --- Subscription limits ---
  const checkLimit = useSubscriptionStore((s) => s.checkLimit);
  const hasFeature = useSubscriptionStore((s) => s.hasFeature);
  const alertLimit = checkLimit('maxAlerts');
  const canCreateAlert = alertLimit.hasCapacity || alertLimit.isUnlimited;
  const hasWhatsApp = hasFeature('whatsappAlerts');

  // --- Progress bar animation ---
  const progressWidth = useSharedValue(33.33);

  useEffect(() => {
    const target = (currentStep / TOTAL_STEPS) * 100;
    progressWidth.value = withTiming(target, {
      duration: 400,
      easing: Easing.out(Easing.cubic),
    });
  }, [currentStep, progressWidth]);

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  // --- Handlers ---
  const toggleInList = useCallback(
    (item: string, list: string[], setter: (v: string[]) => void) => {
      if (list.includes(item)) {
        setter(list.filter((i) => i !== item));
      } else {
        setter([...list, item]);
      }
    },
    [],
  );

  const addKeyword = useCallback(
    (kw: string) => {
      if (!keywords.includes(kw)) {
        setKeywords((prev) => [...prev, kw]);
      }
    },
    [keywords],
  );

  const removeKeyword = useCallback((kw: string) => {
    setKeywords((prev) => prev.filter((k) => k !== kw));
  }, []);

  const addOrg = useCallback(
    (org: string) => {
      if (!selectedOrgs.includes(org)) {
        setSelectedOrgs((prev) => [...prev, org]);
      }
    },
    [selectedOrgs],
  );

  const removeOrg = useCallback((org: string) => {
    setSelectedOrgs((prev) => prev.filter((o) => o !== org));
  }, []);

  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setDirection('forward');
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 1) {
      ReactNativeHapticFeedback.trigger('impactLight', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      setDirection('backward');
      setCurrentStep((prev) => prev - 1);
    } else {
      navigation.goBack();
    }
  }, [currentStep, navigation]);

  const handleCreate = useCallback(() => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    navigation.goBack();
  }, [navigation]);

  // Create button scale
  const createScale = useSharedValue(1);
  const createAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: createScale.value }],
  }));
  const handleCreatePressIn = useCallback(() => {
    createScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  }, [createScale]);
  const handleCreatePressOut = useCallback(() => {
    createScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  }, [createScale]);

  // --- Preview text ---
  const previewText = useMemo(() => {
    const freqLabel =
      FREQUENCIES.find((f) => f.key === frequency)?.label ?? 'daily';
    const catLabels = selectedCategories.length > 0
      ? selectedCategories.join(', ')
      : 'all category';
    const kwLabels = keywords.length > 0
      ? keywords.join(', ')
      : 'your criteria';
    return `You'll receive ${freqLabel.toLowerCase()} notifications about ${catLabels} tenders with keywords: ${kwLabels}`;
  }, [frequency, selectedCategories, keywords]);

  // --- Can proceed ---
  const canProceedStep1 = alertName.trim().length > 0;
  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <View style={[styles.container, { paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ---- Header ---- */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          onPress={goBack}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBackButton}>
          <FeatherIcon name="arrow-left" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Alert</Text>
        <View style={styles.stepIndicator}>
          <Text style={styles.stepIndicatorText}>
            Step {currentStep} of {TOTAL_STEPS}
          </Text>
        </View>
      </View>

      {/* ---- Progress bar ---- */}
      <View style={styles.progressBarTrack}>
        <Animated.View style={[styles.progressBarFill, progressStyle]} />
      </View>

      {/* ---- Alert limit warning ---- */}
      {!canCreateAlert && (
        <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
          <UpgradeBanner
            feature="Tender Alerts"
            requiredPlan="Starter"
            variant="card"
          />
        </View>
      )}

      {/* ---- Step content ---- */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* ===== Step 1: What to monitor ===== */}
          {currentStep === 1 && (
            <Animated.View
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
              key="step-1">
              {/* Alert name */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="tag-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Alert Name</Text>
                  <Text style={styles.requiredAsterisk}>*</Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g., Highway Tenders"
                  placeholderTextColor={TEXT_MUTED}
                  value={alertName}
                  onChangeText={setAlertName}
                />
              </View>

              {/* Keywords */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="key-variant" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Keywords</Text>
                </View>
                <KeywordInput
                  keywords={keywords}
                  onAdd={addKeyword}
                  onRemove={removeKeyword}
                />
              </View>

              {/* Category Filter */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="shape-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Category Filter</Text>
                </View>
                <MultiSelectChips
                  items={CATEGORIES}
                  selected={selectedCategories}
                  onToggle={(key) =>
                    toggleInList(key, selectedCategories, setSelectedCategories)
                  }
                />
              </View>

              {/* State Filter */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="map-marker-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>State Filter</Text>
                </View>
                <StateSelector
                  selected={selectedStates}
                  onToggle={(state) =>
                    toggleInList(state, selectedStates, setSelectedStates)
                  }
                />
              </View>
            </Animated.View>
          )}

          {/* ===== Step 2: Value & Delivery ===== */}
          {currentStep === 2 && (
            <Animated.View
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
              key="step-2">
              {/* Value Range */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="currency-inr" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Value Range</Text>
                </View>
                <MultiSelectChips
                  items={VALUE_RANGES}
                  selected={selectedValueRanges}
                  onToggle={(key) =>
                    toggleInList(key, selectedValueRanges, setSelectedValueRanges)
                  }
                />
              </View>

              {/* Organization */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <FeatherIcon name="briefcase" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Organization</Text>
                </View>
                <OrgInput
                  value={orgInput}
                  onChangeText={setOrgInput}
                  selectedOrgs={selectedOrgs}
                  onAddOrg={addOrg}
                  onRemoveOrg={removeOrg}
                />
              </View>

              {/* Source Portal */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="web" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Source Portal</Text>
                </View>
                <MultiSelectChips
                  items={SOURCE_PORTALS}
                  selected={selectedPortals}
                  onToggle={(key) =>
                    toggleInList(key, selectedPortals, setSelectedPortals)
                  }
                />
              </View>
            </Animated.View>
          )}

          {/* ===== Step 3: How to notify ===== */}
          {currentStep === 3 && (
            <Animated.View
              entering={direction === 'forward' ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
              exiting={direction === 'forward' ? SlideOutLeft.duration(300) : SlideOutRight.duration(300)}
              key="step-3">
              {/* Frequency */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="clock-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Frequency</Text>
                </View>
                {FREQUENCIES.map((freq) => {
                  const isActive = frequency === freq.key;
                  return (
                    <TouchableOpacity
                      key={freq.key}
                      style={[styles.radioCard, isActive && styles.radioCardActive]}
                      onPress={() => {
                        ReactNativeHapticFeedback.trigger('selection', {
                          enableVibrateFallback: true,
                          ignoreAndroidSystemSettings: false,
                        });
                        setFrequency(freq.key);
                      }}
                      activeOpacity={0.7}>
                      <View
                        style={[
                          styles.radioCircle,
                          isActive && styles.radioCircleActive,
                        ]}>
                        {isActive && <View style={styles.radioDot} />}
                      </View>
                      <View style={styles.radioContent}>
                        <View style={styles.radioTitleRow}>
                          <Icon
                            name={freq.icon}
                            size={16}
                            color={isActive ? PRIMARY : TEXT_SECONDARY}
                          />
                          <Text
                            style={[
                              styles.radioLabel,
                              isActive && styles.radioLabelActive,
                            ]}>
                            {freq.label}
                          </Text>
                        </View>
                        <Text style={styles.radioDescription}>
                          {freq.description}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Channels */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="bell-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Notification Channels</Text>
                </View>
                <View style={styles.channelCard}>
                  {/* Push */}
                  <View style={styles.channelRow}>
                    <View style={[styles.channelIconCircle, { backgroundColor: PRIMARY + '14' }]}>
                      <Icon name="bell-outline" size={18} color={PRIMARY} />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelLabel}>Push Notifications</Text>
                    </View>
                    <Switch
                      value={pushEnabled}
                      onValueChange={setPushEnabled}
                      trackColor={{ false: BORDER, true: PRIMARY + '40' }}
                      thumbColor={pushEnabled ? PRIMARY : '#f4f3f4'}
                    />
                  </View>
                  <View style={styles.channelDivider} />

                  {/* Email */}
                  <View style={styles.channelRow}>
                    <View style={[styles.channelIconCircle, { backgroundColor: '#2563EB14' }]}>
                      <Icon name="email-outline" size={18} color="#2563EB" />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelLabel}>Email</Text>
                    </View>
                    <Switch
                      value={emailEnabled}
                      onValueChange={setEmailEnabled}
                      trackColor={{ false: BORDER, true: PRIMARY + '40' }}
                      thumbColor={emailEnabled ? PRIMARY : '#f4f3f4'}
                    />
                  </View>
                  <View style={styles.channelDivider} />

                  {/* WhatsApp */}
                  <View style={styles.channelRow}>
                    <View style={[styles.channelIconCircle, { backgroundColor: '#25D36614' }]}>
                      <Icon name="whatsapp" size={18} color="#25D366" />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelLabel}>WhatsApp</Text>
                      <View style={styles.lockRow}>
                        <Icon name="lock-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.lockText}>Available on Professional plan</Text>
                      </View>
                    </View>
                    <Switch
                      value={whatsappEnabled}
                      onValueChange={setWhatsappEnabled}
                      trackColor={{ false: BORDER, true: PRIMARY + '40' }}
                      thumbColor={whatsappEnabled ? PRIMARY : '#f4f3f4'}
                      disabled
                    />
                  </View>
                  <View style={styles.channelDivider} />

                  {/* SMS */}
                  <View style={styles.channelRow}>
                    <View style={[styles.channelIconCircle, { backgroundColor: '#F59E0B14' }]}>
                      <Icon name="message-text-outline" size={18} color="#F59E0B" />
                    </View>
                    <View style={styles.channelInfo}>
                      <Text style={styles.channelLabel}>SMS</Text>
                      <View style={styles.lockRow}>
                        <Icon name="lock-outline" size={12} color={TEXT_MUTED} />
                        <Text style={styles.lockText}>Available on Professional plan</Text>
                      </View>
                    </View>
                    <Switch
                      value={smsEnabled}
                      onValueChange={setSmsEnabled}
                      trackColor={{ false: BORDER, true: PRIMARY + '40' }}
                      thumbColor={smsEnabled ? PRIMARY : '#f4f3f4'}
                      disabled
                    />
                  </View>
                </View>
              </View>

              {/* Preview */}
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Icon name="eye-outline" size={18} color={PRIMARY} />
                  <Text style={styles.sectionTitle}>Preview</Text>
                </View>
                <View style={styles.previewCard}>
                  <Icon name="information-outline" size={18} color={ACCENT} />
                  <Text style={styles.previewText}>{previewText}</Text>
                </View>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ---- Bottom bar ---- */}
      <View style={[styles.bottomBar, shadows.lg]}>
        {/* Progress dots */}
        <View style={styles.dotsRow}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={[
                styles.dot,
                currentStep >= step && styles.dotActive,
                currentStep === step && styles.dotCurrent,
              ]}
            />
          ))}
        </View>
        <View style={styles.bottomButtons}>
          {currentStep > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBack}
              activeOpacity={0.7}>
              <FeatherIcon name="arrow-left" size={18} color={TEXT_PRIMARY} />
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          {isLastStep ? (
            <AnimatedTouchable
              style={[styles.nextButton, styles.createButton, createAnimStyle]}
              onPress={handleCreate}
              onPressIn={handleCreatePressIn}
              onPressOut={handleCreatePressOut}
              activeOpacity={0.85}>
              <Icon name="check" size={20} color="#FFFFFF" style={{ marginRight: 6 }} />
              <Text style={styles.nextButtonText}>Create Alert</Text>
            </AnimatedTouchable>
          ) : (
            <TouchableOpacity
              style={[
                styles.nextButton,
                currentStep === 1 && !canProceedStep1 && styles.nextButtonDisabled,
              ]}
              onPress={goNext}
              activeOpacity={0.85}
              disabled={currentStep === 1 && !canProceedStep1}>
              <Text style={styles.nextButtonText}>Next</Text>
              <FeatherIcon name="arrow-right" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BACKGROUND,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: BACKGROUND,
  },
  headerBackButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  headerTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    flex: 1,
    textAlign: 'center',
  },
  stepIndicator: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: PRIMARY + '14',
  },
  stepIndicatorText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 12,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Progress bar
  progressBarTrack: {
    height: 3,
    backgroundColor: BORDER,
    marginHorizontal: 20,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: PRIMARY,
    borderRadius: 2,
  },

  // Scroll content
  scrollContent: {
    padding: 20,
    paddingBottom: 140,
  },

  // Section
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  requiredAsterisk: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    color: DANGER,
  },

  // Text input
  textInput: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    height: 52,
    paddingHorizontal: 16,
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },

  // Tag input
  tagInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  tagInput: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    height: 48,
    paddingHorizontal: 16,
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  addButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    backgroundColor: PRIMARY + '40',
  },
  addButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Suggestions
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: PRIMARY + '0A',
    borderWidth: 1,
    borderColor: PRIMARY + '30',
    gap: 4,
  },
  suggestionText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Keyword pills
  keywordPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  keywordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY + '14',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  keywordPillText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Chips
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  chipSelected: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  chipTextSelected: {
    fontFamily: fontFamilies.semiBold,
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // State chips
  stateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  stateChipSelected: {
    backgroundColor: SECONDARY,
    borderColor: SECONDARY,
  },
  stateChipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  stateChipTextSelected: {
    color: '#FFFFFF',
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
  },
  stateSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 10,
    height: 40,
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 10,
  },
  stateSearchInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    height: '100%',
  },
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 4,
  },
  showAllText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Org input
  orgSuggestions: {
    backgroundColor: CARD_BG,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    marginTop: 4,
    overflow: 'hidden',
  },
  orgSuggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    gap: 10,
  },
  orgSuggestionText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },

  // Radio cards
  radioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  radioCardActive: {
    borderColor: PRIMARY,
    backgroundColor: PRIMARY + '06',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  radioCircleActive: {
    borderColor: PRIMARY,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
  radioContent: {
    flex: 1,
  },
  radioTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  radioLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  radioLabelActive: {
    color: PRIMARY,
  },
  radioDescription: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    marginLeft: 22,
  },

  // Channel card
  channelCard: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
  },
  channelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  channelIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  channelInfo: {
    flex: 1,
  },
  channelLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },
  channelDivider: {
    height: 1,
    backgroundColor: BORDER,
    marginLeft: 62,
  },
  lockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  lockText: {
    fontFamily: fontFamilies.regular,
    fontSize: 11,
    fontWeight: '400',
    color: TEXT_MUTED,
  },

  // Preview
  previewCard: {
    flexDirection: 'row',
    backgroundColor: ACCENT + '0D',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: ACCENT + '30',
    gap: 10,
  },
  previewText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    lineHeight: 22,
    flex: 1,
  },

  // Bottom bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: CARD_BG,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BORDER,
  },
  dotActive: {
    backgroundColor: PRIMARY + '40',
  },
  dotCurrent: {
    backgroundColor: PRIMARY,
    width: 24,
  },
  bottomButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: BACKGROUND,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 6,
  },
  backButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  nextButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    gap: 6,
  },
  nextButtonDisabled: {
    backgroundColor: PRIMARY + '50',
  },
  nextButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  createButton: {
    backgroundColor: ACCENT,
  },
});
