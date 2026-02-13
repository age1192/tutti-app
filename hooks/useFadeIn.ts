/**
 * モーダル等のスムーズなフェードイン用フック
 */
import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

export function useFadeIn(visible: boolean, duration = 280): Animated.Value {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      opacity.setValue(0);
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, duration, opacity]);

  return opacity;
}
