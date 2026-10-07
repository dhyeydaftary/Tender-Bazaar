/**
 * TenderBazaar -- FilterScreen (Premium)
 *
 * Full filter screen: category chips, state multi-select with search,
 * value range presets + custom inputs, deadline quick options, status chips,
 * source portal multi-select, sort-by radio buttons, animated bottom bar.
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';

import { CATEGORIES, INDIAN_STATES } from '../../utils/constants';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIMARY = '#FF6B35';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const TEXT_MUTED = '#9CA3AF';
const BORDER = '#E8ECF1';
const SUCCESS = '#22C55E';
const WARNING = '#F59E0B';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeadlineOption = 'Today' | 'This Week' | 'This Month' | 'Next 30 Days' | 'Custom';
type StatusOption = 'Active' | 'Closed' | 'Awarded' | 'All';
type SortByOption = 'relevance' | 'newest' | 'deadline_soonest' | 'value_high' | 'value_low';

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const VALUE_PRESETS = [
  { label: 'Under \u20B910L', key: 'under_10l' },
  { label: '\u20B910L - \u20B91Cr', key: '10l_1cr' },
  { label: '\u20B91Cr - \u20B910Cr', key: '1cr_10cr' },
  { label: '\u20B910Cr - \u20B9100Cr', key: '10cr_100cr' },
  { label: '\u20B9100Cr+', key: 'above_100cr' },
];

const DEADLINE_OPTIONS: DeadlineOption[] = [
  'Today',
  'This Week',
  'This Month',
  'Next 30 Days',
  'Custom',
];

const STATUS_OPTIONS: { label: StatusOption; color: string }[] = [
  { label: 'Active', color: SUCCESS },
  { label: 'Closed', color: TEXT_MUTED },
  { label: 'Awarded', color: WARNING },
  { label: 'All', color: TEXT_SECONDARY },
];

const SOURCE_PORTALS = ['CPPP', 'GeM', 'State Portal', 'IREPS', 'MSTC', 'Other'];

const SORT_BY_OPTIONS: { label: string; value: SortByOption }[] = [
  { label: 'Relevance', value: 'relevance' },
  { label: 'Newest First', value: 'newest' },
  { label: 'Deadline (Soonest)', value: 'deadline_soonest' },
  { label: 'Value (High to Low)', value: 'value_high' },
  { label: 'Value (Low to High)', value: 'value_low' },
];

const STATES_COLLAPSED_COUNT = 8;

const CHIP_SPRING = { damping: 15, stiffness: 400, mass: 0.4 };

// ---------------------------------------------------------------------------
// Animated Chip -- press scale + haptic
// ---------------------------------------------------------------------------

const AnimatedChip = React.memo(({
  label,
  isSelected,
  onPress,
  selectedBg = PRIMARY,
  selectedTextColor = '#FFFFFF',
  iconName,
  iconColor,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
  selectedBg?: string;
  selectedTextColor?: string;
  iconName?: string;
  iconColor?: string;
}) => {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, CHIP_SPRING);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, CHIP_SPRING);
  }, [scale]);

  const handlePress = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    onPress();
  }, [onPress]);

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.chip,
          isSelected && { backgroundColor: selectedBg, borderColor: selectedBg },
        ]}
      >
        {iconName && (
          <Icon
            name={iconName}
            size={16}
            color={isSelected ? selectedTextColor : (iconColor || TEXT_SECONDARY)}
          />
        )}
        <Text
          style={[
            styles.chipText,
            isSelected && { color: selectedTextColor, fontWeight: '600' },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Filter Section Wrapper -- staggered entrance
// ---------------------------------------------------------------------------

const FilterSection = React.memo(({
  title,
  index,
  badge,
  children,
}: {
  title: string;
  index: number;
  badge?: string;
  children: React.ReactNode;
}) => (
  <Animated.View
    entering={FadeInDown.delay(index * 50).duration(300).easing(Easing.out(Easing.cubic))}
    style={styles.section}
  >
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {badge && (
        <View style={styles.sectionBadge}>
          <Text style={styles.sectionBadgeText}>{badge}</Text>
        </View>
      )}
    </View>
    {children}
  </Animated.View>
));

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function FilterScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  // Filter state
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [stateSearchQuery, setStateSearchQuery] = useState('');
  const [statesExpanded, setStatesExpanded] = useState(false);
  const [selectedValuePreset, setSelectedValuePreset] = useState<string | null>(null);
  const [customMinValue, setCustomMinValue] = useState('');
  const [customMaxValue, setCustomMaxValue] = useState('');
  const [selectedDeadline, setSelectedDeadline] = useState<DeadlineOption | null>(null);
  const [customFromDate, setCustomFromDate] = useState('');
  const [customToDate, setCustomToDate] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<StatusOption>('Active');
  const [selectedPortals, setSelectedPortals] = useState<string[]>([]);
  const [selectedSortBy, setSelectedSortBy] = useState<SortByOption>('relevance');

  // Bottom button pulse animation
  const buttonPulse = useSharedValue(1);

  // Total active filters count
  const totalFilters = useMemo(() => {
    let count = 0;
    if (selectedCategories.length > 0) count++;
    if (selectedStates.length > 0) count++;
    if (selectedValuePreset || customMinValue || customMaxValue) count++;
    if (selectedDeadline) count++;
    if (selectedStatus !== 'Active' && selectedStatus !== 'All') count++;
    if (selectedPortals.length > 0) count++;
    if (selectedSortBy !== 'relevance') count++;
    return count;
  }, [
    selectedCategories, selectedStates, selectedValuePreset,
    customMinValue, customMaxValue, selectedDeadline, selectedStatus,
    selectedPortals, selectedSortBy,
  ]);

  // Mock result count -- dynamically changes based on filter selections
  const mockResultCount = useMemo(() => {
    let base = 247;
    if (selectedCategories.length > 0) base = Math.round(base * 0.7);
    if (selectedStates.length > 0) {
      base = Math.round(base * (0.3 + selectedStates.length * 0.05));
    }
    if (selectedValuePreset) base = Math.round(base * 0.5);
    if (selectedDeadline) base = Math.round(base * 0.6);
    if (selectedPortals.length > 0) base = Math.round(base * 0.4);
    return Math.max(base, 12);
  }, [selectedCategories, selectedStates, selectedValuePreset, selectedDeadline, selectedPortals]);

  // Pulse the apply button when filters change
  useEffect(() => {
    buttonPulse.value = withSpring(1.03, {
      damping: 8,
      stiffness: 300,
      mass: 0.3,
    });
    const timeout = setTimeout(() => {
      buttonPulse.value = withSpring(1, CHIP_SPRING);
    }, 200);
    return () => clearTimeout(timeout);
  }, [totalFilters, buttonPulse]);

  const buttonPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonPulse.value }],
  }));

  // ---------------------------------------------------------------------------
  // Toggle helpers
  // ---------------------------------------------------------------------------

  const toggleCategory = useCallback((value: string) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedCategories((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }, []);

  const toggleState = useCallback((state: string) => {
    setSelectedStates((prev) =>
      prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state],
    );
  }, []);

  const toggleSelectAllStates = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight');
    if (selectedStates.length === INDIAN_STATES.length) {
      setSelectedStates([]);
    } else {
      setSelectedStates([...INDIAN_STATES]);
    }
  }, [selectedStates.length]);

  const togglePortal = useCallback((portal: string) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedPortals((prev) =>
      prev.includes(portal) ? prev.filter((p) => p !== portal) : [...prev, portal],
    );
  }, []);

  const handleValuePreset = useCallback((key: string) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedValuePreset((prev) => (prev === key ? null : key));
    setCustomMinValue('');
    setCustomMaxValue('');
  }, []);

  const handleDeadlineSelect = useCallback((option: DeadlineOption) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedDeadline((prev) => (prev === option ? null : option));
    if (option !== 'Custom') {
      setCustomFromDate('');
      setCustomToDate('');
    }
  }, []);

  const handleStatusSelect = useCallback((status: StatusOption) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedStatus(status);
  }, []);

  const handleSortBySelect = useCallback((value: SortByOption) => {
    ReactNativeHapticFeedback.trigger('impactLight');
    setSelectedSortBy(value);
  }, []);

  const resetAll = useCallback(() => {
    ReactNativeHapticFeedback.trigger('notificationWarning');
    setSelectedCategories([]);
    setSelectedStates([]);
    setStateSearchQuery('');
    setStatesExpanded(false);
    setSelectedValuePreset(null);
    setCustomMinValue('');
    setCustomMaxValue('');
    setSelectedDeadline(null);
    setCustomFromDate('');
    setCustomToDate('');
    setSelectedStatus('Active');
    setSelectedPortals([]);
    setSelectedSortBy('relevance');
  }, []);

  const handleApply = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactMedium');
    navigation.goBack();
  }, [navigation]);

  // ---------------------------------------------------------------------------
  // Computed state lists
  // ---------------------------------------------------------------------------

  const filteredStates = useMemo(() => {
    if (!stateSearchQuery.trim()) return [...INDIAN_STATES];
    const q = stateSearchQuery.toLowerCase();
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [stateSearchQuery]);

  const visibleStates = useMemo(
    () => (statesExpanded ? filteredStates : filteredStates.slice(0, STATES_COLLAPSED_COUNT)),
    [filteredStates, statesExpanded],
  );

  const hasMoreStates = filteredStates.length > STATES_COLLAPSED_COUNT;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ---- Header ---- */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={styles.headerBackButton}
        >
          <Icon name="arrow-left" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Filters</Text>
          {totalFilters > 0 && (
            <View style={styles.headerFilterBadge}>
              <Text style={styles.headerFilterBadgeText}>{totalFilters} active</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={resetAll} activeOpacity={0.7}>
          <Text style={styles.headerResetText}>Reset All</Text>
        </TouchableOpacity>
      </View>

      {/* ---- Filter Sections ---- */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* 1. Category */}
        <FilterSection title="Category" index={0}>
          <View style={styles.chipsRow}>
            {CATEGORIES.map((cat) => (
              <AnimatedChip
                key={cat.value}
                label={cat.label}
                isSelected={selectedCategories.includes(cat.value)}
                onPress={() => toggleCategory(cat.value)}
              />
            ))}
          </View>
        </FilterSection>

        {/* 2. State */}
        <FilterSection
          title="State"
          index={1}
          badge={selectedStates.length > 0 ? `${selectedStates.length} selected` : undefined}
        >
          {/* State search input */}
          <View style={styles.stateSearchBar}>
            <Icon name="magnify" size={18} color={TEXT_MUTED} />
            <TextInput
              style={styles.stateSearchInput}
              placeholder="Search states..."
              placeholderTextColor={TEXT_MUTED}
              value={stateSearchQuery}
              onChangeText={setStateSearchQuery}
              autoCorrect={false}
            />
            {stateSearchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setStateSearchQuery('')}
                activeOpacity={0.6}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Icon name="close-circle" size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
            )}
          </View>

          {/* Select All toggle */}
          <TouchableOpacity
            style={styles.selectAllRow}
            onPress={toggleSelectAllStates}
            activeOpacity={0.7}
          >
            <Icon
              name={
                selectedStates.length === INDIAN_STATES.length
                  ? 'checkbox-marked'
                  : selectedStates.length > 0
                    ? 'minus-box'
                    : 'checkbox-blank-outline'
              }
              size={22}
              color={selectedStates.length > 0 ? PRIMARY : TEXT_SECONDARY}
            />
            <Text style={styles.selectAllText}>Select All</Text>
          </TouchableOpacity>

          {/* States checklist in 2 columns */}
          <View style={styles.statesGrid}>
            {visibleStates.map((state) => {
              const isSelected = selectedStates.includes(state);
              return (
                <TouchableOpacity
                  key={state}
                  style={styles.stateItem}
                  onPress={() => toggleState(state)}
                  activeOpacity={0.7}
                >
                  <Icon
                    name={isSelected ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={18}
                    color={isSelected ? PRIMARY : TEXT_MUTED}
                  />
                  <Text
                    style={[
                      styles.stateItemText,
                      isSelected && styles.stateItemTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {state}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Expand / collapse */}
          {hasMoreStates && !stateSearchQuery && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => setStatesExpanded((prev) => !prev)}
              activeOpacity={0.7}
            >
              <Text style={styles.showAllText}>
                {statesExpanded ? 'Show less' : `Show all ${INDIAN_STATES.length} states`}
              </Text>
              <Icon
                name={statesExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={PRIMARY}
              />
            </TouchableOpacity>
          )}
        </FilterSection>

        {/* 3. Value Range */}
        <FilterSection title="Estimated Value" index={2}>
          <View style={styles.chipsRow}>
            {VALUE_PRESETS.map((preset) => (
              <AnimatedChip
                key={preset.key}
                label={preset.label}
                isSelected={selectedValuePreset === preset.key}
                onPress={() => handleValuePreset(preset.key)}
              />
            ))}
          </View>

          {/* Custom range inputs */}
          <View style={styles.customRangeContainer}>
            <Text style={styles.customRangeLabel}>Or custom range:</Text>
            <View style={styles.customRangeInputs}>
              <View style={styles.customRangeInputWrapper}>
                <Text style={styles.currencyPrefix}>{'\u20B9'}</Text>
                <TextInput
                  style={styles.customRangeInput}
                  placeholder="Min Value"
                  placeholderTextColor={TEXT_MUTED}
                  value={customMinValue}
                  onChangeText={(text) => {
                    setCustomMinValue(text);
                    setSelectedValuePreset(null);
                  }}
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.rangeDash}>to</Text>
              <View style={styles.customRangeInputWrapper}>
                <Text style={styles.currencyPrefix}>{'\u20B9'}</Text>
                <TextInput
                  style={styles.customRangeInput}
                  placeholder="Max Value"
                  placeholderTextColor={TEXT_MUTED}
                  value={customMaxValue}
                  onChangeText={(text) => {
                    setCustomMaxValue(text);
                    setSelectedValuePreset(null);
                  }}
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>
        </FilterSection>

        {/* 4. Deadline */}
        <FilterSection title="Deadline" index={3}>
          <View style={styles.chipsRow}>
            {DEADLINE_OPTIONS.map((option) => (
              <AnimatedChip
                key={option}
                label={option}
                isSelected={selectedDeadline === option}
                onPress={() => handleDeadlineSelect(option)}
              />
            ))}
          </View>

          {/* Custom date pickers (mock touchable) */}
          {selectedDeadline === 'Custom' && (
            <View style={styles.customDateContainer}>
              <TouchableOpacity style={styles.datePickerButton} activeOpacity={0.7}>
                <Icon name="calendar-start" size={18} color={TEXT_SECONDARY} />
                <Text
                  style={[
                    styles.datePickerText,
                    !customFromDate && styles.datePickerPlaceholder,
                  ]}
                >
                  {customFromDate || 'From date'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.rangeDash}>to</Text>
              <TouchableOpacity style={styles.datePickerButton} activeOpacity={0.7}>
                <Icon name="calendar-end" size={18} color={TEXT_SECONDARY} />
                <Text
                  style={[
                    styles.datePickerText,
                    !customToDate && styles.datePickerPlaceholder,
                  ]}
                >
                  {customToDate || 'To date'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </FilterSection>

        {/* 5. Status */}
        <FilterSection title="Status" index={4}>
          <View style={styles.chipsRow}>
            {STATUS_OPTIONS.map((option) => {
              const isActive = selectedStatus === option.label;
              return (
                <AnimatedChip
                  key={option.label}
                  label={option.label}
                  isSelected={isActive}
                  onPress={() => handleStatusSelect(option.label)}
                  selectedBg={isActive ? option.color : undefined}
                  iconName={
                    option.label === 'Active'
                      ? 'check-circle-outline'
                      : option.label === 'Closed'
                        ? 'close-circle-outline'
                        : option.label === 'Awarded'
                          ? 'star-circle-outline'
                          : 'checkbox-multiple-blank-circle-outline'
                  }
                  iconColor={option.color}
                />
              );
            })}
          </View>
        </FilterSection>

        {/* 6. Source Portal */}
        <FilterSection title="Source Portal" index={5}>
          <View style={styles.chipsRow}>
            {SOURCE_PORTALS.map((portal) => (
              <AnimatedChip
                key={portal}
                label={portal}
                isSelected={selectedPortals.includes(portal)}
                onPress={() => togglePortal(portal)}
              />
            ))}
          </View>
        </FilterSection>

        {/* 7. Sort By */}
        <FilterSection title="Sort By" index={6}>
          <View style={styles.radioGroup}>
            {SORT_BY_OPTIONS.map((option) => {
              const isActive = selectedSortBy === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={styles.radioRow}
                  onPress={() => handleSortBySelect(option.value)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.radioOuter, isActive && styles.radioOuterSelected]}>
                    {isActive && <View style={styles.radioInner} />}
                  </View>
                  <Text style={[styles.radioLabel, isActive && styles.radioLabelSelected]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </FilterSection>

        {/* Bottom spacer for fixed bar + floating tab bar */}
        <View style={{ height: 140 }} />
      </ScrollView>

      {/* ---- Bottom Fixed Bar ---- */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 20) + 100 }]}>
        <Animated.View style={[styles.bottomBarInner, buttonPulseStyle]}>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={handleApply}
            activeOpacity={0.85}
          >
            <Text style={styles.applyButtonText}>
              Show {mockResultCount} Results
            </Text>
          </TouchableOpacity>
        </Animated.View>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    backgroundColor: CARD_BG,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BACKGROUND,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerFilterBadge: {
    backgroundColor: PRIMARY + '18',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  headerFilterBadgeText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: PRIMARY,
  },
  headerResetText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Scroll Content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sectionBadge: {
    backgroundColor: PRIMARY + '18',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    fontFamily: fontFamilies.medium,
    fontSize: 12,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Chips
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: CARD_BG,
    borderWidth: 1.5,
    borderColor: BORDER,
    gap: 6,
  },
  chipText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },

  // State Search
  stateSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    height: 40,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
    marginBottom: 12,
  },
  stateSearchInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    height: '100%',
    paddingVertical: 0,
  },

  // Select All
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
    marginBottom: 8,
  },
  selectAllText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_PRIMARY,
  },

  // States Grid (2 columns)
  statesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  stateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '50%',
    paddingVertical: 8,
    gap: 8,
  },
  stateItemText: {
    fontFamily: fontFamilies.regular,
    fontSize: 13,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  stateItemTextSelected: {
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Show All / Show Less
  showAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 4,
    marginTop: 4,
  },
  showAllText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Value Range
  customRangeContainer: {
    marginTop: 14,
  },
  customRangeLabel: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
    marginBottom: 8,
  },
  customRangeInputs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  customRangeInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  currencyPrefix: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginRight: 4,
  },
  customRangeInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    height: '100%',
    paddingVertical: 0,
  },
  rangeDash: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_MUTED,
  },

  // Custom Date Pickers
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
  },
  datePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 8,
  },
  datePickerText: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  datePickerPlaceholder: {
    color: TEXT_MUTED,
  },

  // Radio Group
  radioGroup: {
    gap: 4,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: PRIMARY,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
  },
  radioLabel: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_PRIMARY,
  },
  radioLabelSelected: {
    fontFamily: fontFamilies.medium,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Bottom Fixed Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: CARD_BG,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    ...shadows.lg,
  },
  bottomBarInner: {
    width: '100%',
  },
  applyButton: {
    height: 54,
    borderRadius: 16,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  applyButtonText: {
    fontFamily: fontFamilies.bold,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
});
