/**
 * テンポ制御コンポーネント
 * スライダーと+/-ボタンでテンポを調整
 */
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { TEMPO_MIN, TEMPO_MAX } from '../../utils/constants';

interface TempoControlProps {
  tempo: number;
  onTempoChange: (tempo: number) => void;
  onIncrement: (amount?: number) => void;
  onDecrement: (amount?: number) => void;
}

export function TempoControl({
  tempo,
  onTempoChange,
  onIncrement,
  onDecrement,
}: TempoControlProps) {
  return (
    <View style={styles.container}>
      {/* テンポ表示 */}
      <View style={styles.tempoDisplay}>
        <Text style={styles.tempoValue}>{tempo}</Text>
        <Text style={styles.tempoUnit}>BPM</Text>
      </View>

      {/* +-ボタン */}
      <View style={styles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonLarge,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onDecrement(10)}
        >
          <Text style={styles.buttonText}>-10</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onDecrement(1)}
        >
          <Text style={styles.buttonText}>-1</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onIncrement(1)}
        >
          <Text style={styles.buttonText}>+1</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.button,
            styles.buttonLarge,
            pressed && styles.buttonPressed,
          ]}
          onPress={() => onIncrement(10)}
        >
          <Text style={styles.buttonText}>+10</Text>
        </Pressable>
      </View>

      {/* テンポ範囲表示 */}
      <Text style={styles.rangeText}>
        {TEMPO_MIN} - {TEMPO_MAX} BPM
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  tempoDisplay: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tempoValue: {
    ...typography.displayLarge,
    color: colors.functional.rhythm,
  },
  tempoUnit: {
    ...typography.body,
    color: colors.text.secondary,
    marginTop: -spacing.sm,
    fontSize: 14,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  button: {
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    minWidth: 56,
    alignItems: 'center',
  },
  buttonLarge: {
    minWidth: 64,
    backgroundColor: colors.background.tertiary,
  },
  buttonPressed: {
    backgroundColor: colors.accent.primaryDark,
  },
  buttonText: {
    ...typography.body,
    color: colors.text.primary,
    fontWeight: '600',
  },
  rangeText: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.sm,
  },
});
