/**
 * 拍分割（サブディビジョン）コントロールコンポーネント
 * 4分音符、8分音符、3連符、16分音符の音量を個別に調整可能
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Slider from '@react-native-community/slider';
import { colors, typography, spacing } from '../../styles';
import { SubdivisionSettings, SubdivisionType } from '../../types';

interface SubdivisionControlProps {
  settings: SubdivisionSettings;
  onVolumeChange: (type: SubdivisionType, volume: number) => void;
}

// 分割タイプの定義
const SUBDIVISIONS: {
  type: SubdivisionType;
  label: string;
  symbol: string;
  description: string;
}[] = [
  { type: 'quarter', label: '4分', symbol: '♩', description: '1拍に1回' },
  { type: 'eighth', label: '8分', symbol: '♫', description: '1拍に2回' },
  { type: 'triplet', label: '3連', symbol: '3', description: '1拍に3回' },
  { type: 'sixteenth', label: '16分', symbol: '𝅘𝅥𝅯', description: '1拍に4回' },
];

export function SubdivisionControl({
  settings,
  onVolumeChange,
}: SubdivisionControlProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>拍分割</Text>
      <View style={styles.subdivisionList}>
        {SUBDIVISIONS.map((subdivision) => {
          const volume = settings[subdivision.type];
          const isActive = volume > 0;
          
          return (
            <View key={subdivision.type} style={styles.subdivisionItem}>
              {/* ヘッダー: ラベルとシンボル */}
              <Pressable
                style={[
                  styles.header,
                  isActive && styles.headerActive,
                ]}
                onPress={() => {
                  // タップでオン/オフ切り替え
                  if (isActive) {
                    onVolumeChange(subdivision.type, 0);
                  } else {
                    onVolumeChange(subdivision.type, subdivision.type === 'quarter' ? 1.0 : 0.5);
                  }
                }}
              >
                <Text style={[styles.symbol, isActive && styles.symbolActive]}>
                  {subdivision.symbol}
                </Text>
                <Text style={[styles.label, isActive && styles.labelActive]}>
                  {subdivision.label}
                </Text>
              </Pressable>
              
              {/* スライダー */}
              <View style={styles.sliderContainer}>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={1}
                  step={0.05}
                  value={volume}
                  onValueChange={(value) => onVolumeChange(subdivision.type, value)}
                  minimumTrackTintColor={isActive ? colors.functional.rhythm : colors.border.default}
                  maximumTrackTintColor={colors.border.default}
                  thumbTintColor={isActive ? colors.functional.rhythm : colors.text.muted}
                />
                <Text style={[styles.volumeText, isActive && styles.volumeTextActive]}>
                  {Math.round(volume * 100)}%
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
  },
  title: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: 11,
  },
  subdivisionList: {
    gap: spacing.md,
  },
  subdivisionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 72,
    gap: spacing.xs,
  },
  headerActive: {
    backgroundColor: colors.functional.rhythm,
  },
  symbol: {
    fontSize: 18,
    color: colors.text.muted,
  },
  symbolActive: {
    color: '#FFFFFF',
  },
  label: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  labelActive: {
    color: '#FFFFFF',
  },
  sliderContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  volumeText: {
    ...typography.caption,
    color: colors.text.muted,
    minWidth: 40,
    textAlign: 'right',
  },
  volumeTextActive: {
    color: colors.text.secondary,
  },
});
