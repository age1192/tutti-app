/**
 * 振り子アニメーションコンポーネント
 * 実際のメカニカルメトロノームの物理的な動きを再現
 * 支点が下にあり、上端（重り側）が左右に振れる
 */
import React, { useEffect, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { colors } from '../../styles';

interface PendulumProps {
  isPlaying: boolean;
  tempo: number;
  height?: number;
}

export const Pendulum: React.FC<PendulumProps> = ({
  isPlaying,
  tempo,
  height = 200,
}) => {
  const rotation = useSharedValue(0);
  const directionRef = useRef<'left' | 'right'>('right');
  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlayingRef = useRef(isPlaying);

  // refを更新
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // テンポから1拍の時間を計算（ミリ秒）
  const beatDuration = (60 / tempo) * 1000;

  // 振り子の振れ幅（テンポに応じて調整）
  const getMaxAngle = () => Math.max(12, 35 - (tempo - 40) * 0.25);

  // 1回の振り（片道）を実行
  const swing = () => {
    if (!isPlayingRef.current) return;

    const maxAngle = getMaxAngle();
    const targetAngle = directionRef.current === 'right' ? maxAngle : -maxAngle;

    rotation.value = withTiming(targetAngle, {
      duration: beatDuration,
      easing: Easing.bezier(0.45, 0, 0.55, 1),
    });

    directionRef.current = directionRef.current === 'right' ? 'left' : 'right';

    animationTimeoutRef.current = setTimeout(() => {
      swing();
    }, beatDuration);
  };

  useEffect(() => {
    if (isPlaying) {
      directionRef.current = 'right';
      rotation.value = 0;
      swing();
    } else {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
        animationTimeoutRef.current = null;
      }
      cancelAnimation(rotation);
      rotation.value = withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.exp),
      });
    }

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
      cancelAnimation(rotation);
    };
  }, [isPlaying, tempo]);

  const rodHeight = height * 0.65;
  const weightSize = 26;
  const pivotOffset = rodHeight; // 支点から見た回転半径

  // 振り子のアニメーションスタイル
  // 支点を下端にするため、translateYで位置を調整してから回転
  const pendulumStyle = useAnimatedStyle(() => {
    return {
      transform: [
        // 回転の中心を下端にするためのオフセット
        { translateY: pivotOffset / 2 },
        { rotate: `${rotation.value}deg` },
        { translateY: -pivotOffset / 2 },
      ],
    };
  });

  return (
    <View style={[styles.container, { height }]}>
      {/* 目盛り（背景） */}
      <View style={styles.scaleContainer}>
        <View style={[styles.scaleLine, styles.scaleLineOuter]} />
        <View style={[styles.scaleLine, styles.scaleLineInner]} />
        <View style={[styles.scaleLine, styles.scaleLineCenter]} />
        <View style={[styles.scaleLine, styles.scaleLineInner]} />
        <View style={[styles.scaleLine, styles.scaleLineOuter]} />
      </View>

      {/* 振り子本体 */}
      <Animated.View 
        style={[
          styles.pendulum, 
          { height: rodHeight + weightSize },
          pendulumStyle
        ]}
      >
        {/* 重り（上端） */}
        <View 
          style={[
            styles.weight, 
            { 
              width: weightSize, 
              height: weightSize, 
              borderRadius: weightSize / 2,
            }
          ]} 
        />
        
        {/* 棒 */}
        <View style={[styles.rod, { height: rodHeight }]} />
      </Animated.View>

      {/* 支点（下端・回転の中心） */}
      <View style={styles.pivot} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    paddingBottom: 8,
  },
  pendulum: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    position: 'absolute',
    bottom: 8,
  },
  rod: {
    width: 4,
    backgroundColor: colors.text.secondary,
    borderRadius: 2,
  },
  weight: {
    backgroundColor: colors.functional.rhythm,
    marginBottom: -2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 4,
    borderWidth: 2,
    borderColor: colors.background.secondary,
  },
  pivot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.functional.rhythm,
    borderWidth: 2,
    borderColor: colors.background.secondary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
    zIndex: 10,
  },
  scaleContainer: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    width: '75%',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  scaleLine: {
    width: 2,
    backgroundColor: colors.border.default,
    borderRadius: 1,
  },
  scaleLineOuter: {
    height: 12,
  },
  scaleLineInner: {
    height: 18,
  },
  scaleLineCenter: {
    height: 24,
    backgroundColor: colors.text.muted,
  },
});
