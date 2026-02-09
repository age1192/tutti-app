/**
 * セクション編集コンポーネント（横画面最適化・スクロール最小化）
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  Switch,
  Modal,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Section, TimeSignature, TempoChangeType } from '../../types';
import { colors, typography, spacing } from '../../styles';
import { TIME_SIGNATURES, TEMPO_MIN, TEMPO_MAX } from '../../utils/constants';
import {
  formatTimeSignature,
  formatAccentPattern,
  parseAccentPattern,
  validateAccentPattern,
  ACCENT_PRESETS,
} from '../../utils/programUtils';

interface SectionEditorProps {
  section: Section;
  visible: boolean;
  onSave: (updates: Partial<Section>) => void;
  onCancel: () => void;
}

export const SectionEditor: React.FC<SectionEditorProps> = ({
  section,
  visible,
  onSave,
  onCancel,
}) => {
  const [name, setName] = useState(section.name);
  const [tempo, setTempo] = useState(section.tempo.toString());
  const [timeSignature, setTimeSignature] = useState(section.timeSignature);
  const [measures, setMeasures] = useState(section.measures.toString());
  const [countIn, setCountIn] = useState(section.countIn);
  const [accentPatternStr, setAccentPatternStr] = useState(
    formatAccentPattern(section.accentPattern)
  );
  const [patternError, setPatternError] = useState<string | null>(null);
  const [tempoChange, setTempoChange] = useState<TempoChangeType>(section.tempoChange || 'none');
  const [tempoChangeTarget, setTempoChangeTarget] = useState(
    section.tempoChangeTarget?.toString() || ''
  );
  const [tempoChangeToNext, setTempoChangeToNext] = useState(section.tempoChangeToNext || false);
  
  const { width: screenWidth } = Dimensions.get('window');
  const isLandscape = screenWidth > 500;

  // セクションが変わったら状態をリセット
  useEffect(() => {
    setName(section.name);
    setTempo(section.tempo.toString());
    setTimeSignature(section.timeSignature);
    setMeasures(section.measures.toString());
    setCountIn(section.countIn);
    setAccentPatternStr(formatAccentPattern(section.accentPattern));
    setTempoChange(section.tempoChange || 'none');
    setTempoChangeTarget(section.tempoChangeTarget?.toString() || '');
    setTempoChangeToNext(section.tempoChangeToNext || false);
    setPatternError(null);
  }, [section]);

  // アクセントパターンの検証
  useEffect(() => {
    if (!accentPatternStr.trim()) {
      setPatternError(null);
      return;
    }
    const pattern = parseAccentPattern(accentPatternStr);
    if (!pattern) {
      setPatternError('無効な形式です（例: 2+3）');
    } else if (!validateAccentPattern(pattern, timeSignature.numerator)) {
      setPatternError(`合計が${timeSignature.numerator}拍になる必要があります`);
    } else {
      setPatternError(null);
    }
  }, [accentPatternStr, timeSignature.numerator]);

  const handleSave = () => {
    const tempoNum = parseInt(tempo, 10) || section.tempo;
    const measuresNum = parseInt(measures, 10) || section.measures;
    const pattern = parseAccentPattern(accentPatternStr);
    const targetTempoNum = tempoChangeTarget ? parseInt(tempoChangeTarget, 10) : undefined;

    const validPattern =
      pattern && validateAccentPattern(pattern, timeSignature.numerator)
        ? pattern
        : undefined;

    onSave({
      name: name.trim() || section.name,
      tempo: Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, tempoNum)),
      timeSignature,
      measures: Math.max(1, Math.min(999, measuresNum)),
      countIn,
      accentPattern: validPattern,
      tempoChange: tempoChange === 'none' ? undefined : tempoChange,
      tempoChangeTarget: targetTempoNum && targetTempoNum >= TEMPO_MIN && targetTempoNum <= TEMPO_MAX
        ? targetTempoNum
        : undefined,
      tempoChangeToNext: tempoChange !== 'none' ? tempoChangeToNext : undefined,
    });
  };

  const adjustTempo = (delta: number) => {
    const current = parseInt(tempo, 10) || section.tempo;
    const newTempo = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, current + delta));
    setTempo(newTempo.toString());
  };

  const adjustMeasures = (delta: number) => {
    const current = parseInt(measures, 10) || section.measures;
    const newMeasures = Math.max(1, Math.min(999, current + delta));
    setMeasures(newMeasures.toString());
  };

  const handleTimeSignatureChange = (ts: TimeSignature) => {
    setTimeSignature(ts);
    const pattern = parseAccentPattern(accentPatternStr);
    if (pattern && !validateAccentPattern(pattern, ts.numerator)) {
      setAccentPatternStr('');
    }
  };

  const handlePresetSelect = (pattern: number[]) => {
    setAccentPatternStr(formatAccentPattern(pattern));
  };

  const availablePresets = ACCENT_PRESETS.filter(
    (preset) => preset.numerator === timeSignature.numerator
  );

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, isLandscape && styles.modalLandscape]}>
          {/* ヘッダー */}
          <View style={styles.header}>
            <Text style={styles.title}>セクション編集</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.saveButton} onPress={handleSave}>
                <Text style={styles.saveButtonText}>保存</Text>
              </Pressable>
            </View>
          </View>

          {/* 横画面: 2カラムレイアウト */}
          <View style={[styles.content, isLandscape && styles.contentLandscape]}>
            {/* 左カラム: 基本設定 */}
            <View style={[styles.column, isLandscape && styles.columnLeft]}>
              {/* セクション名 */}
              <View style={styles.field}>
                <Text style={styles.label}>セクション名</Text>
                <TextInput
                  style={styles.textInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="セクション名"
                  placeholderTextColor={colors.text.muted}
                />
              </View>

              {/* テンポ */}
              <View style={styles.field}>
                <Text style={styles.label}>テンポ (BPM)</Text>
                <View style={styles.numberControl}>
                  <Pressable style={styles.numberButton} onPress={() => adjustTempo(-10)}>
                    <Text style={styles.numberButtonText}>-10</Text>
                  </Pressable>
                  <Pressable style={styles.numberButton} onPress={() => adjustTempo(-1)}>
                    <Text style={styles.numberButtonText}>-1</Text>
                  </Pressable>
                  <TextInput
                    style={styles.numberInput}
                    value={tempo}
                    onChangeText={setTempo}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Pressable style={styles.numberButton} onPress={() => adjustTempo(1)}>
                    <Text style={styles.numberButtonText}>+1</Text>
                  </Pressable>
                  <Pressable style={styles.numberButton} onPress={() => adjustTempo(10)}>
                    <Text style={styles.numberButtonText}>+10</Text>
                  </Pressable>
                </View>
              </View>

              {/* 小節数 */}
              <View style={styles.field}>
                <Text style={styles.label}>小節数</Text>
                <View style={styles.numberControl}>
                  <Pressable style={styles.numberButton} onPress={() => adjustMeasures(-8)}>
                    <Text style={styles.numberButtonText}>-8</Text>
                  </Pressable>
                  <Pressable style={styles.numberButton} onPress={() => adjustMeasures(-1)}>
                    <Text style={styles.numberButtonText}>-1</Text>
                  </Pressable>
                  <TextInput
                    style={styles.numberInput}
                    value={measures}
                    onChangeText={setMeasures}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Pressable style={styles.numberButton} onPress={() => adjustMeasures(1)}>
                    <Text style={styles.numberButtonText}>+1</Text>
                  </Pressable>
                  <Pressable style={styles.numberButton} onPress={() => adjustMeasures(8)}>
                    <Text style={styles.numberButtonText}>+8</Text>
                  </Pressable>
                </View>
              </View>

              {/* カウントイン */}
              <View style={styles.switchField}>
                <Text style={styles.label}>カウントイン</Text>
                <Switch
                  value={countIn}
                  onValueChange={setCountIn}
                  trackColor={{
                    false: colors.background.tertiary,
                    true: colors.functional.rhythm,
                  }}
                  thumbColor={colors.text.primary}
                />
              </View>

              {/* テンポ変化 */}
              <View style={styles.field}>
                <Text style={styles.label}>テンポ変化</Text>
                <View style={styles.tempoChangeRow}>
                  <Pressable
                    style={[styles.tempoChangeBtn, tempoChange === 'none' && styles.tempoChangeBtnActive]}
                    onPress={() => setTempoChange('none')}
                  >
                    <Text style={[styles.tempoChangeBtnText, tempoChange === 'none' && styles.tempoChangeBtnTextActive]}>
                      なし
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tempoChangeBtn, tempoChange === 'ritardando' && styles.tempoChangeBtnActive]}
                    onPress={() => setTempoChange('ritardando')}
                  >
                    <Text style={[styles.tempoChangeBtnText, tempoChange === 'ritardando' && styles.tempoChangeBtnTextActive]}>
                      リタルダンド
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.tempoChangeBtn, tempoChange === 'accelerando' && styles.tempoChangeBtnActive]}
                    onPress={() => setTempoChange('accelerando')}
                  >
                    <Text style={[styles.tempoChangeBtnText, tempoChange === 'accelerando' && styles.tempoChangeBtnTextActive]}>
                      アッチェレランド
                    </Text>
                  </Pressable>
                </View>
                {tempoChange !== 'none' && (
                  <>
                    <View style={styles.tempoChangeTargetRow}>
                      <Text style={styles.label}>目標テンポ:</Text>
                      <TextInput
                        style={styles.numberInput}
                        value={tempoChangeTarget}
                        onChangeText={setTempoChangeTarget}
                        keyboardType="number-pad"
                        maxLength={3}
                        placeholder={tempo.toString()}
                        placeholderTextColor={colors.text.muted}
                      />
                      <Text style={styles.label}>BPM</Text>
                    </View>
                    <View style={styles.switchField}>
                      <Text style={styles.label}>次のセクションまで変化</Text>
                      <Switch
                        value={tempoChangeToNext}
                        onValueChange={setTempoChangeToNext}
                        trackColor={{
                          false: colors.background.tertiary,
                          true: colors.functional.rhythm,
                        }}
                        thumbColor={colors.text.primary}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* 右カラム: 拍子・アクセント */}
            <View style={[styles.column, isLandscape && styles.columnRight]}>
              {/* 拍子 */}
              <View style={styles.field}>
                <Text style={styles.label}>拍子</Text>
                <View style={styles.timeSignatures}>
                  {TIME_SIGNATURES.map((ts, index) => (
                    <Pressable
                      key={index}
                      style={[
                        styles.timeSignatureButton,
                        ts.numerator === timeSignature.numerator &&
                          ts.denominator === timeSignature.denominator &&
                          styles.timeSignatureButtonActive,
                      ]}
                      onPress={() => handleTimeSignatureChange(ts)}
                    >
                      <Text
                        style={[
                          styles.timeSignatureText,
                          ts.numerator === timeSignature.numerator &&
                            ts.denominator === timeSignature.denominator &&
                            styles.timeSignatureTextActive,
                        ]}
                      >
                        {formatTimeSignature(ts)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* アクセントパターン */}
              <View style={styles.field}>
                <Text style={styles.label}>アクセントパターン</Text>
                <View style={styles.accentRow}>
                  <TextInput
                    style={[styles.textInput, styles.accentInput, patternError && styles.textInputError]}
                    value={accentPatternStr}
                    onChangeText={setAccentPatternStr}
                    placeholder="例: 2+3"
                    placeholderTextColor={colors.text.muted}
                  />
                  {accentPatternStr.trim() && (
                    <Pressable style={styles.clearBtn} onPress={() => setAccentPatternStr('')}>
                      <Text style={styles.clearBtnText}>✕</Text>
                    </Pressable>
                  )}
                </View>
                {patternError && <Text style={styles.errorText}>{patternError}</Text>}
                
                {/* プリセット */}
                {availablePresets.length > 0 && (
                  <View style={styles.presetRow}>
                    {availablePresets.map((preset, index) => (
                      <Pressable
                        key={index}
                        style={[
                          styles.presetButton,
                          accentPatternStr === formatAccentPattern(preset.pattern) &&
                            styles.presetButtonActive,
                        ]}
                        onPress={() => handlePresetSelect(preset.pattern)}
                      >
                        <Text
                          style={[
                            styles.presetButtonText,
                            accentPatternStr === formatAccentPattern(preset.pattern) &&
                              styles.presetButtonTextActive,
                          ]}
                        >
                          {formatAccentPattern(preset.pattern)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            </View>
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
    padding: spacing.sm,
  },
  modal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 12,
    padding: spacing.md,
    width: '100%',
    maxWidth: 400,
    maxHeight: '95%',
  },
  modalLandscape: {
    maxWidth: 700,
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelButton: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
  },
  cancelButtonText: {
    fontSize: 13,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: colors.functional.rhythm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 6,
  },
  saveButtonText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    // 縦画面: 縦並び
  },
  contentLandscape: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  column: {
    // 縦画面: 全幅
  },
  columnLeft: {
    flex: 1,
  },
  columnRight: {
    flex: 1,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 11,
    color: colors.text.muted,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  textInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    fontSize: 14,
    color: colors.text.primary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  textInputError: {
    borderColor: colors.ui.error,
  },
  errorText: {
    fontSize: 10,
    color: colors.ui.error,
    marginTop: 4,
  },
  numberControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  numberButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
  },
  numberButtonText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  numberInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 16,
    color: colors.functional.rhythm,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 50,
  },
  timeSignatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  timeSignatureButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  timeSignatureButtonActive: {
    borderColor: colors.functional.rhythm,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  timeSignatureText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  timeSignatureTextActive: {
    color: colors.functional.rhythm,
  },
  accentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  accentInput: {
    flex: 1,
  },
  clearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearBtnText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: spacing.xs,
  },
  presetButton: {
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetButtonActive: {
    borderColor: colors.functional.rhythm,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  presetButtonText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  presetButtonTextActive: {
    color: colors.functional.rhythm,
  },
  switchField: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  tempoChangeRow: {
    flexDirection: 'row',
    gap: 4,
    flexWrap: 'wrap',
  },
  tempoChangeBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: colors.background.tertiary,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tempoChangeBtnActive: {
    borderColor: colors.functional.rhythm,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
  },
  tempoChangeBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tempoChangeBtnTextActive: {
    color: colors.functional.rhythm,
  },
  tempoChangeTargetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
});
