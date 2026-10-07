/**
 * TenderBazaar -- SavedScreen (Premium)
 *
 * Saved tenders list with category filter chips, sort options,
 * swipe-to-unsave, pull-to-refresh, staggered entrance animations.
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  RefreshControl,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  FadeIn,
  FadeOut,
  SlideOutLeft,
  Layout,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import type { RootStackParamList } from '../../types/navigation';
import TenderCard from '../../components/tender/TenderCard';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';
import { useSavedStore } from '../../stores/savedStore';
import { formatCurrency } from '../../utils/format';
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

type NavProp = NativeStackNavigationProp<RootStackParamList>;

// ---------------------------------------------------------------------------
// Filter chips
// ---------------------------------------------------------------------------

const FILTER_CHIPS = [
  { key: 'all', label: 'All' },
  { key: 'Works', label: 'Works' },
  { key: 'Goods', label: 'Goods' },
  { key: 'Services', label: 'Services' },
  { key: 'Consultancy', label: 'Consultancy' },
] as const;

// ---------------------------------------------------------------------------
// Sort options
// ---------------------------------------------------------------------------

type SortOption = 'saved_newest' | 'deadline_soonest' | 'value_highest' | 'name_az';

const SORT_OPTIONS: { key: SortOption; label: string; icon: string }[] = [
  { key: 'saved_newest', label: 'Saved Date (Newest)', icon: 'clock-outline' },
  { key: 'deadline_soonest', label: 'Deadline (Soonest)', icon: 'calendar-clock' },
  { key: 'value_highest', label: 'Value (Highest)', icon: 'currency-inr' },
  { key: 'name_az', label: 'Name (A-Z)', icon: 'sort-alphabetical-ascending' },
];

// ---------------------------------------------------------------------------
// Mock tender interface matching TenderCard's expected shape
// ---------------------------------------------------------------------------

interface SavedTenderItem {
  id: string;
  title: string;
  organization: string;
  state: string;
  category: 'Works' | 'Goods' | 'Services' | 'Consultancy';
  estimatedValue: number;
  emdAmount: number;
  submissionDeadline: string;
  publishedDate: string;
  status: 'ACTIVE' | 'CLOSED' | 'AWARDED' | 'CANCELLED';
  sourcePortal: string;
  referenceNumber: string;
  savedAt: string; // ISO date for sort
}

// ---------------------------------------------------------------------------
// Mock data — 8 realistic Indian government tenders
// ---------------------------------------------------------------------------

const MOCK_SAVED_TENDERS: SavedTenderItem[] = [
  {
    id: 'sv-1',
    title: 'Construction of 4-Lane Highway NH-48 Section Ahmedabad to Vadodara',
    organization: 'NHAI',
    state: 'Gujarat',
    category: 'Works',
    estimatedValue: 452000000,
    emdAmount: 9040000,
    submissionDeadline: '2026-04-25T17:00:00Z',
    publishedDate: '2026-04-05T10:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'CPPP',
    referenceNumber: 'NHAI/GJ/2026/0412',
    savedAt: '2026-04-11T08:30:00Z',
  },
  {
    id: 'sv-2',
    title: 'Supply & Installation of Cryogenic Engine Test Facility Equipment',
    organization: 'ISRO',
    state: 'Karnataka',
    category: 'Goods',
    estimatedValue: 185000000,
    emdAmount: 3700000,
    submissionDeadline: '2026-04-28T15:00:00Z',
    publishedDate: '2026-04-03T09:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'GeM',
    referenceNumber: 'ISRO/VSSC/2026/CR-87',
    savedAt: '2026-04-10T14:15:00Z',
  },
  {
    id: 'sv-3',
    title: 'EPC Contract for 765kV Transmission Line Raipur-Wardha Section',
    organization: 'Power Grid Corporation',
    state: 'Maharashtra',
    category: 'Works',
    estimatedValue: 890000000,
    emdAmount: 17800000,
    submissionDeadline: '2026-05-02T17:00:00Z',
    publishedDate: '2026-04-01T11:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'CPPP',
    referenceNumber: 'PGCIL/TL/2026/WR-23',
    savedAt: '2026-04-09T16:45:00Z',
  },
  {
    id: 'sv-4',
    title: 'Maintenance of Rolling Stock for Vande Bharat Express Fleet',
    organization: 'Indian Railways',
    state: 'Delhi',
    category: 'Services',
    estimatedValue: 320000000,
    emdAmount: 6400000,
    submissionDeadline: '2026-04-22T14:00:00Z',
    publishedDate: '2026-04-02T08:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'IREPS',
    referenceNumber: 'IR/RS/VB/2026/045',
    savedAt: '2026-04-08T10:30:00Z',
  },
  {
    id: 'sv-5',
    title: 'Consultancy for DPR Preparation of Yamuna Floodplain Rejuvenation',
    organization: 'Delhi Jal Board',
    state: 'Delhi',
    category: 'Consultancy',
    estimatedValue: 45000000,
    emdAmount: 900000,
    submissionDeadline: '2026-04-30T17:00:00Z',
    publishedDate: '2026-04-06T10:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'State Portal',
    referenceNumber: 'DJB/CON/2026/YFR-03',
    savedAt: '2026-04-07T09:00:00Z',
  },
  {
    id: 'sv-6',
    title: 'Design & Build of 150 MLD Sewage Treatment Plant Surat',
    organization: 'Gujarat Water Supply & Sewerage Board',
    state: 'Gujarat',
    category: 'Works',
    estimatedValue: 560000000,
    emdAmount: 11200000,
    submissionDeadline: '2026-05-05T17:00:00Z',
    publishedDate: '2026-04-04T10:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'State Portal',
    referenceNumber: 'GWSSB/STP/2026/SRT-07',
    savedAt: '2026-04-06T11:20:00Z',
  },
  {
    id: 'sv-7',
    title: 'Construction of Grade Separator at Hinjewadi Junction Pune',
    organization: 'Maharashtra PWD',
    state: 'Maharashtra',
    category: 'Works',
    estimatedValue: 275000000,
    emdAmount: 5500000,
    submissionDeadline: '2026-04-20T17:00:00Z',
    publishedDate: '2026-03-28T10:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'State Portal',
    referenceNumber: 'MPWD/RB/2026/PN-112',
    savedAt: '2026-04-05T15:45:00Z',
  },
  {
    id: 'sv-8',
    title: 'Supply of Office Furniture for New Parliament Complex Annexe',
    organization: 'CPWD',
    state: 'Delhi',
    category: 'Goods',
    estimatedValue: 78000000,
    emdAmount: 1560000,
    submissionDeadline: '2026-04-18T15:00:00Z',
    publishedDate: '2026-03-30T09:00:00Z',
    status: 'ACTIVE',
    sourcePortal: 'CPPP',
    referenceNumber: 'CPWD/FURN/2026/NPC-09',
    savedAt: '2026-04-04T13:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Animated Components
// ---------------------------------------------------------------------------

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ---------------------------------------------------------------------------
// FilterChip
// ---------------------------------------------------------------------------

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  index: number;
}

const FilterChip: React.FC<FilterChipProps> = React.memo(
  ({ label, selected, onPress, index }) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      scale.value = withSpring(0.93, { damping: 15, stiffness: 400 });
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, { damping: 15, stiffness: 400 });
    }, [scale]);

    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={0.85}
        style={[
          styles.filterChip,
          selected ? styles.filterChipSelected : styles.filterChipDefault,
          animatedStyle,
        ]}>
        <Text
          style={[
            styles.filterChipText,
            selected ? styles.filterChipTextSelected : styles.filterChipTextDefault,
          ]}>
          {label}
        </Text>
      </AnimatedTouchable>
    );
  },
);

// ---------------------------------------------------------------------------
// SwipeableSavedCard
// ---------------------------------------------------------------------------

interface SwipeableCardProps {
  item: SavedTenderItem;
  index: number;
  onPress: () => void;
  onUnsave: () => void;
}

const SwipeableCard: React.FC<SwipeableCardProps> = React.memo(
  ({ item, index, onPress, onUnsave }) => {
    const translateX = useSharedValue(0);
    const isSwiping = useRef(false);

    const handleUnsave = useCallback(() => {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      onUnsave();
    }, [onUnsave]);

    return (
      <Animated.View
        entering={FadeIn.delay(index * 60).duration(400)}
        exiting={SlideOutLeft.duration(300)}
        layout={Layout.springify().damping(18).stiffness(200)}
        style={styles.swipeableWrapper}>
        {/* Unsave action behind card */}
        <View style={styles.swipeAction}>
          <TouchableOpacity
            style={styles.unsaveAction}
            onPress={handleUnsave}
            activeOpacity={0.8}>
            <Icon name="bookmark-remove" size={22} color="#FFFFFF" />
            <Text style={styles.unsaveActionText}>Unsave</Text>
          </TouchableOpacity>
        </View>

        {/* Tender card */}
        <View style={styles.cardContainer}>
          <TenderCard
            tender={item}
            onPress={onPress}
            onSave={handleUnsave}
            isSaved={true}
          />
        </View>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// SortSheet
// ---------------------------------------------------------------------------

interface SortSheetProps {
  visible: boolean;
  currentSort: SortOption;
  onSelect: (sort: SortOption) => void;
  onClose: () => void;
}

const SortSheet: React.FC<SortSheetProps> = React.memo(
  ({ visible, currentSort, onSelect, onClose }) => {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={onClose}>
        <Pressable style={styles.sheetOverlay} onPress={onClose}>
          <Pressable style={styles.sheetContainer} onPress={() => {}}>
            {/* Handle */}
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Sort By</Text>

            {SORT_OPTIONS.map((option) => {
              const isActive = currentSort === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  style={[styles.sortOption, isActive && styles.sortOptionActive]}
                  onPress={() => {
                    ReactNativeHapticFeedback.trigger('selection', {
                      enableVibrateFallback: true,
                      ignoreAndroidSystemSettings: false,
                    });
                    onSelect(option.key);
                  }}
                  activeOpacity={0.7}>
                  <View style={[styles.sortIconCircle, isActive && styles.sortIconCircleActive]}>
                    <Icon
                      name={option.icon}
                      size={20}
                      color={isActive ? '#FFFFFF' : TEXT_SECONDARY}
                    />
                  </View>
                  <Text style={[styles.sortOptionText, isActive && styles.sortOptionTextActive]}>
                    {option.label}
                  </Text>
                  {isActive && (
                    <Icon name="check" size={20} color={PRIMARY} />
                  )}
                </TouchableOpacity>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    );
  },
);

// ---------------------------------------------------------------------------
// EmptyState
// ---------------------------------------------------------------------------

interface EmptyStateProps {
  onBrowse: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = React.memo(({ onBrowse }) => {
  const iconScale = useSharedValue(0);

  useEffect(() => {
    iconScale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 200 }));
  }, [iconScale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value }],
  }));

  return (
    <View style={styles.emptyContainer}>
      <Animated.View style={[styles.emptyIconCircle, iconStyle]}>
        <Icon name="bookmark-outline" size={56} color={TEXT_MUTED} />
      </Animated.View>
      <Text style={styles.emptyTitle}>No saved tenders yet</Text>
      <Text style={styles.emptySubtitle}>
        Browse tenders and tap the bookmark icon to save them here
      </Text>
      <TouchableOpacity
        style={styles.browseButton}
        onPress={onBrowse}
        activeOpacity={0.85}>
        <FeatherIcon name="search" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
        <Text style={styles.browseButtonText}>Browse Tenders</Text>
      </TouchableOpacity>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SavedScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const { isSaved, removeSaved } = useSavedStore();

  const [tenders, setTenders] = useState<SavedTenderItem[]>(MOCK_SAVED_TENDERS);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortOption>('saved_newest');
  const [showSortSheet, setShowSortSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Subscription limit check
  const checkLimit = useSubscriptionStore((s) => s.checkLimit);
  const savedLimit = checkLimit('maxSavedTenders');

  // --- Filtering ---
  const filteredTenders = useMemo(() => {
    let result = tenders;
    if (activeFilter !== 'all') {
      result = result.filter((t) => t.category === activeFilter);
    }
    return result;
  }, [tenders, activeFilter]);

  // --- Sorting ---
  const sortedTenders = useMemo(() => {
    const sorted = [...filteredTenders];
    switch (sortBy) {
      case 'saved_newest':
        sorted.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
        break;
      case 'deadline_soonest':
        sorted.sort(
          (a, b) =>
            new Date(a.submissionDeadline).getTime() - new Date(b.submissionDeadline).getTime(),
        );
        break;
      case 'value_highest':
        sorted.sort((a, b) => b.estimatedValue - a.estimatedValue);
        break;
      case 'name_az':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [filteredTenders, sortBy]);

  // --- Handlers ---
  const handleUnsave = useCallback(
    (id: string) => {
      ReactNativeHapticFeedback.trigger('impactMedium', {
        enableVibrateFallback: true,
        ignoreAndroidSystemSettings: false,
      });
      removeSaved(id);
      setTenders((prev) => prev.filter((t) => t.id !== id));
    },
    [removeSaved],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1200);
  }, []);

  const handleFilterPress = useCallback((key: string) => {
    ReactNativeHapticFeedback.trigger('selection', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    });
    setActiveFilter(key);
  }, []);

  const handleSortSelect = useCallback((sort: SortOption) => {
    setSortBy(sort);
    setShowSortSheet(false);
  }, []);

  const handleBrowse = useCallback(() => {
    navigation.navigate('Main', { screen: 'SearchTab' });
  }, [navigation]);

  // --- Render helpers ---
  const renderItem = useCallback(
    ({ item, index }: { item: SavedTenderItem; index: number }) => (
      <SwipeableCard
        item={item}
        index={index}
        onPress={() => navigation.navigate('TenderDetail', { id: item.id })}
        onUnsave={() => handleUnsave(item.id)}
      />
    ),
    [navigation, handleUnsave],
  );

  const keyExtractor = useCallback((item: SavedTenderItem) => item.id, []);

  const renderEmpty = useCallback(
    () => <EmptyState onBrowse={handleBrowse} />,
    [handleBrowse],
  );

  // --- Stats bar ---
  const savedCount = tenders.length;
  const currentSortLabel = SORT_OPTIONS.find((o) => o.key === sortBy)?.label ?? '';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* ---- Header ---- */}
      <View style={styles.header}>
        <View style={styles.headerSpacer} />
        <Text style={styles.headerTitle}>Saved Tenders</Text>
        <TouchableOpacity
          style={styles.sortButton}
          onPress={() => setShowSortSheet(true)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="sort-variant" size={22} color={TEXT_PRIMARY} />
        </TouchableOpacity>
      </View>

      {/* ---- Limit banner ---- */}
      {!savedLimit.hasCapacity && !savedLimit.isUnlimited && (
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <UpgradeBanner
            feature="Saved Tenders"
            requiredPlan="Starter"
            variant="inline"
          />
        </View>
      )}

      {/* ---- Stats bar + filter chips ---- */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          {savedCount} saved tender{savedCount !== 1 ? 's' : ''}
          {!savedLimit.isUnlimited && ` / ${savedLimit.limit} max`}
        </Text>
      </View>

      <View style={styles.filterRow}>
        <FlatList
          horizontal
          data={FILTER_CHIPS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterListContent}
          renderItem={({ item, index }) => (
            <FilterChip
              label={item.label}
              selected={activeFilter === item.key}
              onPress={() => handleFilterPress(item.key)}
              index={index}
            />
          )}
        />
      </View>

      {/* ---- List ---- */}
      <FlatList
        data={sortedTenders}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={[
          styles.listContent,
          sortedTenders.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={PRIMARY}
            colors={[PRIMARY]}
          />
        }
      />

      {/* ---- Sort Sheet ---- */}
      <SortSheet
        visible={showSortSheet}
        currentSort={sortBy}
        onSelect={handleSortSelect}
        onClose={() => setShowSortSheet(false)}
      />
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
    paddingTop: 16,
    paddingBottom: 4,
  },
  headerSpacer: {
    width: 32,
  },
  headerTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    textAlign: 'center',
  },
  sortButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats bar
  statsBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  statsText: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },

  // Filter chips
  filterRow: {
    paddingVertical: 10,
  },
  filterListContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterChipSelected: {
    backgroundColor: PRIMARY,
  },
  filterChipDefault: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 13,
    fontWeight: '600',
  },
  filterChipTextSelected: {
    color: '#FFFFFF',
  },
  filterChipTextDefault: {
    color: TEXT_PRIMARY,
  },

  // List
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
    paddingTop: 4,
  },
  listContentEmpty: {
    flex: 1,
  },

  // Swipeable card
  swipeableWrapper: {
    marginBottom: 0,
    overflow: 'visible',
  },
  swipeAction: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 12,
    width: 100,
    borderRadius: 16,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsaveAction: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  unsaveActionText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cardContainer: {
    // Card sits on top of the swipe action
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: BORDER + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 20,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  browseButton: {
    flexDirection: 'row',
    height: 50,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.md,
  },
  browseButtonText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Sort sheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 40,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: BORDER,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontFamily: fontFamilies.bold,
    fontSize: 18,
    fontWeight: '700',
    color: TEXT_PRIMARY,
    marginBottom: 16,
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
    marginBottom: 4,
  },
  sortOptionActive: {
    backgroundColor: PRIMARY + '0D',
  },
  sortIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  sortIconCircleActive: {
    backgroundColor: PRIMARY,
  },
  sortOptionText: {
    fontFamily: fontFamilies.medium,
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_PRIMARY,
    flex: 1,
  },
  sortOptionTextActive: {
    fontFamily: fontFamilies.semiBold,
    fontWeight: '600',
    color: PRIMARY,
  },
});
