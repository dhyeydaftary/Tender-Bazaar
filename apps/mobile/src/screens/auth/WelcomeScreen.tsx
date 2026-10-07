/**
 * TenderBazaar — Premium Onboarding Welcome Screen
 *
 * 3-slide carousel with Lottie animations, parallax effect,
 * Reanimated animated dots, MMKV onboarding flag, haptic feedback.
 */

import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
  FlatList,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
  type ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  SharedValue,
} from 'react-native-reanimated';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import Icon from 'react-native-vector-icons/Feather';
import { storage, StorageKeys } from '../../services/storage/mmkv';
import type { AuthStackParamList } from '../../types/navigation';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const PRIMARY = '#FF6B35';
const SECONDARY = '#1B2845';
const TEXT_PRIMARY = '#0F1117';
const TEXT_SECONDARY = '#6B7280';
const BACKGROUND = '#F7F8FA';
const CARD_BG = '#FFFFFF';
const DOT_INACTIVE = '#D1D5DB';

const LOTTIE_HEIGHT = SCREEN_HEIGHT * 0.42;

const hapticOptions = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: false,
};

// ---------------------------------------------------------------------------
// Slide Data
// ---------------------------------------------------------------------------

interface SlideData {
  id: string;
  lottie: any;
  title: string;
  subtitle: string;
}

const SLIDES: SlideData[] = [
  {
    id: '1',
    lottie: require('../../assets/lottie/onboarding-search.json'),
    title: 'Discover Every Tender',
    subtitle:
      '50,000+ government tenders from 28 states, updated every hour across GeM, CPPP & state portals.',
  },
  {
    id: '2',
    lottie: require('../../assets/lottie/onboarding-alerts.json'),
    title: 'Never Miss a Deadline',
    subtitle:
      'Smart alerts via Push, Email & WhatsApp so you never lose a bidding opportunity again.',
  },
  {
    id: '3',
    lottie: require('../../assets/lottie/onboarding-ai.json'),
    title: 'AI Checks Your Eligibility',
    subtitle:
      'Know if you qualify before you bid. Our AI analyzes tender requirements against your company profile.',
  },
];

// ---------------------------------------------------------------------------
// Animated Dot Component
// ---------------------------------------------------------------------------

function Dot({
  index,
  scrollX,
}: {
  index: number;
  scrollX: SharedValue<number>;
}) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 28, 8],
      Extrapolation.CLAMP,
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP,
    );

    const backgroundColor =
      scrollX.value >= (index - 0.5) * SCREEN_WIDTH &&
      scrollX.value < (index + 0.5) * SCREEN_WIDTH
        ? PRIMARY
        : DOT_INACTIVE;

    return { width, opacity, backgroundColor };
  });

  return <Animated.View style={[styles.dot, animatedStyle]} />;
}

// ---------------------------------------------------------------------------
// Slide Item Component
// ---------------------------------------------------------------------------

function SlideItem({
  item,
  index,
  scrollX,
}: {
  item: SlideData;
  index: number;
  scrollX: SharedValue<number>;
}) {
  const parallaxStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const translateX = interpolate(
      scrollX.value,
      inputRange,
      [-30, 0, 30],
      Extrapolation.CLAMP,
    );

    return { transform: [{ translateX }] };
  });

  const contentOpacity = useAnimatedStyle(() => {
    const inputRange = [
      (index - 0.5) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 0.5) * SCREEN_WIDTH,
    ];

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0, 1, 0],
      Extrapolation.CLAMP,
    );

    const translateY = interpolate(
      scrollX.value,
      inputRange,
      [30, 0, 30],
      Extrapolation.CLAMP,
    );

    return { opacity, transform: [{ translateY }] };
  });

  return (
    <View style={styles.slide}>
      {/* Lottie with parallax */}
      <View style={styles.lottieContainer}>
        <Animated.View style={[styles.lottieWrapper, parallaxStyle]}>
          <LottieView
            source={item.lottie}
            autoPlay
            loop
            style={styles.lottie}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

      {/* Text content */}
      <Animated.View style={[styles.textContainer, contentOpacity]}>
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

type NavProp = NativeStackNavigationProp<AuthStackParamList, 'Welcome'>;

export default function WelcomeScreen() {
  const navigation = useNavigation<NavProp>();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList<SlideData>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollX = useSharedValue(0);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  // Scroll handler for Reanimated
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  // Track active index
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Skip fade animation
  const skipOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * SCREEN_WIDTH, (SLIDES.length - 1) * SCREEN_WIDTH],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const handleSkip = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    navigation.navigate('Login');
  }, [navigation]);

  const handleGetStarted = useCallback(() => {
    ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions);
    storage.set(StorageKeys.APP_ONBOARDED, 'true');
    navigation.navigate('Register');
  }, [navigation]);

  const handleLogin = useCallback(() => {
    ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
    storage.set(StorageKeys.APP_ONBOARDED, 'true');
    navigation.navigate('Login');
  }, [navigation]);

  // Button area animation
  const buttonOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * SCREEN_WIDTH, (SLIDES.length - 1) * SCREEN_WIDTH],
      [0, 1],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * SCREEN_WIDTH, (SLIDES.length - 1) * SCREEN_WIDTH],
      [20, 0],
      Extrapolation.CLAMP,
    );
    return { opacity, transform: [{ translateY }] };
  });

  const swipeOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollX.value,
      [(SLIDES.length - 2) * SCREEN_WIDTH, (SLIDES.length - 1) * SCREEN_WIDTH],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  const renderItem = useCallback(
    ({ item, index }: { item: SlideData; index: number }) => (
      <SlideItem item={item} index={index} scrollX={scrollX} />
    ),
    [scrollX],
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={BACKGROUND} />

      {/* Skip button */}
      <Animated.View style={[styles.skipContainer, skipOpacity]}>
        <TouchableOpacity
          style={styles.skipButton}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderItem}
        keyExtractor={(item: SlideData) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        style={styles.carousel}
        contentContainerStyle={styles.carouselContent}
      />

      {/* Bottom section */}
      <View
        style={[styles.bottomSection, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* Page dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, index) => (
            <Dot key={index} index={index} scrollX={scrollX} />
          ))}
        </View>

        {/* Action area */}
        <View style={styles.actionArea}>
          {/* Get Started button (visible on last slide) */}
          <Animated.View style={[styles.getStartedWrapper, buttonOpacity]}>
            <TouchableOpacity
              style={styles.getStartedButton}
              onPress={handleGetStarted}
              activeOpacity={0.85}
            >
              <Text style={styles.getStartedText}>Get Started</Text>
              <View style={styles.arrowCircle}>
                <Icon name="arrow-right" size={18} color={PRIMARY} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Swipe hint (visible on non-last slides) */}
          {!isLastSlide && (
            <Animated.View style={[styles.swipeHintWrapper, swipeOpacity]}>
              <Text style={styles.swipeHint}>Swipe to continue</Text>
              <View style={styles.swipeArrows}>
                <Icon name="chevron-right" size={16} color={TEXT_SECONDARY} />
                <Icon
                  name="chevron-right"
                  size={16}
                  color={TEXT_SECONDARY}
                  style={styles.chevronOffset}
                />
              </View>
            </Animated.View>
          )}
        </View>

        {/* Login link */}
        <TouchableOpacity
          onPress={handleLogin}
          activeOpacity={0.7}
          style={styles.loginLinkContainer}
        >
          <Text style={styles.loginLink}>
            Already have an account?{' '}
            <Text style={styles.loginLinkBold}>Login</Text>
          </Text>
        </TouchableOpacity>
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
  skipContainer: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  skipButton: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: CARD_BG,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  carousel: {
    flex: 1,
  },
  carouselContent: {
    alignItems: 'center',
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    justifyContent: 'flex-start',
  },
  lottieContainer: {
    width: SCREEN_WIDTH,
    height: LOTTIE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    overflow: 'hidden',
  },
  lottieWrapper: {
    width: SCREEN_WIDTH * 0.85,
    height: LOTTIE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lottie: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    paddingHorizontal: 36,
    alignItems: 'center',
    marginTop: 40,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    textAlign: 'center',
    marginBottom: 14,
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  slideSubtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 4,
  },
  bottomSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    gap: 6,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  actionArea: {
    width: '100%',
    height: 56,
    marginBottom: 20,
    justifyContent: 'center',
  },
  getStartedWrapper: {
    position: 'absolute',
    width: '100%',
  },
  getStartedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PRIMARY,
    height: 56,
    borderRadius: 16,
    width: '100%',
    gap: 12,
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 6,
  },
  getStartedText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  arrowCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  swipeHintWrapper: {
    position: 'absolute',
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 4,
  },
  swipeHint: {
    fontSize: 15,
    fontWeight: '500',
    color: TEXT_SECONDARY,
  },
  swipeArrows: {
    flexDirection: 'row',
    marginLeft: 2,
  },
  chevronOffset: {
    marginLeft: -8,
    opacity: 0.5,
  },
  loginLinkContainer: {
    paddingVertical: 4,
  },
  loginLink: {
    fontSize: 15,
    color: TEXT_SECONDARY,
  },
  loginLinkBold: {
    color: PRIMARY,
    fontWeight: '700',
  },
});
