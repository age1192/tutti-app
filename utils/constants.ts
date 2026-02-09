/**
 * 定数定義
 */
import { TimeSignature } from '../types';

// メトロノーム
export const TEMPO_MIN = 20;
export const TEMPO_MAX = 300;
export const TEMPO_DEFAULT = 120;

// 利用可能な拍子
export const TIME_SIGNATURES: TimeSignature[] = [
  { numerator: 1, denominator: 4 },  // 1拍子
  { numerator: 2, denominator: 4 },
  { numerator: 3, denominator: 4 },
  { numerator: 4, denominator: 4 },
  { numerator: 5, denominator: 4 },
  { numerator: 6, denominator: 8 },
  { numerator: 7, denominator: 8 },
  { numerator: 9, denominator: 8 },
  { numerator: 12, denominator: 8 },
];

// メトロノーム音声
export const CLICK_FREQUENCY_ACCENT = 1000; // Hz
export const CLICK_FREQUENCY_NORMAL = 800;  // Hz
export const CLICK_DURATION_ACCENT = 50;    // ms
export const CLICK_DURATION_NORMAL = 30;    // ms

// ハーモニーディレクター
export const PITCH_MIN = 430;
export const PITCH_MAX = 450;
export const PITCH_DEFAULT = 440;

export const OCTAVE_MIN = 1;
export const OCTAVE_MAX = 7;
export const OCTAVE_DEFAULT = 4;

// AsyncStorage キー
export const STORAGE_KEYS = {
  PROGRAMS: '@programs',
  SETTINGS: '@settings',
  METRONOME_LAST: '@metronome_last',
  HARMONY_LAST: '@harmony_last',
  METRONOME_PRESETS: '@metronome_presets',
  HARMONY_PRESETS: '@harmony_presets',
  PLAYBACK_PRESETS: '@playback_presets',
  FIRST_LAUNCH: '@first_launch',
} as const;
