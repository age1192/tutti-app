/**
 * コード進行パッドコンテナ
 * 
 * I, IV, Vを大きく、他は小さく配置
 * 12調すべてにトランスポーズ可能
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Dimensions } from 'react-native';
import { colors, spacing } from '../../styles';
import { ChordPad, ChordVoices } from './ChordPad';
import { useAudioEngine } from '../../hooks';
import { useHarmonyStore } from '../../stores';
import { ToneType } from '../../types';
import { getEqualTemperamentFrequency, getJustIntonationFrequency } from '../../utils/pitchUtils';

// ダイアトニックコードの定義（度数とコードタイプ）
interface DiatonicChord {
  degree: string;      // ローマ数字表記
  semitones: number;   // ルートからの半音数
  type: 'major' | 'minor' | 'diminished';
}

const DIATONIC_CHORDS: DiatonicChord[] = [
  { degree: 'I', semitones: 0, type: 'major' },
  { degree: 'ii', semitones: 2, type: 'minor' },
  { degree: 'iii', semitones: 4, type: 'minor' },
  { degree: 'IV', semitones: 5, type: 'major' },
  { degree: 'V', semitones: 7, type: 'major' },
  { degree: 'vi', semitones: 9, type: 'minor' },
  { degree: 'vii°', semitones: 11, type: 'diminished' },
];

// コードタイプごとの構成音（半音数）
const CHORD_INTERVALS = {
  major: { third: 4, fifth: 7 },      // Root, M3, P5
  minor: { third: 3, fifth: 7 },      // Root, m3, P5
  diminished: { third: 3, fifth: 6 }, // Root, m3, dim5
};

// 音名（12調）
const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
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

interface ChordProgressionPadProps {
  // 基準となるMIDIノート（C4 = 60）
  rootMidi?: number;
  // ピッチ（Hz）- useHarmonyStoreから
  basePitch?: number;
  // 音律 - useHarmonyStoreから
  tuning?: 'equal' | 'just';
  // オクターブオフセット
  octaveOffset?: number;
  // ホールドモード
  holdMode?: boolean;
  // パッドサイズ（未使用だが互換性のため残す）
  padSize?: number;
  // キーインデックス（親から制御）
  keyIndex?: number;
  // キー変更ハンドラー（親から制御）
  onKeyChange?: (delta: number) => void;
}

// MIDIノートから周波数を計算（平均律）
const midiToFrequencyEqual = (midi: number, basePitch: number = 440): number => {
  return basePitch * Math.pow(2, (midi - 69) / 12);
};

export const ChordProgressionPad: React.FC<ChordProgressionPadProps> = ({
  rootMidi = 60, // C4
  basePitch = 442,
  tuning = 'just',
  octaveOffset = 0,
  holdMode = false,
  keyIndex: externalKeyIndex,
  onKeyChange: externalOnKeyChange,
}) => {
  const { startNote, stopNote, stopAllNotes, setNoteVolume } = useAudioEngine();
  const { tone } = useHarmonyStore();
  const [internalKeyIndex, setInternalKeyIndex] = useState(0); // 0 = C
  const keyIndex = externalKeyIndex !== undefined ? externalKeyIndex : internalKeyIndex;
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  
  // 現在再生中のノートを管理
  const activeNotesRef = useRef<Map<string, ChordVoices>>(new Map());
  const prevHoldModeRef = useRef<boolean>(holdMode);

  // ホールドモードがOFFになった時に、すべてのコードの音を停止
  useEffect(() => {
    // ホールドモードがOFFになった時（true -> false）
    if (prevHoldModeRef.current && !holdMode) {
      // すべてのダイアトニックコードの音を停止
      const allChordIds = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
      allChordIds.forEach((chordId) => {
        const baseId = chordId.charCodeAt(0) * 1000;
        stopNote(baseId + 0);
        stopNote(baseId + 1);
        stopNote(baseId + 2);
      });
      // アクティブなコードをクリア
      activeNotesRef.current.clear();
    }
    // 前のホールドモードの状態を更新
    prevHoldModeRef.current = holdMode;
  }, [holdMode, stopNote]);

  // 実際のルートMIDI（トランスポーズ適用）
  const actualRootMidi = rootMidi + KEY_OPTIONS[keyIndex].semitones;

  // 動的パッドサイズ計算（I IV Vを大きく）
  const { mainPadSize, secondaryPadSize } = useMemo(() => {
    const availableWidth = screenWidth - 32; // 左右余白
    // ヘッダー(コントロール約80px) + モードバー(44px) + タブバー(68px) + 余白
    // topBarはmodeBarと同じ行に配置するので高さに含めない
    const availableHeight = screenHeight - 200; 
    
    // メイン（I IV V）: 3個 + 2個のギャップ（各8px）
    const mainWidthBased = Math.floor((availableWidth - 16) / 3);
    // セカンダリ（ii iii vi vii°）: 4個 + 3個のギャップ（各8px）
    const secondaryWidthBased = Math.floor((availableWidth - 24) / 4);
    
    // 縦: 2行 + ギャップ（8px）
    const maxHeightBased = Math.floor((availableHeight - 8) / 2);
    
    // サイズを適切に設定（I,IV,Vは大きめ、ii,iii,vi,vii°は小さめ）
    // より大きなサイズを確保
    const mainSize = Math.min(mainWidthBased, maxHeightBased, 150); // 最大150px
    const secondarySize = Math.min(secondaryWidthBased, Math.floor(maxHeightBased * 0.8), 110); // 最大110px
    
    return {
      mainPadSize: Math.max(mainSize, 120), // 最小120px（以前より大きく）
      secondaryPadSize: Math.max(secondarySize, 85), // 最小85px（以前より大きく）
    };
  }, [screenWidth, screenHeight]);

  // コードの構成音（MIDIノート）を計算
  const getChordVoices = useCallback((chord: DiatonicChord): ChordVoices => {
    const baseRoot = actualRootMidi + octaveOffset * 12 + chord.semitones;
    const intervals = CHORD_INTERVALS[chord.type];
    
    return {
      root: baseRoot,
      third: baseRoot + intervals.third,
      fifth: baseRoot + intervals.fifth,
    };
  }, [actualRootMidi, octaveOffset]);

  // コード名を取得
  const getChordName = useCallback((chord: DiatonicChord): string => {
    const noteIndex = (keyIndex + chord.semitones) % 12;
    const noteName = NOTE_NAMES[noteIndex];
    const suffix = chord.type === 'minor' ? 'm' : chord.type === 'diminished' ? '°' : '';
    return `${noteName}${suffix}`;
  }, [keyIndex]);

  // コード開始
  const handleChordStart = useCallback((chordId: string, voices: ChordVoices) => {
    const baseId = chordId.charCodeAt(0) * 1000;
    
    // ホールドモードがONの時は、既存のコードの音をすべて停止（置き換え方式）
    if (holdMode) {
      // 既存のコードの音をすべて停止（同じコードIDも含む）
      // すべてのダイアトニックコードの可能性のあるbaseIdを停止
      // これにより、activeNotesRefに記録されていない音も確実に停止
      const allChordIds = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
      allChordIds.forEach((existingChordId) => {
        const existingBaseId = existingChordId.charCodeAt(0) * 1000;
        stopNote(existingBaseId + 0);
        stopNote(existingBaseId + 1);
        stopNote(existingBaseId + 2);
      });
      // 既存のコードをクリア（新しいコードだけを残す）
      activeNotesRef.current.clear();
    }
    
    // 最新の音色を取得
    const currentTone = useHarmonyStore.getState().tone;
    
    let rootFreq: number;
    let thirdFreq: number;
    let fifthFreq: number;
    
    if (tuning === 'just') {
      // 純正律: コードのルート音を基準に各音を計算
      // ルート音は平均律で計算
      rootFreq = getEqualTemperamentFrequency(voices.root, basePitch);
      
      // 3度と5度はルート音を基準に純正律で計算
      // 長3度（M3）: 5/4 = 1.25（約14セント低い）
      // 完全5度（P5）: 3/2 = 1.5（約2セント高い）
      thirdFreq = getJustIntonationFrequency(voices.third, voices.root, basePitch);
      fifthFreq = getJustIntonationFrequency(voices.fifth, voices.root, basePitch);
    } else {
      // 平均律: すべて平均律で計算
      rootFreq = midiToFrequencyEqual(voices.root, basePitch);
      thirdFreq = midiToFrequencyEqual(voices.third, basePitch);
      fifthFreq = midiToFrequencyEqual(voices.fifth, basePitch);
    }
    
    // ホールドモードがONの時は、同じコードIDの音も停止してから開始（置き換え方式）
    if (holdMode) {
      // 同じコードIDの音を停止（念のため）
      stopNote(baseId + 0);
      stopNote(baseId + 1);
      stopNote(baseId + 2);
    }
    
    startNote(baseId + 0, rootFreq, 0.25, currentTone);
    startNote(baseId + 1, thirdFreq, 0.25, currentTone);
    startNote(baseId + 2, fifthFreq, 0.25, currentTone);
    
    activeNotesRef.current.set(chordId, voices);
  }, [basePitch, tuning, startNote, stopNote, holdMode]);

  // コード終了
  const handleChordStop = useCallback((chordId: string) => {
    const baseId = chordId.charCodeAt(0) * 1000;
    
    stopNote(baseId + 0);
    stopNote(baseId + 1);
    stopNote(baseId + 2);
    
    activeNotesRef.current.delete(chordId);
  }, [stopNote]);

  // 音量変更
  const handleVolumeChange = useCallback((
    chordId: string,
    voicePart: 'root' | 'third' | 'fifth',
    volume: number
  ) => {
    const baseId = chordId.charCodeAt(0) * 1000;
    const partIndex = voicePart === 'root' ? 0 : voicePart === 'third' ? 1 : 2;
    setNoteVolume(baseId + partIndex, volume * 0.25);
  }, [setNoteVolume]);

  // キー変更
  const handleKeyChange = (delta: number) => {
    if (externalOnKeyChange) {
      externalOnKeyChange(delta);
    } else {
      setInternalKeyIndex((prev) => (prev + delta + 12) % 12);
    }
  };
  
  // キー名を取得（エクスポート用）
  const keyName = KEY_OPTIONS[keyIndex].name;

  // basePitch/tuning/tone が変更されたときに、鳴っているコードを再生し直す（リアルタイム反映）
  useEffect(() => {
    // 現在鳴っているコードがあれば再生し直す
    const activeChords = Array.from(activeNotesRef.current.entries());
    if (activeChords.length === 0) return;

    const currentTone = useHarmonyStore.getState().tone;
    
    activeChords.forEach(([chordId, voices]) => {
      const baseId = chordId.charCodeAt(0) * 1000;
      
      // 既存の音を停止
      stopNote(baseId + 0);
      stopNote(baseId + 1);
      stopNote(baseId + 2);
      
      // 新しい周波数を計算
      let rootFreq: number;
      let thirdFreq: number;
      let fifthFreq: number;
      
      if (tuning === 'just') {
        rootFreq = getEqualTemperamentFrequency(voices.root, basePitch);
        thirdFreq = getJustIntonationFrequency(voices.third, voices.root, basePitch);
        fifthFreq = getJustIntonationFrequency(voices.fifth, voices.root, basePitch);
      } else {
        rootFreq = midiToFrequencyEqual(voices.root, basePitch);
        thirdFreq = midiToFrequencyEqual(voices.third, basePitch);
        fifthFreq = midiToFrequencyEqual(voices.fifth, basePitch);
      }
      
      // 新しい周波数で再生
      startNote(baseId + 0, rootFreq, 0.25, currentTone);
      startNote(baseId + 1, thirdFreq, 0.25, currentTone);
      startNote(baseId + 2, fifthFreq, 0.25, currentTone);
    });
  }, [basePitch, tuning, startNote, stopNote]);

  return (
    <View style={styles.container}>
      {/* コードパッド（I IV V大きく、他は小さく） */}
      <View style={styles.padGrid}>
        {/* 上段: I, IV, V（主要コード - 大きく） */}
        <View style={styles.mainChords}>
          {[DIATONIC_CHORDS[0], DIATONIC_CHORDS[3], DIATONIC_CHORDS[4]].map((chord) => {
            const voices = getChordVoices(chord);
            const chordName = getChordName(chord);
            
            return (
              <ChordPad
                key={chord.degree}
                label={chord.degree}
                subLabel={chordName}
                voices={voices}
                size={mainPadSize}
                holdMode={holdMode}
                onChordStart={(v) => handleChordStart(chord.degree, v)}
                onChordStop={() => handleChordStop(chord.degree)}
                onVolumeChange={(part, vol) => handleVolumeChange(chord.degree, part, vol)}
              />
            );
          })}
        </View>

        {/* 下段: ii, iii, vi, vii°（その他のダイアトニックコード - 小さく） */}
        <View style={styles.secondaryChords}>
          {[DIATONIC_CHORDS[1], DIATONIC_CHORDS[2], DIATONIC_CHORDS[5], DIATONIC_CHORDS[6]].map((chord) => {
            const voices = getChordVoices(chord);
            const chordName = getChordName(chord);
            
            return (
              <ChordPad
                key={chord.degree}
                label={chord.degree}
                subLabel={chordName}
                voices={voices}
                size={secondaryPadSize}
                holdMode={holdMode}
                onChordStart={(v) => handleChordStart(chord.degree, v)}
                onChordStop={() => handleChordStop(chord.degree)}
                onVolumeChange={(part, vol) => handleVolumeChange(chord.degree, part, vol)}
              />
            );
          })}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.sm, // 画面端から適切な距離を確保
    paddingVertical: spacing.xs, // 上下の余白を確保
    justifyContent: 'flex-start', // 上寄せ
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
    marginTop: 0,
    height: 36, // 固定高さで被らないように
  },
  keySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: 2,
  },
  keyBtn: {
    width: 32,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
  },
  keyBtnText: {
    fontSize: 12,
    color: colors.text.secondary,
    fontWeight: '600',
  },
  keyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 4,
  },
  keyLabel: {
    fontSize: 11,
    color: colors.text.muted,
  },
  keyName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.functional.harmony,
    minWidth: 50,
    textAlign: 'center',
  },
  guide: {
    flexDirection: 'row',
    gap: 8,
  },
  guideItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  guideIcon: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  guideText: {
    fontSize: 9,
    color: colors.text.muted,
  },
  padGrid: {
    flex: 1,
    justifyContent: 'flex-start', // 中央から上寄せに変更
    alignItems: 'center',
    gap: spacing.xs, // smからxsに変更して小さい画面に対応
    paddingTop: spacing.md, // 上部の余白を増やす（modeBarとの被り防止）
    paddingBottom: spacing.lg, // mdからlgに変更して下部の余白を増やす
    minHeight: 0, // flexアイテムが縮小可能に
  },
  mainChords: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs, // smからxsに変更
    flexWrap: 'wrap', // 小さい画面で折り返し可能に
    marginBottom: spacing.xs, // 下段との間隔を確保
  },
  secondaryChords: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs, // smからxsに変更
    flexWrap: 'wrap', // 小さい画面で折り返し可能に
  },
});
