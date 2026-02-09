/**
 * ハーモニーディレクター状態管理ストア
 */
import { create } from 'zustand';
import { TuningType, ToneType } from '../types';
import { PITCH_DEFAULT, PITCH_MIN, PITCH_MAX, OCTAVE_DEFAULT, OCTAVE_MIN, OCTAVE_MAX } from '../utils/constants';

// トランスポーズ（楽器のキー）
export type TransposeKey = 'C' | 'Bb' | 'F' | 'Eb' | 'A' | 'D' | 'G' | 'Ab' | 'Db' | 'Gb' | 'E' | 'B';

// トランスポーズの半音数マッピング
export const TRANSPOSE_SEMITONES: Record<TransposeKey, number> = {
  'C': 0,
  'Bb': -2,
  'F': -5,
  'Eb': -3,
  'A': 3,
  'D': 2,
  'G': -7,
  'Ab': -4,
  'Db': -1,
  'Gb': -6,
  'E': 4,
  'B': -11,
};

interface HarmonyState {
  // 設定
  tuning: TuningType;
  tone: ToneType;      // 音色
  basePitch: number; // A4の基準周波数
  octave: number;    // 現在の開始オクターブ
  transpose: TransposeKey; // トランスポーズ
  
  // 再生状態
  activeNotes: Set<number>; // 現在押されている音のMIDIノート番号
  
  // アクション
  setTuning: (tuning: TuningType) => void;
  setTone: (tone: ToneType) => void;
  setBasePitch: (pitch: number) => void;
  incrementPitch: (amount?: number) => void;
  decrementPitch: (amount?: number) => void;
  setOctave: (octave: number) => void;
  incrementOctave: () => void;
  decrementOctave: () => void;
  setTranspose: (key: TransposeKey) => void;
  
  // ノート制御
  addActiveNote: (note: number) => void;
  removeActiveNote: (note: number) => void;
  setActiveNotes: (notes: number[]) => void;
  clearActiveNotes: () => void;
}

export const useHarmonyStore = create<HarmonyState>((set, get) => ({
  // 初期値
  tuning: 'equal',
  tone: 'organ',        // デフォルトはオルガン
  basePitch: PITCH_DEFAULT, // 440 Hz
  octave: OCTAVE_DEFAULT,   // 4 (C4から開始)
  transpose: 'C',           // トランスポーズなし
  activeNotes: new Set(),

  // 音律設定
  setTuning: (tuning) => set({ tuning }),
  
  // 音色設定
  setTone: (tone) => set({ tone }),

  // ピッチ設定
  setBasePitch: (pitch) => {
    const clampedPitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch));
    set({ basePitch: clampedPitch });
  },
  
  incrementPitch: (amount = 1) => {
    const { basePitch } = get();
    const newPitch = Math.min(PITCH_MAX, basePitch + amount);
    set({ basePitch: newPitch });
  },
  
  decrementPitch: (amount = 1) => {
    const { basePitch } = get();
    const newPitch = Math.max(PITCH_MIN, basePitch - amount);
    set({ basePitch: newPitch });
  },

  // オクターブ設定
  setOctave: (octave) => {
    const clampedOctave = Math.max(OCTAVE_MIN, Math.min(OCTAVE_MAX - 1, octave));
    set({ octave: clampedOctave });
  },
  
  incrementOctave: () => {
    const { octave } = get();
    if (octave < OCTAVE_MAX - 1) {
      set({ octave: octave + 1 });
    }
  },
  
  decrementOctave: () => {
    const { octave } = get();
    if (octave > OCTAVE_MIN) {
      set({ octave: octave - 1 });
    }
  },

  // トランスポーズ設定
  setTranspose: (transpose) => set({ transpose }),

  // ノート制御
  addActiveNote: (note) => {
    const { activeNotes } = get();
    const newNotes = new Set(activeNotes);
    newNotes.add(note);
    set({ activeNotes: newNotes });
  },
  
  removeActiveNote: (note) => {
    const { activeNotes } = get();
    const newNotes = new Set(activeNotes);
    newNotes.delete(note);
    set({ activeNotes: newNotes });
  },
  
  setActiveNotes: (notes) => {
    set({ activeNotes: new Set(notes) });
  },
  
  clearActiveNotes: () => {
    set({ activeNotes: new Set() });
  },
}));
