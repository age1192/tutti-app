/**
 * コード再生画面
 * 入力したコードをテンポに沿って再生する機能
 * アイディアルプロ風の小節ごとのコード進行機能
 */
import { View, Text, StyleSheet, Pressable, StatusBar, ScrollView, Dimensions, Modal, Animated, TextInput, Alert, Platform, AppState, AppStateStatus } from 'react-native';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// react-native-keyeventのインポート（エラーハンドリング付き）
let KeyEvent: any = null;
try {
  KeyEvent = require('react-native-keyevent');
} catch (e) {
  // ライブラリが利用できない場合はnullのまま
  console.warn('react-native-keyevent is not available:', e);
}
import { colors, typography, spacing } from '../styles';
import { useMetronomeStore } from '../stores/useMetronomeStore';
import { useSettingsStore } from '../stores/useSettingsStore';
import { usePresetStore } from '../stores/usePresetStore';
import { useAudioEngine } from '../hooks';
import { getEqualTemperamentFrequency } from '../utils/pitchUtils';
import { chordNameToMidiNotes, transposeChordName, getChordPitchClasses } from '../utils/chordUtils';
import { PITCH_DEFAULT, TEMPO_MIN, TEMPO_MAX, TIME_SIGNATURES, LANDSCAPE_SAFE_AREA_INSET } from '../utils/constants';
import { getTemplateById, isTemplateId } from '../utils/playbackTemplates';
import { applyVoiceLeading, getInitialVoicing } from '../utils/voiceLeadingUtils';
import { TimeSignatureSelector } from '../components/metronome/TimeSignatureSelector';
import { PresetManager } from '../components/preset/PresetManager';
import { TimeSignature } from '../types';
import Slider from '@react-native-community/slider';

// 小節のデータ構造
interface Measure {
  id: string;
  chordName: string; // コード名（例: "C", "Dm", "G7"）
  midiNotes: number[]; // MIDIノート番号の配列
  /** ユーザーがボイシングをカスタマイズした場合 true（この小節は声部連結なしでmidiNotesをそのまま使用） */
  hasCustomVoicing?: boolean;
}

// デフォルト表示用: template-basic（基本的な I-IV-V）の内容
function getDefaultPlaybackState() {
  const template = getTemplateById('template-basic');
  if (template) {
    return {
      measures: template.measures.map((m) => ({ ...m, hasCustomVoicing: template.useSpecifiedVoicing ?? false })),
      tempo: template.tempo,
      timeSignature: template.timeSignature,
      metronomeEnabled: template.metronomeEnabled,
      useSpecifiedVoicing: template.useSpecifiedVoicing ?? false,
      currentTemplateId: template.id as string | null,
    };
  }
  return {
    measures: [
      { id: '1', chordName: 'C', midiNotes: chordNameToMidiNotes('C', 4) },
      { id: '2', chordName: 'F', midiNotes: chordNameToMidiNotes('F', 4) },
      { id: '3', chordName: 'G', midiNotes: chordNameToMidiNotes('G', 4) },
      { id: '4', chordName: 'C', midiNotes: chordNameToMidiNotes('C', 4) },
    ],
    tempo: 120,
    timeSignature: TIME_SIGNATURES[3],
    metronomeEnabled: true,
    useSpecifiedVoicing: false,
    currentTemplateId: null,
  };
}

const DEFAULT_PLAYBACK = getDefaultPlaybackState();

// 12音の基本コード
const ROOT_NOTES = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

// コードタイプ（派生コード）
const CHORD_TYPES = [
  { name: '', label: 'メジャー' },
  { name: 'm', label: 'マイナー' },
  { name: '7', label: 'セブンス' },
  { name: 'm7', label: 'm7' },
  { name: 'M7', label: 'M7' },
  { name: 'sus4', label: 'sus4' },
  { name: 'sus2', label: 'sus2' },
  { name: 'dim', label: 'dim' },
  { name: 'dim7', label: 'dim7' },
  { name: 'aug', label: 'aug' },
  { name: '6', label: '6' },
  { name: 'm6', label: 'm6' },
  { name: '9', label: '9' },
  { name: 'm9', label: 'm9' },
  { name: 'add9', label: 'add9' },
];

// コードプリセットを生成
const CHORD_PRESETS = ROOT_NOTES.flatMap(root => 
  CHORD_TYPES.map(type => ({ root, type: type.name, full: root + type.name, label: type.label }))
);

// SATB 4声の名前（西洋和声の基本）
const SATB_VOICE_NAMES = ['Bass', 'Tenor', 'Alto', 'Soprano'];
// ピッチクラス表示名（0=C ～ 11=B）
const PITCH_CLASS_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// 1声分のデータ
interface SatbVoice {
  pitchClass: number;
  octave: number;
}

// ボイシング編集モーダルコンポーネント（SATB 4声方式）
interface VoicingEditorModalProps {
  visible: boolean;
  measure: Measure | null;
  onSave: (midiNotes: number[]) => void;
  onCancel: () => void;
  startNote: (noteId: number, frequency: number, volume?: number, tone?: string) => void;
  stopAllNotes: () => void;
  resumeAudioContextSync?: () => void;
}

function VoicingEditorModal({ visible, measure, onSave, onCancel, startNote, stopAllNotes, resumeAudioContextSync }: VoicingEditorModalProps) {
  const [satbVoices, setSatbVoices] = useState<SatbVoice[]>([
    { pitchClass: 0, octave: 2 },
    { pitchClass: 0, octave: 3 },
    { pitchClass: 0, octave: 4 },
    { pitchClass: 0, octave: 5 },
  ]);
  const [previewMidiNotes, setPreviewMidiNotes] = useState<number[]>([]);

  // SATB から MIDI ノート配列を生成（低→高の順で返す）
  const buildMidiNotesFromSatb = useCallback((voices: SatbVoice[]) => {
    const notes = voices.map((v) => (v.octave + 1) * 12 + v.pitchClass);
    notes.sort((a, b) => a - b);
    return notes;
  }, []);

  // プレビュー用のMIDIノートを更新
  const updatePreview = useCallback(() => {
    setPreviewMidiNotes(buildMidiNotesFromSatb(satbVoices));
  }, [satbVoices, buildMidiNotesFromSatb]);

  useEffect(() => {
    updatePreview();
  }, [satbVoices, updatePreview]);

  // 小節が変更されたら初期化（既存の4音を SATB に割り当て、足りなければコード構成音で補う）
  useEffect(() => {
    if (!visible || !measure || !measure.chordName) {
      if (!measure) {
        setSatbVoices([
          { pitchClass: 0, octave: 2 },
          { pitchClass: 0, octave: 3 },
          { pitchClass: 0, octave: 4 },
          { pitchClass: 0, octave: 5 },
        ]);
        setPreviewMidiNotes([]);
      }
      return;
    }

    const { pitchClasses } = getChordPitchClasses(measure.chordName);
    const defaultMidi = measure.midiNotes.length >= 4
      ? measure.midiNotes
      : measure.midiNotes.length > 0
        ? measure.midiNotes
        : chordNameToMidiNotes(measure.chordName, 4);

    const sorted = [...defaultMidi].map((n) => ({ pc: n % 12, octave: Math.floor(n / 12) - 1 })).sort((a, b) => {
      const na = (a.octave + 1) * 12 + a.pc;
      const nb = (b.octave + 1) * 12 + b.pc;
      return na - nb;
    });

    const defaultOctaves = [2, 3, 4, 5]; // Bass, Tenor, Alto, Soprano の目安
    const initial: SatbVoice[] = [];
    for (let i = 0; i < 4; i++) {
      let pc: number;
      let octave: number;
      if (sorted[i]) {
        pc = pitchClasses.includes(sorted[i].pc) ? sorted[i].pc : pitchClasses[0];
        octave = sorted[i].octave;
      } else {
        pc = pitchClasses[i % pitchClasses.length] ?? pitchClasses[0];
        octave = defaultOctaves[i];
      }
      initial.push({ pitchClass: pc, octave });
    }
    setSatbVoices(initial);
  }, [visible, measure?.id, measure?.chordName, measure?.midiNotes?.join(',')]);

  const handlePitchClassChange = (voiceIndex: number, pitchClass: number) => {
    const next = [...satbVoices];
    next[voiceIndex] = { ...next[voiceIndex], pitchClass };
    setSatbVoices(next);
  };

  const handleOctaveChange = (voiceIndex: number, octave: number) => {
    const clamped = Math.max(1, Math.min(7, octave));
    const next = [...satbVoices];
    next[voiceIndex] = { ...next[voiceIndex], octave: clamped };
    setSatbVoices(next);
  };

  const handlePreview = () => {
    resumeAudioContextSync?.(); // iOS: ユーザージェスチャー内で同期的に resume
    stopAllNotes();
    const notes = buildMidiNotesFromSatb(satbVoices);
    notes.forEach((midiNote) => {
      const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
      startNote(midiNote, frequency, 0.3, 'organ');
    });
    setTimeout(() => stopAllNotes(), 1000);
  };

  const handleSave = () => {
    onSave(buildMidiNotesFromSatb(satbVoices));
    stopAllNotes();
  };

  const handleCancel = () => {
    stopAllNotes();
    onCancel();
  };

  if (!measure || !measure.chordName) return null;

  const chordPitchClasses = getChordPitchClasses(measure.chordName).pitchClasses;
  if (chordPitchClasses.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
      presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
    >
      <View style={styles.modalOverlay}>
        <ScrollView
          style={styles.voicingEditorModalScrollView}
          contentContainerStyle={styles.voicingEditorModalScrollContent}
          showsVerticalScrollIndicator={true}
        >
          <View style={styles.voicingEditorModalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>ボイシングを編集（SATB）</Text>
              <Pressable style={styles.modalCloseIconButton} onPress={handleCancel}>
                <Text style={styles.modalCloseIconText}>×</Text>
              </Pressable>
            </View>

            <View style={styles.voicingEditorContent}>
              <Text style={styles.voicingEditorChordName}>{measure.chordName}</Text>
              <Text style={styles.voicingEditorSatbHint}>各声部にコードの構成音とオクターブを割り当てます。</Text>

              <View style={styles.voicingEditorVoiceList}>
                {SATB_VOICE_NAMES.map((voiceName, index) => {
                  const voice = satbVoices[index] ?? { pitchClass: 0, octave: 4 };
                  const noteName = PITCH_CLASS_NAMES[voice.pitchClass];
                  const octave = voice.octave;
                  const allowedPitchClasses = chordPitchClasses;

                  return (
                    <View key={index} style={styles.voicingEditorVoiceRow}>
                      <View style={styles.voicingEditorVoiceLabel}>
                        <Text style={styles.voicingEditorVoiceName}>{voiceName}</Text>
                        <Text style={styles.voicingEditorVoiceNote}>{noteName}{octave}</Text>
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.voicingEditorPitchClassScroll}
                        contentContainerStyle={styles.voicingEditorPitchClassRow}
                      >
                        {allowedPitchClasses.map((pc) => (
                          <Pressable
                            key={pc}
                            style={[
                              styles.voicingEditorPitchClassButton,
                              voice.pitchClass === pc && styles.voicingEditorPitchClassButtonSelected,
                            ]}
                            onPress={() => handlePitchClassChange(index, pc)}
                          >
                            <Text
                              style={[
                                styles.voicingEditorPitchClassButtonText,
                                voice.pitchClass === pc && styles.voicingEditorPitchClassButtonTextSelected,
                              ]}
                            >
                              {PITCH_CLASS_NAMES[pc]}
                            </Text>
                          </Pressable>
                        ))}
                      </ScrollView>
                      <View style={styles.voicingEditorOctaveControls}>
                        <Pressable
                          style={styles.voicingEditorOctaveButton}
                          onPress={() => handleOctaveChange(index, octave - 1)}
                        >
                          <Text style={styles.voicingEditorOctaveButtonText}>−</Text>
                        </Pressable>
                        <Text style={styles.voicingEditorOctaveValue}>{octave}</Text>
                        <Pressable
                          style={styles.voicingEditorOctaveButton}
                          onPress={() => handleOctaveChange(index, octave + 1)}
                        >
                          <Text style={styles.voicingEditorOctaveButtonText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.voicingEditorActions}>
                <Pressable style={styles.voicingEditorPreviewButton} onPress={handlePreview}>
                  <Text style={styles.voicingEditorPreviewButtonText}>プレビュー</Text>
                </Pressable>
                <View style={styles.voicingEditorSaveCancel}>
                  <Pressable
                    style={[styles.voicingEditorSaveButton, styles.voicingEditorCancelButton]}
                    onPress={handleCancel}
                  >
                    <Text style={styles.voicingEditorSaveButtonText}>キャンセル</Text>
                  </Pressable>
                  <Pressable style={styles.voicingEditorSaveButton} onPress={handleSave}>
                    <Text style={[styles.voicingEditorSaveButtonText, styles.voicingEditorSaveButtonTextActive]}>保存</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function PlaybackScreen() {
  const insets = useSafeAreaInsets();
  const { tempo: metronomeTempo, timeSignature: metronomeTimeSignature, setTimeSignature } = useMetronomeStore();
  const { settings } = useSettingsStore();
  const { startNote, stopNote, stopAllNotes, playClick, resumeAudioContextSync } = useAudioEngine();
  const [dimensions, setDimensions] = useState(Dimensions.get('window'));
  
  // コード進行の状態（デフォルト: template-basic 基本的な I-IV-V）
  const [measures, setMeasures] = useState<Measure[]>(DEFAULT_PLAYBACK.measures);
  const [isPlaying, setIsPlaying] = useState(false);
  const [manualMode, setManualMode] = useState(false); // 手動モード（キーボード/ペダルで進む）
  const [currentMeasureIndex, setCurrentMeasureIndex] = useState(0);
  const keyboardInputRef = useRef<TextInput>(null);
  const [selectingMeasureId, setSelectingMeasureId] = useState<string | null>(null);
  const [tempo, setTempo] = useState(DEFAULT_PLAYBACK.tempo);
  const [timeSignature, setLocalTimeSignature] = useState(DEFAULT_PLAYBACK.timeSignature);
  const [metronomeEnabled, setMetronomeEnabled] = useState(DEFAULT_PLAYBACK.metronomeEnabled);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [isCountIn, setIsCountIn] = useState(false);
  const [tempoInput, setTempoInput] = useState(DEFAULT_PLAYBACK.tempo.toString());
  const [presetManagerVisible, setPresetManagerVisible] = useState(false);
  const [savePresetModalVisible, setSavePresetModalVisible] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  /** テンプレート由来の場合 true：measures[].midiNotes を直接使用（声部連結なし） */
  const [useSpecifiedVoicing, setUseSpecifiedVoicing] = useState(DEFAULT_PLAYBACK.useSpecifiedVoicing);
  /** 現在読み込まれているテンプレートID（テンプレートの場合のみ設定、ユーザー編集時はnull） */
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(DEFAULT_PLAYBACK.currentTemplateId);
  /** ボイシング編集モーダルの表示状態（小節ID） */
  const [editingVoicingMeasureId, setEditingVoicingMeasureId] = useState<string | null>(null);
  const { savePlaybackPreset, loadPlaybackPresets, playbackPresets } = usePresetStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const countInIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const beatProgressAnim = useRef(new Animated.Value(0)).current;
  const progressAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const beatAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  const [globalTimelineWidth, setGlobalTimelineWidth] = useState(0);
  const measuresScrollViewRef = useRef<ScrollView>(null);
  /** 手動モードで現在鳴らしているMIDIノート（次のコードに移るまで持続） */
  const manualModeNotesRef = useRef<number[]>([]);

  // 画面サイズ変更を監視
  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    return () => subscription.remove();
  }, []);

  // 利用可能な高さを計算（ヘッダー、コントロール、ステータス、タブバーを除く）
  const availableHeight = useMemo(() => {
    const screenHeight = dimensions.height;
    const headerHeight = 60; // ヘッダーの高さ（概算）
    const controlsHeight = 80; // コントロール（再生ボタン）の高さ（概算）
    const statusHeight = 0; // ステータスの高さ（インライン表示のため0）
    const tabBarHeight = 70; // タブバーの高さ（概算）
    const padding = spacing.md * 2; // 上下のパディング
    
    return screenHeight - headerHeight - controlsHeight - statusHeight - tabBarHeight - padding - insets.top;
  }, [dimensions.height, insets.top]);

  // バックグラウンド再生OFF時: バックグラウンドに移ったら停止
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'background' && !settings?.backgroundPlayback && isPlaying) {
        setIsPlaying(false);
      }
    };
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [settings?.backgroundPlayback, isPlaying]);

  // 画面に入った時に停止
  useFocusEffect(
    useCallback(() => {
      setIsPlaying(false);
      stopAllNotes();
      setCurrentMeasureIndex(0);
      progressAnim.setValue(0);
      beatProgressAnim.setValue(0);
      if (progressAnimationRef.current) {
        progressAnimationRef.current.stop();
        progressAnimationRef.current = null;
      }
      if (beatAnimationRef.current) {
        beatAnimationRef.current.stop();
        beatAnimationRef.current = null;
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return () => {
        setIsPlaying(false);
        stopAllNotes();
        if (progressAnimationRef.current) {
          progressAnimationRef.current.stop();
          progressAnimationRef.current = null;
        }
        if (beatAnimationRef.current) {
          beatAnimationRef.current.stop();
          beatAnimationRef.current = null;
        }
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        if (countInIntervalRef.current) {
          clearInterval(countInIntervalRef.current);
          countInIntervalRef.current = null;
        }
        setIsCountIn(false);
      };
    }, [stopAllNotes])
  );


  // メトロノームのテンポと拍子が変更されたら同期
  useEffect(() => {
    if (!isPlaying) {
      setTempo(metronomeTempo);
      setTempoInput(metronomeTempo.toString());
      setLocalTimeSignature(metronomeTimeSignature);
    }
  }, [metronomeTempo, metronomeTimeSignature, isPlaying]);

  // テンポ入力の処理
  const handleTempoInputChange = (text: string) => {
    setTempoInput(text);
    const numValue = parseInt(text, 10);
    if (!isNaN(numValue) && numValue >= TEMPO_MIN && numValue <= TEMPO_MAX) {
      setTempo(numValue);
    }
  };

  const handleTempoInputBlur = () => {
    const numValue = parseInt(tempoInput, 10);
    if (isNaN(numValue) || numValue < TEMPO_MIN) {
      setTempoInput(TEMPO_MIN.toString());
      setTempo(TEMPO_MIN);
    } else if (numValue > TEMPO_MAX) {
      setTempoInput(TEMPO_MAX.toString());
      setTempo(TEMPO_MAX);
    } else {
      setTempoInput(numValue.toString());
      setTempo(numValue);
    }
  };

  // 手動モードで次のコードに進む（再生中のみ有効。現在の音を止めて次を鳴らす。次のコードに移るまで持続。最後の小節の次で音を切る）
  const handleNextChord = useCallback(() => {
    if (!manualMode || !isPlaying) return;
    
    const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
    if (validMeasures.length === 0) return;
    
    // 現在鳴っている音を止める
    manualModeNotesRef.current.forEach((midiNote) => {
      stopNote(midiNote);
    });
    manualModeNotesRef.current = [];
    
    const currentValidIndex = validMeasures.findIndex(
      (m) => m.id === measures[currentMeasureIndex]?.id
    );
    
    // 最後の小節の次（右矢印を押した）→ 音を切れて終了
    if (currentValidIndex >= validMeasures.length - 1) {
      return;
    }
    
    // 次の有効なコードに進む
    const nextValidMeasure = validMeasures[currentValidIndex + 1];
    const nextIndex = measures.findIndex((m) => m.id === nextValidMeasure.id);
    setCurrentMeasureIndex(nextIndex);
    
    // コードを再生（持続。次のコードに移るまで鳴らし続ける）
    // カスタムボイシングが指定されている場合は measures[].midiNotes を直接使用
    // それ以外は声部連結を適用
    let midiNotes: number[];
    if (nextValidMeasure.hasCustomVoicing) {
      midiNotes = nextValidMeasure.midiNotes.map((n) => n + transposeSemitones);
    } else {
      const prevNotes = validMeasures[currentValidIndex]?.midiNotes || [];
      midiNotes = prevNotes.length > 0
        ? applyVoiceLeading(prevNotes, nextValidMeasure.chordName).map((n) => n + transposeSemitones)
        : getInitialVoicing(nextValidMeasure.chordName, 4).map((n) => n + transposeSemitones);
    }
    
    manualModeNotesRef.current = midiNotes;
    midiNotes.forEach((midiNote) => {
      const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
      startNote(midiNote, frequency, 0.3, 'organ');
    });
  }, [manualMode, isPlaying, measures, currentMeasureIndex, transposeSemitones, startNote, stopNote]);

  // 手動モードで前のコードに戻る（再生中のみ有効。現在の音を止めて前を鳴らし、持続）
  const handlePreviousChord = useCallback(() => {
    if (!manualMode || !isPlaying) return;
    
    const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
    if (validMeasures.length === 0) return;
    
    // 現在鳴っている音を止める
    manualModeNotesRef.current.forEach((midiNote) => {
      stopNote(midiNote);
    });
    manualModeNotesRef.current = [];
    
    const currentValidIndex = validMeasures.findIndex(
      (m) => m.id === measures[currentMeasureIndex]?.id
    );
    
    if (currentValidIndex <= 0) return;
    
    // 前の有効なコードに戻る
    const prevValidMeasure = validMeasures[currentValidIndex - 1];
    const prevIndex = measures.findIndex((m) => m.id === prevValidMeasure.id);
    setCurrentMeasureIndex(prevIndex);
    
    // コードを再生（持続）
    // カスタムボイシングが指定されている場合は measures[].midiNotes を直接使用
    // それ以外は getInitialVoicing を使用
    let midiNotes: number[];
    if (prevValidMeasure.hasCustomVoicing) {
      midiNotes = prevValidMeasure.midiNotes.map((n) => n + transposeSemitones);
    } else {
      midiNotes = getInitialVoicing(prevValidMeasure.chordName, 4).map((n) => n + transposeSemitones);
    }
    
    manualModeNotesRef.current = midiNotes;
    midiNotes.forEach((midiNote) => {
      const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
      startNote(midiNote, frequency, 0.3, 'organ');
    });
  }, [manualMode, isPlaying, measures, currentMeasureIndex, transposeSemitones, startNote, stopNote]);

  // 手動モードで再生を押したとき、1個目のコードを自動で再生開始（持続）
  useEffect(() => {
    if (!manualMode || !isPlaying) return;
    
    const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
    if (validMeasures.length === 0) return;
    
    const firstMeasure = validMeasures[0];
    const firstIndex = measures.findIndex((m) => m.id === firstMeasure.id);
    setCurrentMeasureIndex(firstIndex);
    
    // カスタムボイシングが指定されている場合は measures[].midiNotes を直接使用
    // それ以外は getInitialVoicing を使用
    let midiNotes: number[];
    if (firstMeasure.hasCustomVoicing) {
      midiNotes = firstMeasure.midiNotes.map((n) => n + transposeSemitones);
    } else {
      midiNotes = getInitialVoicing(firstMeasure.chordName, 4).map((n) => n + transposeSemitones);
    }
    
    manualModeNotesRef.current = midiNotes;
    midiNotes.forEach((midiNote) => {
      const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
      startNote(midiNote, frequency, 0.3, 'organ');
    });
    
    return () => {
      manualModeNotesRef.current.forEach((midiNote) => {
        stopNote(midiNote);
      });
      manualModeNotesRef.current = [];
    };
  }, [manualMode, isPlaying, measures, transposeSemitones, startNote, stopNote]);

  // 停止時に手動モードの鳴っている音をクリア
  useEffect(() => {
    if (!isPlaying) {
      manualModeNotesRef.current = [];
    }
  }, [isPlaying]);

  // キーボードイベントハンドラー（再生中のみ有効）
  const handleKeyPress = useCallback((e: any) => {
    if (!manualMode || !isPlaying) return;
    
    // iOSとAndroidの両方で動作するように、複数の方法でキーを検出
    const key = e.nativeEvent?.key || e.key || e.nativeEvent?.code;
    
    // 右矢印キー（→）
    if (key === 'ArrowRight' || key === 'Right' || e.nativeEvent?.keyCode === 39) {
      handleNextChord();
      e.preventDefault?.();
      return false;
    }
    // 左矢印キー（←）
    else if (key === 'ArrowLeft' || key === 'Left' || e.nativeEvent?.keyCode === 37) {
      handlePreviousChord();
      e.preventDefault?.();
      return false;
    }
  }, [manualMode, isPlaying, handleNextChord, handlePreviousChord]);
  
  // Android用のonKeyDownハンドラー（再生中のみ有効）
  const handleKeyDown = useCallback((e: any) => {
    if (!manualMode || !isPlaying) return;
    
    const keyCode = e.nativeEvent?.keyCode;
    // 右矢印キー（→）
    if (keyCode === 39) {
      handleNextChord();
      e.preventDefault?.();
      return false;
    }
    // 左矢印キー（←）
    else if (keyCode === 37) {
      handlePreviousChord();
      e.preventDefault?.();
      return false;
    }
  }, [manualMode, isPlaying, handleNextChord, handlePreviousChord]);

  // react-native-keyeventを使ったキーボードイベント検出（iOS/Android両対応）
  useEffect(() => {
    if (!manualMode || isPlaying || !KeyEvent) {
      return;
    }

    try {
      // キーイベントリスナーを追加
      const keyDownListener = KeyEvent.onKeyDownListener((keyEvent: any) => {
        // 右矢印キー（→）
        if (keyEvent.keyCode === 22 || keyEvent.keyCode === 39) { // DPAD_RIGHT or KEYCODE_DPAD_RIGHT
          handleNextChord();
        }
        // 左矢印キー（←）
        else if (keyEvent.keyCode === 21 || keyEvent.keyCode === 37) { // DPAD_LEFT or KEYCODE_DPAD_LEFT
          handlePreviousChord();
        }
      });

      const keyUpListener = KeyEvent.onKeyUpListener((keyEvent: any) => {
        // 必要に応じてキーアップイベントも処理
      });

      return () => {
        // クリーンアップ
        try {
          keyDownListener?.remove();
          keyUpListener?.remove();
        } catch (e) {
          console.warn('Error removing key event listeners:', e);
        }
      };
    } catch (e) {
      console.warn('Error setting up key event listeners:', e);
      return undefined;
    }
  }, [manualMode, isPlaying, handleNextChord, handlePreviousChord]);

  // TextInputフォールバック（react-native-keyeventが動作しない場合のバックアップ）
  useEffect(() => {
    if (manualMode && !isPlaying) {
      // 少し遅延を入れてフォーカスを当てる（iOS/Androidの両方で動作するように）
      const timer = setTimeout(() => {
        keyboardInputRef.current?.focus();
      }, 200);
      return () => clearTimeout(timer);
    } else {
      // 手動モードが無効な時はフォーカスを外す
      keyboardInputRef.current?.blur();
    }
  }, [manualMode, isPlaying]);

  // テンポに合わせてコードを再生
  useEffect(() => {
    if (!isPlaying || measures.length === 0 || manualMode) {
      // 手動モードの時は自動再生を停止
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countInIntervalRef.current) {
        clearInterval(countInIntervalRef.current);
        countInIntervalRef.current = null;
      }
      setIsCountIn(false);
      setCurrentBeat(0);
      progressAnim.setValue(0);
      beatProgressAnim.setValue(0);
      if (progressAnimationRef.current) {
        progressAnimationRef.current.stop();
        progressAnimationRef.current = null;
      }
      if (beatAnimationRef.current) {
        beatAnimationRef.current.stop();
        beatAnimationRef.current = null;
      }
      return;
    }

    // 有効なコードがある小節のみをフィルタ
    const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
    if (validMeasures.length === 0) {
      setIsPlaying(false);
      return;
    }

    const beatIntervalMs = (60 / tempo) * 1000; // 1拍の時間（ミリ秒）
    const measureDurationMs = beatIntervalMs * timeSignature.numerator; // 1小節の時間（ミリ秒）
    
    // カウントインを開始（1小節分）
    setIsCountIn(true);
    setCurrentBeat(0);
    progressAnim.setValue(0);
    beatProgressAnim.setValue(0);
    
    // カウントインの1拍目を即座に再生
    if (metronomeEnabled) {
      playClick(true, 0.7, 'default'); // 最初の拍はアクセント
    }
    
    let countInBeat = 1; // 1拍目は既に再生済み
    setCurrentBeat(0); // 1拍目を表示
    
    countInIntervalRef.current = setInterval(() => {
      countInBeat++;
      if (metronomeEnabled) {
        const isAccent = countInBeat % timeSignature.numerator === 1; // 小節の最初の拍はアクセント
        playClick(isAccent, 0.7, 'default');
      }
      setCurrentBeat((countInBeat - 1) % timeSignature.numerator);
      
      // カウントイン終了（1小節分 = timeSignature.numerator拍）
      if (countInBeat > timeSignature.numerator) {
        if (countInIntervalRef.current) {
          clearInterval(countInIntervalRef.current);
          countInIntervalRef.current = null;
        }
        setIsCountIn(false);
        setCurrentBeat(0);
        
        // 本番の再生を開始
        const firstMeasure = validMeasures[0];
        const firstVoicedNotes = firstMeasure.hasCustomVoicing
          ? firstMeasure.midiNotes.map((n) => n + transposeSemitones)
          : getInitialVoicing(transposeChordName(firstMeasure.chordName, transposeSemitones));
        const voicedNotesRef = { current: firstVoicedNotes };
        firstVoicedNotes.forEach((midiNote) => {
          const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
          startNote(midiNote, frequency, 0.3, 'organ');
        });
        setCurrentMeasureIndex(0);

        // メトロノームとコードを同期させるための統合インターバル
        let beatCount = 0;
        let measureIndex = 0;

        // タイムラインアニメーション（全体の進行）
        const totalDuration = measureDurationMs * validMeasures.length;
        const progressAnimation = Animated.loop(
          Animated.timing(progressAnim, {
            toValue: 100,
            duration: totalDuration,
            useNativeDriver: false,
          })
        );
        progressAnimationRef.current = progressAnimation;
        progressAnimation.start();

        // ビートごとのアニメーション（1小節分）
        const beatAnimation = Animated.loop(
          Animated.timing(beatProgressAnim, {
            toValue: 100,
            duration: measureDurationMs,
            useNativeDriver: false,
          })
        );
        beatAnimationRef.current = beatAnimation;
        beatAnimation.start();

        // 統合インターバル（1拍ごと）
        intervalRef.current = setInterval(() => {
          beatCount = (beatCount + 1) % timeSignature.numerator;
          const isNewMeasure = beatCount === 0;
          
          // メトロノームのクリック音を再生
          if (metronomeEnabled) {
            const isAccent = isNewMeasure; // 小節の最初の拍はアクセント
            playClick(isAccent, 0.7, 'default');
          }
          
          setCurrentBeat(beatCount);
          
          // 小節が切り替わる時（beatCount === 0）にコードを変更
          if (isNewMeasure) {
            // 前のコードを停止（実際に再生していた音を停止）
            voicedNotesRef.current.forEach((midiNote) => {
              stopNote(midiNote);
            });

            // 次の小節に進む
            measureIndex = (measureIndex + 1) % validMeasures.length;
            const currentMeasure = validMeasures[measureIndex];
            const currentChordName = transposeChordName(currentMeasure.chordName, transposeSemitones);

            // カスタムボイシングが指定されている場合は measures[].midiNotes を直接使用
            // それ以外は声部連結を適用（最初の小節は getInitialVoicing、2小節目以降は applyVoiceLeading）
            const nextVoicedNotes = currentMeasure.hasCustomVoicing
              ? currentMeasure.midiNotes.map((n) => n + transposeSemitones)
              : measureIndex === 0
                ? getInitialVoicing(currentChordName)
                : applyVoiceLeading(voicedNotesRef.current, currentChordName);
            voicedNotesRef.current = nextVoicedNotes;

            nextVoicedNotes.forEach((midiNote) => {
              const frequency = getEqualTemperamentFrequency(midiNote, PITCH_DEFAULT);
              startNote(midiNote, frequency, 0.3, 'organ');
            });

            setCurrentMeasureIndex(measureIndex);
            
            // ビートアニメーションをリセット
            if (beatAnimationRef.current) {
              beatAnimationRef.current.stop();
            }
            beatProgressAnim.setValue(0);
            const newBeatAnimation = Animated.loop(
              Animated.timing(beatProgressAnim, {
                toValue: 100,
                duration: measureDurationMs,
                useNativeDriver: false,
              })
            );
            beatAnimationRef.current = newBeatAnimation;
            newBeatAnimation.start();
          }
        }, beatIntervalMs);
      }
    }, beatIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (countInIntervalRef.current) {
        clearInterval(countInIntervalRef.current);
        countInIntervalRef.current = null;
      }
      if (progressAnimationRef.current) {
        progressAnimationRef.current.stop();
        progressAnimationRef.current = null;
      }
      if (beatAnimationRef.current) {
        beatAnimationRef.current.stop();
        beatAnimationRef.current = null;
      }
    };
  }, [isPlaying, measures, tempo, timeSignature, metronomeEnabled, transposeSemitones, startNote, stopNote, playClick]);

  // 停止時にすべての音を停止
  useEffect(() => {
    if (!isPlaying) {
      stopAllNotes();
      setCurrentMeasureIndex(0);
    }
  }, [isPlaying, stopAllNotes]);

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
      if (validMeasures.length === 0) {
        // コードが入力されていない場合は警告を表示（オプション）
        return;
      }
      // iOS: 再生ボタン押下（ユーザージェスチャー）内で同期的に resume を呼ぶ
      resumeAudioContextSync();
      setIsPlaying(true);
    }
  };

  const handleAddMeasure = () => {
    if (isPlaying) return;
    setUseSpecifiedVoicing(false); // ユーザー編集時は声部連結を使用
    setCurrentTemplateId(null); // ユーザーが編集したらテンプレート状態を解除
    const newMeasure: Measure = {
      id: Date.now().toString(),
      chordName: '',
      midiNotes: [],
    };
    setMeasures([...measures, newMeasure]);
  };

  const handleDeleteMeasure = (id: string) => {
    if (measures.length <= 1 || isPlaying) return;
    setUseSpecifiedVoicing(false); // ユーザー編集時は声部連結を使用
    setCurrentTemplateId(null); // ユーザーが編集したらテンプレート状態を解除
    setMeasures(measures.filter((m) => m.id !== id));
  };

  const handleSelectChord = useCallback((id: string, chordName: string) => {
    try {
      const midiNotes = chordNameToMidiNotes(chordName, 4);
      setUseSpecifiedVoicing(false);
      setCurrentTemplateId(null);
      setMeasures((prevMeasures) =>
        prevMeasures.map((m) =>
          m.id === id
            ? { ...m, chordName, midiNotes, hasCustomVoicing: false }
            : m
        )
      );
      setSelectingMeasureId(null);
    } catch (err) {
      console.error('Select chord error:', err);
      Alert.alert('エラー', 'コードの選択に失敗しました');
      setSelectingMeasureId(null);
    }
  }, []);

  // ボイシング編集モーダルを開く
  const handleOpenVoicingEditor = (id: string) => {
    setSelectingMeasureId(null);
    setEditingVoicingMeasureId(id);
  };

  // ボイシングを保存（テンプレート指定ボイシング使用中でも、1つでも音を変えたら以降は声部連結で再計算する）
  const handleSaveVoicing = (id: string, customMidiNotes: number[]) => {
    setCurrentTemplateId(null); // ユーザーが編集したらテンプレート状態を解除
    setMeasures(
      measures.map((m) =>
        m.id === id
          ? { ...m, midiNotes: customMidiNotes, hasCustomVoicing: true }
          : m
      )
    );
    setUseSpecifiedVoicing(false); // どこか1つでも音を変えたら再計算モードへ
    setEditingVoicingMeasureId(null);
  };

  // ボイシング編集をキャンセル
  const handleCancelVoicingEdit = () => {
    setEditingVoicingMeasureId(null);
  };

  const handleOpenChordSelector = (id: string) => {
    if (!isPlaying) {
      setSelectingMeasureId(id);
    }
  };

  const handleTimeSignatureChange = (newTimeSignature: TimeSignature) => {
    if (!isPlaying) {
      setLocalTimeSignature(newTimeSignature);
      setTimeSignature(newTimeSignature);
    }
  };

  // プリセット保存
  const handleSavePreset = async () => {
    if (!presetName.trim()) {
      if (Platform.OS === 'web') {
        window.alert('プリセット名を入力してください');
      } else {
        Alert.alert('エラー', 'プリセット名を入力してください');
      }
      return;
    }

    try {
      await savePlaybackPreset({
        name: presetName.trim(),
        measures,
        tempo,
        timeSignature,
        metronomeEnabled,
      });
      setPresetName('');
      setSavePresetModalVisible(false);
      if (Platform.OS === 'web') {
        window.alert('プリセットを保存しました');
      } else {
        Alert.alert('完了', 'プリセットを保存しました');
      }
    } catch (error) {
      console.error('Failed to save preset:', error);
      const errorMsg = error instanceof Error ? error.message : 'プリセットの保存に失敗しました';
      if (Platform.OS === 'web') {
        window.alert(errorMsg);
      } else {
        Alert.alert('エラー', errorMsg);
      }
    }
  };

  // プリセット読み込み（テンプレート＆ユーザー保存プリセット対応）
  const handleLoadPreset = (presetId: string) => {
    try {
      if (isPlaying) {
        setIsPlaying(false);
      }
      
      const template = getTemplateById(presetId);
      const userPreset = playbackPresets.find((p) => p.id === presetId);
      const preset = template ?? userPreset;
      if (!preset) return;

      // テンプレートの useSpecifiedVoicing が true の場合、各小節の midiNotes をそのまま使用
      // （声部連結を適用せず、テンプレートで指定した音の高さを維持する）
      const templateUsesSpecifiedVoicing = template?.useSpecifiedVoicing === true;
      const measuresWithVoicing = preset.measures.map((m) => ({
        ...m,
        hasCustomVoicing: template
          ? templateUsesSpecifiedVoicing  // テンプレート: useSpecifiedVoicing に従う
          : m.hasCustomVoicing,           // ユーザープリセット: 元の値を維持
      }));

      setMeasures(measuresWithVoicing);
      setTempo(preset.tempo);
      setTempoInput(preset.tempo.toString());
      setLocalTimeSignature(preset.timeSignature);
      setTimeSignature(preset.timeSignature);
      setMetronomeEnabled(preset.metronomeEnabled);
      setUseSpecifiedVoicing(templateUsesSpecifiedVoicing);
      setCurrentTemplateId(template ? presetId : null);
      setPresetManagerVisible(false);
    } catch (err) {
      console.error('Error loading preset:', err);
      Alert.alert('エラー', 'プリセットの読み込みに失敗しました');
    }
  };

  // プリセット読み込み時にプリセットリストを更新
  useEffect(() => {
    if (presetManagerVisible) {
      loadPlaybackPresets();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetManagerVisible]);

  const validMeasures = measures.filter((m) => m.midiNotes.length > 0);
  const currentValidIndex = validMeasures.findIndex(
    (m) => m.id === measures[currentMeasureIndex]?.id
  );

  // 再生中に現在の小節が画面外の場合、自動スクロールして表示
  useEffect(() => {
    if (!isPlaying || currentMeasureIndex < 0 || !measuresScrollViewRef.current) return;

    // 小節の幅とgapを計算（stylesから取得）
    const measureCellWidth = 100; // measureCellのwidth
    const gap = spacing.sm; // measuresGridのgap
    const measureTotalWidth = measureCellWidth + gap;

    // 現在の小節の位置を計算（measures配列でのインデックス）
    const scrollX = currentMeasureIndex * measureTotalWidth;

    // 画面幅を取得
    const screenWidth = dimensions.width;
    const padding = spacing.md * 2; // measuresGridContentのpadding左右

    // 小節を画面中央に表示するようにスクロール位置を調整
    const targetScrollX = Math.max(0, scrollX - (screenWidth - padding - measureCellWidth) / 2);

    // スクロール実行（少し遅延を入れてスムーズに）
    setTimeout(() => {
      measuresScrollViewRef.current?.scrollTo({
        x: targetScrollX,
        animated: true,
      });
    }, 50);
  }, [isPlaying, currentMeasureIndex, dimensions.width]);

  // コード選択モーダルの内容をメモ化（パフォーマンス改善）
  const chordModalContent = useMemo(() => {
    return CHORD_TYPES.map((chordType) => (
      <View key={chordType.name} style={styles.chordTypeRow}>
        <View style={styles.chordTypeLabel}>
          <Text style={styles.chordTypeLabelText}>{chordType.label}</Text>
        </View>
        <View style={styles.chordTypeGrid}>
          {ROOT_NOTES.map((root) => {
            const chordName = root + chordType.name;
            return (
              <Pressable
                key={chordName}
                style={styles.chordTableCell}
                onPress={() => {
                  if (selectingMeasureId) {
                    handleSelectChord(selectingMeasureId, chordName);
                  }
                }}
              >
                <Text style={styles.chordTableCellText}>{chordName}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    ));
  }, [selectingMeasureId, handleSelectChord]);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {/* 非表示のキーボード入力（キーボード/ペダルイベント検出用） */}
      {manualMode && (
        <TextInput
          ref={keyboardInputRef}
          style={styles.hiddenKeyboardInput}
          onKeyPress={handleKeyPress}
          onKeyDown={handleKeyDown}
          autoFocus={false}
          showSoftInputOnFocus={false}
          blurOnSubmit={false}
          keyboardType="default"
          returnKeyType="none"
          editable={true}
          multiline={false}
          defaultValue=""
        />
      )}
      
      {/* ヘッダー（背景は画面端まで、コンテンツは余白内） */}
      <View
        style={[
          styles.headerOuter,
          {
            marginLeft: -Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
            marginRight: -Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
          },
        ]}
      >
        <View
          style={[
            styles.header,
            {
              paddingLeft: Math.max(insets.left, LANDSCAPE_SAFE_AREA_INSET),
              paddingRight: Math.max(insets.right, LANDSCAPE_SAFE_AREA_INSET),
            },
          ]}
        >
        <View style={styles.titleRow}>
          <Text style={styles.title}>コード再生</Text>
        </View>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.subtitle}>
              {tempo} BPM ({timeSignature.numerator}/{timeSignature.denominator})
            </Text>
            <Text style={styles.voicingHint}>長押しでボイシング編集</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={styles.transposeRow}>
              <Text style={styles.transposeLabel}>トランスポーズ</Text>
              <View style={styles.transposeControls}>
                <Pressable
                  style={[styles.transposeButton, isPlaying && styles.transposeButtonDisabled]}
                  onPress={() => setTransposeSemitones((s) => Math.max(-11, s - 1))}
                  disabled={isPlaying}
                >
                  <Text style={[styles.transposeButtonText, isPlaying && styles.transposeButtonTextDisabled]}>−</Text>
                </Pressable>
                <Text style={styles.transposeValue}>
                  {transposeSemitones === 0 ? '0' : (transposeSemitones > 0 ? '+' : '') + transposeSemitones}
                </Text>
                <Pressable
                  style={[styles.transposeButton, isPlaying && styles.transposeButtonDisabled]}
                  onPress={() => setTransposeSemitones((s) => Math.min(11, s + 1))}
                  disabled={isPlaying}
                >
                  <Text style={[styles.transposeButtonText, isPlaying && styles.transposeButtonTextDisabled]}>+</Text>
                </Pressable>
              </View>
            </View>
            <View style={styles.presetButtons}>
              <Pressable
                style={styles.presetButton}
                onPress={() => setSavePresetModalVisible(true)}
                disabled={isPlaying}
              >
                <Text style={[styles.presetButtonText, isPlaying && styles.presetButtonTextDisabled]}>
                  保存
                </Text>
              </Pressable>
              <Pressable
                style={styles.presetButton}
                onPress={() => setPresetManagerVisible(true)}
                disabled={isPlaying}
              >
                <Text style={[styles.presetButtonText, isPlaying && styles.presetButtonTextDisabled]}>
                  読み込み
                </Text>
              </Pressable>
            </View>
            <Pressable
              style={styles.settingsButton}
              onPress={() => setSettingsModalVisible(true)}
            >
              <Text style={styles.settingsButtonText}>⚙</Text>
            </Pressable>
          </View>
        </View>
        </View>
      </View>


      {/* メインエリア */}
      <View style={styles.content}>
        {/* 小節表（グリッド形式） */}
        <ScrollView 
          ref={measuresScrollViewRef}
          horizontal
          style={styles.measuresGridContainer}
          contentContainerStyle={styles.measuresGridContent}
          showsHorizontalScrollIndicator={true}
        >
          <View style={styles.measuresGrid}>
            {measures.map((measure, index) => {
              const isValid = measure.midiNotes.length > 0;
              const isCurrent = isPlaying && currentValidIndex >= 0 && 
                validMeasures[currentValidIndex]?.id === measure.id;
              return (
                <Pressable
                  key={measure.id}
                  style={[
                    styles.measureCell,
                    isCurrent && styles.measureCellActive,
                    !isValid && styles.measureCellEmpty,
                  ]}
                  onPress={() => {
                    if (!isPlaying) {
                      handleOpenChordSelector(measure.id);
                    }
                  }}
                  onLongPress={() => {
                    if (!isPlaying && isValid && measure.chordName) {
                      handleOpenVoicingEditor(measure.id);
                    }
                  }}
                  disabled={isPlaying}
                >
                  {/* 小節番号 */}
                  <View style={styles.measureCellHeader}>
                    <Text style={styles.measureCellNumber}>{index + 1}</Text>
                    {measures.length > 1 && (
                      <Pressable
                        style={styles.measureCellDelete}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleDeleteMeasure(measure.id);
                        }}
                        disabled={isPlaying}
                      >
                        <Text style={[styles.measureCellDeleteText, isPlaying && styles.measureCellDeleteTextDisabled]}>×</Text>
                      </Pressable>
                    )}
                  </View>
                  
                  {/* コードネーム */}
                  <View
                    style={[
                      styles.measureCellChord,
                      !isValid && styles.measureCellChordEmpty,
                      isCurrent && styles.measureCellChordActive,
                    ]}
                  >
                    <View style={styles.measureCellChordContent}>
                      <Text style={[
                        styles.measureCellChordText,
                        !isValid && styles.measureCellChordTextEmpty
                      ]}>
                        {isValid
                          ? transposeChordName(measure.chordName, transposeSemitones)
                          : '−'}
                      </Text>
                      {measure.hasCustomVoicing && (
                        <View style={styles.customVoicingIndicator}>
                          <View style={styles.customVoicingDot} />
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {/* タイムラインプログレスバー */}
                  {isPlaying && isCurrent && (
                    <View 
                      style={styles.measureCellTimeline}
                      onLayout={(e) => {
                        const width = e.nativeEvent.layout.width;
                        if (width > 0 && width !== timelineWidth) {
                          setTimelineWidth(width);
                        }
                      }}
                    >
                      {timelineWidth > 0 && (
                        <Animated.View
                          style={[
                            styles.measureCellTimelineBar,
                            {
                              width: beatProgressAnim.interpolate({
                                inputRange: [0, 100],
                                outputRange: [0, timelineWidth],
                              }),
                            },
                          ]}
                        />
                      )}
                    </View>
                  )}
                </Pressable>
              );
            })}
            
            {/* 小節追加ボタン */}
            <Pressable 
              style={styles.addMeasureCell} 
              onPress={handleAddMeasure}
              disabled={isPlaying}
            >
              <Text style={[styles.addMeasureCellText, isPlaying && styles.addMeasureCellTextDisabled]}>
                +
              </Text>
            </Pressable>
          </View>
        </ScrollView>

        {/* コントロール */}
        <View style={styles.controls}>
          {/* 手動モードトグル */}
          <Pressable
            style={[
              styles.manualModeButton,
              manualMode && styles.manualModeButtonActive,
              isPlaying && styles.manualModeButtonDisabled,
            ]}
            onPress={() => {
              if (!isPlaying) {
                setManualMode(!manualMode);
                if (!manualMode) {
                  setCurrentMeasureIndex(0);
                }
              }
            }}
            disabled={isPlaying}
          >
            <Text style={[
              styles.manualModeButtonText,
              manualMode && styles.manualModeButtonTextActive,
              isPlaying && styles.manualModeButtonTextDisabled,
            ]}>
              {manualMode ? '手動' : '自動'}
            </Text>
          </Pressable>
          
          {/* 手動モード時のみ表示：前へ/次へ矢印ボタン（再生を押した後のみ有効） */}
          {manualMode && (
            <View style={styles.arrowButtonsRow}>
              <Pressable
                style={[
                  styles.arrowButton,
                  (!isPlaying || validMeasures.length === 0) && styles.arrowButtonDisabled,
                ]}
                onPress={handlePreviousChord}
                disabled={!isPlaying || validMeasures.length === 0}
              >
                <Text style={[
                  styles.arrowButtonText,
                  (!isPlaying || validMeasures.length === 0) && styles.arrowButtonTextDisabled,
                ]}>←</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.arrowButton,
                  (!isPlaying || validMeasures.length === 0) && styles.arrowButtonDisabled,
                ]}
                onPress={handleNextChord}
                disabled={!isPlaying || validMeasures.length === 0}
              >
                <Text style={[
                  styles.arrowButtonText,
                  (!isPlaying || validMeasures.length === 0) && styles.arrowButtonTextDisabled,
                ]}>→</Text>
              </Pressable>
            </View>
          )}
          
          <Pressable
            style={[
              styles.playButton,
              isPlaying && styles.playButtonActive,
              validMeasures.length === 0 && styles.playButtonDisabled,
            ]}
            onPress={handlePlayPause}
            disabled={validMeasures.length === 0}
          >
            <Text
              style={[
                styles.playButtonText,
                isPlaying && styles.playButtonTextActive,
                validMeasures.length === 0 && styles.playButtonTextDisabled,
              ]}
            >
              {isPlaying ? '停止' : '再生'}
            </Text>
          </Pressable>
          
          {/* ステータス表示（再生ボタンの横） */}
          {(isCountIn || (isPlaying && !isCountIn)) && (
            <View style={styles.controlsStatus}>
              {isCountIn ? (
                <View style={styles.countInContainerInline}>
                  <Text style={styles.countInTextInline}>カウントイン</Text>
                  <Text style={styles.countInBeatInline}>{currentBeat + 1}</Text>
                </View>
              ) : (
                <Text style={styles.statusTextInline}>
                  再生中: {currentValidIndex + 1}/{validMeasures.length}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>

      {/* タイムラインプログレスバー（全体） */}
      <View 
        style={styles.globalTimelineContainer}
        onLayout={(e) => {
          const width = e.nativeEvent.layout.width;
          if (width > 0 && width !== globalTimelineWidth) {
            setGlobalTimelineWidth(width);
          }
        }}
      >
        {isPlaying && globalTimelineWidth > 0 && (
          <Animated.View
            style={[
              styles.globalTimelineBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: [0, globalTimelineWidth],
                }),
              },
            ]}
          />
        )}
      </View>


      {/* コード選択モーダル - 常にレンダリングして表示速度を改善 */}
      <Modal
        visible={selectingMeasureId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectingMeasureId(null)}
        hardwareAccelerated={false}
        presentationStyle="overFullScreen"
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { 
            height: Math.min(dimensions.height * 0.9, 600), 
            maxHeight: dimensions.height * 0.95,
            maxWidth: dimensions.width * 0.95,
          }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>コードを選択</Text>
            <Pressable
              style={styles.modalCloseIconButton}
              onPress={() => setSelectingMeasureId(null)}
            >
              <Text style={styles.modalCloseIconText}>×</Text>
            </Pressable>
            </View>
            
            {/* コード選択テーブル（12音×派生コード） */}
            <View style={styles.chordTableContainer}>
              <ScrollView 
                style={styles.chordTable} 
                contentContainerStyle={styles.chordTableContent}
                showsVerticalScrollIndicator={true}
              >
                {chordModalContent}
              </ScrollView>
            </View>
            
            <Pressable 
              style={styles.modalCloseButton} 
              onPress={() => setSelectingMeasureId(null)}
            >
              <Text style={styles.modalCloseText}>キャンセル</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ボイシング編集モーダル */}
      <VoicingEditorModal
        visible={editingVoicingMeasureId !== null}
        measure={measures.find((m) => m.id === editingVoicingMeasureId) || null}
        onSave={(customMidiNotes) => {
          if (editingVoicingMeasureId) {
            handleSaveVoicing(editingVoicingMeasureId, customMidiNotes);
          }
        }}
        onCancel={handleCancelVoicingEdit}
        startNote={startNote}
        stopAllNotes={stopAllNotes}
        resumeAudioContextSync={resumeAudioContextSync}
      />

      {/* プリセット保存モーダル */}
      <Modal
        visible={savePresetModalVisible}
        transparent
        animationType="none"
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.presetSaveModalContent}>
            <Text style={styles.modalTitle}>プリセット名</Text>
            <TextInput
              style={styles.presetSaveInput}
              value={presetName}
              onChangeText={setPresetName}
              placeholder="プリセット名を入力"
              placeholderTextColor={colors.text.muted}
              autoFocus
            />
            <View style={styles.presetSaveModalActions}>
              <Pressable
                style={[styles.presetSaveModalButton, styles.presetSaveModalButtonCancel]}
                onPress={() => {
                  setPresetName('');
                  setSavePresetModalVisible(false);
                }}
              >
                <Text style={styles.presetSaveModalButtonText}>キャンセル</Text>
              </Pressable>
              <Pressable 
                style={[styles.presetSaveModalButton, styles.presetSaveModalButtonSave]} 
                onPress={handleSavePreset}
              >
                <Text style={[styles.presetSaveModalButtonText, styles.presetSaveModalButtonTextSave]}>保存</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* プリセット管理モーダル */}
      <PresetManager
        visible={presetManagerVisible}
        onClose={() => setPresetManagerVisible(false)}
        type="playback"
        onSelect={handleLoadPreset}
      />

      {/* 設定モーダル */}
      <Modal
        visible={settingsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSettingsModalVisible(false)}
        presentationStyle={Platform.OS === 'ios' ? 'overFullScreen' : undefined}
      >
        <View style={styles.settingsModalOverlay}>
          <Pressable
            style={styles.settingsModalOverlayLeft}
            onPress={() => setSettingsModalVisible(false)}
          />
          <View
            style={styles.settingsModalContent}
          >
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>設定</Text>
              <Pressable
                style={styles.settingsModalCloseButton}
                onPress={() => setSettingsModalVisible(false)}
              >
                <Text style={styles.settingsModalCloseText}>×</Text>
              </Pressable>
            </View>

            <ScrollView 
              style={styles.settingsModalBody}
              contentContainerStyle={styles.settingsModalBodyContent}
              showsVerticalScrollIndicator={true}
            >
              {/* テンポコントロール */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>テンポ</Text>
                <View style={styles.tempoInputRow}>
                  <TextInput
                    style={styles.tempoInputModal}
                    value={tempoInput}
                    onChangeText={(text) => {
                      const num = parseInt(text, 10);
                      if (!isNaN(num) && num >= TEMPO_MIN && num <= TEMPO_MAX) {
                        setTempoInput(text);
                      } else if (text === '') {
                        setTempoInput('');
                      }
                    }}
                    onBlur={() => {
                      const num = parseInt(tempoInput, 10);
                      if (!isNaN(num) && num >= TEMPO_MIN && num <= TEMPO_MAX) {
                        setTempo(num);
                      } else {
                        setTempoInput(tempo.toString());
                      }
                    }}
                    keyboardType="number-pad"
                    maxLength={3}
                    editable={!isPlaying}
                  />
                  <Text style={styles.tempoUnitModal}>BPM</Text>
                </View>
                <Slider
                  style={styles.tempoSliderModal}
                  minimumValue={TEMPO_MIN}
                  maximumValue={TEMPO_MAX}
                  value={tempo}
                  onValueChange={(value) => {
                    if (!isPlaying) {
                      setTempo(value);
                      setTempoInput(Math.round(value).toString());
                    }
                  }}
                  disabled={isPlaying}
                  minimumTrackTintColor={colors.functional.harmony}
                  maximumTrackTintColor={colors.background.tertiary}
                  thumbTintColor={colors.functional.harmony}
                />
              </View>

              {/* 拍子選択 */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>拍子</Text>
                <View style={styles.timeSignatureGrid}>
                  {TIME_SIGNATURES.map((sig, index) => {
                    const isSelected = sig.numerator === timeSignature.numerator && 
                                      sig.denominator === timeSignature.denominator;
                    return (
                      <Pressable
                        key={index}
                        style={[
                          styles.timeSignatureButton,
                          isSelected && styles.timeSignatureButtonSelected,
                        ]}
                        onPress={() => {
                          if (!isPlaying) {
                            handleTimeSignatureChange(sig);
                          }
                        }}
                        disabled={isPlaying}
                      >
                        <Text
                          style={[
                            styles.timeSignatureButtonText,
                            isSelected && styles.timeSignatureButtonTextSelected,
                          ]}
                        >
                          {sig.numerator}/{sig.denominator}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* メトロノームON/OFF */}
              <View style={styles.settingsSection}>
                <Text style={styles.settingsSectionTitle}>メトロノーム</Text>
                <Pressable
                  style={[
                    styles.metronomeToggleButtonModal,
                    metronomeEnabled && styles.metronomeToggleButtonModalActive,
                  ]}
                  onPress={() => {
                    if (!isPlaying) {
                      setMetronomeEnabled(!metronomeEnabled);
                    }
                  }}
                  disabled={isPlaying}
                >
                  <Text
                    style={[
                      styles.metronomeToggleButtonTextModal,
                      metronomeEnabled && styles.metronomeToggleButtonTextModalActive,
                    ]}
                  >
                    {metronomeEnabled ? 'ON' : 'OFF'}
                  </Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.primary,
    position: 'relative',
  },
  headerOuter: {
    backgroundColor: colors.background.secondary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
  },
  header: {
    paddingVertical: spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'column',
    gap: spacing.xs,
  },
  voicingHint: {
    ...typography.body,
    fontSize: 10,
    color: colors.text.muted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  subtitle: {
    ...typography.body,
    fontSize: 12,
    color: colors.text.secondary,
  },
  transposeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  transposeLabel: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  transposeControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  transposeButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.functional.harmony,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transposeButtonDisabled: {
    opacity: 0.5,
  },
  transposeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  transposeButtonTextDisabled: {
    opacity: 0.7,
  },
  transposeValue: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 28,
    textAlign: 'center',
  },
  presetButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  presetButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.functional.harmony,
    minHeight: 36,
  },
  presetButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  presetButtonTextDisabled: {
    opacity: 0.5,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  settingsButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  settingsPanelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  settingsPanelHeaderText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingsPanelHeaderIcon: {
    fontSize: 12,
    color: colors.text.secondary,
  },
  settingsPanelContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
    zIndex: 10,
    elevation: 10,
  },
  tempoControlCompact: {
    gap: spacing.xs,
  },
  tempoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  tempoLabelCompact: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tempoInput: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    minWidth: 60,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  sliderCompact: {
    width: '100%',
    height: 24,
  },
  timeSignatureSectionCompact: {
    marginTop: spacing.xs,
  },
  metronomeToggleSectionCompact: {
    marginTop: spacing.xs,
    alignItems: 'center',
  },
  metronomeToggleButtonCompact: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    minWidth: 140,
    alignItems: 'center',
  },
  metronomeToggleTextCompact: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  metronomeToggleButtonActive: {
    backgroundColor: colors.functional.rhythm,
  },
  metronomeToggleButtonDisabled: {
    opacity: 0.5,
  },
  metronomeToggleTextActive: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    flexDirection: 'column',
  },
  measuresGridContainer: {
    flex: 1,
  },
  measuresGridContent: {
    padding: spacing.md,
    alignItems: 'center',
  },
  measuresGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  measureCell: {
    width: 100,
    minHeight: 120,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  measureCellActive: {
    borderColor: colors.functional.harmony,
    backgroundColor: colors.functional.harmony + '20',
  },
  measureCellEmpty: {
    opacity: 0.6,
  },
  measureCellHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  measureCellNumber: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  measureCellDelete: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  measureCellDeleteText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  measureCellDeleteTextDisabled: {
    opacity: 0.3,
  },
  measureCellChord: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    marginBottom: spacing.xs,
  },
  measureCellChordContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  measureCellChordEmpty: {
    backgroundColor: colors.background.secondary,
  },
  measureCellChordActive: {
    borderColor: colors.functional.harmony,
    backgroundColor: colors.functional.harmony + '10',
  },
  measureCellChordText: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
  },
  measureCellChordTextEmpty: {
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  measureCellTimeline: {
    width: '100%',
    height: 3,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  measureCellTimelineBar: {
    height: '100%',
    backgroundColor: colors.functional.harmony,
  },
  addMeasureCell: {
    width: 100,
    minHeight: 120,
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addMeasureCellText: {
    ...typography.body,
    fontSize: 32,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  addMeasureCellTextDisabled: {
    opacity: 0.3,
  },
  measureItem: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
    minHeight: 50,
    position: 'relative',
  },
  measureContent: {
    flex: 1,
  },
  measureRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  measureItemActive: {
    borderColor: colors.functional.harmony,
    backgroundColor: colors.functional.harmony + '20',
  },
  measureItemEmpty: {
    opacity: 0.6,
  },
  measureLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  measureNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // モーダル
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  modalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '95%',
    maxWidth: '95%',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  modalCloseIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    right: 0,
    top: 0,
  },
  modalCloseIconText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.secondary,
    lineHeight: 28,
  },
  chordTableContainer: {
    flex: 1,
    marginVertical: spacing.md,
    minHeight: 300,
  },
  chordTable: {
    flex: 1,
  },
  chordTableContent: {
    padding: spacing.sm,
    paddingBottom: spacing.xl * 3,
    gap: spacing.md,
  },
  chordTypeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chordTypeLabel: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingRight: spacing.sm,
  },
  chordTypeLabelText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  chordTypeGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-start',
  },
  chordTableCell: {
    minWidth: 50,
    height: 36,
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border.default,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
  },
  chordTableCellText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
  },
  modalCloseButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCloseText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  measureNumberText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  measureChord: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
    marginRight: spacing.sm,
  },
  chordButton: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: 'transparent',
    minHeight: 36,
    justifyContent: 'center',
  },
  chordButtonEmpty: {
    backgroundColor: colors.background.secondary,
  },
  chordButtonActive: {
    borderColor: colors.functional.harmony,
    backgroundColor: colors.functional.harmony + '10',
  },
  chordButtonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  chordButtonTextEmpty: {
    color: colors.text.muted,
    fontStyle: 'italic',
  },
  timelineProgressContainer: {
    marginTop: spacing.xs,
    height: 3,
    backgroundColor: colors.background.tertiary,
    borderRadius: 2,
    overflow: 'hidden',
  },
  timelineProgressBar: {
    height: '100%',
    backgroundColor: colors.functional.harmony,
  },
  globalTimelineContainer: {
    position: 'absolute',
    bottom: 80,
    left: spacing.lg,
    right: spacing.lg,
    height: 6,
    backgroundColor: colors.background.tertiary,
    borderRadius: 3,
    overflow: 'visible',
    zIndex: 1,
    elevation: 1,
  },
  globalTimelineBar: {
    height: '100%',
    backgroundColor: colors.functional.harmony,
    borderRadius: 3,
  },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  deleteButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  deleteButtonTextDisabled: {
    opacity: 0.3,
  },
  addMeasureButton: {
    backgroundColor: colors.background.secondary,
    borderRadius: 8,
    padding: spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
    borderStyle: 'dashed',
    marginTop: spacing.xs,
    minHeight: 44,
    justifyContent: 'center',
  },
  addMeasureButtonText: {
    ...typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  hintContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.secondary,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
  },
  hintText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.text.muted,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border.default,
    minHeight: 80,
    gap: spacing.md,
  },
  manualModeButton: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  manualModeButtonActive: {
    backgroundColor: colors.functional.harmony,
    borderColor: colors.functional.harmony,
  },
  manualModeButtonDisabled: {
    opacity: 0.5,
  },
  manualModeButtonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  manualModeButtonTextActive: {
    color: '#FFFFFF',
  },
  manualModeButtonTextDisabled: {
    color: colors.text.muted,
  },
  arrowButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  arrowButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.functional.harmony,
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.background.tertiary,
  },
  arrowButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  arrowButtonTextDisabled: {
    color: colors.text.muted,
  },
  hiddenKeyboardInput: {
    position: 'absolute',
    width: 0,
    height: 0,
    opacity: 0,
    left: -9999,
  },
  playButton: {
    backgroundColor: colors.functional.harmony,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
    shadowColor: colors.functional.harmony,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  playButtonActive: {
    backgroundColor: '#FF4444',
  },
  playButtonDisabled: {
    opacity: 0.5,
    backgroundColor: colors.background.tertiary,
  },
  playButtonText: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playButtonTextActive: {
    color: '#FFFFFF',
  },
  playButtonTextDisabled: {
    color: colors.text.muted,
  },
  status: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    minHeight: 40,
  },
  statusText: {
    ...typography.body,
    fontSize: 12,
    color: colors.text.secondary,
  },
  countInContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  countInText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.functional.rhythm,
  },
  countInBeat: {
    ...typography.heading,
    fontSize: 32,
    fontWeight: '700',
    color: colors.functional.rhythm,
  },
  controlsStatus: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  countInContainerInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  countInTextInline: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.functional.rhythm,
  },
  countInBeatInline: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: '700',
    color: colors.functional.rhythm,
  },
  statusTextInline: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  presetSaveModalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 350,
  },
  presetSaveInput: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    backgroundColor: colors.background.tertiary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  presetSaveModalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    justifyContent: 'flex-end',
  },
  presetSaveModalButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  presetSaveModalButtonCancel: {
    backgroundColor: colors.background.tertiary,
  },
  presetSaveModalButtonSave: {
    backgroundColor: colors.functional.harmony,
  },
  presetSaveModalButtonText: {
    ...typography.body,
    fontSize: 16,
    color: colors.text.primary,
    fontWeight: '600',
  },
  presetSaveModalButtonTextSave: {
    color: '#FFFFFF',
  },
  settingsModalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  settingsModalOverlayLeft: {
    flex: 1,
  },
  settingsModalContent: {
    backgroundColor: colors.background.secondary,
    width: 360,
    height: '100%',
    padding: spacing.lg,
    paddingTop: spacing.md + 20, // ヘッダー分の余白を減らす
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  settingsModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.default,
    paddingBottom: spacing.md,
  },
  settingsModalTitle: {
    ...typography.heading,
    fontSize: 20,
    fontWeight: '600',
    color: colors.text.primary,
  },
  settingsModalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  settingsModalCloseText: {
    fontSize: 20,
    color: colors.text.secondary,
    fontWeight: '300',
    lineHeight: 20,
    textAlign: 'center',
  },
  settingsModalBody: {
    flex: 1,
  },
  settingsModalBodyContent: {
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  settingsSection: {
    gap: spacing.md,
    width: '100%',
  },
  settingsSectionTitle: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
  },
  tempoInputModal: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    textAlign: 'center',
    minWidth: 80,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  tempoUnitModal: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  tempoSliderModal: {
    width: '100%',
    height: 40,
  },
  metronomeToggleButtonModal: {
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  metronomeToggleButtonModalActive: {
    backgroundColor: colors.functional.rhythm,
    borderColor: colors.functional.rhythm,
  },
  metronomeToggleButtonTextModal: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  metronomeToggleButtonTextModalActive: {
    color: '#FFFFFF',
  },
  timeSignatureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'flex-start',
  },
  timeSignatureButton: {
    backgroundColor: colors.background.tertiary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 6,
    minWidth: 45,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border.default,
    flex: 0,
  },
  timeSignatureButtonSelected: {
    backgroundColor: colors.functional.rhythm,
    borderColor: colors.functional.rhythm,
  },
  timeSignatureButtonText: {
    ...typography.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  timeSignatureButtonTextSelected: {
    color: '#FFFFFF',
  },
  // ボイシング編集モーダル用スタイル
  customVoicingButton: {
    marginTop: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.functional.harmony,
    borderRadius: 8,
    alignItems: 'center',
  },
  customVoicingButtonDisabled: {
    backgroundColor: colors.background.tertiary,
    opacity: 0.5,
  },
  customVoicingButtonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  customVoicingButtonTextDisabled: {
    color: colors.text.muted,
  },
  voicingEditorModalScrollView: {
    width: '100%',
    maxHeight: '90%',
  },
  voicingEditorModalScrollContent: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  voicingEditorModalContent: {
    backgroundColor: colors.background.secondary,
    borderRadius: 16,
    padding: spacing.lg,
    width: '95%',
    maxWidth: '95%',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  },
  voicingEditorContent: {
    paddingVertical: spacing.md,
  },
  voicingEditorChordName: {
    ...typography.heading,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  voicingEditorSatbHint: {
    ...typography.body,
    fontSize: 13,
    color: colors.text.muted,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  voicingEditorVoiceList: {
    marginBottom: spacing.md,
  },
  voicingEditorVoiceRow: {
    flexDirection: 'column',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    marginBottom: spacing.sm,
  },
  voicingEditorVoiceLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  voicingEditorPitchClassScroll: {
    maxHeight: 44,
    marginBottom: spacing.sm,
  },
  voicingEditorPitchClassRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 4,
    paddingVertical: 4,
  },
  voicingEditorPitchClassButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background.primary,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  voicingEditorPitchClassButtonSelected: {
    backgroundColor: colors.functional.harmony,
    borderColor: colors.functional.harmony,
  },
  voicingEditorPitchClassButtonText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text.primary,
  },
  voicingEditorPitchClassButtonTextSelected: {
    color: '#FFFFFF',
  },
  voicingEditorVoiceName: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 50,
  },
  voicingEditorVoiceNote: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '600',
    color: colors.functional.harmony,
    minWidth: 40,
  },
  voicingEditorOctaveControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  voicingEditorOctaveButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.functional.harmony,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voicingEditorOctaveButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  voicingEditorOctaveValue: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text.primary,
    minWidth: 30,
    textAlign: 'center',
  },
  voicingEditorActions: {
    gap: spacing.md,
  },
  voicingEditorPreviewButton: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.background.tertiary,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border.default,
  },
  voicingEditorPreviewButtonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.primary,
  },
  voicingEditorSaveCancel: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  voicingEditorSaveButton: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.functional.harmony,
    borderRadius: 8,
    alignItems: 'center',
  },
  voicingEditorCancelButton: {
    backgroundColor: colors.background.tertiary,
  },
  voicingEditorSaveButtonText: {
    ...typography.body,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text.secondary,
  },
  voicingEditorSaveButtonTextActive: {
    color: '#FFFFFF',
  },
  customVoicingIndicator: {
    marginLeft: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  customVoicingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.functional.harmony,
  },
});
