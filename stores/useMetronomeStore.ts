/**
 * メトロノーム状態管理ストア
 */
import { create } from 'zustand';
import { TimeSignature, SubdivisionSettings, SubdivisionType, MetronomeToneType } from '../types';
import { TEMPO_DEFAULT, TEMPO_MIN, TEMPO_MAX, TIME_SIGNATURES } from '../utils/constants';

// デフォルトの分割設定
const DEFAULT_SUBDIVISION_SETTINGS: SubdivisionSettings = {
  quarter: 1.0,    // 4分音符（メインビート）
  eighth: 0.0,     // 8分音符（デフォルトでオフ）
  triplet: 0.0,    // 3連符（デフォルトでオフ）
  sixteenth: 0.0,  // 16分音符（デフォルトでオフ）
};

interface MetronomeState {
  // 設定
  tempo: number;
  timeSignature: TimeSignature;
  subdivisionSettings: SubdivisionSettings;
  tone: MetronomeToneType; // 音色
  
  // 再生状態
  isPlaying: boolean;
  currentBeat: number; // 1-indexed (1, 2, 3, 4...)
  currentMeasure: number;
  currentSubdivision: number; // 分割音の現在位置
  
  // アクション
  setTempo: (tempo: number) => void;
  incrementTempo: (amount?: number) => void;
  decrementTempo: (amount?: number) => void;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  setTimeSignatureByIndex: (index: number) => void;
  setTone: (tone: MetronomeToneType) => void;
  
  // 分割設定
  setSubdivisionVolume: (type: SubdivisionType, volume: number) => void;
  resetSubdivisionSettings: () => void;
  
  play: () => void;
  stop: () => void;
  toggle: () => void;
  
  tick: () => void; // 次の拍に進む
  setSubdivision: (subdivision: number) => void; // 分割音位置を設定
  reset: () => void; // 拍をリセット
}

export const useMetronomeStore = create<MetronomeState>((set, get) => ({
  // 初期値
  tempo: TEMPO_DEFAULT,
  timeSignature: { numerator: 4, denominator: 4 },
  subdivisionSettings: { ...DEFAULT_SUBDIVISION_SETTINGS },
  tone: 'default',
  isPlaying: false,
  currentBeat: 0,
  currentMeasure: 1,
  currentSubdivision: 0,

  // テンポ設定
  setTempo: (tempo) => {
    const clampedTempo = Math.max(TEMPO_MIN, Math.min(TEMPO_MAX, tempo));
    set({ tempo: clampedTempo });
  },
  
  incrementTempo: (amount = 1) => {
    const { tempo } = get();
    const newTempo = Math.min(TEMPO_MAX, tempo + amount);
    set({ tempo: newTempo });
  },
  
  decrementTempo: (amount = 1) => {
    const { tempo } = get();
    const newTempo = Math.max(TEMPO_MIN, tempo - amount);
    set({ tempo: newTempo });
  },

  // 拍子設定
  setTimeSignature: (timeSignature) => {
    set({ timeSignature, currentBeat: 0 });
  },
  
  setTimeSignatureByIndex: (index) => {
    if (index >= 0 && index < TIME_SIGNATURES.length) {
      set({ timeSignature: TIME_SIGNATURES[index], currentBeat: 0 });
    }
  },
  
  // 音色設定
  setTone: (tone) => set({ tone }),

  // 分割設定
  setSubdivisionVolume: (type, volume) => {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    set((state) => ({
      subdivisionSettings: {
        ...state.subdivisionSettings,
        [type]: clampedVolume,
      },
    }));
  },
  
  resetSubdivisionSettings: () => {
    set({ subdivisionSettings: { ...DEFAULT_SUBDIVISION_SETTINGS } });
  },

  // 再生制御
  play: () => set({ isPlaying: true, currentBeat: 0, currentSubdivision: 0 }),
  stop: () => set({ isPlaying: false, currentBeat: 0, currentSubdivision: 0 }),
  toggle: () => {
    const { isPlaying } = get();
    if (isPlaying) {
      set({ isPlaying: false, currentBeat: 0, currentSubdivision: 0 });
    } else {
      set({ isPlaying: true, currentBeat: 0, currentSubdivision: 0 });
    }
  },

  // 拍を進める
  tick: () => {
    const { currentBeat, timeSignature, currentMeasure } = get();
    const nextBeat = currentBeat + 1;
    
    if (nextBeat > timeSignature.numerator) {
      // 次の小節へ
      set({ currentBeat: 1, currentMeasure: currentMeasure + 1, currentSubdivision: 0 });
    } else {
      set({ currentBeat: nextBeat, currentSubdivision: 0 });
    }
  },

  // 分割音位置を設定
  setSubdivision: (subdivision) => {
    set({ currentSubdivision: subdivision });
  },

  // リセット
  reset: () => set({ currentBeat: 0, currentMeasure: 1, currentSubdivision: 0, isPlaying: false }),
}));
