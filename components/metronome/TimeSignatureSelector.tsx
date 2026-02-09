/**
 * 拍子選択コンポーネント
 */
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { TIME_SIGNATURES } from '../../utils/constants';
import { TimeSignature } from '../../types';

interface TimeSignatureSelectorProps {
  currentSignature: TimeSignature;
  onSelect: (signature: TimeSignature) => void;
}

export function TimeSignatureSelector({
  currentSignature,
  onSelect,
}: TimeSignatureSelectorProps) {
  const formatSignature = (sig: TimeSignature) => `${sig.numerator}/${sig.denominator}`;

  const isSelected = (sig: TimeSignature) =>
    sig.numerator === currentSignature.numerator &&
    sig.denominator === currentSignature.denominator;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>拍子</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {TIME_SIGNATURES.map((sig, index) => (
          <Pressable
            key={index}
            style={[
              styles.option,
              isSelected(sig) && styles.optionSelected,
            ]}
            onPress={() => onSelect(sig)}
          >
            <Text
              style={[
                styles.optionText,
                isSelected(sig) && styles.optionTextSelected,
              ]}
            >
              {formatSignature(sig)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    ...typography.caption,
    color: colors.text.muted,
    marginBottom: spacing.md,
    textAlign: 'center',
    fontSize: 11,
  },
  scrollContent: {
    paddingHorizontal: spacing.sm,
    gap: spacing.md,
  },
  option: {
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  optionSelected: {
    backgroundColor: colors.functional.rhythm,
  },
  optionText: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  optionTextSelected: {
    color: '#FFFFFF',
  },
});
