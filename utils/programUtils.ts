/**
 * プログラムユーティリティ
 * AsyncStorage連携とプログラム操作関数
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Program, Section, TimeSignature } from '../types';
import { STORAGE_KEYS, TEMPO_DEFAULT } from './constants';

/**
 * ユニークIDを生成
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * アクセントパターンを文字列に変換
 * 例: [2, 3] → "2+3"
 */
export function formatAccentPattern(pattern: number[] | undefined): string {
  if (!pattern || pattern.length === 0) return '';
  return pattern.join('+');
}

/**
 * 文字列をアクセントパターンに変換
 * 例: "2+3" → [2, 3]
 */
export function parseAccentPattern(str: string): number[] | undefined {
  if (!str.trim()) return undefined;
  const parts = str.split('+').map((s) => parseInt(s.trim(), 10));
  if (parts.some(isNaN) || parts.some((n) => n <= 0)) return undefined;
  return parts;
}

/**
 * アクセントパターンが拍子と一致するか検証
 */
export function validateAccentPattern(
  pattern: number[] | undefined,
  numerator: number
): boolean {
  if (!pattern || pattern.length === 0) return true;
  const sum = pattern.reduce((a, b) => a + b, 0);
  return sum === numerator;
}

/**
 * アクセントパターンからアクセント位置を計算
 * 例: [2, 3] → [1, 3]（1拍目と3拍目がアクセント）
 */
export function getAccentBeats(pattern: number[] | undefined): number[] {
  if (!pattern || pattern.length === 0) return [1];
  
  const accents: number[] = [];
  let position = 1;
  
  for (const group of pattern) {
    accents.push(position);
    position += group;
  }
  
  return accents;
}

/**
 * 特定の拍がアクセントかどうかを判定
 */
export function isAccentBeat(
  beat: number,
  pattern: number[] | undefined
): boolean {
  const accents = getAccentBeats(pattern);
  return accents.includes(beat);
}

/**
 * よく使われるアクセントパターンのプリセット
 */
export const ACCENT_PRESETS: { label: string; pattern: number[]; numerator: number }[] = [
  { label: '2+3 (5拍子)', pattern: [2, 3], numerator: 5 },
  { label: '3+2 (5拍子)', pattern: [3, 2], numerator: 5 },
  { label: '2+2+3 (7拍子)', pattern: [2, 2, 3], numerator: 7 },
  { label: '2+3+2 (7拍子)', pattern: [2, 3, 2], numerator: 7 },
  { label: '3+2+2 (7拍子)', pattern: [3, 2, 2], numerator: 7 },
  { label: '3+3+2 (8拍子)', pattern: [3, 3, 2], numerator: 8 },
  { label: '2+3+3 (8拍子)', pattern: [2, 3, 3], numerator: 8 },
  { label: '3+2+3 (8拍子)', pattern: [3, 2, 3], numerator: 8 },
  { label: '2+2+2+3 (9拍子)', pattern: [2, 2, 2, 3], numerator: 9 },
  { label: '3+3+3 (9拍子)', pattern: [3, 3, 3], numerator: 9 },
  { label: '3+3+2+2 (10拍子)', pattern: [3, 3, 2, 2], numerator: 10 },
  { label: '2+2+3+3 (10拍子)', pattern: [2, 2, 3, 3], numerator: 10 },
];

/**
 * デフォルトのセクションを作成
 */
export function createDefaultSection(index: number = 0): Section {
  return {
    id: generateId(),
    name: `セクション ${index + 1}`,
    tempo: TEMPO_DEFAULT,
    timeSignature: { numerator: 4, denominator: 4 },
    measures: 8,
    countIn: index === 0, // 最初のセクションのみカウントイン
    tempoChange: 'none',
  };
}

/**
 * 新しいプログラムを作成
 */
export function createNewProgram(name: string = '新規プログラム'): Program {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    createdAt: now,
    updatedAt: now,
    sections: [createDefaultSection(0)],
  };
}

/**
 * プログラムをコピー（クローン）
 */
export function cloneProgram(program: Program, newName?: string): Program {
  const now = Date.now();
  return {
    ...program,
    id: generateId(),
    name: newName || `${program.name} のコピー`,
    createdAt: now,
    updatedAt: now,
    sections: program.sections.map((section) => ({
      ...section,
      id: generateId(),
    })),
  };
}

/**
 * プログラムの総小節数を計算
 */
export function getTotalMeasures(program: Program): number {
  return program.sections.reduce((total, section) => total + section.measures, 0);
}

/**
 * プログラムの推定再生時間を計算（秒）
 * カウントインは演奏時間に含まない
 */
export function getEstimatedDuration(program: Program): number {
  let totalSeconds = 0;

  for (const section of program.sections) {
    const beatsPerMeasure = section.timeSignature.numerator;
    const totalBeats = beatsPerMeasure * section.measures;
    const beatsPerSecond = section.tempo / 60;
    const sectionDuration = totalBeats / beatsPerSecond;

    // カウントインは演奏時間に含まない
    totalSeconds += sectionDuration;
  }

  return totalSeconds;
}

/**
 * 時間をフォーマット（mm:ss）
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 拍子を文字列にフォーマット
 */
export function formatTimeSignature(ts: TimeSignature): string {
  return `${ts.numerator}/${ts.denominator}`;
}

/**
 * 特定の拍位置からセクションと小節を取得
 */
export function getPositionInfo(
  program: Program,
  totalBeat: number
): {
  sectionIndex: number;
  measureInSection: number;
  beatInMeasure: number;
  isCountIn: boolean;
} | null {
  let beatCount = 0;

  for (let sectionIndex = 0; sectionIndex < program.sections.length; sectionIndex++) {
    const section = program.sections[sectionIndex];
    const beatsPerMeasure = section.timeSignature.numerator;

    // カウントイン
    if (section.countIn) {
      const countInBeats = beatsPerMeasure;
      if (totalBeat < beatCount + countInBeats) {
        const beatInCountIn = totalBeat - beatCount;
        return {
          sectionIndex,
          measureInSection: 0,
          beatInMeasure: beatInCountIn + 1,
          isCountIn: true,
        };
      }
      beatCount += countInBeats;
    }

    // セクション本体
    const sectionBeats = beatsPerMeasure * section.measures;
    if (totalBeat < beatCount + sectionBeats) {
      const beatInSection = totalBeat - beatCount;
      const measureInSection = Math.floor(beatInSection / beatsPerMeasure) + 1;
      const beatInMeasure = (beatInSection % beatsPerMeasure) + 1;
      return {
        sectionIndex,
        measureInSection,
        beatInMeasure,
        isCountIn: false,
      };
    }
    beatCount += sectionBeats;
  }

  return null; // 終了
}

/**
 * プログラムの総拍数を計算
 */
export function getTotalBeats(program: Program): number {
  let total = 0;

  for (const section of program.sections) {
    const beatsPerMeasure = section.timeSignature.numerator;

    // カウントイン
    if (section.countIn) {
      total += beatsPerMeasure;
    }

    // セクション本体
    total += beatsPerMeasure * section.measures;
  }

  return total;
}

// =====================
// AsyncStorage 操作
// =====================

/**
 * すべてのプログラムを読み込み
 */
export async function loadPrograms(): Promise<Program[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEYS.PROGRAMS);
    if (json) {
      return JSON.parse(json);
    }
    return [];
  } catch (error) {
    console.error('Failed to load programs:', error);
    return [];
  }
}

/**
 * プログラムを保存
 */
export async function saveProgram(program: Program): Promise<void> {
  try {
    const programs = await loadPrograms();
    const existingIndex = programs.findIndex((p) => p.id === program.id);

    const updatedProgram = {
      ...program,
      updatedAt: Date.now(),
    };

    if (existingIndex >= 0) {
      programs[existingIndex] = updatedProgram;
    } else {
      programs.push(updatedProgram);
    }

    await AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(programs));
  } catch (error) {
    console.error('Failed to save program:', error);
    throw error;
  }
}

/**
 * プログラムを削除
 */
export async function deleteProgram(id: string): Promise<void> {
  try {
    const programs = await loadPrograms();
    const filtered = programs.filter((p) => p.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.PROGRAMS, JSON.stringify(filtered));
  } catch (error) {
    console.error('Failed to delete program:', error);
    throw error;
  }
}

/**
 * テンプレートとして保存
 */
export async function saveAsTemplate(program: Program): Promise<void> {
  try {
    const templateProgram: Program = {
      ...program,
      isTemplate: true,
      updatedAt: Date.now(),
    };
    await saveProgram(templateProgram);
  } catch (error) {
    console.error('Failed to save as template:', error);
    throw error;
  }
}

/**
 * テンプレート一覧を取得
 */
export async function loadTemplates(): Promise<Program[]> {
  try {
    const programs = await loadPrograms();
    return programs.filter((p) => p.isTemplate === true);
  } catch (error) {
    console.error('Failed to load templates:', error);
    return [];
  }
}

/**
 * テンプレートから新規プログラムを作成
 */
export function createFromTemplate(template: Program, name?: string): Program {
  const newProgram: Program = {
    ...template,
    id: generateId(),
    name: name || `${template.name} (コピー)`,
    isTemplate: false, // テンプレートから作成したプログラムは通常のプログラム
    createdAt: Date.now(),
    updatedAt: Date.now(),
    sections: template.sections.map((section) => ({
      ...section,
      id: generateId(),
    })),
  };
  return newProgram;
}

/**
 * 単一プログラムを取得
 */
export async function getProgram(id: string): Promise<Program | null> {
  try {
    const programs = await loadPrograms();
    return programs.find((p) => p.id === id) || null;
  } catch (error) {
    console.error('Failed to get program:', error);
    return null;
  }
}

/**
 * すべてのプログラムを削除
 */
export async function clearAllPrograms(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEYS.PROGRAMS);
  } catch (error) {
    console.error('Failed to clear programs:', error);
    throw error;
  }
}

// =====================
// セクション操作
// =====================

/**
 * プログラムにセクションを追加
 */
export function addSection(program: Program, section?: Partial<Section>): Program {
  const newSection = {
    ...createDefaultSection(program.sections.length),
    ...section,
    id: generateId(),
  };

  return {
    ...program,
    updatedAt: Date.now(),
    sections: [...program.sections, newSection],
  };
}

/**
 * プログラムからセクションを削除
 */
export function removeSection(program: Program, sectionId: string): Program {
  return {
    ...program,
    updatedAt: Date.now(),
    sections: program.sections.filter((s) => s.id !== sectionId),
  };
}

/**
 * セクションを更新
 */
export function updateSection(
  program: Program,
  sectionId: string,
  updates: Partial<Section>
): Program {
  return {
    ...program,
    updatedAt: Date.now(),
    sections: program.sections.map((s) =>
      s.id === sectionId ? { ...s, ...updates } : s
    ),
  };
}

/**
 * セクションを並び替え
 */
export function reorderSections(program: Program, fromIndex: number, toIndex: number): Program {
  const sections = [...program.sections];
  const [removed] = sections.splice(fromIndex, 1);
  sections.splice(toIndex, 0, removed);

  return {
    ...program,
    updatedAt: Date.now(),
    sections,
  };
}

/**
 * セクションを複製
 */
export function duplicateSection(program: Program, sectionId: string): Program {
  const sectionIndex = program.sections.findIndex((s) => s.id === sectionId);
  if (sectionIndex < 0) return program;

  const originalSection = program.sections[sectionIndex];
  const newSection = {
    ...originalSection,
    id: generateId(),
    name: `${originalSection.name} (コピー)`,
  };

  const sections = [...program.sections];
  sections.splice(sectionIndex + 1, 0, newSection);

  return {
    ...program,
    updatedAt: Date.now(),
    sections,
  };
}
