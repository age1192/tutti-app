/**
 * プリセット選択UI
 */
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { PresetManager } from './PresetManager';
import { usePresetStore } from '../../stores/usePresetStore';
import { useMetronomeStore } from '../../stores/useMetronomeStore';
import { useHarmonyStore } from '../../stores/useHarmonyStore';

interface PresetSelectorProps {
  type: 'metronome' | 'harmony' | 'playback';
}

export function PresetSelector({ type }: PresetSelectorProps) {
  const [managerVisible, setManagerVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [presetName, setPresetName] = useState('');

  const { 
    saveMetronomePreset, 
    saveHarmonyPreset, 
    savePlaybackPreset,
    loadAllPresets,
    playbackPresets,
  } = usePresetStore();
  const {
    tempo,
    timeSignature,
    subdivisionSettings,
    tone: metronomeTone,
  } = useMetronomeStore();
  const {
    tuning,
    tone: harmonyTone,
    basePitch,
    octave,
    transpose,
  } = useHarmonyStore();

  const handleSave = async () => {
    if (!presetName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('プリセット名を入力してください');
      } else {
        Alert.alert('エラー', 'プリセット名を入力してください');
      }
      return;
    }

    try {
      if (type === 'metronome') {
        await saveMetronomePreset({
          name: presetName.trim(),
          tempo,
          timeSignature,
          subdivisionSettings,
          tone: metronomeTone,
        });
      } else if (type === 'harmony') {
        await saveHarmonyPreset({
          name: presetName.trim(),
          tuning,
          tone: harmonyTone,
          basePitch,
          octave,
          transpose,
        });
      } else {
        // playback用のプリセット保存は呼び出し側で実装
        throw new Error('Playback preset save should be handled by parent component');
      }
      setPresetName('');
      setSaveModalVisible(false);
      if (Platform.OS === 'web') {
        window.alert('プリセットを保存しました');
      } else {
        Alert.alert('完了', 'プリセットを保存しました');
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
      if (Platform.OS === 'web') {
        window.alert('プリセットの保存に失敗しました');
      } else {
        Alert.alert('エラー', 'プリセットの保存に失敗しました');
      }
    }
  };

  const handleLoad = (presetId: string) => {
    const { metronomePresets, harmonyPresets, playbackPresets } = usePresetStore.getState();
    const presets = type === 'metronome' 
      ? metronomePresets 
      : type === 'harmony' 
      ? harmonyPresets 
      : playbackPresets;
    const preset = presets.find((p) => p.id === presetId);

    if (!preset) return;

    if (type === 'metronome') {
      const metronomePreset = preset as typeof metronomePresets[0];
      const { setTempo, setTimeSignature, setSubdivisionVolume, setTone } = useMetronomeStore.getState();
      setTempo(metronomePreset.tempo);
      setTimeSignature(metronomePreset.timeSignature);
      Object.entries(metronomePreset.subdivisionSettings).forEach(([key, value]) => {
        setSubdivisionVolume(key as any, value);
      });
      setTone(metronomePreset.tone);
    } else if (type === 'harmony') {
      const harmonyPreset = preset as typeof harmonyPresets[0];
      const { setTuning, setTone, setBasePitch, setOctave, setTranspose } = useHarmonyStore.getState();
      setTuning(harmonyPreset.tuning);
      setTone(harmonyPreset.tone);
      setBasePitch(harmonyPreset.basePitch);
      setOctave(harmonyPreset.octave);
      setTranspose(harmonyPreset.transpose as any);
    } else {
      // playback用のプリセット読み込みは呼び出し側で実装
      onSelect?.(presetId);
    }
  };

  return (
    <>
      <View style={styles.container}>
        <Pressable style={styles.button} onPress={() => setSaveModalVisible(true)}>
          <Text style={styles.buttonText}>保存</Text>
        </Pressable>
        <Pressable style={styles.button} onPress={() => setManagerVisible(true)}>
          <Text style={styles.buttonText}>読み込み</Text>
        </Pressable>
      </View>

      {/* 保存モーダル */}
      <Modal visible={saveModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>プリセット名</Text>
            <TextInput
              style={styles.input}
              value={presetName}
              onChangeText={setPresetName}
              placeholder="プリセット名を入力"
              placeholderTextColor={colors.text.muted}
              autoFocus
            />
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setPresetName('');
                  setSaveModalVisible(false);
                }}
              >
                <Text style={styles.modalButtonText}>キャンセル</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalButtonSave]} onPress={handleSave}>
                <Text style={[styles.modalButtonText, styles.modalButtonTextSave]}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* プリセット管理モーダル */}
      <PresetManager
        visible={managerVisible}
        onClose={() => setManagerVisible(false)}
        type={type}
        onSelect={handleLoad}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.xs, // mdからxsに変更して小さい画面に対応
    flexShrink: 1, // 小さい画面で縮小可能に
  },
  button: {
    paddingHorizontal: spacing.sm, // mdからsmに変更
    paddingVertical: spacing.xs, // smからxsに変更
    borderRadius: 8,
    backgroundColor: colors.accent.primary,
    minWidth: 50, // 最小幅を設定
  },
  buttonText: {
    fontSize: 12, // 14から12に変更して小さい画面に対応
    color: colors.background.secondary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 350,
  },
  modalTitle: {
    ...typography.heading,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  input: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  modalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.background.tertiary,
  },
  modalButtonSave: {
    backgroundColor: colors.accent.primary,
  },
  modalButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
  },
  modalButtonTextSave: {
    color: colors.background.secondary,
  },
});
