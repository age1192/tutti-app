/**
 * タップテンポボタン
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../styles';

interface TapTempoButtonProps {
  onTap: () => void;
}

export function TapTempoButton({ onTap }: TapTempoButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        pressed && styles.buttonPressed,
      ]}
      onPress={onTap}
    >
      <Text style={styles.text}>TAP</Text>
      <Text style={styles.subtext}>タップでテンポ設定</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  buttonPressed: {
    backgroundColor: colors.accent.primaryLight,
    borderColor: colors.accent.primary,
  },
  text: {
    ...typography.heading,
    color: colors.functional.rhythm,
    fontSize: 28,
    fontWeight: '700',
  },
  subtext: {
    ...typography.caption,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
