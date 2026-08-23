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
  /** 0–100. Discipline scores are clamped server-side, so the ring never
   * needs to represent a below-baseline value. */
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor: string;
  children?: React.ReactNode;
}

/**
 * Signature progress ring. The track is the same dashed stitch used across
 * pocket glyphs and empty states, not a plain circle — so "how full is
 * this" reads as thread being sewn, not a generic dashboard donut. The
 * value arc draws in with a single eased animation on mount/update rather
 * than snapping straight to its final angle.
 */
export function ProgressRing({ progress, size = 120, strokeWidth = 8, color, trackColor, children }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Convert 0–100 to a 0–1 fill ratio, clamped defensively in case a caller
  // ever passes something out of range.
  const displayProgress = Math.max(0, Math.min(1, progress / 100));

  const animatedProgress = useSharedValue(0);
  useEffect(() => {
    animatedProgress.value = withTiming(displayProgress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [displayProgress, animatedProgress]);

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
          stroke={color}
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