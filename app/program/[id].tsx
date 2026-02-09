/**
 * プログラム編集画面
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors, typography, spacing } from '../../styles';
import { useProgramStore } from '../../stores';
import { Section } from '../../types';
import { SectionItem, SectionEditor, TimeSignatureSequenceEditor, QRCodeExportModal, ProgramTextInput } from '../../components/program';
import {
  getProgram,
  formatDuration,
  getEstimatedDuration,
  getTotalMeasures,
} from '../../utils/programUtils';

export default function ProgramEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const {
    currentProgram,
    setCurrentProgram,
    saveProgram,
    deleteProgram,
    addSection,
    removeSection,
    updateSection,
    duplicateSection,
    updateCurrentProgram,
    saveAsTemplate,
  } = useProgramStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [programName, setProgramName] = useState('');
  const [timeSignatureSequenceModalVisible, setTimeSignatureSequenceModalVisible] = useState(false);
  const [sequenceEditingSection, setSequenceEditingSection] = useState<Section | null>(null);
  const [qrExportModalVisible, setQrExportModalVisible] = useState(false);
  const [textInputModalVisible, setTextInputModalVisible] = useState(false);

  // 横画面固定
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      return () => {
        // 画面を離れる時は何もしない（home.tsxで管理）
      };
    }, [])
  );

  // プログラムを読み込み
  useEffect(() => {
    const loadProgram = async () => {
      if (id && (!currentProgram || currentProgram.id !== id)) {
        const program = await getProgram(id);
        if (program) {
          setCurrentProgram(program);
          setProgramName(program.name);
        } else {
          Alert.alert('エラー', 'プログラムが見つかりません', [
            { text: 'OK', onPress: () => router.back() },
          ]);
        }
      } else if (currentProgram) {
        setProgramName(currentProgram.name);
      }
    };
    loadProgram();
  }, [id, currentProgram?.id]);

  // 保存
  const handleSave = async () => {
    if (!currentProgram) {
      if (Platform.OS === 'web') {
        window.alert('エラー: プログラムが読み込まれていません');
      } else {
        Alert.alert('エラー', 'プログラムが読み込まれていません');
      }
      return;
    }

    // プログラム名を更新
    const updatedProgram = {
      ...currentProgram,
      name: programName.trim() || currentProgram.name,
    };

    try {
      updateCurrentProgram(updatedProgram);
      await saveProgram(updatedProgram);
      setCurrentProgram(updatedProgram);
      if (Platform.OS === 'web') {
        window.alert('保存完了: プログラムを保存しました');
      } else {
        Alert.alert('保存完了', 'プログラムを保存しました');
      }
    } catch (err) {
      console.error('Save error:', err);
      const errorMsg = `保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
      if (Platform.OS === 'web') {
        window.alert(`エラー: ${errorMsg}`);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  // 再生画面に移動
  const handlePlay = () => {
    if (!currentProgram) return;
    router.push(`/program/play?id=${currentProgram.id}`);
  };

  // セクション編集を開始
  const handleEditSection = (section: Section) => {
    setEditingSection(section);
    setIsEditing(true);
  };

  // セクション編集を保存
  const handleSaveSection = (updates: Partial<Section>) => {
    if (editingSection) {
      updateSection(editingSection.id, updates);
    }
    setIsEditing(false);
    setEditingSection(null);
  };

  // セクション削除
  const handleDeleteSection = (sectionId: string) => {
    if (!currentProgram) return;

    if (currentProgram.sections.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert('削除できません: 最低1つのセクションが必要です');
      } else {
        Alert.alert('削除できません', '最低1つのセクションが必要です');
      }
      return;
    }

    if (Platform.OS === 'web') {
      if (window.confirm('このセクションを削除しますか？')) {
        removeSection(sectionId);
      }
    } else {
      Alert.alert('セクション削除', 'このセクションを削除しますか？', [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => removeSection(sectionId),
        },
      ]);
    }
  };

  // セクション追加
  const handleAddSection = () => {
    addSection();
  };

  // テンプレートとして保存
  const handleSaveAsTemplate = async () => {
    if (!currentProgram) {
      if (Platform.OS === 'web') {
        window.alert('エラー: プログラムが読み込まれていません');
      } else {
        Alert.alert('エラー', 'プログラムが読み込まれていません');
      }
      return;
    }

    try {
      await saveAsTemplate(currentProgram);
      if (Platform.OS === 'web') {
        window.alert('テンプレートとして保存しました');
      } else {
        Alert.alert('完了', 'テンプレートとして保存しました');
      }
    } catch (err) {
      console.error('Save as template error:', err);
      const errorMsg = `テンプレートの保存に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
      if (Platform.OS === 'web') {
        window.alert(`エラー: ${errorMsg}`);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  // プログラム削除
  const handleDeleteProgram = async () => {
    if (!currentProgram) {
      if (Platform.OS === 'web') {
        window.alert('エラー: プログラムが読み込まれていません');
      } else {
        Alert.alert('エラー', 'プログラムが読み込まれていません');
      }
      return;
    }
    
    const doDelete = Platform.OS === 'web'
      ? window.confirm(`「${currentProgram.name}」を削除しますか？`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '削除確認',
            `「${currentProgram.name}」を削除しますか？`,
            [
              { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
              { text: '削除', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (doDelete) {
      try {
        await deleteProgram(currentProgram.id);
        router.back();
      } catch (err) {
        console.error('Delete error:', err);
        const errorMsg = `プログラムの削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
        if (Platform.OS === 'web') {
          window.alert(`エラー: ${errorMsg}`);
        } else {
          Alert.alert('エラー', errorMsg);
        }
      }
    }
  };

  if (!currentProgram) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  const totalMeasures = getTotalMeasures(currentProgram);
  const estimatedDuration = getEstimatedDuration(currentProgram);
  const topPadding = Math.max(insets.top, 4);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* ヘッダー */}
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <Pressable style={styles.actionButton} onPress={() => setQrExportModalVisible(true)}>
            <Text style={styles.actionButtonText}>エクスポート</Text>
          </Pressable>
          <Pressable style={styles.playButtonSmall} onPress={handlePlay}>
            <Text style={styles.playButtonText}>▶ 再生</Text>
          </Pressable>
          <Pressable style={styles.templateButton} onPress={handleSaveAsTemplate}>
            <Text style={styles.templateButtonText}>テンプレート保存</Text>
          </Pressable>
          <Pressable style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>保存</Text>
          </Pressable>
          <Pressable style={styles.deleteButton} onPress={handleDeleteProgram}>
            <Text style={styles.deleteButtonText}>削除</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={styles.content}>
        {/* プログラム情報 */}
        <View style={styles.programInfo}>
          <TextInput
            style={styles.programNameInput}
            value={programName}
            onChangeText={setProgramName}
            placeholder="プログラム名"
            placeholderTextColor={colors.text.muted}
          />
          <View style={styles.programStats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{currentProgram.sections.length}</Text>
              <Text style={styles.statLabel}>セクション</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{totalMeasures}</Text>
              <Text style={styles.statLabel}>小節</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{formatDuration(estimatedDuration)}</Text>
              <Text style={styles.statLabel}>推定時間</Text>
            </View>
          </View>
        </View>

        {/* セクションリスト */}
        <View style={styles.sectionList}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>セクション一覧</Text>
            <View style={styles.sectionActions}>
              <Pressable style={styles.textInputButton} onPress={() => setTextInputModalVisible(true)}>
                <Text style={styles.textInputButtonText}>テキスト入力</Text>
              </Pressable>
              <Pressable style={styles.addSectionButton} onPress={handleAddSection}>
                <Text style={styles.addSectionText}>+ 追加</Text>
              </Pressable>
            </View>
          </View>

          {currentProgram.sections.map((section, index) => (
            <SectionItem
              key={section.id}
              section={section}
              index={index}
              onPress={() => handleEditSection(section)}
              onEdit={() => handleEditSection(section)}
              onDelete={() => handleDeleteSection(section.id)}
              onDuplicate={() => duplicateSection(section.id)}
              onTimeSignatureSequence={() => {
                setSequenceEditingSection(section);
                setTimeSignatureSequenceModalVisible(true);
              }}
            />
          ))}
        </View>

        {/* 使い方ヒント */}
        <View style={styles.hints}>
          <Text style={styles.hintTitle}>使い方</Text>
          <Text style={styles.hintText}>
            • セクションをタップして編集{'\n'}
            • 「複製」で同じ設定のセクションをコピー{'\n'}
            • 「+ 追加」で新しいセクションを末尾に追加{'\n'}
            • 編集後は必ず「保存」ボタンで保存{'\n'}
            • 「▶ 再生」でプログラムを実行
          </Text>
        </View>
      </ScrollView>

      {/* セクション編集モーダル */}
      {editingSection && (
        <SectionEditor
          section={editingSection}
          visible={isEditing}
          onSave={handleSaveSection}
          onCancel={() => {
            setIsEditing(false);
            setEditingSection(null);
          }}
        />
      )}

      {/* 拍子シーケンス編集モーダル */}
      {sequenceEditingSection && (
        <TimeSignatureSequenceEditor
          visible={timeSignatureSequenceModalVisible}
          onClose={() => {
            setTimeSignatureSequenceModalVisible(false);
            setSequenceEditingSection(null);
          }}
          onApply={(sequence) => {
            // 各小節を別セクションに分割
            const sectionIndex = currentProgram.sections.findIndex(
              (s) => s.id === sequenceEditingSection.id
            );
            if (sectionIndex >= 0) {
              const newSections = sequence.map((ts, i) => ({
                ...sequenceEditingSection,
                id: `${sequenceEditingSection.id}-${i}`,
                name: `${sequenceEditingSection.name} (${i + 1})`,
                measures: 1,
                timeSignature: ts,
                countIn: i === 0 && sequenceEditingSection.countIn,
              }));

              // 既存のセクションを置き換え
              const updatedSections = [...currentProgram.sections];
              updatedSections.splice(sectionIndex, 1, ...newSections);
              updateCurrentProgram({ sections: updatedSections });
            }
            setTimeSignatureSequenceModalVisible(false);
            setSequenceEditingSection(null);
          }}
          initialMeasures={sequenceEditingSection.measures}
          initialTimeSignature={sequenceEditingSection.timeSignature}
        />
      )}

      {/* QRコードエクスポートモーダル */}
      <QRCodeExportModal
        visible={qrExportModalVisible}
        program={currentProgram}
        onClose={() => setQrExportModalVisible(false)}
      />

      {/* テキスト入力モーダル */}
      <ProgramTextInput
        visible={textInputModalVisible}
        onClose={() => setTextInputModalVisible(false)}
        onApply={(sections) => {
          // テキストから生成したセクションで置き換え
          updateCurrentProgram({ sections });
          Alert.alert('適用完了', `${sections.length}個のセクションを生成しました`);
        }}
        existingSections={currentProgram.sections}
        defaultTempo={currentProgram.sections[0]?.tempo || 120}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...typography.body,
    color: colors.text.muted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 11,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  playButtonSmall: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.ui.success,
    borderRadius: 6,
  },
  playButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  templateButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.functional.harmony,
    borderRadius: 6,
  },
  templateButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  saveButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.accent.primary,
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700', // 600から700に変更してボールドに
  },
  deleteButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: '#FF5252',
    borderRadius: 6,
  },
  deleteButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700', // 600から700に変更してボールドに
  },
  qrButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrButtonText: {
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  programInfo: {
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.background.secondary,
  },
  programNameInput: {
    ...typography.title,
    color: colors.text.primary,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  programStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    ...typography.heading,
    color: colors.accent.primary,
  },
  statLabel: {
    ...typography.caption,
    color: colors.text.muted,
  },
  sectionList: {
    padding: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.body,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  sectionActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  textInputButton: {
    backgroundColor: colors.functional.rhythm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  textInputButtonText: {
    ...typography.caption,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addSectionButton: {
    backgroundColor: colors.background.secondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 6,
  },
  addSectionText: {
    ...typography.caption,
    color: colors.accent.primary,
    fontWeight: '600',
  },
  hints: {
    padding: spacing.lg,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.lg,
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
  },
  hintTitle: {
    ...typography.caption,
    color: colors.text.secondary,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  hintText: {
    ...typography.caption,
    color: colors.text.muted,
    lineHeight: 20,
  },
});
