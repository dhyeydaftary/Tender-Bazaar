import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { fontFamilies } from '@/theme/typography';

interface UpgradeBannerProps {
  feature: string;
  requiredPlan: string;
  currentPlan?: string;
  variant?: 'inline' | 'card';
  onPress?: () => void;
}

/**
 * A CTA banner shown when a feature is locked by the user's plan.
 *
 * - `inline` — compact single-line banner
 * - `card` — standalone card with more description
 */
export function UpgradeBanner({
  feature,
  requiredPlan,
  currentPlan = 'Free',
  variant = 'inline',
  onPress,
}: UpgradeBannerProps) {
  const navigation = useNavigation();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('Plans' as never);
    }
  };

  if (variant === 'card') {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardRow}>
          <View style={styles.cardIconWrap}>
            <Icon name="lock-outline" size={22} color="#FF6B35" />
          </View>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>
              {feature} requires {requiredPlan}
            </Text>
            <Text style={styles.cardDescription}>
              You are on the {currentPlan} plan. Upgrade to access this feature
              and more.
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.cardButton}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <Icon name="star-four-points-outline" size={16} color="#FFFFFF" />
          <Text style={styles.cardButtonText}>Upgrade</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // inline variant
  return (
    <TouchableOpacity
      style={styles.inlineContainer}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Icon name="lock-outline" size={14} color="#D97706" />
      <Text style={styles.inlineText} numberOfLines={1}>
        {feature} — Available on{' '}
        <Text style={styles.inlineBold}>{requiredPlan}</Text> and above.
      </Text>
      <View style={styles.inlineUpgrade}>
        <Text style={styles.inlineUpgradeText}>Upgrade</Text>
        <Icon name="arrow-top-right" size={12} color="#FF6B35" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Card variant
  cardContainer: {
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.2)',
    borderRadius: 12,
    padding: 16,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: '#0F1117',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#6B7280',
    lineHeight: 18,
  },
  cardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FF6B35',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  cardButtonText: {
    fontSize: 14,
    fontFamily: fontFamilies.semiBold,
    color: '#FFFFFF',
  },
  // Inline variant
  inlineContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inlineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: fontFamilies.regular,
    color: '#92400E',
  },
  inlineBold: {
    fontFamily: fontFamilies.semiBold,
  },
  inlineUpgrade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  inlineUpgradeText: {
    fontSize: 12,
    fontFamily: fontFamilies.semiBold,
    color: '#FF6B35',
  },
});
