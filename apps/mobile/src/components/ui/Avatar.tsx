/**
 * TenderBazaar — Avatar Component
 *
 * Image avatar with fallback to initials (first 2 letters).
 * Sizes: sm=32, md=40, lg=56, xl=80
 * Circular with optional border.
 */

import React, { useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';
import { lightColors as colors } from '../../theme/colors';
import { fontFamilies } from '../../theme/typography';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  imageUri?: string;
  source?: ImageSourcePropType;
  size?: AvatarSize;
  borderColor?: string;
  borderWidth?: number;
  backgroundColor?: string;
  style?: ViewStyle;
}

// ---------------------------------------------------------------------------
// Size map
// ---------------------------------------------------------------------------

const SIZE_MAP: Record<AvatarSize, { container: number; fontSize: number }> = {
  sm: { container: 32, fontSize: 12 },
  md: { container: 40, fontSize: 14 },
  lg: { container: 56, fontSize: 20 },
  xl: { container: 80, fontSize: 28 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Deterministic color from name string */
function getColorFromName(name: string): string {
  const palette = [
    colors.primary,
    colors.secondary,
    colors.accent,
    colors.category.works,
    colors.category.goods,
    colors.category.services,
    colors.category.consultancy,
    colors.info,
    colors.success,
    colors.warning,
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const Avatar: React.FC<AvatarProps> = ({
  name,
  imageUri,
  source,
  size = 'md',
  borderColor,
  borderWidth: borderW,
  backgroundColor,
  style,
}) => {
  const [imgError, setImgError] = useState(false);
  const config = SIZE_MAP[size];

  const containerSize = config.container;
  const hasBorder = borderColor || borderW;

  const containerStyle: ViewStyle = {
    width: containerSize,
    height: containerSize,
    borderRadius: containerSize / 2,
    backgroundColor: backgroundColor || getColorFromName(name),
    ...(hasBorder
      ? { borderWidth: borderW || 2, borderColor: borderColor || colors.primary }
      : {}),
  };

  const imgSource = source || (imageUri ? { uri: imageUri } : null);
  const showImage = imgSource && !imgError;

  return (
    <View style={[styles.container, containerStyle, style]}>
      {showImage ? (
        <Image
          source={imgSource}
          style={[
            styles.image,
            {
              width: containerSize,
              height: containerSize,
              borderRadius: containerSize / 2,
            },
          ]}
          onError={() => setImgError(true)}
        />
      ) : (
        <Text
          style={[
            styles.initials,
            { fontSize: config.fontSize },
          ]}
          numberOfLines={1}
        >
          {getInitials(name)}
        </Text>
      )}
    </View>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    fontFamily: fontFamilies.bold,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});

export default React.memo(Avatar);
