/**
 * コード進行パッドコンポーネント
 * 
 * タップ＆ホールドでコード再生、ドラッグで特定の音をフォーカス
 * - 上ドラッグ: Root Only
 * - 左ドラッグ: 3rd Only
 * - 右ドラッグ: 5th Only
 * - 中央: Full Chord
 */
import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import { colors, spacing } from '../../styles';
import { useHaptics } from '../../hooks';

// フォーカスモード
export type FocusMode = 'full' | 'root' | 'third' | 'fifth';

// コードの構成音
export interface ChordVoices {
  root: number;   // Root音のMIDIノート
  third: number;  // 3rd音のMIDIノート
  fifth: number;  // 5th音のMIDIノート
}

interface ChordPadProps {
  // 表示名（例: "I", "IV", "V"）
  label: string;
  // サブラベル（例: "C", "F", "G"）
  subLabel?: string;
  // コードの構成音
  voices: ChordVoices;
  // コード開始時のコールバック
  onChordStart?: (voices: ChordVoices) => void;
  // コード終了時のコールバック
  onChordStop?: () => void;
  // 音量変更時のコールバック（voicePart: 音声パート, volume: 0.0-1.0）
  onVolumeChange?: (voicePart: 'root' | 'third' | 'fifth', volume: number) => void;
  // フォーカスモード変更時のコールバック
  onFocusModeChange?: (mode: FocusMode) => void;
  // サイズ
  size?: number;
  // 無効状態
  disabled?: boolean;
  // ホールドモード（trueの時は音が持続する）
  holdMode?: boolean;
}

// ジェスチャー閾値（px）
const GESTURE_THRESHOLD = 25;

// モードごとの色
const MODE_COLORS: Record<FocusMode, string> = {
  full: colors.functional.harmony,
  root: '#E91E63',  // ピンク - Root
  third: '#2196F3', // 青 - 3rd
  fifth: '#4CAF50', // 緑 - 5th
};

export const ChordPad: React.FC<ChordPadProps> = ({
  label,
  subLabel,
  voices,
  onChordStart,
  onChordStop,
  onVolumeChange,
  onFocusModeChange,
  size = 100,
  disabled = false,
  holdMode = false,
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const [focusMode, setFocusMode] = useState<FocusMode>('full');
  const { lightImpact, mediumImpact } = useHaptics();
  
  // アニメーション用
  const scale = useRef(new Animated.Value(1)).current;
  const indicatorOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  
  // タッチ開始位置を記録
  const touchStart = useRef({ x: 0, y: 0 });
  const currentMode = useRef<FocusMode>('full');

  // 方向からモードを判定
  const getModeFromOffset = useCallback((dx: number, dy: number): FocusMode => {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    
    // 閾値以下なら Full Chord
    if (absX < GESTURE_THRESHOLD && absY < GESTURE_THRESHOLD) {
      return 'full';
    }
    
    // X軸とY軸のどちらが大きいか
    if (absY > absX) {
      // 上下方向
      if (dy < -GESTURE_THRESHOLD) {
        return 'root'; // 上
      }
      return 'full'; // 下は Full に戻る
    } else {
      // 左右方向
      if (dx < -GESTURE_THRESHOLD) {
        return 'third'; // 左
      } else if (dx > GESTURE_THRESHOLD) {
        return 'fifth'; // 右
      }
    }
    
    return 'full';
  }, []);

  // 音量を更新（フォーカスモードでは他の音を完全ミュート）
  const updateVolumes = useCallback((mode: FocusMode) => {
    if (!onVolumeChange) return;
    
    switch (mode) {
      case 'full':
        onVolumeChange('root', 1.0);
        onVolumeChange('third', 1.0);
        onVolumeChange('fifth', 1.0);
        break;
      case 'root':
        onVolumeChange('root', 1.0);
        onVolumeChange('third', 0.0);
        onVolumeChange('fifth', 0.0);
        break;
      case 'third':
        onVolumeChange('root', 0.0);
        onVolumeChange('third', 1.0);
        onVolumeChange('fifth', 0.0);
        break;
      case 'fifth':
        onVolumeChange('root', 0.0);
        onVolumeChange('third', 0.0);
        onVolumeChange('fifth', 1.0);
        break;
    }
  }, [onVolumeChange]);

  // PanResponder の設定
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !disabled,
    onMoveShouldSetPanResponder: () => !disabled,
    
    onPanResponderGrant: (evt) => {
      // タッチ開始
      setIsPressed(true);
      setFocusMode('full');
      currentMode.current = 'full';
      touchStart.current = {
        x: evt.nativeEvent.pageX,
        y: evt.nativeEvent.pageY,
      };
      
      // スケールアニメーション
      Animated.spring(scale, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
      
      // コード開始
      onChordStart?.(voices);
      updateVolumes('full');
      onFocusModeChange?.('full');
      mediumImpact();
    },
    
    onPanResponderMove: (evt, gestureState) => {
      // ドラッグ中
      const dx = gestureState.dx;
      const dy = gestureState.dy;
      
      // インジケーター位置を更新（制限付き）
      const maxOffset = size / 3;
      const clampedX = Math.max(-maxOffset, Math.min(maxOffset, dx));
      const clampedY = Math.max(-maxOffset, Math.min(maxOffset, dy));
      indicatorOffset.setValue({ x: clampedX, y: clampedY });
      
      // モード判定
      const newMode = getModeFromOffset(dx, dy);
      
      // モードが変わった場合
      if (newMode !== currentMode.current) {
        currentMode.current = newMode;
        setFocusMode(newMode);
        updateVolumes(newMode);
        onFocusModeChange?.(newMode);
        lightImpact();
      }
    },
    
    onPanResponderRelease: () => {
      // タッチ終了
      setIsPressed(false);
      setFocusMode('full');
      currentMode.current = 'full';
      
      // アニメーションリセット
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(indicatorOffset, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }),
      ]).start();
      
      // ホールドモードがOFFの時のみコード終了
      if (!holdMode) {
        onChordStop?.();
      }
    },
    
    onPanResponderTerminate: () => {
      // 中断時
      setIsPressed(false);
      setFocusMode('full');
      currentMode.current = 'full';
      
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.spring(indicatorOffset, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: true,
        }),
      ]).start();
      
      // ホールドモードがOFFの時のみコード終了
      if (!holdMode) {
        onChordStop?.();
      }
    },
  }), [disabled, voices, size, getModeFromOffset, updateVolumes, onChordStart, onChordStop, onFocusModeChange, lightImpact, mediumImpact, scale, indicatorOffset]);

  // 現在のモードの色
  const currentColor = MODE_COLORS[focusMode];

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.pad,
          {
            width: size,
            height: size,
            borderRadius: size / 6,
            backgroundColor: isPressed ? currentColor : colors.background.secondary,
            transform: [{ scale }],
          },
        ]}
      >
        {/* 方向インジケーター */}
        <View style={styles.directionIndicators}>
          <Text style={[styles.directionText, styles.directionUp, focusMode === 'root' && styles.directionActive]}>
            R
          </Text>
          <View style={styles.directionRow}>
            <Text style={[styles.directionText, styles.directionLeft, focusMode === 'third' && styles.directionActive]}>
              3
            </Text>
            <Text style={[styles.directionText, styles.directionRight, focusMode === 'fifth' && styles.directionActive]}>
              5
            </Text>
          </View>
        </View>

        {/* メインラベル */}
        <View style={styles.labelContainer}>
          <Text style={[styles.label, isPressed && styles.labelActive]}>
            {label}
          </Text>
          {subLabel && (
            <Text style={[styles.subLabel, isPressed && styles.subLabelActive]}>
              {subLabel}
            </Text>
          )}
        </View>

        {/* タッチインジケーター */}
        {isPressed && (
          <Animated.View
            style={[
              styles.touchIndicator,
              {
                transform: [
                  { translateX: indicatorOffset.x },
                  { translateY: indicatorOffset.y },
                ],
              },
            ]}
          />
        )}

        {/* モード表示 */}
        {isPressed && focusMode !== 'full' && (
          <View style={[styles.modeIndicator, { backgroundColor: currentColor }]}>
            <Text style={styles.modeText}>
              {focusMode === 'root' ? 'Root' : focusMode === 'third' ? '3rd' : '5th'}
            </Text>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  pad: {
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
    overflow: 'hidden',
    position: 'relative',
  },
  directionIndicators: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'space-between',
    padding: 8,
  },
  directionText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.text.muted,
    opacity: 0.5,
  },
  directionUp: {
    alignSelf: 'center',
  },
  directionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  directionLeft: {},
  directionRight: {},
  directionActive: {
    color: '#FFFFFF',
    opacity: 1,
  },
  labelContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  label: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text.primary,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  subLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
    marginTop: 2,
  },
  subLabelActive: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  touchIndicator: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  modeIndicator: {
    position: 'absolute',
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  modeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
