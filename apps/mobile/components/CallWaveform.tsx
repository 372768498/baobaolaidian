/**
 * CallWaveform — animated bars that pulse while AI is speaking.
 * Uses Reanimated 2 shared values for smooth, GPU-driven animation.
 *
 * When `active` is false (user speaking or silence) bars shrink to a
 * flat idle state.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import { COLORS } from '@/lib/constants';

const BAR_COUNT = 5;
// Height multipliers per bar to create a natural wave shape
const HEIGHTS = [0.5, 0.8, 1.0, 0.8, 0.5];
// Stagger delay (ms) so bars don't all pulse in sync
const DELAYS = [0, 80, 160, 80, 0];
const MAX_HEIGHT = 48;
const MIN_HEIGHT = 6;

interface Props {
  active: boolean; // true = AI speaking, animate
  color?: string;
}

function WaveBar({ active, multiplier, delay, color }: {
  active: boolean;
  multiplier: number;
  delay: number;
  color: string;
}) {
  const height = useSharedValue(MIN_HEIGHT);

  useEffect(() => {
    if (active) {
      // Slight delay so bars are staggered
      const timeout = setTimeout(() => {
        height.value = withRepeat(
          withSequence(
            withTiming(MAX_HEIGHT * multiplier, {
              duration: 350,
              easing: Easing.inOut(Easing.sin),
            }),
            withTiming(MIN_HEIGHT, {
              duration: 350,
              easing: Easing.inOut(Easing.sin),
            })
          ),
          -1 // infinite
        );
      }, delay);
      return () => clearTimeout(timeout);
    } else {
      cancelAnimation(height);
      height.value = withTiming(MIN_HEIGHT, { duration: 200 });
    }
  }, [active]);

  const animStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[styles.bar, animStyle, { backgroundColor: color }]}
    />
  );
}

export function CallWaveform({ active, color = COLORS.primary }: Props) {
  return (
    <View style={styles.container}>
      {Array.from({ length: BAR_COUNT }).map((_, i) => (
        <WaveBar
          key={i}
          active={active}
          multiplier={HEIGHTS[i]}
          delay={DELAYS[i]}
          color={color}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: MAX_HEIGHT + 8,
  },
  bar: {
    width: 6,
    borderRadius: 3,
  },
});
