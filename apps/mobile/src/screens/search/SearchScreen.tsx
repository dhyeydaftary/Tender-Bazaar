/**
 * TenderBazaar -- SearchScreen (Premium)
 *
 * Full-featured search with animated search bar, recent/trending before search,
 * sort pills, FlatList results with TenderCard, loading skeletons, empty state,
 * and infinite scroll.
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withDelay,
  Easing,
  FadeIn,
} from 'react-native-reanimated';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import FeatherIcon from 'react-native-vector-icons/Feather';

import type { RootStackParamList } from '../../types/navigation';
import TenderCard from '../../components/tender/TenderCard';
import TenderCardSkeleton from '../../components/tender/TenderCardSkeleton';
import Badge from '../../components/ui/Badge';
import { CATEGORIES } from '../../utils/constants';
import { formatCurrency } from '../../utils/format';
import { useSavedStore } from '../../stores/savedStore';
import { getObject, setObject, StorageKeys } from '../../services/storage/mmkv';
import { fontFamilies } from '../../theme/typography';
import { shadows } from '../../theme/shadows';

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

type NavProp = NativeStackNavigationProp<RootStackParamList>;
type SortOption = 'Relevance' | 'Newest' | 'Deadline' | 'Value';

const SORT_OPTIONS: SortOption[] = ['Relevance', 'Newest', 'Deadline', 'Value'];

const TRENDING_SEARCHES = [
  'highway construction',
  'IT services',
  'medical equipment',
  'solar panel',
  'bridge repair',
  'school building',
  'water supply',
  'road maintenance',
];

const CATEGORY_CARDS = [
  { value: 'Works', label: 'Works', icon: 'hammer-wrench', color: '#F87171', count: '1,240' },
  { value: 'Goods', label: 'Goods', icon: 'package-variant-closed', color: '#60A5FA', count: '856' },
  { value: 'Services', label: 'Services', icon: 'briefcase-outline', color: '#34D399', count: '623' },
  { value: 'Consultancy', label: 'Consultancy', icon: 'lightbulb-outline', color: '#A78BFA', count: '318' },
];

// ---------------------------------------------------------------------------
// Mock tender data -- 10 realistic Indian tenders
// ---------------------------------------------------------------------------

interface MockTender {
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
}

const MOCK_RESULTS: MockTender[] = [
  {
    id: 'sr-1', title: 'Construction of 4-Lane Highway NH-48 Ahmedabad-Vadodara Section',
    organization: 'National Highways Authority of India (NHAI)', state: 'Gujarat',
    category: 'Works', estimatedValue: 452000000, emdAmount: 4520000,
    submissionDeadline: '2026-04-28T17:00:00Z', publishedDate: '2026-04-05T10:00:00Z',
    status: 'ACTIVE', sourcePortal: 'CPPP', referenceNumber: 'NHAI/GJ/2026/0412',
  },
  {
    id: 'sr-2', title: 'Supply of IT Equipment and Laptops for Government Schools Phase-II',
    organization: 'Department of Education, Maharashtra', state: 'Maharashtra',
    category: 'Goods', estimatedValue: 35000000, emdAmount: 700000,
    submissionDeadline: '2026-04-25T15:00:00Z', publishedDate: '2026-04-03T09:00:00Z',
    status: 'ACTIVE', sourcePortal: 'GeM', referenceNumber: 'GEM/MH/EDU/2026/1845',
  },
  {
    id: 'sr-3', title: 'Annual Maintenance Contract for Smart City CCTV Surveillance Network',
    organization: 'Surat Municipal Corporation', state: 'Gujarat',
    category: 'Services', estimatedValue: 18500000, emdAmount: 370000,
    submissionDeadline: '2026-05-02T17:00:00Z', publishedDate: '2026-04-07T11:30:00Z',
    status: 'ACTIVE', sourcePortal: 'State Portal', referenceNumber: 'SMC/IT/AMC/2026/0078',
  },
  {
    id: 'sr-4', title: 'Consulting Services for Urban Development Master Plan 2041',
    organization: 'Directorate of Urban Development, Rajasthan', state: 'Rajasthan',
    category: 'Consultancy', estimatedValue: 7500000, emdAmount: 150000,
    submissionDeadline: '2026-05-10T17:00:00Z', publishedDate: '2026-04-08T08:00:00Z',
    status: 'ACTIVE', sourcePortal: 'CPPP', referenceNumber: 'DUDA/RJ/CONS/2026/0034',
  },
  {
    id: 'sr-5', title: 'Road Resurfacing and Bituminous Overlay Works in Zone-4, New Delhi',
    organization: 'Public Works Department, Delhi', state: 'Delhi',
    category: 'Works', estimatedValue: 120000000, emdAmount: 2400000,
    submissionDeadline: '2026-04-22T17:00:00Z', publishedDate: '2026-04-01T10:00:00Z',
    status: 'ACTIVE', sourcePortal: 'CPPP', referenceNumber: 'PWD/DL/ROAD/2026/0291',
  },
  {
    id: 'sr-6', title: 'Supply and Installation of 500 KWp Solar Rooftop Power Plant',
    organization: 'Solar Energy Corporation of India', state: 'Karnataka',
    category: 'Goods', estimatedValue: 28000000, emdAmount: 560000,
    submissionDeadline: '2026-05-05T15:00:00Z', publishedDate: '2026-04-06T12:00:00Z',
    status: 'ACTIVE', sourcePortal: 'GeM', referenceNumber: 'SECI/KA/SOLAR/2026/0156',
  },
  {
    id: 'sr-7', title: 'Construction of 200-Bed District Hospital with Modern OT Complex',
    organization: 'Dept of Health & Family Welfare, Tamil Nadu', state: 'Tamil Nadu',
    category: 'Works', estimatedValue: 380000000, emdAmount: 7600000,
    submissionDeadline: '2026-05-15T17:00:00Z', publishedDate: '2026-04-09T09:00:00Z',
    status: 'ACTIVE', sourcePortal: 'State Portal', referenceNumber: 'DHFW/TN/HOSP/2026/0045',
  },
  {
    id: 'sr-8', title: 'Procurement of Medical Equipment for Primary Health Centres',
    organization: 'National Health Mission, Uttar Pradesh', state: 'Uttar Pradesh',
    category: 'Goods', estimatedValue: 15000000, emdAmount: 300000,
    submissionDeadline: '2026-04-30T15:00:00Z', publishedDate: '2026-04-04T14:00:00Z',
    status: 'ACTIVE', sourcePortal: 'GeM', referenceNumber: 'NHM/UP/MED/2026/0823',
  },
  {
    id: 'sr-9', title: 'Comprehensive Water Supply Scheme for Rural Villages Phase-III',
    organization: 'Jal Jeevan Mission, Madhya Pradesh', state: 'Madhya Pradesh',
    category: 'Works', estimatedValue: 950000000, emdAmount: 19000000,
    submissionDeadline: '2026-05-20T17:00:00Z', publishedDate: '2026-04-10T10:00:00Z',
    status: 'ACTIVE', sourcePortal: 'CPPP', referenceNumber: 'JJM/MP/WSS/2026/0067',
  },
  {
    id: 'sr-10', title: 'IT Infrastructure Management and Cloud Migration Services',
    organization: 'National Informatics Centre (NIC)', state: 'Delhi',
    category: 'Services', estimatedValue: 42000000, emdAmount: 840000,
    submissionDeadline: '2026-05-08T15:00:00Z', publishedDate: '2026-04-02T11:00:00Z',
    status: 'ACTIVE', sourcePortal: 'CPPP', referenceNumber: 'NIC/DL/CLOUD/2026/0192',
  },
];

// ---------------------------------------------------------------------------
// Spring configs
// ---------------------------------------------------------------------------

const SEARCH_SPRING = { damping: 20, stiffness: 300, mass: 0.6 };
const ITEM_SPRING = { damping: 18, stiffness: 200, mass: 0.5 };

// ---------------------------------------------------------------------------
// Animated Result Item -- stagger entrance
// ---------------------------------------------------------------------------

const AnimatedResultItem = React.memo(
  ({ index, children }: { index: number; children: React.ReactNode }) => {
    const opacity = useSharedValue(0);
    const translateY = useSharedValue(10);

    useEffect(() => {
      const delay = Math.min(index * 60, 300);
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      );
      translateY.value = withDelay(delay, withSpring(0, ITEM_SPRING));
    }, [index, opacity, translateY]);

    const animStyle = useAnimatedStyle(() => ({
      opacity: opacity.value,
      transform: [{ translateY: translateY.value }],
    }));

    return <Animated.View style={animStyle}>{children}</Animated.View>;
  },
);

// ---------------------------------------------------------------------------
// Category Card -- press scale animation
// ---------------------------------------------------------------------------

const CategoryCard = React.memo(
  ({ item, onPress }: { item: typeof CATEGORY_CARDS[number]; onPress: () => void }) => {
    const scale = useSharedValue(1);

    const animStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = useCallback(() => {
      scale.value = withSpring(0.95, SEARCH_SPRING);
    }, [scale]);

    const handlePressOut = useCallback(() => {
      scale.value = withSpring(1, SEARCH_SPRING);
    }, [scale]);

    return (
      <Animated.View style={[styles.categoryCardWrapper, animStyle]}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={styles.categoryCard}
        >
          <View style={[styles.categoryCardIcon, { backgroundColor: item.color + '18' }]}>
            <Icon name={item.icon} size={24} color={item.color} />
          </View>
          <Text style={styles.categoryCardLabel}>{item.label}</Text>
          <Text style={styles.categoryCardCount}>{item.count} tenders</Text>
        </Pressable>
      </Animated.View>
    );
  },
);

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SearchScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<MockTender[]>([]);
  const [activeSort, setActiveSort] = useState<SortOption>('Relevance');
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilterCount] = useState(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  // Saved store
  const { isSaved, addSaved, removeSaved } = useSavedStore();

  // Search bar shared values
  const searchBarScale = useSharedValue(1);
  const searchBarShadow = useSharedValue(0);
  const searchBarBorderProgress = useSharedValue(0);

  // Load recent searches from MMKV on mount
  useEffect(() => {
    const stored = getObject<string[]>(StorageKeys.SEARCH_RECENT);
    if (stored && Array.isArray(stored)) {
      setRecentSearches(stored.slice(0, 10));
    }
  }, []);

  // Persist recent searches
  const saveRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s.toLowerCase() !== term.toLowerCase());
      const updated = [term, ...filtered].slice(0, 10);
      setObject(StorageKeys.SEARCH_RECENT, updated);
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter((s) => s !== term);
      setObject(StorageKeys.SEARCH_RECENT, updated);
      return updated;
    });
  }, []);

  const clearAllRecent = useCallback(() => {
    setRecentSearches([]);
    setObject(StorageKeys.SEARCH_RECENT, []);
  }, []);

  // Animated styles for search bar
  const searchBarAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: searchBarScale.value }],
    borderColor: searchBarBorderProgress.value > 0.5 ? PRIMARY : BORDER,
  }));

  const searchBarShadowStyle = useAnimatedStyle(() => ({
    opacity: searchBarShadow.value,
  }));

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    searchBarScale.value = withSpring(1.02, SEARCH_SPRING);
    searchBarShadow.value = withTiming(1, { duration: 200 });
    searchBarBorderProgress.value = withTiming(1, { duration: 200 });
  }, [searchBarScale, searchBarShadow, searchBarBorderProgress]);

  const handleBlur = useCallback(() => {
    setIsFocused(false);
    searchBarScale.value = withSpring(1, SEARCH_SPRING);
    searchBarShadow.value = withTiming(0, { duration: 200 });
    searchBarBorderProgress.value = withTiming(0, { duration: 200 });
  }, [searchBarScale, searchBarShadow, searchBarBorderProgress]);

  // Execute search with mock delay
  const executeSearch = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) return;
    Keyboard.dismiss();
    setIsLoading(true);
    setHasSearched(true);
    setIsSearching(true);
    saveRecentSearch(searchQuery.trim());
    setTimeout(() => {
      setResults(MOCK_RESULTS);
      setIsLoading(false);
    }, 800);
  }, [saveRecentSearch]);

  const handleSubmitSearch = useCallback(() => {
    executeSearch(query);
  }, [query, executeSearch]);

  const handleClearSearch = useCallback(() => {
    setQuery('');
    setHasSearched(false);
    setIsSearching(false);
    setResults([]);
    inputRef.current?.focus();
  }, []);

  const fillAndSearch = useCallback((term: string) => {
    setQuery(term);
    executeSearch(term);
  }, [executeSearch]);

  const handleCategoryPress = useCallback((value: string) => {
    setQuery(value.toLowerCase());
    executeSearch(value.toLowerCase());
  }, [executeSearch]);

  // Infinite scroll handler
  const handleEndReached = useCallback(() => {
    if (loadingMore || !hasSearched) return;
    setLoadingMore(true);
    setTimeout(() => setLoadingMore(false), 1200);
  }, [loadingMore, hasSearched]);

  // Tender interactions
  const handleTenderPress = useCallback((id: string) => {
    navigation.navigate('TenderDetail', { id });
  }, [navigation]);

  const handleToggleSave = useCallback((id: string) => {
    if (isSaved(id)) {
      removeSaved(id);
    } else {
      addSaved(id);
    }
  }, [isSaved, addSaved, removeSaved]);

  const resultsCountText = useMemo(
    () => (results.length > 0 ? '247 tenders found' : ''),
    [results.length],
  );

  // ---------------------------------------------------------------------------
  // Render: Search Bar (sticky top)
  // ---------------------------------------------------------------------------

  const renderSearchBar = useCallback(() => (
    <View style={[styles.searchBarContainer, { paddingTop: 12 }]}>
      <Animated.View style={[styles.searchBarShadowLayer, searchBarShadowStyle, shadows.md]} />
      <Animated.View style={[styles.searchBar, searchBarAnimStyle]}>
        <Icon name="magnify" size={22} color={isFocused ? PRIMARY : TEXT_SECONDARY} />
        <TextInput
          ref={inputRef}
          style={styles.searchInput}
          placeholder="Search tenders, organizations..."
          placeholderTextColor={TEXT_MUTED}
          value={query}
          onChangeText={setQuery}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmitSearch}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={handleClearSearch}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Icon name="close-circle" size={20} color={TEXT_SECONDARY} />
          </TouchableOpacity>
        )}
      </Animated.View>
      <TouchableOpacity
        style={styles.filterButton}
        onPress={() => navigation.navigate('FilterScreen')}
        activeOpacity={0.7}
      >
        <Icon name="tune-variant" size={22} color={PRIMARY} />
        {activeFilterCount > 0 && (
          <View style={styles.filterCountBadge}>
            <Text style={styles.filterCountText}>{activeFilterCount}</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  ), [
    query, isFocused, activeFilterCount, searchBarAnimStyle, searchBarShadowStyle,
    handleFocus, handleBlur, handleSubmitSearch, handleClearSearch, navigation,
  ]);

  // ---------------------------------------------------------------------------
  // Render: Before Search (recent, trending, categories)
  // ---------------------------------------------------------------------------

  const renderBeforeSearch = useCallback(() => (
    <Animated.ScrollView
      entering={FadeIn.duration(300)}
      style={styles.beforeSearchContainer}
      contentContainerStyle={styles.beforeSearchContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Recent Searches */}
      {recentSearches.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Searches</Text>
            <TouchableOpacity onPress={clearAllRecent} activeOpacity={0.7}>
              <Text style={styles.sectionAction}>Clear All</Text>
            </TouchableOpacity>
          </View>
          {recentSearches.map((term) => (
            <TouchableOpacity
              key={term}
              style={styles.recentRow}
              onPress={() => fillAndSearch(term)}
              activeOpacity={0.7}
            >
              <View style={styles.recentLeft}>
                <Icon name="clock-outline" size={18} color={TEXT_MUTED} />
                <Text style={styles.recentText}>{term}</Text>
              </View>
              <TouchableOpacity
                onPress={() => removeRecentSearch(term)}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Icon name="close" size={16} color={TEXT_MUTED} />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Trending Searches */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Trending Searches</Text>
        </View>
        <View style={styles.trendingGrid}>
          {TRENDING_SEARCHES.map((term) => (
            <TouchableOpacity
              key={term}
              style={styles.trendingItem}
              onPress={() => fillAndSearch(term)}
              activeOpacity={0.7}
            >
              <Icon name="trending-up" size={14} color={PRIMARY} />
              <Text style={styles.trendingText}>{term}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Popular Categories */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Popular Categories</Text>
        </View>
        <View style={styles.categoriesGrid}>
          {CATEGORY_CARDS.map((cat) => (
            <CategoryCard
              key={cat.value}
              item={cat}
              onPress={() => handleCategoryPress(cat.value)}
            />
          ))}
        </View>
      </View>

      {/* Bottom spacer for floating tab bar */}
      <View style={{ height: 100 }} />
    </Animated.ScrollView>
  ), [recentSearches, clearAllRecent, fillAndSearch, removeRecentSearch, handleCategoryPress]);

  // ---------------------------------------------------------------------------
  // Render: Loading Skeletons
  // ---------------------------------------------------------------------------

  const renderLoading = useCallback(() => (
    <View style={styles.loadingContainer}>
      <TenderCardSkeleton style={styles.skeletonCard} />
      <TenderCardSkeleton style={styles.skeletonCard} />
      <TenderCardSkeleton style={styles.skeletonCard} />
    </View>
  ), []);

  // ---------------------------------------------------------------------------
  // Render: Empty Results
  // ---------------------------------------------------------------------------

  const renderEmptyResults = useCallback(() => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconWrap}>
        <Icon name="file-search-outline" size={72} color={BORDER} />
      </View>
      <Text style={styles.emptyTitle}>No tenders found for '{query}'</Text>
      <Text style={styles.emptySubtitle}>
        Try different keywords or adjust your filters
      </Text>
      {activeFilterCount > 0 && (
        <TouchableOpacity style={styles.clearFiltersButton} activeOpacity={0.7}>
          <Icon name="filter-remove-outline" size={18} color={PRIMARY} />
          <Text style={styles.clearFiltersText}>Clear Filters</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [query, activeFilterCount]);

  // ---------------------------------------------------------------------------
  // Render: Sort Pills
  // ---------------------------------------------------------------------------

  const renderSortPills = useCallback(() => (
    <View style={styles.sortContainer}>
      <Text style={styles.resultsCount}>{resultsCountText}</Text>
      <View style={styles.sortPills}>
        {SORT_OPTIONS.map((option) => {
          const isActive = activeSort === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.sortPill, isActive && styles.sortPillActive]}
              onPress={() => setActiveSort(option)}
              activeOpacity={0.7}
            >
              <Text style={[styles.sortPillText, isActive && styles.sortPillTextActive]}>
                {option}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  ), [activeSort, resultsCountText]);

  // ---------------------------------------------------------------------------
  // Render: Result Item
  // ---------------------------------------------------------------------------

  const renderResultItem = useCallback(
    ({ item, index }: { item: MockTender; index: number }) => (
      <AnimatedResultItem index={index}>
        <TenderCard
          tender={item}
          onPress={() => handleTenderPress(item.id)}
          onSave={() => handleToggleSave(item.id)}
          isSaved={isSaved(item.id)}
          style={styles.resultCard}
        />
      </AnimatedResultItem>
    ),
    [handleTenderPress, handleToggleSave, isSaved],
  );

  const renderListFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: 100 }} />;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator color={PRIMARY} size="small" />
        <Text style={styles.loadingFooterText}>Loading more tenders...</Text>
        <View style={{ height: 100 }} />
      </View>
    );
  }, [loadingMore]);

  const keyExtractor = useCallback((item: MockTender) => item.id, []);

  // ---------------------------------------------------------------------------
  // Render: Results (list, loading, or empty)
  // ---------------------------------------------------------------------------

  const renderResults = useCallback(() => {
    if (isLoading) return renderLoading();
    if (hasSearched && results.length === 0) return renderEmptyResults();

    return (
      <FlatList
        data={results}
        renderItem={renderResultItem}
        keyExtractor={keyExtractor}
        ListHeaderComponent={renderSortPills}
        ListFooterComponent={renderListFooter}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        removeClippedSubviews
        maxToRenderPerBatch={6}
        windowSize={7}
      />
    );
  }, [
    isLoading, hasSearched, results, renderLoading, renderEmptyResults,
    renderResultItem, keyExtractor, renderSortPills, renderListFooter, handleEndReached,
  ]);

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />
      {renderSearchBar()}
      {!isSearching && !hasSearched ? renderBeforeSearch() : renderResults()}
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

  // Search Bar
  searchBarContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 10,
    alignItems: 'center',
  },
  searchBarShadowLayer: {
    position: 'absolute',
    left: 20,
    right: 68,
    top: 12,
    height: 48,
    borderRadius: 14,
    backgroundColor: CARD_BG,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD_BG,
    borderRadius: 14,
    height: 48,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: BORDER,
    gap: 10,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    fontFamily: fontFamilies.regular,
    fontSize: 16,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    height: '100%',
    paddingVertical: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: PRIMARY + '14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterCountText: {
    fontFamily: fontFamilies.bold,
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Before Search
  beforeSearchContainer: {
    flex: 1,
  },
  beforeSearchContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },

  // Sections
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 17,
    fontWeight: '600',
    color: TEXT_PRIMARY,
  },
  sectionAction: {
    fontFamily: fontFamilies.medium,
    fontSize: 14,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Recent Searches
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  recentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recentText: {
    fontFamily: fontFamilies.regular,
    fontSize: 15,
    fontWeight: '400',
    color: TEXT_PRIMARY,
    flex: 1,
  },

  // Trending
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  trendingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: PRIMARY + '0A',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: PRIMARY + '20',
  },
  trendingText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: PRIMARY,
  },

  // Categories Grid
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryCardWrapper: {
    width: '47%',
  },
  categoryCard: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    ...shadows.sm,
  },
  categoryCardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  categoryCardLabel: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 2,
  },
  categoryCardCount: {
    fontFamily: fontFamilies.regular,
    fontSize: 12,
    fontWeight: '400',
    color: TEXT_SECONDARY,
  },

  // Sort
  sortContainer: {
    paddingBottom: 12,
  },
  resultsCount: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
    marginBottom: 12,
  },
  sortPills: {
    flexDirection: 'row',
    gap: 8,
  },
  sortPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sortPillActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  sortPillText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  sortPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },

  // Results List
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  resultCard: {
    marginBottom: 12,
  },

  // Loading
  loadingContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  skeletonCard: {
    marginBottom: 12,
  },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
  emptyIconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: BORDER + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 18,
    fontWeight: '600',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: fontFamilies.regular,
    fontSize: 14,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: PRIMARY,
    marginTop: 4,
  },
  clearFiltersText: {
    fontFamily: fontFamilies.semiBold,
    fontSize: 14,
    fontWeight: '600',
    color: PRIMARY,
  },

  // Loading Footer
  loadingFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingFooterText: {
    fontFamily: fontFamilies.medium,
    fontSize: 13,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
});
