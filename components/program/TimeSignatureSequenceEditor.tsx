/**
 * 拍子シーケンスエディタ
 * 1小節ごとに拍子が変わる曲（アルメニアンダンスなど）の入力支援
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView, TextInput, Platform } from 'react-native';
import { TimeSignature } from '../../types';
import { colors, spacing } from '../../styles';
import { TIME_SIGNATURES } from '../../utils/constants';
import { formatTimeSignature } from '../../utils/programUtils';

interface TimeSignatureSequenceEditorProps {
  visible: boolean;
  onClose: () => void;
  onApply: (sequence: TimeSignature[]) => void;
  initialMeasures: number;
  initialTimeSignature: TimeSignature;
}

export const TimeSignatureSequenceEditor: React.FC<TimeSignatureSequenceEditorProps> = ({
  visible,
  onClose,
  onApply,
  initialMeasures,
  initialTimeSignature,
}) => {
  const [sequence, setSequence] = useState<TimeSignature[]>(
    Array(initialMeasures).fill(initialTimeSignature)
  );

  const handleTimeSignatureChange = (index: number, ts: TimeSignature) => {
    const newSequence = [...sequence];
    newSequence[index] = ts;
    setSequence(newSequence);
  };

  const handleApply = () => {
    onApply(sequence);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>拍子シーケンス編集</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <Text style={styles.description}>
            各小節の拍子を設定してください
          </Text>

          <ScrollView style={styles.sequenceContainer}>
            {sequence.map((ts, index) => (
              <View key={index} style={styles.measureRow}>
                <Text style={styles.measureLabel}>小節 {index + 1}</Text>
                <View style={styles.timeSignatureButtons}>
                  {TIME_SIGNATURES.map((sig) => (
                    <Pressable
                      key={`${sig.numerator}-${sig.denominator}`}
                      style={[
                        styles.tsButton,
                        ts.numerator === sig.numerator &&
                          ts.denominator === sig.denominator &&
                          styles.tsButtonActive,
                      ]}
                      onPress={() => handleTimeSignatureChange(index, sig)}
                    >
                      <Text
                        style={[
                          styles.tsButtonText,
                          ts.numerator === sig.numerator &&
                            ts.denominator === sig.denominator &&
                            styles.tsButtonTextActive,
                        ]}
                      >
                        {formatTimeSignature(sig)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>キャンセル</Text>
            </Pressable>
            <Pressable style={styles.applyBtn} onPress={handleApply}>
              <Text style={styles.applyBtnText}>適用</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 18,
    color: colors.text.secondary,
  },
  description: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing.md,
  },
  sequenceContainer: {
    maxHeight: 400,
    marginBottom: spacing.md,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
    paddingVertical: spacing.xs,
  },
  measureLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
    width: 60,
  },
  timeSignatureButtons: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tsButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tsButtonActive: {
    borderColor: colors.functional.rhythm,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  tsButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tsButtonTextActive: {
    color: colors.functional.rhythm,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  applyBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    backgroundColor: colors.functional.rhythm,
    borderRadius: 8,
    alignItems: 'center',
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
