import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedProps,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const AnimatedPath = Animated.createAnimatedComponent(Path);

// Same pocket silhouette as PocketGlyph, traced as one continuous path so
// its length can be measured and animated as a "sewing" stitch.
const POCKET_PATH = 'M4 4 H16 L20 8 V17 A3 3 0 0 1 17 20 H7 A3 3 0 0 1 4 17 Z';
const PATH_LENGTH = 62; // approximate length of POCKET_PATH at the 24x24 viewBox scale

interface PocketLoaderProps {
  size?: number;
  color: string;
  trackColor?: string;
}

/**
 * Signature loading indicator. A dashed stitch chases around the same
 * pocket silhouette used everywhere else in the app (PocketGlyph,
 * ProgressRing, EmptyIllustration), instead of a generic spinning circle —
 * so "the app is thinking" still looks like this app, not any app.
 */
export function PocketLoader({ size = 40, color, trackColor = `${color}33` }: PocketLoaderProps) {
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withRepeat(
      withTiming(-PATH_LENGTH * 2, { duration: 1400, easing: Easing.linear }),
      -1,
      false
    );
  }, [offset]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: offset.value,
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={POCKET_PATH} stroke={trackColor} strokeWidth={1.75} strokeLinejoin="round" />
        <AnimatedPath
          d={POCKET_PATH}
          stroke={color}
          strokeWidth={1.75}
          strokeLinejoin="round"
          strokeLinecap="round"
          strokeDasharray={`${PATH_LENGTH * 0.22},${PATH_LENGTH * 0.78}`}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
}