/**
 * 拍インジケーター
 * 現在の拍を視覚的に表示 - 全拍でアクティブ時に光る
 */
import { View, StyleSheet } from 'react-native';
import { colors, spacing } from '../../styles';

interface BeatIndicatorProps {
  beats: number;        // 総拍数
  currentBeat: number;  // 現在の拍（1-indexed、0は停止中）
  isPlaying: boolean;
  size?: 'normal' | 'compact'; // コンパクトモード対応
}

export function BeatIndicator({ beats, currentBeat, isPlaying, size = 'normal' }: BeatIndicatorProps) {
  const isCompact = size === 'compact';
  const dotSize = isCompact ? 14 : 18;
  const accentDotSize = isCompact ? 18 : 24;
  const gapSize = isCompact ? spacing.xs : spacing.sm;

  return (
    <View style={[styles.container, { gap: gapSize }]}>
      {Array.from({ length: beats }, (_, index) => {
        const beatNumber = index + 1;
        const isActive = isPlaying && currentBeat === beatNumber;
        const isAccent = beatNumber === 1;
        const currentSize = isAccent ? accentDotSize : dotSize;

        return (
          <View
            key={beatNumber}
            style={[
              styles.dot,
              {
                width: currentSize,
                height: currentSize,
                borderRadius: currentSize / 2,
              },
              isAccent && styles.dotAccent,
              isActive && styles.dotActive,
              isActive && isAccent && styles.dotActiveAccent,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  dotAccent: {
    backgroundColor: colors.background.tertiary,
    borderColor: colors.functional.rhythm,
    borderWidth: 2,
  },
  dotActive: {
    backgroundColor: colors.functional.rhythm,
    borderColor: colors.functional.rhythm,
    transform: [{ scale: 1.15 }],
    shadowColor: colors.functional.rhythm,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 8,
    elevation: 4,
  },
  dotActiveAccent: {
    backgroundColor: colors.functional.rhythm,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
});
