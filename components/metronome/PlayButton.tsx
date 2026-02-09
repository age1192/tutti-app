/**
 * 再生/停止ボタン
 */
import { Pressable, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing } from '../../styles';

interface PlayButtonProps {
  isPlaying: boolean;
  onPress: () => void;
}

export function PlayButton({ isPlaying, onPress }: PlayButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        isPlaying ? styles.buttonPlaying : styles.buttonStopped,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
    >
      <Text style={styles.icon}>{isPlaying ? '⏹' : '▶'}</Text>
      <Text style={styles.text}>{isPlaying ? '停止' : '再生'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    gap: spacing.sm,
  },
  buttonStopped: {
    backgroundColor: colors.functional.rhythm,
  },
  buttonPlaying: {
    backgroundColor: colors.functional.stop,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  icon: {
    fontSize: 24,
  },
  text: {
    ...typography.heading,
    color: '#FFFFFF',
    fontSize: 20,
  },
});
