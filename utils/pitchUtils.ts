/**
 * 音律計算ユーティリティ
 * Phase 4 で完全実装予定
 */

// MIDIノート番号からノート名を取得
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * 平均律での周波数計算
 * @param midiNote MIDIノート番号（A4 = 69）
 * @param basePitch A4の基準周波数（デフォルト: 440Hz）
 */
export function getEqualTemperamentFrequency(
  midiNote: number,
  basePitch: number = 440
): number {
  // A4 = MIDI note 69
  const semitones = midiNote - 69;
  return basePitch * Math.pow(2, semitones / 12);
}

/**
 * 純正律の比率
 */
export const JUST_INTONATION_RATIOS: Record<number, number> = {
  0: 1,         // ユニゾン
  1: 16 / 15,   // 短2度
  2: 9 / 8,     // 長2度
  3: 6 / 5,     // 短3度
  4: 5 / 4,     // 長3度
  5: 4 / 3,     // 完全4度
  6: 45 / 32,   // 増4度/減5度
  7: 3 / 2,     // 完全5度
  8: 8 / 5,     // 短6度
  9: 5 / 3,     // 長6度
  10: 9 / 5,    // 短7度
  11: 15 / 8,   // 長7度
};

/**
 * 純正律での周波数計算
 * @param midiNote MIDIノート番号
 * @param rootNote 基準となるルートノート（MIDIノート番号）
 * @param basePitch A4の基準周波数
 */
export function getJustIntonationFrequency(
  midiNote: number,
  rootNote: number,
  basePitch: number = 440
): number {
  // ルートの周波数を平均律で計算
  const rootFrequency = getEqualTemperamentFrequency(rootNote, basePitch);

  // ルートからの半音数（オクターブを考慮）
  const interval = ((midiNote - rootNote) % 12 + 12) % 12;
  const octaveOffset = Math.floor((midiNote - rootNote) / 12);

  const ratio = JUST_INTONATION_RATIOS[interval] || 1;
  return rootFrequency * ratio * Math.pow(2, octaveOffset);
}

/**
 * MIDIノート番号からノート名を取得
 */
export function getNoteNameFromMidi(midiNote: number): string {
  const octave = Math.floor(midiNote / 12) - 1;
  const noteName = NOTE_NAMES[midiNote % 12];
  return `${noteName}${octave}`;
}

/**
 * ノート名からMIDIノート番号を取得
 */
export function getMidiFromNoteName(noteName: string): number {
  const match = noteName.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) throw new Error(`Invalid note name: ${noteName}`);

  const note = match[1];
  const octave = parseInt(match[2], 10);

  const noteIndex = NOTE_NAMES.indexOf(note);
  if (noteIndex === -1) throw new Error(`Invalid note: ${note}`);

  return (octave + 1) * 12 + noteIndex;
}
