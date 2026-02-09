/**
 * プリセット選択UI
 */
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Modal, Alert, Platform } from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { PresetManager } from './PresetManager';
import { usePresetStore } from '../../stores/usePresetStore';
import { useMetronomeStore } from '../../stores/useMetronomeStore';
import { useHarmonyStore } from '../../stores/useHarmonyStore';

interface PresetSelectorProps {
  type: 'metronome' | 'harmony' | 'playback';
  screenWidth?: number;
}

export function PresetSelector({ type, screenWidth = 800 }: PresetSelectorProps) {
  const [managerVisible, setManagerVisible] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [presetName, setPresetName] = useState('');

  // 画面幅に応じた動的スタイル計算
  const dynamicStyles = useMemo(() => {
    const isSmallScreen = screenWidth < 400;
    const isLargeScreen = screenWidth >= 800;
    
    return {
      button: {
        paddingHorizontal: isSmallScreen ? spacing.xs : isLargeScreen ? spacing.md : spacing.sm,
        paddingVertical: isSmallScreen ? 4 : isLargeScreen ? 8 : 6,
        borderRadius: isSmallScreen ? 6 : isLargeScreen ? 10 : 8,
        minWidth: isSmallScreen ? 45 : isLargeScreen ? 70 : 55,
      },
      buttonText: {
        fontSize: isSmallScreen ? 11 : isLargeScreen ? 15 : 13,
      },
    };
  }, [screenWidth]);

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
      // モーダルを閉じる前に少し遅延を入れてiOSでのクラッシュを防ぐ
      setTimeout(() => {
        setSaveModalVisible(false);
        if (Platform.OS === 'web') {
          window.alert('プリセットを保存しました');
        } else {
          Alert.alert('完了', 'プリセットを保存しました');
        }
      }, 100);
    } catch (error) {
      console.error('Failed to save preset:', error);
      const errorMsg = error instanceof Error ? error.message : 'プリセットの保存に失敗しました';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  const handleLoad = (presetId: string) => {
    try {
      const { metronomePresets, harmonyPresets, playbackPresets } = usePresetStore.getState();
      const presets = type === 'metronome' 
        ? metronomePresets 
        : type === 'harmony' 
        ? harmonyPresets 
        : playbackPresets;
      const preset = presets.find((p) => p.id === presetId);

      if (!preset) {
        console.warn('Preset not found:', presetId);
        return;
      }

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
    } catch (err) {
      console.error('Error loading preset:', err);
      Alert.alert('エラー', 'プリセットの読み込みに失敗しました');
    }
  };

  return (
    <>
      <View style={styles.container}>
        <Pressable style={[styles.button, dynamicStyles.button]} onPress={() => setSaveModalVisible(true)}>
          <Text style={[styles.buttonText, dynamicStyles.buttonText]}>保存</Text>
        </Pressable>
        <Pressable style={[styles.button, dynamicStyles.button]} onPress={() => setManagerVisible(true)}>
          <Text style={[styles.buttonText, dynamicStyles.buttonText]}>読み込み</Text>
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
    gap: spacing.xs,
    flexShrink: 1,
  },
  button: {
    backgroundColor: colors.accent.primary,
  },
  buttonText: {
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
