/**
 * プログラムテキスト入力コンポーネント
 * 
 * 4/4(4)-3/4(4)-2+2+3/8(2) のような形式でプログラムを入力
 */
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, ScrollView, Platform } from 'react-native';
import { FadeModal } from '../ui/FadeModal';
import { Section } from '../../types';
import { colors, spacing } from '../../styles';
import { parseProgramText, SYNTAX_HELP, sectionsToText } from '../../utils/programTextParser';

interface ProgramTextInputProps {
  visible: boolean;
  onClose: () => void;
  onApply: (sections: Section[]) => void;
  existingSections?: Section[];
  defaultTempo?: number;
}

export const ProgramTextInput: React.FC<ProgramTextInputProps> = ({
  visible,
  onClose,
  onApply,
  existingSections = [],
  defaultTempo = 120,
}) => {
  // 既存のセクションからテキストを生成
  const initialText = useMemo(() => {
    if (existingSections.length > 0) {
      return sectionsToText(existingSections);
    }
    return '';
  }, [existingSections]);

  const [text, setText] = useState(initialText);
  const [showHelp, setShowHelp] = useState(false);

  // モーダルが開いたときにテキストを初期化
  React.useEffect(() => {
    if (visible) {
      setText(initialText);
    }
  }, [visible, initialText]);

  // リアルタイムでパース
  const parseResult = useMemo(() => {
    if (!text.trim()) {
      return null;
    }
    return parseProgramText(text, defaultTempo);
  }, [text, defaultTempo]);

  // プレビュー表示
  const preview = useMemo(() => {
    if (!parseResult?.sections || parseResult.sections.length === 0) {
      return null;
    }
    
    return parseResult.sections.map((section, index) => {
      let tsText = '';
      if (section.accentPattern && section.accentPattern.length > 1) {
        tsText = section.accentPattern.join('+') + '/' + section.timeSignature.denominator;
      } else {
        tsText = `${section.timeSignature.numerator}/${section.timeSignature.denominator}`;
      }
      
      return (
        <View key={index} style={styles.previewItem}>
          <Text style={styles.previewIndex}>{index + 1}.</Text>
          <Text style={styles.previewTime}>{tsText}</Text>
          <Text style={styles.previewMeasures}>{section.measures}小節</Text>
          <Text style={styles.previewTempo}>{section.tempo} BPM</Text>
        </View>
      );
    });
  }, [parseResult]);

  // 適用
  const handleApply = useCallback(() => {
    if (!parseResult?.sections || parseResult.sections.length === 0) {
      return;
    }
    
    if (parseResult.errors && parseResult.errors.length > 0) {
      // エラーがあっても適用可能（警告として表示）
    }
    
    onApply(parseResult.sections);
    onClose();
  }, [parseResult, onApply, onClose]);

  return (
    <FadeModal
      visible={visible}
      transparent
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>テキストで入力</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView 
            style={styles.scrollContent}
            contentContainerStyle={styles.scrollContentContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {/* ヘルプトグル */}
            <Pressable 
              style={styles.helpToggle} 
              onPress={() => setShowHelp(!showHelp)}
            >
              <Text style={styles.helpToggleText}>
                {showHelp ? '▼ 構文ヘルプを閉じる' : '▶ 構文ヘルプを見る'}
              </Text>
            </Pressable>

            {/* ヘルプ */}
            {showHelp && (
              <View style={styles.helpBox}>
                <Text style={styles.helpText}>{SYNTAX_HELP}</Text>
              </View>
            )}

            {/* 入力エリア */}
            <TextInput
              style={styles.input}
              value={text}
              onChangeText={setText}
              placeholder="4/4(4)@120-3/4(4)-2+2+3/8(2)"
              placeholderTextColor={colors.text.muted}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />

            {/* エラー表示 */}
            {parseResult?.errors && parseResult.errors.length > 0 && (
              <View style={styles.errorBox}>
                {parseResult.errors.map((error, index) => (
                  <View key={index} style={styles.errorItem}>
                    <Text style={styles.errorMessage}>{error.message}</Text>
                    {error.suggestion && (
                      <Text style={styles.errorSuggestion}>{error.suggestion}</Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* プレビュー */}
            {preview && preview.length > 0 && (
              <View style={styles.previewBox}>
                <Text style={styles.previewTitle}>プレビュー ({preview.length}セクション)</Text>
                <ScrollView 
                  style={styles.previewScroll} 
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  contentContainerStyle={styles.previewList}
                >
                  {preview}
                </ScrollView>
              </View>
            )}
          </ScrollView>

          {/* アクション */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelBtnText}>キャンセル</Text>
            </Pressable>
            <Pressable 
              style={[
                styles.applyBtn, 
                (!parseResult?.sections || parseResult.sections.length === 0) && styles.applyBtnDisabled
              ]} 
              onPress={handleApply}
              disabled={!parseResult?.sections || parseResult.sections.length === 0}
            >
              <Text style={styles.applyBtnText}>適用</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </FadeModal>
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
    width: '100%',
    maxWidth: 500,
    maxHeight: '90%',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  scrollContent: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  scrollContentContainer: {
    padding: spacing.md,
    paddingTop: 0,
    flexGrow: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    paddingBottom: spacing.sm,
    marginBottom: 0,
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
  helpToggle: {
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  helpToggleText: {
    fontSize: 12,
    color: colors.functional.rhythm,
    fontWeight: '600',
  },
  helpBox: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  helpText: {
    fontSize: 11,
    color: colors.text.secondary,
    lineHeight: 18,
    fontFamily: 'monospace',
  },
  input: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text.primary,
    fontFamily: 'monospace',
    marginBottom: spacing.md,
    minHeight: 60,
  },
  errorBox: {
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#FF5252',
  },
  errorItem: {
    marginBottom: spacing.xs,
  },
  errorMessage: {
    fontSize: 12,
    color: '#FF5252',
    fontWeight: '600',
  },
  errorSuggestion: {
    fontSize: 11,
    color: colors.text.muted,
    marginTop: 2,
  },
  previewBox: {
    marginBottom: spacing.md,
    maxWidth: '100%',
  },
  previewTitle: {
    fontSize: 12,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  previewScroll: {
    maxHeight: 100,
  },
  previewList: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  previewItem: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: spacing.sm,
    minWidth: 100,
    alignItems: 'center',
  },
  previewIndex: {
    fontSize: 10,
    color: colors.text.muted,
  },
  previewTime: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.functional.rhythm,
    marginVertical: 2,
  },
  previewMeasures: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  previewTempo: {
    fontSize: 10,
    color: colors.text.muted,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    paddingTop: spacing.sm,
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
  applyBtnDisabled: {
    opacity: 0.5,
  },
  applyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
