/**
 * コード判定ユーティリティ
 * MIDIノートからコード名を推定
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// コードの構成音（ルートからの半音数）
const CHORD_PATTERNS: { name: string; intervals: number[] }[] = [
  // 三和音
  { name: '', intervals: [0, 4, 7] },           // Major (C)
  { name: 'm', intervals: [0, 3, 7] },          // minor (Cm)
  { name: 'dim', intervals: [0, 3, 6] },        // diminished (Cdim)
  { name: 'aug', intervals: [0, 4, 8] },        // augmented (Caug)
  { name: 'sus4', intervals: [0, 5, 7] },       // suspended 4th (Csus4)
  { name: 'sus2', intervals: [0, 2, 7] },       // suspended 2nd (Csus2)
  
  // 四和音
  { name: '7', intervals: [0, 4, 7, 10] },      // Dominant 7th (C7)
  { name: 'M7', intervals: [0, 4, 7, 11] },     // Major 7th (CM7)
  { name: 'm7', intervals: [0, 3, 7, 10] },     // minor 7th (Cm7)
  { name: 'mM7', intervals: [0, 3, 7, 11] },    // minor Major 7th (CmM7)
  { name: 'dim7', intervals: [0, 3, 6, 9] },    // diminished 7th (Cdim7)
  { name: 'm7b5', intervals: [0, 3, 6, 10] },   // half diminished (Cm7b5)
  { name: 'aug7', intervals: [0, 4, 8, 10] },   // augmented 7th (Caug7)
  
  // 6th
  { name: '6', intervals: [0, 4, 7, 9] },       // Major 6th (C6)
  { name: 'm6', intervals: [0, 3, 7, 9] },      // minor 6th (Cm6)
  
  // 9th
  { name: '9', intervals: [0, 4, 7, 10, 14] },  // Dominant 9th (C9) - 0,4,7,10,14 = root,3rd,5th,7th,9th
  { name: 'm9', intervals: [0, 3, 7, 10, 14] }, // minor 9th (Cm9) - 0,3,7,10,14 = root,m3rd,5th,7th,9th
  
  // add系
  { name: 'add9', intervals: [0, 4, 7, 14] },   // add 9 (Cadd9) - 14 = 2 + 12
  { name: 'madd9', intervals: [0, 3, 7, 14] },  // minor add 9 (Cmadd9)
  
  // 二和音（パワーコード、単純な音程）
  { name: '5', intervals: [0, 7] },             // Power chord (C5)
];

/**
 * MIDIノートの配列からルート音（主音）を取得
 * @param midiNotes MIDIノート番号の配列
 * @returns ルート音のMIDIノート番号（判定できない場合は最初の音）
 */
export function getRootNote(midiNotes: number[]): number | null {
  if (midiNotes.length < 2) return null;

  const uniqueNotes = [...new Set(midiNotes)].sort((a, b) => a - b);
  if (uniqueNotes.length < 2) return null;

  const pitchClasses = uniqueNotes.map((note) => note % 12);
  const uniquePitchClasses = [...new Set(pitchClasses)].sort((a, b) => a - b);

  // 各ピッチクラスをルートとして試す
  for (const root of uniquePitchClasses) {
    const intervals = uniquePitchClasses.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
    
    // パターンマッチング
    for (const pattern of CHORD_PATTERNS) {
      if (arraysEqual(intervals, pattern.intervals)) {
        // ルート音のMIDIノート番号を返す
        const rootMidi = uniqueNotes.find((note) => note % 12 === root);
        return rootMidi ?? null;
      }
    }
  }

  // 判定できない場合は最初の音をルートとする
  return uniqueNotes[0];
}

/**
 * MIDIノートの配列からコード名を判定
 * @param midiNotes MIDIノート番号の配列
 * @returns コード名（判定できない場合は null）
 */
export function detectChord(midiNotes: number[]): string | null {
  if (midiNotes.length < 2) return null;

  // ノートをソートして重複を除去
  const uniqueNotes = [...new Set(midiNotes)].sort((a, b) => a - b);
  
  if (uniqueNotes.length < 2) return null;

  // ピッチクラス（0-11）に変換
  const pitchClasses = uniqueNotes.map((note) => note % 12);
  const uniquePitchClasses = [...new Set(pitchClasses)].sort((a, b) => a - b);

  // 各ピッチクラスをルートとして試す
  for (const root of uniquePitchClasses) {
    // ルートからの音程を計算
    const intervals = uniquePitchClasses.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
    
    // オクターブ上のノートも考慮（add9など）
    const extendedIntervals = [...intervals];
    for (const pc of pitchClasses) {
      const interval = (pc - root + 12) % 12;
      if (interval === 2 && !extendedIntervals.includes(14)) {
        // 9th (= 2nd + オクターブ) の可能性
        extendedIntervals.push(14);
      }
    }
    extendedIntervals.sort((a, b) => a - b);

    // パターンマッチング
    for (const pattern of CHORD_PATTERNS) {
      if (arraysEqual(intervals, pattern.intervals) || 
          arraysEqual(extendedIntervals, pattern.intervals)) {
        const rootName = NOTE_NAMES[root];
        return `${rootName}${pattern.name}`;
      }
    }
  }

  // 判定できない場合は構成音を表示
  const noteNames = uniquePitchClasses.map((pc) => NOTE_NAMES[pc]);
  return noteNames.join('/');
}

/**
 * 配列が等しいかチェック
 */
function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * MIDIノートから音名を取得（オクターブなし）
 */
export function getNoteNameWithoutOctave(midiNote: number): string {
  return NOTE_NAMES[midiNote % 12];
}

/**
 * コード名からMIDIノートの配列を生成
 * @param chordName コード名（例: "C", "Dm", "G7", "Am7"）
 * @param octave オクターブ（デフォルト: 4, C4 = 60）
 * @returns MIDIノート番号の配列
 */
export function chordNameToMidiNotes(chordName: string, octave: number = 4): number[] {
  if (!chordName || chordName.trim() === '') {
    return [];
  }

  // コード名をパース（例: "C", "Dm", "G7", "Am7", "F#m", "Bb", "A#m"）
  // フラット（b）とシャープ（#）の両方に対応
  const match = chordName.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) {
    return [];
  }

  const rootLetter = match[1];
  const accidental = match[2]; // # または b
  const suffix = match[3] || '';

  // ルート音名を構築
  let rootName: string;
  if (accidental === '#') {
    rootName = rootLetter + '#';
  } else if (accidental === 'b') {
    // フラットをシャープに変換（Bb -> A#, Eb -> D#）
    const flatToSharp: Record<string, string> = {
      'C': 'B',
      'D': 'C#',
      'E': 'D#',
      'F': 'E',
      'G': 'F#',
      'A': 'G#',
      'B': 'A#',
    };
    rootName = flatToSharp[rootLetter] || rootLetter;
  } else {
    rootName = rootLetter;
  }

  // ルート音のインデックスを取得
  const rootIndex = NOTE_NAMES.indexOf(rootName);
  if (rootIndex === -1) {
    return [];
  }

  // ルート音のMIDIノート番号（C4 = 60）
  const rootMidi = (octave + 1) * 12 + rootIndex;

  // コードパターンを検索（サフィックスでマッチ）
  // より長いサフィックスから順に検索（例: "m7" と "m" の両方がある場合、"m7" を優先）
  const sortedPatterns = [...CHORD_PATTERNS].sort((a, b) => b.name.length - a.name.length);
  const pattern = sortedPatterns.find((p) => suffix.startsWith(p.name));
  
  if (!pattern) {
    // パターンが見つからない場合は、メジャーコードとして扱う
    const majorPattern = CHORD_PATTERNS.find((p) => p.name === '');
    if (majorPattern) {
      return majorPattern.intervals.map((interval) => rootMidi + interval);
    }
    return [rootMidi];
  }

  // コードの構成音を生成
  return pattern.intervals.map((interval) => {
    // 14はadd9などで使われる（2 + 12）
    if (interval === 14) {
      return rootMidi + 2 + 12; // 9th = 2nd + オクターブ
    }
    return rootMidi + interval;
  });
}

/**
 * コード名を半音単位でトランスポーズする
 * @param chordName コード名（例: "C", "Dm", "G7", "F#m7", "Bb"）
 * @param semitones 半音数（正: 上げる、負: 下げる）
 * @returns トランスポーズ後のコード名
 */
export function transposeChordName(chordName: string, semitones: number): string {
  if (!chordName || chordName.trim() === '' || semitones === 0) {
    return chordName;
  }

  const match = chordName.match(/^([A-G])([#b]?)(.*)$/);
  if (!match) {
    return chordName;
  }

  const rootLetter = match[1];
  const accidental = match[2];
  const suffix = match[3] || '';

  let rootName: string;
  if (accidental === '#') {
    rootName = rootLetter + '#';
  } else if (accidental === 'b') {
    const flatToSharp: Record<string, string> = {
      'C': 'B', 'D': 'C#', 'E': 'D#', 'F': 'E', 'G': 'F#', 'A': 'G#', 'B': 'A#',
    };
    rootName = flatToSharp[rootLetter] || rootLetter;
  } else {
    rootName = rootLetter;
  }

  const rootIndex = NOTE_NAMES.indexOf(rootName);
  if (rootIndex === -1) {
    return chordName;
  }

  const newIndex = (rootIndex + semitones + 120) % 12;
  const newRootName = NOTE_NAMES[newIndex];
  return newRootName + suffix;
}

/**
 * コード名からピッチクラス（0-11）の配列を取得（ルート→3rd→5th→7thの順）
 * 声部連結（voice leading）に使用
 */
export function getChordPitchClasses(chordName: string): { pitchClasses: number[]; rootPitchClass: number } {
  const midiNotes = chordNameToMidiNotes(chordName, 4);
  if (midiNotes.length === 0) {
    return { pitchClasses: [], rootPitchClass: 0 };
  }
  const pitchClasses = [...new Set(midiNotes.map((n) => n % 12))];
  const rootPitchClass = midiNotes[0] % 12;
  return { pitchClasses, rootPitchClass };
}
