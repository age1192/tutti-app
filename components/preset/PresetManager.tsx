/**
 * プリセット管理モーダル
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  Platform,
} from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { usePresetStore } from '../../stores/usePresetStore';
import { MetronomePreset, HarmonyPreset, PlaybackPreset } from '../../types';
import { PLAYBACK_TEMPLATES, isTemplateId } from '../../utils/playbackTemplates';

interface PresetManagerProps {
  visible: boolean;
  onClose: () => void;
  type: 'metronome' | 'harmony' | 'playback';
  onSelect?: (presetId: string) => void;
}

export function PresetManager({ visible, onClose, type, onSelect }: PresetManagerProps) {
  const {
    metronomePresets,
    harmonyPresets,
    playbackPresets,
    loadAllPresets,
    deleteMetronomePreset,
    deleteHarmonyPreset,
    deletePlaybackPreset,
  } = usePresetStore();

  const presets = type === 'metronome' 
    ? metronomePresets 
    : type === 'harmony' 
    ? harmonyPresets 
    : [...PLAYBACK_TEMPLATES, ...playbackPresets];
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    if (visible) {
      loadAllPresets().catch((err) => {
        console.error('Failed to load presets:', err);
      });
    }
  }, [visible, loadAllPresets]);

  const handleDelete = (id: string) => {
    const confirmMessage = 'このプリセットを削除しますか？';
    if (Platform.OS === 'web') {
      if (window.confirm(confirmMessage)) {
        try {
          if (type === 'metronome') {
            deleteMetronomePreset(id);
          } else if (type === 'harmony') {
            deleteHarmonyPreset(id);
          } else {
            deletePlaybackPreset(id);
          }
        } catch (err) {
          console.error('Error deleting preset:', err);
          window.alert('プリセットの削除に失敗しました');
        }
      }
    } else {
      Alert.alert('確認', confirmMessage, [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            try {
              if (type === 'metronome') {
                deleteMetronomePreset(id);
              } else if (type === 'harmony') {
                deleteHarmonyPreset(id);
              } else {
                deletePlaybackPreset(id);
              }
            } catch (err) {
              console.error('Error deleting preset:', err);
              Alert.alert('エラー', 'プリセットの削除に失敗しました');
            }
          },
        },
      ]);
    }
  };

  const handleSelect = async (presetId: string) => {
    try {
      // モーダルを閉じてから処理を実行（iOSでクラッシュを防ぐ）
      onClose();
      
      // 少し待ってから処理を実行（モーダルのアニメーション完了を待つ）
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onSelect?.(presetId);
    } catch (err) {
      console.error('Error selecting preset:', err);
      const errorMsg = err instanceof Error ? err.message : 'プリセットの選択に失敗しました';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>
              {type === 'metronome' 
                ? 'メトロノーム' 
                : type === 'harmony' 
                ? 'ハーモニー' 
                : 'コード再生'}プリセット
            </Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView 
            style={styles.content} 
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={true}
            nestedScrollEnabled={true}
          >
            {presets.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>プリセットがありません</Text>
              </View>
            ) : (
              presets.map((preset) => {
                const isTemplate = type === 'playback' && isTemplateId(preset.id);
                return (
                  <View key={preset.id} style={styles.presetItem}>
                    <Pressable
                      style={styles.presetContent}
                      onPress={() => handleSelect(preset.id)}
                    >
                      <Text style={styles.presetName}>{preset.name}</Text>
                      <Text style={styles.presetDate}>
                        {isTemplate
                          ? 'テンプレート'
                          : new Date(preset.createdAt).toLocaleDateString('ja-JP')}
                      </Text>
                    </Pressable>
                    {!isTemplate && (
                      <Pressable
                        style={styles.deleteButton}
                        onPress={() => handleDelete(preset.id)}
                      >
                        <Text style={styles.deleteButtonText}>削除</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    width: '100%',
    maxWidth: 400,
    maxHeight: '85%',
    minHeight: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 24,
    color: colors.text.secondary,
    fontWeight: '300',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  presetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  presetContent: {
    flex: 1,
  },
  presetName: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  presetDate: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text.muted,
  },
  deleteButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.status.error,
  },
  deleteButtonText: {
    ...typography.body,
    fontSize: 14,
    color: colors.background.secondary,
    fontWeight: '600',
  },
});
