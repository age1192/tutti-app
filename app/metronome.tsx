/**
 * メトロノーム画面
 * - 横画面固定
 * - スクロールなしでスマホサイズに収まるレイアウト
 * - 表示モード切替（BeatPulse/振り子）
 * - BPMキーボード入力対応
 */
import { View, Text, StyleSheet, Pressable, Dimensions, StatusBar, TextInput, Keyboard } from 'react-native';
import Slider from '@react-native-community/slider';
import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';
import { colors, typography, spacing } from '../styles';
import { useMetronome, useHaptics, useKeepAwake } from '../hooks';
import {
  BeatIndicator,
  Pendulum,
  BeatPulse,
} from '../components/metronome';
import { PresetSelector } from '../components/preset';
import { TIME_SIGNATURES, TEMPO_MIN, TEMPO_MAX, TEMPO_DEFAULT } from '../utils/constants';
import { TimeSignature, SubdivisionType, SubdivisionSettings, MetronomeToneType } from '../types';
import { useSettingsStore } from '../stores/useSettingsStore';
import { useMetronomeStore } from '../stores/useMetronomeStore';

type VisualMode = 'pulse' | 'pendulum';

// 拍分割の定義
const SUBDIVISIONS: { type: SubdivisionType; label: string; desc: string }[] = [
  { type: 'quarter', label: '♩', desc: '4分' },
  { type: 'eighth', label: '♫', desc: '8分' },
  { type: 'triplet', label: '3', desc: '3連' },
  { type: 'sixteenth', label: '16', desc: '16分' },
];

export default function MetronomeScreen() {
  const {
    tempo,
    timeSignature,
    isPlaying,
    currentBeat,
    currentMeasure,
    subdivisionSettings,
    tone,
    setTempo,
    incrementTempo,
    decrementTempo,
    setTimeSignature,
    setSubdivisionVolume,
    setTone,
    toggle,
    tapTempo,
    stop,
    reset,
  } = useMetronome();

  const { beatImpact } = useHaptics();
  const insets = useSafeAreaInsets();
  const { settings, loadSettings } = useSettingsStore();
  const { setTempo: setMetronomeTempo, setTimeSignature: setMetronomeTimeSignature } = useMetronomeStore();

  // 演奏中は画面を点灯させ続ける
  useKeepAwake(isPlaying, 'metronome');

  // ビートパルスの状態
  const [pulseActive, setPulseActive] = useState(false);
  const [lastBeat, setLastBeat] = useState(0);
  
  // 表示モード（デフォルトはパルス）
  const [visualMode, setVisualMode] = useState<VisualMode>('pulse');
  
  // モーダルの状態
  const [subdivisionModalVisible, setSubdivisionModalVisible] = useState(false);
  const [timeSignatureModalVisible, setTimeSignatureModalVisible] = useState(false);
  
  // テンポ入力の状態
  const [tempoInputVisible, setTempoInputVisible] = useState(false);
  const [tempoInputValue, setTempoInputValue] = useState(tempo.toString());
  const tempoInputRef = useRef<TextInput>(null);
  
  // 画面サイズ
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const isLandscape = dimensions.width > dimensions.height;

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // 画面に入った時にメトロノーム停止と設定適用（画面向きはhome.tsxで管理）
  useFocusEffect(
    useCallback(() => {
      stop();
      reset();
      
      // 設定を読み込んで適用
      loadSettings().then(() => {
        const currentSettings = useSettingsStore.getState().settings;
        if (!currentSettings) return; // 設定が読み込まれていない場合はスキップ
        
        const currentTempo = useMetronomeStore.getState().tempo;
        const currentTimeSignature = useMetronomeStore.getState().timeSignature;
        
        // テンポがデフォルト値（120）と同じ場合のみ設定を適用
        if (currentTempo === 120 || currentTempo === TEMPO_DEFAULT) {
          const defaultTempo = currentSettings.defaultTempo ?? TEMPO_DEFAULT;
          setMetronomeTempo(defaultTempo);
        }
        // 拍子がデフォルト値（4/4）と同じ場合のみ設定を適用
        if (currentTimeSignature.numerator === 4 && currentTimeSignature.denominator === 4) {
          const defaultTimeSignature = currentSettings.defaultTimeSignature ?? { numerator: 4, denominator: 4 };
          setMetronomeTimeSignature(defaultTimeSignature);
        }
      }).catch((error) => {
        console.error('Failed to load and apply settings:', error);
      });

      return () => {
        stop();
      };
    }, [stop, reset, loadSettings, setMetronomeTempo, setMetronomeTimeSignature])
  );

  // ビートが変わったらパルスとハプティクスをトリガー
  useEffect(() => {
    if (isPlaying && currentBeat !== lastBeat && currentBeat > 0) {
      setPulseActive(true);
      const isAccent = currentBeat === 1;
      beatImpact(isAccent);
      setLastBeat(currentBeat);

      const timer = setTimeout(() => setPulseActive(false), 100);
      return () => clearTimeout(timer);
    }
  }, [currentBeat, isPlaying, lastBeat, beatImpact]);

  // 停止時にリセット
  useEffect(() => {
    if (!isPlaying) {
      setLastBeat(0);
      setPulseActive(false);
    }
  }, [isPlaying]);

  // テンポ入力の処理
  const handleTempoInputSubmit = useCallback(() => {
    const newTempo = parseInt(tempoInputValue, 10);
    if (!isNaN(newTempo) && newTempo >= TEMPO_MIN && newTempo <= TEMPO_MAX) {
      setTempo(newTempo);
    } else {
      setTempoInputValue(tempo.toString());
    }
    setTempoInputVisible(false);
    Keyboard.dismiss();
  }, [tempoInputValue, setTempo, tempo]);

  const handleTempoInputOpen = useCallback(() => {
    setTempoInputValue(tempo.toString());
    setTempoInputVisible(true);
    setTimeout(() => tempoInputRef.current?.focus(), 100);
  }, [tempo]);

  // レイアウト計算
  const layoutSizes = useMemo(() => {
    const screenHeight = dimensions.height;
    const screenWidth = dimensions.width;
    // 振り子モード時は大きく表示（画面高さの70%）
    const pendulumSize = Math.min(screenHeight * 0.7, 180);
    const pulseSize = Math.min(screenHeight * 0.45, 100);
    const visualSize = visualMode === 'pendulum' ? pendulumSize : pulseSize;
    const tempoFontSize = Math.min(44, screenHeight * 0.14);
    return { visualSize, tempoFontSize, pendulumSize, pulseSize };
  }, [dimensions, visualMode]);

  const topPadding = Math.max(insets.top, 4);
  const bottomPadding = Math.max(insets.bottom, 0);

  return (
    <View style={[styles.container, { paddingBottom: bottomPadding }]}>
      <StatusBar hidden={isLandscape} />

      {/* 上段: コントロールバー */}
      <View style={[styles.controlBar, { paddingTop: topPadding }]}>
        {/* 左側: 設定ボタン群 */}
        <View style={styles.controlGroup}>
          {/* 拍子選択 */}
          <Pressable
            style={styles.controlButton}
            onPress={() => setTimeSignatureModalVisible(true)}
          >
            <Text style={styles.controlButtonText}>
              {timeSignature.numerator}/{timeSignature.denominator}
            </Text>
            <Text style={styles.controlLabel}>拍子</Text>
          </Pressable>

          {/* 拍分割 */}
          <Pressable
            style={styles.controlButton}
            onPress={() => setSubdivisionModalVisible(true)}
          >
            <Text style={styles.controlButtonText}>♩♪</Text>
            <Text style={styles.controlLabel}>拍分割</Text>
          </Pressable>

          {/* プログラム */}
          <Link href="/program" asChild>
            <Pressable style={styles.controlButton}>
              <Text style={styles.controlButtonText}>PRG</Text>
              <Text style={styles.controlLabel}>プログラム</Text>
            </Pressable>
          </Link>

          {/* 音色選択 */}
          <Pressable
            style={styles.controlButton}
            onPress={() => {
              const tones: MetronomeToneType[] = ['default', 'hard', 'wood'];
              const currentIndex = tones.indexOf(tone);
              const nextIndex = (currentIndex + 1) % tones.length;
              setTone(tones[nextIndex]);
            }}
          >
            <Text style={styles.controlButtonText}>
              {tone === 'default' ? '♪' : tone === 'hard' ? '■' : '♫'}
            </Text>
            <Text style={styles.controlLabel}>
              {tone === 'default' ? '音色: 通常' : tone === 'hard' ? '音色: 硬め' : '音色: 木'}
            </Text>
          </Pressable>

          {/* プリセット */}
          <View style={styles.presetContainer}>
            <Text style={styles.presetLabel}>プリセット</Text>
            <PresetSelector type="metronome" />
          </View>
        </View>

        {/* 右側: 表示モード切替 */}
        <View style={styles.modeToggle}>
          <Pressable
            style={[styles.modeButton, visualMode === 'pulse' && styles.modeButtonActive]}
            onPress={() => setVisualMode('pulse')}
          >
            <Text style={[styles.modeButtonText, visualMode === 'pulse' && styles.modeButtonTextActive]}>●</Text>
          </Pressable>
          <Pressable
            style={[styles.modeButton, visualMode === 'pendulum' && styles.modeButtonActive]}
            onPress={() => setVisualMode('pendulum')}
          >
            <Text style={[styles.modeButtonText, visualMode === 'pendulum' && styles.modeButtonTextActive]}>振り子</Text>
          </Pressable>
        </View>
      </View>

      {/* メインエリア: 2カラムレイアウト */}
      <View style={[styles.mainArea, { paddingBottom: bottomPadding }]}>
        {/* 左カラム: ビジュアル表示 */}
        <View style={styles.visualColumn}>
          {visualMode === 'pulse' ? (
            <BeatPulse
              isActive={pulseActive}
              isAccent={currentBeat === 1}
              size={layoutSizes.pulseSize}
            />
          ) : (
            <Pendulum
              isPlaying={isPlaying}
              tempo={tempo}
              height={layoutSizes.pendulumSize}
            />
          )}
        </View>

        {/* 右カラム: テンポ＆コントロール */}
        <View style={styles.controlColumn}>
          {/* テンポ表示（タップで入力モード） */}
          <Pressable style={styles.tempoDisplay} onPress={handleTempoInputOpen}>
            {tempoInputVisible ? (
              <TextInput
                ref={tempoInputRef}
                style={[styles.tempoInput, { fontSize: layoutSizes.tempoFontSize }]}
                value={tempoInputValue}
                onChangeText={setTempoInputValue}
                onSubmitEditing={handleTempoInputSubmit}
                onBlur={handleTempoInputSubmit}
                keyboardType="number-pad"
                maxLength={3}
                selectTextOnFocus
              />
            ) : (
              <Text style={[styles.tempoValue, { fontSize: layoutSizes.tempoFontSize }]}>{tempo}</Text>
            )}
            <Text style={styles.tempoUnit}>BPM</Text>
          </Pressable>

          {/* テンポ調整ボタン＋TAP＋再生ボタン */}
          <View style={styles.tempoButtonRow}>
            <Pressable
              style={({ pressed }) => [styles.tempoButton, pressed && styles.tempoButtonPressed]}
              onPress={() => decrementTempo(10)}
            >
              <Text style={styles.tempoButtonText}>-10</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.tempoButton, pressed && styles.tempoButtonPressed]}
              onPress={() => decrementTempo(1)}
            >
              <Text style={styles.tempoButtonText}>-1</Text>
            </Pressable>

            {/* TAPテンポ（BPMの近くに配置） */}
            <Pressable
              style={[styles.tapButton]}
              onPress={tapTempo}
            >
              <Text style={styles.tapButtonText}>TAP</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.tempoButton, pressed && styles.tempoButtonPressed]}
              onPress={() => incrementTempo(1)}
            >
              <Text style={styles.tempoButtonText}>+1</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.tempoButton, pressed && styles.tempoButtonPressed]}
              onPress={() => incrementTempo(10)}
            >
              <Text style={styles.tempoButtonText}>+10</Text>
            </Pressable>
          </View>

          {/* 再生ボタン＋拍インジケーター */}
          <View style={styles.playRow}>
            <Pressable
              style={[styles.playButton, isPlaying && styles.playButtonActive]}
              onPress={toggle}
            >
              <Text style={styles.playButtonText}>{isPlaying ? '■' : '▶'}</Text>
            </Pressable>
            
            <View style={styles.beatIndicatorContainer}>
              <BeatIndicator
                beats={timeSignature.numerator}
                currentBeat={currentBeat}
                isPlaying={isPlaying}
                size="compact"
              />
              {isPlaying && (
                <Text style={styles.measureText}>小節: {currentMeasure}</Text>
              )}
            </View>
          </View>
        </View>
      </View>

      {/* 拍分割モーダル（中央表示・スライダー付き） */}
      {subdivisionModalVisible && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setSubdivisionModalVisible(false)} />
          <View style={styles.subdivisionModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>拍分割</Text>
              <Pressable onPress={() => setSubdivisionModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </Pressable>
            </View>
            <View style={styles.subdivisionList}>
              {SUBDIVISIONS.map((sub) => {
                const volume = subdivisionSettings[sub.type];
                const isActive = volume > 0;
                return (
                  <View key={sub.type} style={styles.subdivisionRow}>
                    <Pressable
                      style={[styles.subdivisionChip, isActive && styles.subdivisionChipActive]}
                      onPress={() => {
                        if (isActive) {
                          setSubdivisionVolume(sub.type, 0);
                        } else {
                          setSubdivisionVolume(sub.type, sub.type === 'quarter' ? 1.0 : 0.5);
                        }
                      }}
                    >
                      <Text style={[styles.subdivisionLabel, isActive && styles.subdivisionLabelActive]}>
                        {sub.label}
                      </Text>
                      <Text style={[styles.subdivisionDesc, isActive && styles.subdivisionDescActive]}>
                        {sub.desc}
                      </Text>
                    </Pressable>
                    <Slider
                      style={styles.subdivisionSlider}
                      minimumValue={0}
                      maximumValue={1}
                      step={0.05}
                      value={volume}
                      onValueChange={(value) => setSubdivisionVolume(sub.type, value)}
                      minimumTrackTintColor={isActive ? colors.functional.rhythm : colors.border.default}
                      maximumTrackTintColor={colors.border.default}
                      thumbTintColor={isActive ? colors.functional.rhythm : colors.text.muted}
                    />
                    <Text style={[styles.volumeText, isActive && styles.volumeTextActive]}>
                      {Math.round(volume * 100)}%
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>
      )}

      {/* 拍子選択モーダル */}
      {timeSignatureModalVisible && (
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setTimeSignatureModalVisible(false)} />
          <View style={styles.timeSignatureModal}>
            <Text style={styles.modalTitle}>拍子を選択</Text>
            <View style={styles.timeSignatureGrid}>
              {TIME_SIGNATURES.map((sig) => {
                const isSelected = sig.numerator === timeSignature.numerator && 
                                   sig.denominator === timeSignature.denominator;
                return (
                  <Pressable
                    key={`${sig.numerator}/${sig.denominator}`}
                    style={[styles.timeSignatureOption, isSelected && styles.timeSignatureOptionActive]}
                    onPress={() => {
                      setTimeSignature(sig);
                      setTimeSignatureModalVisible(false);
                    }}
                  >
                    <Text style={[styles.timeSignatureOptionText, isSelected && styles.timeSignatureOptionTextActive]}>
                      {sig.numerator}/{sig.denominator}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  controlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    paddingHorizontal: Math.max(spacing.md, 8), // 最小8pxのpaddingを確保（Android対応）
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  controlGroup: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  controlButton: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: 12,
    minWidth: 90,
  },
  controlButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.functional.rhythm,
  },
  controlLabel: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: 4,
    fontWeight: '500',
  },
  presetContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.md, // 音色ボタンとの間隔を広げる
  },
  presetLabel: {
    fontSize: 13,
    color: colors.text.muted,
    marginBottom: 4,
    fontWeight: '500',
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    padding: 2,
  },
  modeButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  modeButtonActive: {
    backgroundColor: colors.functional.rhythm,
  },
  modeButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  modeButtonTextActive: {
    color: '#FFFFFF',
  },
  mainArea: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  visualColumn: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlColumn: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md, // smからmdに変更
    paddingTop: spacing.lg, // 上に余白を追加してBPM表示を真ん中に
  },
  tempoDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  tempoValue: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.functional.rhythm,
  },
  tempoInput: {
    fontFamily: 'monospace',
    fontWeight: '700',
    color: colors.functional.rhythm,
    borderBottomWidth: 2,
    borderBottomColor: colors.functional.rhythm,
    minWidth: 80,
    textAlign: 'center',
    padding: 0,
  },
  tempoUnit: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '500',
  },
  tempoButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tempoButton: {
    backgroundColor: colors.background.secondary,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    minWidth: 60,
    alignItems: 'center',
  },
  tempoButtonPressed: {
    backgroundColor: colors.accent.primaryDark,
  },
  tempoButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  tapButton: {
    backgroundColor: colors.functional.rhythm,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginHorizontal: spacing.xs,
  },
  tapButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.functional.rhythm,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: colors.functional.stop,
  },
  playButtonText: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
    paddingLeft: 2, // 三角を中央に調整
  },
  beatIndicatorContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  measureText: {
    fontSize: 11,
    color: colors.text.secondary,
  },
  // モーダル共通
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  // 拍分割モーダル
  subdivisionModal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.md,
    minWidth: 340,
  },
  subdivisionList: {
    gap: spacing.sm,
  },
  subdivisionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subdivisionChip: {
    width: 50,
    height: 44,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subdivisionChipActive: {
    backgroundColor: colors.functional.rhythm,
  },
  subdivisionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  subdivisionLabelActive: {
    color: '#FFFFFF',
  },
  subdivisionDesc: {
    fontSize: 9,
    color: colors.text.muted,
  },
  subdivisionDescActive: {
    color: 'rgba(255,255,255,0.8)',
  },
  subdivisionSlider: {
    flex: 1,
    height: 36,
  },
  volumeText: {
    fontSize: 12,
    color: colors.text.muted,
    minWidth: 36,
    textAlign: 'right',
  },
  volumeTextActive: {
    color: colors.text.secondary,
    fontWeight: '600',
  },
  // 拍子モーダル
  timeSignatureModal: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    minWidth: 280,
  },
  timeSignatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  timeSignatureOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
    backgroundColor: colors.background.tertiary,
    minWidth: 55,
    alignItems: 'center',
  },
  timeSignatureOptionActive: {
    backgroundColor: colors.functional.rhythm,
  },
  timeSignatureOptionText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  timeSignatureOptionTextActive: {
    color: '#FFFFFF',
  },
});
