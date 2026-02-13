/**
 * テンプレート選択モーダル
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  InteractionManager,
} from 'react-native';
import { colors, typography, spacing } from '../../styles';
import { useProgramStore } from '../../stores/useProgramStore';
import { Program } from '../../types';
import { formatDuration, getEstimatedDuration } from '../../utils/programUtils';

interface TemplateSelectorProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (templateId: string, name?: string) => Promise<void>;
}

export function TemplateSelector({ visible, onClose, onSelect }: TemplateSelectorProps) {
  const { templates, loadTemplates, isLoading } = useProgramStore();
  const [selectedTemplate, setSelectedTemplate] = useState<Program | null>(null);
  const [programName, setProgramName] = useState('');

  useEffect(() => {
    if (visible) {
      const task = InteractionManager.runAfterInteractions(() => loadTemplates());
      return () => task.cancel();
    }
  }, [visible, loadTemplates]);

  const handleSelect = async () => {
    if (!selectedTemplate) {
      if (Platform.OS === 'web') {
        window.alert('テンプレートを選択してください');
      } else {
        Alert.alert('エラー', 'テンプレートを選択してください');
      }
      return;
    }

    try {
      await onSelect(selectedTemplate.id, programName.trim() || undefined);
      setSelectedTemplate(null);
      setProgramName('');
      onClose();
    } catch (error) {
      console.error('Failed to create from template:', error);
      if (Platform.OS === 'web') {
        window.alert('テンプレートからの作成に失敗しました');
      } else {
        Alert.alert('エラー', 'テンプレートからの作成に失敗しました');
      }
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType={Platform.OS === 'ios' ? 'none' : 'fade'}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>テンプレートから作成</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </Pressable>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>読み込み中...</Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>テンプレートがありません</Text>
            </View>
          ) : (
            <>
              <ScrollView style={styles.list} showsVerticalScrollIndicator={true}>
                {templates.map((item) => {
                  const isSelected = selectedTemplate?.id === item.id;
                  const duration = formatDuration(getEstimatedDuration(item));
                  return (
                    <Pressable
                      key={item.id}
                      style={[styles.templateItem, isSelected && styles.templateItemActive]}
                      onPress={() => {
                        setSelectedTemplate(item);
                        setProgramName(`${item.name} (コピー)`);
                      }}
                    >
                      <Text style={styles.templateName}>{item.name}</Text>
                      <Text style={styles.templateInfo}>
                        {item.sections.length}セクション / {duration}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {selectedTemplate && (
                <View style={styles.inputSection}>
                  <Text style={styles.inputLabel}>プログラム名</Text>
                  <TextInput
                    style={styles.input}
                    value={programName}
                    onChangeText={setProgramName}
                    placeholder="プログラム名を入力"
                    placeholderTextColor={colors.text.muted}
                  />
                </View>
              )}

              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelButtonText}>キャンセル</Text>
                </Pressable>
                <Pressable
                  style={[styles.createButton, !selectedTemplate && styles.createButtonDisabled]}
                  onPress={handleSelect}
                  disabled={!selectedTemplate}
                >
                  <Text
                    style={[
                      styles.createButtonText,
                      !selectedTemplate && styles.createButtonTextDisabled,
                    ]}
                  >
                    作成
                  </Text>
                </Pressable>
              </View>
            </>
          )}
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
    maxWidth: 500,
    maxHeight: '80%',
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
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
  },
  emptyState: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    ...typography.body,
    color: colors.text.muted,
  },
  list: {
    maxHeight: 300,
    padding: spacing.md,
  },
  templateItem: {
    padding: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateItemActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primaryLight,
  },
  templateName: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  templateInfo: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text.muted,
  },
  inputSection: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  inputLabel: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    alignItems: 'center',
  },
  cancelButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
  },
  createButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.accent.primary,
    alignItems: 'center',
  },
  createButtonDisabled: {
    backgroundColor: colors.border.default,
  },
  createButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.background.secondary,
    fontWeight: '600',
  },
  createButtonTextDisabled: {
    color: colors.text.muted,
  },
});
