/**
 * 定数定義
 */
import { TimeSignature } from '../types';

/** Appleガイドライン: 横画面時のノッチ回避用余白（左右のみ、44pt〜59pt推奨） */
export const LANDSCAPE_SAFE_AREA_INSET = 44;

// レスポンシブデザイン用ブレークポイント（横画面固定、iPad 13インチまで対応）
// Chrome DevToolsで確認した値をここに反映してください
export const BREAKPOINTS = {
  sm: 400,   // 小型スマホ（iPhone SE等: 幅 < 400px）
  md: 600,   // 中型スマホ（400px <= 幅 < 600px）
  lg: 800,   // 大型スマホ/小型タブレット（600px <= 幅 < 800px）
  xl: 1024,  // iPad Pro 12.9インチ（800px <= 幅 <= 1024px）
} as const;

// 画面サイズ判定ヘルパー
export const getScreenSize = (width: number): 'sm' | 'md' | 'lg' | 'xl' => {
  if (width < BREAKPOINTS.sm) return 'sm';
  if (width < BREAKPOINTS.md) return 'md';
  if (width < BREAKPOINTS.lg) return 'lg';
  return 'xl';
};

// 画面サイズ判定ヘルパー（boolean版）
export const isSmallScreen = (width: number): boolean => width < BREAKPOINTS.sm;
export const isMediumScreen = (width: number): boolean => 
  width >= BREAKPOINTS.sm && width < BREAKPOINTS.md;
export const isLargeScreen = (width: number): boolean => 
  width >= BREAKPOINTS.lg;
export const isXLargeScreen = (width: number): boolean => 
  width >= BREAKPOINTS.xl;

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
