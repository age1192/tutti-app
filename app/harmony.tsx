/**
 * ハーモニー画面
 * - 横画面（ランドスケープ）対応
 * - リアルなピアノ鍵盤
 * - グリッサンド対応
 * - コード進行パッドモード
 */
import { View, Text, StyleSheet, Dimensions, StatusBar, Pressable } from 'react-native';
import { useEffect, useCallback, useState, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing } from '../styles';
import { TuningType } from '../types';
import { useHarmonyStore } from '../stores';
import { useAudioEngine, useBluetoothPedal } from '../hooks';
import { PianoKeyboard, HarmonyControls, ChordProgressionPad } from '../components/harmony';
import { getEqualTemperamentFrequency, getJustIntonationFrequency, JUST_INTONATION_RATIOS } from '../utils/pitchUtils';
import { ToneType } from '../types';
import { detectChord, getRootNote } from '../utils/chordUtils';
import { TRANSPOSE_SEMITONES, TransposeKey } from '../stores/useHarmonyStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { PITCH_DEFAULT } from '../utils/constants';

// 表示モード
type ViewMode = 'keyboard' | 'chordPad';

// キーオプション（コードモード用）
const KEY_OPTIONS = [
  { name: 'C', semitones: 0 },
  { name: 'C#/Db', semitones: 1 },
  { name: 'D', semitones: 2 },
  { name: 'Eb', semitones: 3 },
  { name: 'E', semitones: 4 },
  { name: 'F', semitones: 5 },
  { name: 'F#/Gb', semitones: 6 },
  { name: 'G', semitones: 7 },
  { name: 'Ab', semitones: 8 },
  { name: 'A', semitones: 9 },
  { name: 'Bb', semitones: 10 },
  { name: 'B', semitones: 11 },
];

export default function HarmonyScreen() {
  const {
    tuning,
    tone,
    basePitch,
    octave,
    transpose,
    activeNotes,
    setTuning,
    setTone,
    setBasePitch,
    setOctave,
    setTranspose,
    addActiveNote,
    removeActiveNote,
    clearActiveNotes,
  } = useHarmonyStore();

  const { startNote, stopNote, stopAllNotes, setNoteVolume, isAudioSupported, ensureAudioContextResumed } = useAudioEngine();
  const insets = useSafeAreaInsets();
  const { settings, loadSettings } = useSettingsStore();
  const [isLandscape, setIsLandscape] = useState(false);
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  const [holdMode, setHoldMode] = useState(false); // ホールドモード
  const [currentRootNote, setCurrentRootNote] = useState<number | null>(null); // 現在の和音のルート音
  const [viewMode, setViewMode] = useState<ViewMode>('keyboard'); // 表示モード
  const [chordKeyIndex, setChordKeyIndex] = useState(0); // コードモードのキーインデックス

  // 画面がフォーカスされた時に設定のデフォルト値を適用
  useFocusEffect(
    useCallback(() => {
      // 設定を読み込んで適用
      loadSettings().then(() => {
        const currentSettings = useSettingsStore.getState().settings;
        if (!currentSettings) return; // 設定が読み込まれていない場合はスキップ
        
        const currentBasePitch = useHarmonyStore.getState().basePitch;
        const currentTuning = useHarmonyStore.getState().tuning;
        
        // ピッチがデフォルト値（440）と同じ場合のみ設定を適用（ユーザーが変更していない場合）
        if (Math.abs(currentBasePitch - PITCH_DEFAULT) < 0.1) {
          const defaultPitch = currentSettings.defaultPitch ?? PITCH_DEFAULT;
          setBasePitch(defaultPitch);
        }
        // 調律がデフォルト値（平均律）と同じ場合のみ設定を適用
        if (currentTuning === 'equal') {
          const defaultTuning = currentSettings.defaultTuning ?? 'equal';
          setTuning(defaultTuning);
        }
      }).catch((error) => {
        console.error('Failed to load and apply settings:', error);
      });
    }, [loadSettings, setBasePitch, setTuning])
  );

  // HarmonyControlsの高さを計算（横画面時はヘッダー上余白を最小に）
  const controlsHeight = useMemo(() => {
    const topPadding = isLandscape ? 4 : Math.max(insets.top, spacing.sm);
    const controlsMinHeight = isLandscape ? 68 : 70;
    return topPadding + controlsMinHeight;
  }, [isLandscape, insets.top]);

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
      setIsLandscape(window.width > window.height);
    });

    // 初期状態をチェック
    const { width, height } = Dimensions.get('window');
    setIsLandscape(width > height);

    return () => subscription.remove();
  }, []);

  // 画面に入った時にクリーンアップ（画面向きはhome.tsxで管理）
  useEffect(() => {
    return () => {
      stopAllNotes();
      clearActiveNotes();
    };
  }, [stopAllNotes, clearActiveNotes]);

  // 全ての音が消えたらルート音もリセット
  useEffect(() => {
    if (activeNotes.size === 0) {
      setCurrentRootNote(null);
    }
  }, [activeNotes]);

  // MIDIから周波数を計算（トランスポーズ考慮）
  const getFrequency = useCallback(
    (midiNote: number): number => {
      // トランスポーズを適用
      const transposedMidi = midiNote + TRANSPOSE_SEMITONES[transpose];
      
      // 平均律の場合は常に平均律で計算
      if (tuning === 'equal') {
        return getEqualTemperamentFrequency(transposedMidi, basePitch);
      }
      
      // 純正律の場合
      // ルート音が設定されている場合は、そのルート音を基準に純正律で計算
      if (currentRootNote !== null) {
        // ルート音を平均律で計算
        const rootMidi = currentRootNote + TRANSPOSE_SEMITONES[transpose];
        const rootFrequency = getEqualTemperamentFrequency(rootMidi, basePitch);
        
        // ルート音からの音程を計算
        const interval = ((transposedMidi - rootMidi) % 12 + 12) % 12;
        const octaveOffset = Math.floor((transposedMidi - rootMidi) / 12);
        
        // 純正律の比率を適用
        const ratio = JUST_INTONATION_RATIOS[interval] || 1;
        
        return rootFrequency * ratio * Math.pow(2, octaveOffset);
      }
      
      // ルート音が設定されていない場合（単音で和音が始まっていない）は平均律
      return getEqualTemperamentFrequency(transposedMidi, basePitch);
    },
    [tuning, basePitch, transpose, currentRootNote]
  );

  // 周波数を計算するヘルパー関数（ルート音を直接指定）
  const calculateFrequencyWithRoot = useCallback((
    midiNote: number,
    rootNote: number | null
  ): number => {
    const transposedMidi = midiNote + TRANSPOSE_SEMITONES[transpose];
    
    if (tuning === 'equal') {
      return getEqualTemperamentFrequency(transposedMidi, basePitch);
    }
    
    if (rootNote !== null) {
      // 純正律でルート音がある場合
      const rootMidi = rootNote + TRANSPOSE_SEMITONES[transpose];
      const rootFrequency = getEqualTemperamentFrequency(rootMidi, basePitch);
      const interval = ((transposedMidi - rootMidi) % 12 + 12) % 12;
      const octaveOffset = Math.floor((transposedMidi - rootMidi) / 12);
      const ratio = JUST_INTONATION_RATIOS[interval] || 1;
      return rootFrequency * ratio * Math.pow(2, octaveOffset);
    }
    
    // 単音でルート音がない場合は平均律
    return getEqualTemperamentFrequency(transposedMidi, basePitch);
  }, [tuning, basePitch, transpose]);

  // ノートON
  const handleNoteOn = useCallback(
    async (midiNote: number) => {
      try {
        // iOS: ユーザーインタラクション時にAudioContextを確実にresume
        await ensureAudioContextResumed();
        
        // 新しいノートを追加した状態で和音を判定
        const newActiveNotes = new Set(activeNotes);
        newActiveNotes.add(midiNote);
        const notesArray = Array.from(newActiveNotes);
        
        // 和音が2音以上ならルート音を判定・更新
        let rootNote = currentRootNote;
        if (notesArray.length >= 2) {
          const detectedRoot = getRootNote(notesArray);
          if (detectedRoot !== null) {
            rootNote = detectedRoot;
            setCurrentRootNote(detectedRoot);
            
            // ルート音が変わった場合、既存の音も再計算
            if (currentRootNote !== detectedRoot && tuning === 'just') {
              activeNotes.forEach((existingMidi) => {
                const frequency = calculateFrequencyWithRoot(existingMidi, detectedRoot);
                stopNote(existingMidi);
                startNote(existingMidi, frequency, 0.3, tone);
              });
            }
          }
        }
        
        // 新しい音の周波数を計算
        const frequency = calculateFrequencyWithRoot(midiNote, rootNote);
        
        await startNote(midiNote, frequency, 0.3, tone);
        addActiveNote(midiNote);
      } catch (error) {
        console.error('[Harmony] Error in handleNoteOn:', error);
      }
    },
    [activeNotes, currentRootNote, tuning, calculateFrequencyWithRoot, startNote, stopNote, addActiveNote, ensureAudioContextResumed]
  );

  // ノートOFF
  const handleNoteOff = useCallback(
    (midiNote: number) => {
      stopNote(midiNote);
      removeActiveNote(midiNote);
    },
    [stopNote, removeActiveNote]
  );

  // 全音停止
  const handleStopAll = useCallback(() => {
    stopAllNotes();
    clearActiveNotes();
    setCurrentRootNote(null); // ルート音もリセット
  }, [stopAllNotes, clearActiveNotes]);

  // ホールドモード切替
  const handleHoldModeChange = useCallback((hold: boolean) => {
    setHoldMode(hold);
    // ホールドをOFFにした時は全音停止
    if (!hold) {
      handleStopAll();
    }
  }, [handleStopAll]);

  // Bluetoothペダル対応
  const { isConnected: isPedalConnected, connect: connectPedal, disconnect: disconnectPedal } = useBluetoothPedal(
    () => {
      // ペダル押下: ホールドON
      if (!holdMode) {
        setHoldMode(true);
      }
    },
    () => {
      // ペダル解放: ホールドOFF
      if (holdMode) {
        setHoldMode(false);
        handleStopAll();
      }
    }
  );

  // 周波数を再計算するヘルパー関数
  const recalculateFrequency = useCallback((
    midiNote: number,
    newTuning?: TuningType,
    newPitch?: number,
    newTranspose?: TransposeKey
  ): number => {
    const currentTuning = newTuning ?? tuning;
    const currentPitch = newPitch ?? basePitch;
    const currentTranspose = newTranspose ?? transpose;
    const rootNote = currentRootNote; // 現在のルート音を使用
    
    const transposedMidi = midiNote + TRANSPOSE_SEMITONES[currentTranspose];
    
    // 平均律の場合は常に平均律で計算
    if (currentTuning === 'equal') {
      return getEqualTemperamentFrequency(transposedMidi, currentPitch);
    }
    
    // 純正律の場合
    // ルート音が設定されている場合は、そのルート音を基準に純正律で計算
    if (rootNote !== null) {
      // ルート音を平均律で計算
      const rootMidi = rootNote + TRANSPOSE_SEMITONES[currentTranspose];
      const rootFrequency = getEqualTemperamentFrequency(rootMidi, currentPitch);
      
      // ルート音からの音程を計算
      const interval = ((transposedMidi - rootMidi) % 12 + 12) % 12;
      const octaveOffset = Math.floor((transposedMidi - rootMidi) / 12);
      
      // 純正律の比率を適用
      const ratio = JUST_INTONATION_RATIOS[interval] || 1;
      
      return rootFrequency * ratio * Math.pow(2, octaveOffset);
    }
    
    // ルート音が設定されていない場合は平均律
    return getEqualTemperamentFrequency(transposedMidi, currentPitch);
  }, [tuning, basePitch, transpose, currentRootNote]);

  // 音律変更時にアクティブな音を再計算
  const handleTuningChange = useCallback((newTuning: TuningType) => {
    // アクティブな音を再計算してから設定を更新
    const notes = Array.from(activeNotes);
    notes.forEach((midi) => {
      const frequency = recalculateFrequency(midi, newTuning);
      stopNote(midi);
      startNote(midi, frequency, 0.3, tone);
    });
    setTuning(newTuning);
  }, [setTuning, activeNotes, recalculateFrequency, stopNote, startNote, tone]);

  // ピッチ変更時にアクティブな音を再計算
  const handlePitchChange = useCallback((newPitch: number) => {
    // アクティブな音を再計算してから設定を更新
    const notes = Array.from(activeNotes);
    notes.forEach((midi) => {
      const frequency = recalculateFrequency(midi, undefined, newPitch);
      stopNote(midi);
      startNote(midi, frequency, 0.3, tone);
    });
    setBasePitch(newPitch);
  }, [setBasePitch, activeNotes, recalculateFrequency, stopNote, startNote, tone]);

  // トランスポーズ変更時にアクティブな音を再計算
  const handleTransposeChange = useCallback((newTranspose: TransposeKey) => {
    // アクティブな音を再計算してから設定を更新
    const notes = Array.from(activeNotes);
    notes.forEach((midi) => {
      const frequency = recalculateFrequency(midi, undefined, undefined, newTranspose);
      stopNote(midi);
      startNote(midi, frequency, 0.3, tone);
    });
    setTranspose(newTranspose);
  }, [setTranspose, activeNotes, recalculateFrequency, stopNote, startNote, tone]);

  // 音色変更時にアクティブな音を再生成
  const handleToneChange = useCallback((newTone: ToneType) => {
    // アクティブな音を新しい音色で再生成
    const notes = Array.from(activeNotes);
    notes.forEach((midi) => {
      const frequency = recalculateFrequency(midi);
      stopNote(midi);
      startNote(midi, frequency, 0.3, newTone);
    });
    setTone(newTone);
  }, [setTone, activeNotes, recalculateFrequency, stopNote, startNote]);

  // コード名を計算
  const chordName = useMemo(() => {
    const notes = Array.from(activeNotes);
    if (notes.length < 2) return null;
    return detectChord(notes);
  }, [activeNotes]);

  // 純正律モードでルート音が設定されている時、activeNotesが変更されたら全ての音を再計算
  useEffect(() => {
    if (tuning === 'just' && currentRootNote !== null && activeNotes.size > 0) {
      // ルート音が設定されているので、全ての音を再計算
      const notes = Array.from(activeNotes);
      
      notes.forEach((midi) => {
        const frequency = calculateFrequencyWithRoot(midi, currentRootNote);
        stopNote(midi);
        startNote(midi, frequency, 0.3, tone);
      });
    }
  }, [activeNotes, currentRootNote, tuning, calculateFrequencyWithRoot, stopNote, startNote, tone]);

  // モード切り替え時に全音停止
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    handleStopAll();
    setViewMode(mode);
  }, [handleStopAll]);

  // コードパッド用のルートMIDI（オクターブ設定を反映）
  const chordPadRootMidi = useMemo(() => {
    return 60 + (octave - 4) * 12; // C4 = 60 を基準
  }, [octave]);

  return (
    <View style={[styles.container, isLandscape && styles.containerLandscape]}>
      <StatusBar hidden={isLandscape} />

      {/* 上段: コントロール（Tonica風・横並び・SafeArea対応） */}
      <HarmonyControls
        octave={octave}
        tuning={tuning}
        tone={tone}
        basePitch={basePitch}
        transpose={transpose}
        holdMode={holdMode}
        onOctaveChange={setOctave}
        onTuningChange={handleTuningChange}
        onToneChange={handleToneChange}
        onPitchChange={handlePitchChange}
        onTransposeChange={handleTransposeChange}
        onHoldModeChange={handleHoldModeChange}
        isLandscape={isLandscape}
      />

      {/* モード切り替えバーとコード名/Hz表示エリア（横並び） */}
      <View style={styles.modeBar}>
        {/* モード切り替えボタン */}
        <View style={styles.modeSwitcher}>
          <Pressable
            style={[styles.modeBtn, viewMode === 'keyboard' && styles.modeBtnActive]}
            onPress={() => handleViewModeChange('keyboard')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'keyboard' && styles.modeBtnTextActive]}>
              鍵盤
            </Text>
          </Pressable>
          <Pressable
            style={[styles.modeBtn, viewMode === 'chordPad' && styles.modeBtnActive]}
            onPress={() => handleViewModeChange('chordPad')}
          >
            <Text style={[styles.modeBtnText, viewMode === 'chordPad' && styles.modeBtnTextActive]}>
              コード
            </Text>
          </Pressable>
        </View>

        {/* コード名/Hz表示エリア（鍵盤モード時）またはキーセレクタ＆ガイド（コードモード時） */}
        {viewMode === 'keyboard' ? (
          <View style={styles.infoBar}>
            {chordName ? (
              <View style={styles.chordBar}>
                <Text style={styles.chordName}>{chordName}</Text>
              </View>
            ) : activeNotes.size > 0 ? (
              <View style={styles.activeNotesBar}>
                <Text style={styles.activeNotesText} numberOfLines={1}>
                  {Array.from(activeNotes)
                    .map((midi) => `${getFrequency(midi).toFixed(0)}Hz`)
                    .join(' / ')}
                </Text>
              </View>
            ) : (
              <View style={styles.infoBarPlaceholder}>
                <Text style={styles.infoBarPlaceholderText}>音を押すとコード名/周波数を表示</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.chordModeBar}>
            {/* キーセレクタ */}
            <View style={styles.keySelector}>
              <Pressable 
                style={styles.keyBtn} 
                onPress={() => setChordKeyIndex((prev) => (prev - 1 + 12) % 12)}
              >
                <Text style={styles.keyBtnText}>◀</Text>
              </Pressable>
              <View style={styles.keyDisplay}>
                <Text style={styles.keyLabel}>Key:</Text>
                <Text style={styles.keyName}>{KEY_OPTIONS[chordKeyIndex].name}</Text>
              </View>
              <Pressable 
                style={styles.keyBtn} 
                onPress={() => setChordKeyIndex((prev) => (prev + 1) % 12)}
              >
                <Text style={styles.keyBtnText}>▶</Text>
              </Pressable>
            </View>

            {/* ガイド */}
            <View style={styles.guide}>
              <View style={styles.guideItem}>
                <View style={[styles.guideIcon, { backgroundColor: '#E91E63' }]} />
                <Text style={styles.guideText}>↑R</Text>
              </View>
              <View style={styles.guideItem}>
                <View style={[styles.guideIcon, { backgroundColor: '#2196F3' }]} />
                <Text style={styles.guideText}>←3</Text>
              </View>
              <View style={styles.guideItem}>
                <View style={[styles.guideIcon, { backgroundColor: '#4CAF50' }]} />
                <Text style={styles.guideText}>→5</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* メインエリア（flex:1で残りスペースを使用、overflow:hiddenで確実にはみ出さない） */}
      <View style={[
        styles.keyboardPanel, 
        isLandscape && styles.keyboardPanelLandscape,
      ]}>
        {viewMode === 'keyboard' ? (
          <PianoKeyboard
            startOctave={octave}
            octaveCount={2}
            activeNotes={activeNotes}
            holdMode={holdMode}
            maxHeight={Math.floor(dimensions.height - controlsHeight - MODE_BAR_HEIGHT - spacing.xs * 2 - TAB_BAR_HEIGHT)}
            onNoteOn={handleNoteOn}
            onNoteOff={handleNoteOff}
          />
        ) : (
          <ChordProgressionPad
            rootMidi={chordPadRootMidi}
            basePitch={basePitch}
            tuning={tuning}
            padSize={85}
            octaveOffset={0}
            holdMode={holdMode}
            keyIndex={chordKeyIndex}
            onKeyChange={(delta) => setChordKeyIndex((prev) => (prev + delta + 12) % 12)}
            startNote={startNote}
            stopNote={stopNote}
            stopAllNotes={stopAllNotes}
            setNoteVolume={setNoteVolume}
          />
        )}
      </View>
    </View>
  );
}

// スマホサイズ対応の固定高さ（PianoKeyboard.tsxと合わせる）
const MODE_BAR_HEIGHT = 44; // ボタンの文字が切れないように調整（モード切り替えとコード名/周波数表示の共通高さ）

// タブバーの高さを計算（paddingTop + paddingBottom + tab高さ + border）
// paddingTop: spacing.sm (8) + paddingBottom: spacing.sm (8) + tab paddingVertical: spacing.md * 2 (32) + テキスト高さ (約18) + border (2) ≈ 68px
const TAB_BAR_HEIGHT = spacing.sm + spacing.sm + spacing.md * 2 + 18 + 2; // 約68px

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
  },
  containerLandscape: {
    paddingTop: 0,
  },
  modeBar: {
    height: MODE_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    zIndex: 10,
  },
  modeSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 4,
  },
  modeBtn: {
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: colors.functional.harmony,
  },
  modeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
    lineHeight: 18,
  },
  modeBtnTextActive: {
    color: '#FFFFFF',
  },
  infoBar: {
    flex: 1,
    height: MODE_BAR_HEIGHT,
    justifyContent: 'center',
    zIndex: 10,
    backgroundColor: colors.background.primary,
    position: 'relative',
  },
  infoBarPlaceholder: {
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    height: MODE_BAR_HEIGHT,
    justifyContent: 'center',
  },
  infoBarPlaceholderText: {
    fontSize: 11,
    color: colors.text.muted,
  },
  keyboardPanel: {
    flex: 1, // 残りのスペースを使用
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.sm, // 上部の余白を増やす（modeBarとの被り防止）
    paddingBottom: Math.max(spacing.md, TAB_BAR_HEIGHT * 0.3), // タブバーとの被り防止（タブバー高さの30%以上の余白）
    overflow: 'hidden', // 絶対にはみ出さない
    zIndex: 1,
  },
  keyboardPanelLandscape: {
    paddingVertical: spacing.xs,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xs,
  },
  chordBar: {
    backgroundColor: colors.functional.harmony,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    borderRadius: 6,
    height: MODE_BAR_HEIGHT,
    justifyContent: 'center',
  },
  chordName: {
    ...typography.heading,
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '700',
    lineHeight: 20,
  },
  activeNotesBar: {
    backgroundColor: colors.background.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    alignItems: 'center',
    height: MODE_BAR_HEIGHT,
    justifyContent: 'center',
  },
  activeNotesText: {
    ...typography.caption,
    color: colors.functional.harmony,
    fontSize: 11,
    lineHeight: 14,
  },
  // コードモード用のバー（キーセレクタとガイド）
  chordModeBar: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    height: MODE_BAR_HEIGHT,
  },
  keySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 4,
  },
  keyBtn: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
  },
  keyBtnText: {
    fontSize: 14,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  keyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: 4,
  },
  keyLabel: {
    fontSize: 11,
    color: colors.text.muted,
  },
  keyName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.functional.harmony,
    minWidth: 50,
    textAlign: 'center',
  },
  guide: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  guideIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  guideText: {
    fontSize: 10,
    color: colors.text.muted,
  },
});
