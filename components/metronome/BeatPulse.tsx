/**
 * ビートパルスアニメーションコンポーネント
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../styles';

interface BeatPulseProps {
  isActive: boolean;
  isAccent?: boolean;
  size?: number;
  style?: ViewStyle;
}

export const BeatPulse: React.FC<BeatPulseProps> = ({
  isActive,
  isAccent = false,
  size = 80,
  style,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    if (isActive) {
      // パルスアニメーション
      scale.value = withSequence(
        withTiming(1.3, { duration: 50, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) })
      );
      opacity.value = withSequence(
        withTiming(1, { duration: 50 }),
        withTiming(0.3, { duration: 300 })
      );
    }
  }, [isActive]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Animated.View
        style={[
          styles.pulse,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isAccent
              ? colors.functional.rhythm
              : colors.accent.primaryDark,
          },
          animatedStyle,
        ]}
      />
      <View
        style={[
          styles.center,
          {
            width: size * 0.4,
            height: size * 0.4,
            borderRadius: (size * 0.4) / 2,
            backgroundColor: isAccent
              ? colors.functional.rhythm
              : colors.accent.primary,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulse: {
    position: 'absolute',
  },
  center: {
    position: 'absolute',
  },
});
