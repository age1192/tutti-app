/**
 * プログラムリスト画面（横画面最適化）
 */
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  Alert,
  TextInput,
  Modal,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors, typography, spacing } from '../../styles';
import { useProgramStore } from '../../stores';
import { Program } from '../../types';
import {
  formatDuration,
  getEstimatedDuration,
  getTotalMeasures,
  generateId,
} from '../../utils/programUtils';
import { LANDSCAPE_SAFE_AREA_INSET } from '../../utils/constants';
import { QRCodeImportModal, TemplateSelector } from '../../components/program';

export default function ProgramListScreen() {
  const {
    programs,
    isLoading,
    error,
    loadPrograms,
    createProgram,
    deleteProgram,
    saveProgram,
    setCurrentProgram,
    createFromTemplate,
    clearError,
  } = useProgramStore();

  const insets = useSafeAreaInsets();
  const [showNewModal, setShowNewModal] = useState(false);
  const [newProgramName, setNewProgramName] = useState('');
  const [qrImportModalVisible, setQrImportModalVisible] = useState(false);
  const [templateSelectorVisible, setTemplateSelectorVisible] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const isLandscape = dimensions.width > dimensions.height;

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // 横画面固定（home.tsxで管理されているが、念のため）
  useFocusEffect(
    useCallback(() => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      loadPrograms();
      
      return () => {
        // 画面を離れる時は何もしない（home.tsxで管理）
      };
    }, [loadPrograms])
  );

  // エラー表示
  useEffect(() => {
    if (error) {
      Alert.alert('エラー', error, [{ text: 'OK', onPress: clearError }]);
    }
  }, [error]);

  // 新規プログラム作成
  const handleCreateProgram = async () => {
    if (!newProgramName.trim()) {
      Alert.alert('エラー', 'プログラム名を入力してください');
      return;
    }

    try {
      const program = await createProgram(newProgramName.trim());
      if (!program || !program.id) {
        throw new Error('プログラムの作成に失敗しました');
      }
      setShowNewModal(false);
      setNewProgramName('');
      // iOSでrouter.pushが失敗する可能性があるため、try-catchで囲む
      try {
        router.push(`/program/${program.id}`);
      } catch (routerError) {
        console.error('Router push error:', routerError);
        // フォールバック: プログラムを設定してからナビゲート
        setCurrentProgram(program);
        setTimeout(() => {
          router.push(`/program/${program.id}`);
        }, 100);
      }
    } catch (err) {
      console.error('Create program error:', err);
      const errorMsg = err instanceof Error ? err.message : 'プログラムの作成に失敗しました';
      Alert.alert('エラー', errorMsg);
    }
  };

  // プログラム削除
  const handleDeleteProgram = async (program: Program) => {
    const doDelete = Platform.OS === 'web'
      ? window.confirm(`「${program.name}」を削除しますか？`)
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '削除確認',
            `「${program.name}」を削除しますか？`,
            [
              { text: 'キャンセル', style: 'cancel', onPress: () => resolve(false) },
              { text: '削除', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (doDelete) {
      try {
        await deleteProgram(program.id);
      } catch (err) {
        console.error('Delete program error:', err);
        const errorMsg = `プログラムの削除に失敗しました: ${err instanceof Error ? err.message : String(err)}`;
        if (Platform.OS === 'web') {
          window.alert(`エラー: ${errorMsg}`);
        } else {
          Alert.alert('エラー', errorMsg);
        }
      }
    }
  };

  // プログラムを選択して編集画面へ
  const handleSelectProgram = (program: Program) => {
    try {
      setCurrentProgram(program);
      router.push(`/program/${program.id}`);
    } catch (err) {
      console.error('Select program error:', err);
      Alert.alert('エラー', 'プログラムの選択に失敗しました');
    }
  };

  // プログラムを選択して再生画面へ
  const handlePlayProgram = (program: Program) => {
    try {
      setCurrentProgram(program);
      router.push(`/program/play?id=${program.id}`);
    } catch (err) {
      console.error('Play program error:', err);
      Alert.alert('エラー', 'プログラムの再生に失敗しました');
    }
  };

  // プログラムアイテムをレンダリング（横画面用コンパクト表示）
  const renderProgramItem = ({ item }: { item: Program }) => {
    const totalMeasures = getTotalMeasures(item);
    const estimatedDuration = getEstimatedDuration(item);

    return (
      <View style={styles.programItem}>
        <Pressable
          style={styles.programContent}
          onPress={() => handleSelectProgram(item)}
        >
          <Text style={styles.programName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.programInfo}>
            {item.sections.length}セクション • {totalMeasures}小節 • 約{formatDuration(estimatedDuration)}
          </Text>
        </Pressable>

        <View style={styles.programActions}>
          <Pressable
            style={styles.playButton}
            onPress={() => handlePlayProgram(item)}
          >
            <Text style={styles.playButtonText}>▶</Text>
          </Pressable>
          <Pressable
            style={styles.deleteButton}
            onPress={() => handleDeleteProgram(item)}
          >
            <Text style={styles.deleteButtonText}>×</Text>
          </Pressable>
        </View>
      </View>
    );
  };

  // 空の状態
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>プログラムがありません</Text>
      <Text style={styles.emptyText}>新規作成ボタンでプログラムを作成</Text>
    </View>
  );

  // 横画面時のノッチ回避: 左右のみ 44pt を採用
  const safePadding = {
    top: insets.top,
    bottom: insets.bottom,
    left: Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
    right: Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: safePadding.top,
          paddingBottom: safePadding.bottom,
          paddingLeft: safePadding.left,
          paddingRight: safePadding.right,
        },
      ]}
    >
      <StatusBar hidden={isLandscape} />

      {/* ヘッダー */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>プログラム一覧</Text>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.importButton}
            onPress={() => setQrImportModalVisible(true)}
          >
            <Text style={styles.importButtonText}>インポート</Text>
          </Pressable>
          <Pressable
            style={styles.templateButton}
            onPress={() => setTemplateSelectorVisible(true)}
          >
            <Text style={styles.templateButtonText}>テンプレート</Text>
          </Pressable>
          <Pressable
            style={styles.addButton}
            onPress={() => setShowNewModal(true)}
          >
            <Text style={styles.addButtonText}>+ 新規</Text>
          </Pressable>
        </View>
      </View>

      {/* ローディング */}
      {isLoading && (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.functional.rhythm} />
        </View>
      )}

      {/* プログラムリスト（横2カラム表示） */}
      {!isLoading && (
        <FlatList
          data={programs}
          keyExtractor={(item) => item.id}
          renderItem={renderProgramItem}
          contentContainerStyle={styles.list}
          numColumns={2}
          columnWrapperStyle={styles.row}
          ListEmptyComponent={renderEmptyState}
        />
      )}

      {/* 新規作成モーダル */}
      <Modal
        visible={showNewModal}
        transparent
        animationType="fade"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>新規プログラム作成</Text>
            <TextInput
              style={styles.modalInput}
              value={newProgramName}
              onChangeText={setNewProgramName}
              placeholder="プログラム名を入力"
              placeholderTextColor={colors.text.muted}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowNewModal(false);
                  setNewProgramName('');
                }}
              >
                <Text style={styles.modalCancelText}>キャンセル</Text>
              </Pressable>
              <Pressable
                style={styles.modalCreateButton}
                onPress={handleCreateProgram}
              >
                <Text style={styles.modalCreateText}>作成</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* QRコードインポートモーダル */}
      <QRCodeImportModal
        visible={qrImportModalVisible}
        onClose={() => setQrImportModalVisible(false)}
        onImport={async (program) => {
          // インポートしたプログラムに新しいIDを付与して保存
          try {
            const importedProgram = {
              ...program,
              id: generateId(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            await saveProgram(importedProgram);
            // プログラム一覧を再読み込み
            await loadPrograms();
            if (Platform.OS === 'web') {
              window.alert('インポート完了: プログラムをインポートしました');
            } else {
              Alert.alert('インポート完了', 'プログラムをインポートしました');
            }
          } catch (error) {
            console.error('Import error:', error);
            if (Platform.OS === 'web') {
              window.alert(`エラー: プログラムの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
            } else {
              Alert.alert('エラー', `プログラムの保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  importButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  importButtonText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  templateButton: {
    backgroundColor: colors.functional.harmony,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  templateButtonText: {
    fontSize: 12,
    color: colors.background.secondary,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: colors.functional.rhythm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
  },
  addButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: spacing.sm,
    flexGrow: 1,
  },
  row: {
    gap: spacing.sm,
  },
  programItem: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    maxWidth: '49%',
  },
  programContent: {
    flex: 1,
    padding: spacing.sm,
  },
  programName: {
    fontSize: 14,
    color: colors.text.primary,
    fontWeight: '600',
    marginBottom: 2,
  },
  programInfo: {
    fontSize: 11,
    color: colors.text.muted,
  },
  programActions: {
    flexDirection: 'row',
  },
  playButton: {
    backgroundColor: colors.functional.rhythm,
    width: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: colors.background.tertiary,
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    color: colors.text.muted,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  emptyText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  modalInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: 14,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  modalCreateButton: {
    flex: 1,
    backgroundColor: colors.functional.rhythm,
    paddingVertical: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
  },
  modalCreateText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
