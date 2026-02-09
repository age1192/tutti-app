/**
 * アイコンボタンコンポーネント
 */
import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing } from '../../styles';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type IconButtonVariant = 'primary' | 'secondary' | 'ghost';
type IconButtonSize = 'small' | 'medium' | 'large';

interface IconButtonProps {
  icon: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
  haptic?: boolean;
  label?: string;
}

export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  onPress,
  variant = 'secondary',
  size = 'medium',
  disabled = false,
  style,
  haptic = true,
  label,
}) => {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const handlePress = () => {
    if (haptic) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const sizeConfig = {
    small: { size: 36, fontSize: 16 },
    medium: { size: 48, fontSize: 20 },
    large: { size: 64, fontSize: 28 },
  };

  const { size: buttonSize, fontSize } = sizeConfig[size];

  return (
    <AnimatedPressable
      style={[
        styles.button,
        styles[`button_${variant}`],
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
        },
        disabled && styles.button_disabled,
        animatedStyle,
        style,
      ]}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityLabel={label}
    >
      <Text style={[styles.icon, { fontSize }]}>{icon}</Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  button_primary: {
    backgroundColor: colors.accent.primary,
  },
  button_secondary: {
    backgroundColor: colors.background.secondary,
  },
  button_ghost: {
    backgroundColor: 'transparent',
  },
  button_disabled: {
    opacity: 0.5,
  },
  icon: {
    color: colors.text.primary,
  },
});
