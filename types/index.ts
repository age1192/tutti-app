/**
 * 型定義
 */

// 拍子
export interface TimeSignature {
  numerator: number;   // 分子
  denominator: number; // 分母
}

// テンポ変化タイプ
export type TempoChangeType = 'none' | 'ritardando' | 'accelerando';

// プログラムのセクション
export interface Section {
  id: string;
  name: string;
  tempo: number;        // BPM
  timeSignature: TimeSignature;
  measures: number;     // 小節数
  countIn: boolean;     // カウントイン有無
  accentPattern?: number[];  // アクセントパターン（例: [2,3]で2+3の5拍子）
  tempoChange?: TempoChangeType;  // テンポ変化タイプ
  tempoChangeTarget?: number;     // 目標テンポ（BPM）
  tempoChangeToNext?: boolean;    // 次のセクションまで変化するか
}

// プログラム
export interface Program {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sections: Section[];
  isTemplate?: boolean; // テンプレートかどうか（後方互換性のためオプショナル）
}

// 音律タイプ
export type TuningType = 'equal' | 'just';

// 音色タイプ
export type ToneType = 'organ' | 'organ2' | 'flute' | 'clarinet';

// メトロノーム音色タイプ
export type MetronomeToneType = 'default' | 'hard' | 'wood';

// 拍分割タイプ
export type SubdivisionType = 'quarter' | 'eighth' | 'triplet' | 'sixteenth';

// 拍分割設定
export interface SubdivisionSettings {
  // 各分割の音量（0.0 - 1.0）
  quarter: number;    // 4分音符（メインビート）
  eighth: number;     // 8分音符（2分割）
  triplet: number;    // 3連符（3分割）
  sixteenth: number;  // 16分音符（4分割）
}

// アプリ設定
export interface AppSettings {
  keepScreenOn: boolean;
  backgroundPlayback: boolean;  // バックグラウンド再生
  hapticEnabled: boolean;       // 振動フィードバック
  defaultTempo: number;
  defaultTimeSignature: TimeSignature;
  defaultPitch: number;  // A4基準周波数
  defaultTuning: TuningType;
}

// メトロノーム状態
export interface MetronomeState {
  isPlaying: boolean;
  tempo: number;
  timeSignature: TimeSignature;
  currentBeat: number;
}

// ハーモニー状態
export interface HarmonyState {
  tuning: TuningType;
  basePitch: number; // A4の周波数
  octave: number;    // 現在のオクターブ（C4が含まれるオクターブを基準）
  activeNotes: number[]; // 現在押されている音のMIDIノート番号
}

// メトロノームプリセット
export interface MetronomePreset {
  id: string;
  name: string;
  tempo: number;
  timeSignature: TimeSignature;
  subdivisionSettings: SubdivisionSettings;
  tone: MetronomeToneType;
  createdAt: number;
}

// コード再生プリセット
export interface PlaybackPreset {
  id: string;
  name: string;
  measures: Array<{
    id: string;
    chordName: string;
    midiNotes: number[];
    /** ユーザーがボイシングをカスタマイズした場合 true */
    hasCustomVoicing?: boolean;
  }>;
  tempo: number;
  timeSignature: TimeSignature;
  metronomeEnabled: boolean;
  createdAt: number;
}

// ハーモニーディレクタープリセット
export interface HarmonyPreset {
  id: string;
  name: string;
  tuning: TuningType;
  tone: ToneType;
  basePitch: number;
  octave: number;
  transpose: 'C' | 'Bb' | 'F' | 'Eb' | 'A' | 'D' | 'G' | 'Ab' | 'Db' | 'Gb' | 'E' | 'B';
  createdAt: number;
}

// チューナー設定
export interface TunerSettings {
  referencePitch: number; // A4の周波数（デフォルト440Hz）
  sensitivity: number;    // 感度（0-100）
}
