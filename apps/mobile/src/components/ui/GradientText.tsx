/**
 * TenderBazaar — GradientText Component
 *
 * Masked gradient text using react-native-linear-gradient + MaskedView.
 * Falls back to solid color if MaskedView is unavailable.
 */

import React from 'react';
import { StyleSheet, Text, type TextStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { lightColors as colors } from '../../theme/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GradientTextProps {
  children: React.ReactNode;
  colors?: string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: TextStyle;
}

// ---------------------------------------------------------------------------
// Attempt to load MaskedView
// ---------------------------------------------------------------------------

let MaskedView: React.ComponentType<any> | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  MaskedView = require('@react-native-masked-view/masked-view').default;
} catch {
  MaskedView = null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const GradientText: React.FC<GradientTextProps> = ({
  children,
  colors: gradientColors = [colors.primary, colors.primaryLight],
  start = { x: 0, y: 0 },
  end = { x: 1, y: 0 },
  style,
}) => {
  // Fallback: solid color text
  if (!MaskedView) {
    return (
      <Text style={[style, { color: gradientColors[0] }]}>
        {children}
      </Text>
    );
  }

  return (
    <MaskedView
      maskElement={
        <Text style={[style, styles.maskText]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={gradientColors}
        start={start}
        end={end}
      >
        {/* Invisible text to size the gradient */}
        <Text style={[style, styles.hiddenText]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  maskText: {
    backgroundColor: 'transparent',
  },
  hiddenText: {
    opacity: 0,
  },
});

export default React.memo(GradientText);
