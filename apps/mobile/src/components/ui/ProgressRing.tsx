import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { stitch } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface ProgressRingProps {
  /** Can be negative for below-baseline discipline scores (e.g., -5, -10) */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  negativeColor?: string; // Optional color for negative progress
  children?: React.ReactNode;
}

/**
 * Signature progress ring. The track is the same dashed stitch used across
 * pocket glyphs and empty states, not a plain circle — so "how full is
 * this" reads as thread being sewn, not a generic dashboard donut. The
 * value arc draws in with a single eased animation on mount/update rather
 * than snapping straight to its final angle.
 * 
 * Supports negative progress values for below-baseline discipline scores.
 */
export function ProgressRing({ progress, size = 120, strokeWidth = 8, color, trackColor, negativeColor, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  
  // Handle negative progress values for discipline scores (e.g., -5, -10, 15)
  const isNegative = progress < 0;
  const absProgress = Math.abs(progress);
  const displayProgress = Math.max(0, Math.min(1, absProgress / 100)); // Convert percentage to 0-1 range
  const displayColor = isNegative ? (negativeColor || color) : color;

  const animatedProgress = useSharedValue(0);
  useEffect(() => {
    animatedProgress.value = withTiming(displayProgress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [displayProgress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        {/* stitched track */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={stitch.width + 1}
          strokeDasharray={`${stitch.dash},${stitch.gap}`}
          fill="none"
        />
        {/* animated value arc */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={displayColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference},${circumference}`}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>
      {children}
    </View>
  );
}