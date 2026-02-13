/**
 * ハーモニーのコントロールパネル
 * ボタンサイズを大きく、トランスポーズUI改善
 */
import { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Modal, Dimensions, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../../styles';
import { TuningType, ToneType } from '../../types';
import { OCTAVE_MIN, OCTAVE_MAX, PITCH_MIN, PITCH_MAX, LANDSCAPE_SAFE_AREA_INSET } from '../../utils/constants';
import { TransposeKey, TRANSPOSE_SEMITONES } from '../../stores/useHarmonyStore';
import { PresetSelector } from '../preset';

interface HarmonyControlsProps {
  octave: number;
  tuning: TuningType;
  tone: ToneType;
  basePitch: number;
  transpose: TransposeKey;
  holdMode: boolean;
  onOctaveChange: (octave: number) => void;
  onTuningChange: (tuning: TuningType) => void;
  onToneChange: (tone: ToneType) => void;
  onPitchChange: (pitch: number) => void;
  onTransposeChange: (transpose: TransposeKey) => void;
  onHoldModeChange: (hold: boolean) => void;
  isLandscape?: boolean;
}

// よく使うトランスポーズ（吹奏楽）
const COMMON_TRANSPOSE_KEYS: TransposeKey[] = ['C', 'Bb', 'Eb', 'F'];

// 全12調（TransposeKey型に合わせる）
const ALL_TRANSPOSE_KEYS: TransposeKey[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// 音色の表示名（順番: オルガン、ピアノ、フルート、クラリネット）
const TONE_LABELS: Record<ToneType, string> = {
  organ: 'オルガン',
  organ2: 'ピアノ',
  flute: 'フルート',
  clarinet: 'クラリネット',
};

// 音色の表示順序
const TONE_ORDER: ToneType[] = ['organ', 'organ2', 'flute', 'clarinet'];

export function HarmonyControls({
  octave,
  tuning,
  tone,
  basePitch,
  transpose,
  holdMode,
  onOctaveChange,
  onTuningChange,
  onToneChange,
  onPitchChange,
  onTransposeChange,
  onHoldModeChange,
  isLandscape = false,
}: HarmonyControlsProps) {
  const insets = useSafeAreaInsets();
  const [showTransposeModal, setShowTransposeModal] = useState(false);
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);
  const canGoLower = octave > OCTAVE_MIN;
  const canGoHigher = octave < OCTAVE_MAX - 1;

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription.remove();
  }, []);

  // 横画面時はホームで safe area 適用済み。縦画面時は insets を使用
  const topPadding = isLandscape ? 4 : Math.max(insets.top, spacing.sm);
  const hPadLeft = Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET);
  const hPadRight = Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET);

  // トランスポーズがよく使うものかチェック
  const isCommonTranspose = COMMON_TRANSPOSE_KEYS.includes(transpose);

  return (
    <>
      {/* 背景は画面端まで、コンテンツは余白内 */}
      <View
        style={[
          styles.wrapperOuter,
          { marginLeft: -hPadLeft, marginRight: -hPadRight },
        ]}
      >
        <View
          style={[
            styles.wrapper,
            {
              paddingTop: topPadding,
              paddingLeft: hPadLeft,
              paddingRight: hPadRight,
            },
          ]}
        >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[
            styles.container,
            isLandscape && styles.containerLandscape,
            { flexGrow: 1, justifyContent: 'space-evenly' },
          ]}
        >
          {/* 基準ピッチ */}
          <View style={styles.block}>
            <Text style={styles.label}>基準ピッチ</Text>
            <View style={styles.row}>
              <Pressable
                style={styles.btn}
                onPress={() => onPitchChange(Math.max(PITCH_MIN, basePitch - 1))}
              >
                <Text style={styles.btnText}>−</Text>
              </Pressable>
              <Text style={styles.value}>{basePitch}</Text>
              <Pressable
                style={styles.btn}
                onPress={() => onPitchChange(Math.min(PITCH_MAX, basePitch + 1))}
              >
                <Text style={styles.btnText}>+</Text>
              </Pressable>
            </View>
          </View>

          {/* 移調 */}
          <View style={styles.block}>
            <Text style={styles.label}>移調</Text>
            <View style={styles.transposeRow}>
              {COMMON_TRANSPOSE_KEYS.map((key) => {
                const isSelected = transpose === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.transposeChip, isSelected && styles.transposeChipActive]}
                    onPress={() => onTransposeChange(key)}
                  >
                    <Text style={[styles.transposeChipText, isSelected && styles.transposeChipTextActive]}>
                      {key}
                    </Text>
                  </Pressable>
                );
              })}
              <Pressable
                style={[styles.transposeChip, !isCommonTranspose && styles.transposeChipActive]}
                onPress={() => setShowTransposeModal(true)}
              >
                <Text style={[styles.transposeChipText, !isCommonTranspose && styles.transposeChipTextActive]}>
                  …
                </Text>
              </Pressable>
            </View>
          </View>

          {/* 音色 */}
          <View style={styles.block}>
            <Text style={styles.label}>音色</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.toneRow}>
              {TONE_ORDER.map((t) => {
                const isSelected = tone === t;
                return (
                  <Pressable
                    key={t}
                    style={[styles.toneChip, isSelected && styles.toneChipActive]}
                    onPress={() => onToneChange(t)}
                  >
                    <Text style={[styles.toneChipText, isSelected && styles.toneChipTextActive]}>
                      {TONE_LABELS[t]}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* 音の持続 */}
          <View style={styles.block}>
            <Text style={styles.label}>音の持続</Text>
            <Pressable
              style={[styles.holdToggle, holdMode && styles.holdToggleActive]}
              onPress={() => onHoldModeChange(!holdMode)}
            >
              <View style={[styles.holdThumb, holdMode && styles.holdThumbOn]} />
            </Pressable>
          </View>

          {/* 音域 */}
          <View style={styles.block}>
            <Text style={styles.label}>音域</Text>
            <View style={styles.row}>
              <Pressable
                style={[styles.btn, !canGoLower && styles.btnDisabled]}
                onPress={() => canGoLower && onOctaveChange(octave - 1)}
                disabled={!canGoLower}
              >
                <Text style={[styles.btnText, !canGoLower && styles.btnTextDisabled]}>◀</Text>
              </Pressable>
              <Text style={styles.value}>C{octave}</Text>
              <Pressable
                style={[styles.btn, !canGoHigher && styles.btnDisabled]}
                onPress={() => canGoHigher && onOctaveChange(octave + 1)}
                disabled={!canGoHigher}
              >
                <Text style={[styles.btnText, !canGoHigher && styles.btnTextDisabled]}>▶</Text>
              </Pressable>
            </View>
          </View>

          {/* 調律 */}
          <View style={styles.block}>
            <Text style={styles.label}>調律</Text>
            <View style={styles.tuningRow}>
              <Pressable
                style={[styles.tuningChip, tuning === 'equal' && styles.tuningChipActive]}
                onPress={() => onTuningChange('equal')}
              >
                <Text style={[styles.tuningChipText, tuning === 'equal' && styles.tuningChipTextActive]}>
                  平均律
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tuningChip, tuning === 'just' && styles.tuningChipActive]}
                onPress={() => onTuningChange('just')}
              >
                <Text style={[styles.tuningChipText, tuning === 'just' && styles.tuningChipTextActive]}>
                  純正律
                </Text>
              </Pressable>
            </View>
          </View>

          {/* プリセット */}
          <View style={styles.block}>
            <Text style={styles.label}>プリセット</Text>
            <PresetSelector type="harmony" screenWidth={screenWidth} />
          </View>
        </ScrollView>
        </View>
      </View>

      {/* トランスポーズ選択モーダル */}
      <Modal
        visible={showTransposeModal}
        transparent
        animationType="fade"
        supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>移調を選択</Text>
            <View style={styles.modalGrid}>
              {ALL_TRANSPOSE_KEYS.map((key) => {
                const isSelected = transpose === key;
                return (
                  <Pressable
                    key={key}
                    style={[styles.modalChip, isSelected && styles.modalChipActive]}
                    onPress={() => {
                      onTransposeChange(key);
                      setShowTransposeModal(false);
                    }}
                  >
                    <Text style={[styles.modalChipText, isSelected && styles.modalChipTextActive]}>
                      {key}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={() => setShowTransposeModal(false)}>
              <Text style={styles.modalCloseText}>閉じる</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  wrapperOuter: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  wrapper: {},
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    paddingRight: spacing.lg,
    gap: spacing.md,
    minHeight: 70,
  },
  containerLandscape: {
    paddingHorizontal: spacing.md,
    paddingRight: spacing.xl,
    paddingVertical: 5,
    minHeight: 68,
  },
  block: {
    alignItems: 'center',
    minWidth: 70,
    justifyContent: 'flex-start',
  },
  label: {
    ...typography.caption,
    color: colors.text.muted,
    fontSize: 10,
    marginBottom: 3,
    fontWeight: '500',
    height: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  value: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 40,
    textAlign: 'center',
  },
  btn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.35,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.functional.harmony,
  },
  btnTextDisabled: {
    color: colors.text.muted,
  },
  transposeRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    gap: 4,
    minWidth: 140,
  },
  transposeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    minWidth: 36,
    alignItems: 'center',
  },
  transposeChipActive: {
    backgroundColor: colors.functional.harmony,
  },
  transposeChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  transposeChipTextActive: {
    color: '#FFFFFF',
  },
  toneRow: {
    maxHeight: 40,
    marginTop: 0,
  },
  toneChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    marginRight: 4,
  },
  toneChipActive: {
    backgroundColor: colors.functional.harmony,
  },
  toneChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  toneChipTextActive: {
    color: '#FFFFFF',
  },
  holdToggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  holdToggleActive: {
    backgroundColor: colors.functional.harmony,
  },
  holdThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  holdThumbOn: {
    alignSelf: 'flex-end',
  },
  tuningRow: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: 2,
  },
  tuningChip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  tuningChipActive: {
    backgroundColor: colors.functional.harmony,
  },
  tuningChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tuningChipTextActive: {
    color: '#FFFFFF',
  },
  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  modalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  modalChip: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    minWidth: 60,
    alignItems: 'center',
  },
  modalChipActive: {
    backgroundColor: colors.functional.harmony,
  },
  modalChipText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  modalChipTextActive: {
    color: '#FFFFFF',
  },
  modalCloseBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
});
