/**
 * 声部連結（Voice Leading）ユーティリティ
 * 前後のコードの音を考慮し、和声的に滑らかな響きになるよう各声部のオクターブを最適化
 *
 * 遂行ルール:
 * 1. 構成音が近い音に飛ぶ … 各声部は前のコードの対応する声部に最も近い音（最小移動）で次のコードへ進行する
 * 2. ルートは確実にバス … 戻り値は高音→低音の順で、最低音（最後の要素）は常にルート
 */
import { getChordPitchClasses } from './chordUtils';

/**
 * 前のコードのボイシングを基準に、次のコードの最適なボイシングを計算
 * 各声部が最小限の動きで次のコードに進行するようにする
 *
 * @param prevMidiNotes 前のコードのMIDIノート（例: [67, 64, 60] = G4, E4, C4）
 * @param nextChordName 次のコード名（例: "G", "Dm7", "F"）
 * @returns 声部連結を適用した次のコードのMIDIノート配列
 */
export function applyVoiceLeading(
  prevMidiNotes: number[],
  nextChordName: string
): number[] {
  if (prevMidiNotes.length === 0) return [];
  const { pitchClasses, rootPitchClass } = getChordPitchClasses(nextChordName);
  if (pitchClasses.length === 0) return [];

  // 前のコードの声部を高音から低音へソート（ソプラノ→アルト→テナー→バス）
  let prevVoices = [...prevMidiNotes].sort((a, b) => b - a);
  while (prevVoices.length < pitchClasses.length && prevVoices.length > 0) {
    const lowest = prevVoices[prevVoices.length - 1];
    prevVoices = [...prevVoices, lowest - 12];
  }

  // ルートを除く上声部に声部連結を適用し、ルートは必ずバス（最低音）に配置
  const result = assignVoicesWithRootBass(prevVoices, pitchClasses, rootPitchClass);
  const sorted = result.sort((a, b) => b - a);

  // ルール2の検証: 最低音がルートのピッチクラスであること
  const bassNote = sorted[sorted.length - 1];
  const bassPitchClass = bassNote % 12;
  if (bassPitchClass !== rootPitchClass) {
    console.warn(
      '[voiceLeading] ルートバス違反: 最低音のピッチクラスがルートと一致しません',
      { bassPitchClass, rootPitchClass, chordName: nextChordName }
    );
  }
  return sorted;
}

/**
 * ルートを必ずバス（最低音）に置き、上声部に声部連結を適用
 */
function assignVoicesWithRootBass(
  prevVoices: number[],
  pitchClasses: number[],
  rootPitchClass: number
): number[] {
  const upperPcs = pitchClasses.filter((pc) => pc !== rootPitchClass);
  const upperResult: number[] = [];
  const usedIndices = new Set<number>();
  let upperBound = 127;

  // 上声部（ソプラノ〜テナー）：ルート以外を「前の声部に最も近い音」で配置（ルール1: 構成音が近い音に飛ぶ）
  const nUpper = Math.min(prevVoices.length - 1, upperPcs.length); // バス分を除く
  for (let i = 0; i < nUpper; i++) {
    const prevPitch = prevVoices[i];
    let bestNote = -1;
    let bestDist = Infinity;
    let bestIdx = -1;

    for (let j = 0; j < upperPcs.length; j++) {
      if (usedIndices.has(j)) continue;
      const pc = upperPcs[j];
      const note = findClosestNoteInRange(pc, prevPitch, 24, upperBound);
      const dist = Math.abs(note - prevPitch);
      if (dist < bestDist) {
        bestDist = dist;
        bestNote = note;
        bestIdx = j;
      }
    }

    if (bestNote >= 0 && bestIdx >= 0) {
      upperResult.push(bestNote);
      usedIndices.add(bestIdx);
      upperBound = bestNote - 1;
    }
  }

  // 次のコードの構成音が前より多い場合: 未割り当てのピッチクラスを上声部の下に追加（近い音域で配置）
  const refPitch = upperResult.length > 0 ? upperResult[upperResult.length - 1] : prevVoices[prevVoices.length - 1] + 12;
  for (let j = 0; j < upperPcs.length; j++) {
    if (usedIndices.has(j)) continue;
    const pc = upperPcs[j];
    const note = findClosestNoteInRange(pc, refPitch, 24, upperBound);
    upperResult.push(note);
    upperBound = note - 1;
  }
  upperResult.sort((a, b) => b - a); // 高音→低音の順を維持

  // バス：ルートを必ず最低音に（ルール2: ルートは確実にバス）
  // 前のバスに近いオクターブで、上声部より低く
  const prevBass = prevVoices[prevVoices.length - 1];
  const lowerBound = upperResult.length > 0 ? Math.min(...upperResult) - 1 : 127;
  const rootNote = findRootBass(rootPitchClass, prevBass, lowerBound);

  return [...upperResult, rootNote];
}

/** ルートをバスに配置。前のバスに近く、かつ lowerBound より低く */
function findRootBass(rootPitchClass: number, prevBass: number, lowerBound: number): number {
  const targetOctave = Math.floor(prevBass / 12);
  let bestNote = rootPitchClass + targetOctave * 12;
  let bestDist = Math.abs(bestNote - prevBass);

  for (let octaveOffset = -2; octaveOffset <= 1; octaveOffset++) {
    const note = rootPitchClass + (targetOctave + octaveOffset) * 12;
    if (note > lowerBound) continue;
    if (note < 24) continue;
    const dist = Math.abs(note - prevBass);
    if (dist < bestDist) {
      bestDist = dist;
      bestNote = note;
    }
  }
  return bestNote;
}

/**
 * ピッチクラスと目標音高から、指定範囲内で最も近いMIDIノートを返す
 */
function findClosestNoteInRange(
  pitchClass: number,
  targetMidi: number,
  rangeSemitones: number,
  upperBound: number
): number {
  const targetOctave = Math.floor(targetMidi / 12);
  let bestNote = pitchClass + targetOctave * 12;
  let bestDist = Math.abs(bestNote - targetMidi);

  // 上下1オクターブの範囲を探索
  for (let octaveOffset = -1; octaveOffset <= 1; octaveOffset++) {
    const note = pitchClass + (targetOctave + octaveOffset) * 12;
    if (note > upperBound) continue;
    if (note < 24) continue; // 最低音の制限
    const dist = Math.abs(note - targetMidi);
    if (dist < bestDist) {
      bestDist = dist;
      bestNote = note;
    }
  }

  return bestNote;
}

/**
 * 初回再生用：基準オクターブで開離和音風のボイシングを返す
 * 声部連結の基準となる最初のコード用
 * 高音部をやや高めに配置して、後の声部連結で自然に動くようにする
 * ルール2: ルートは必ずバス（最低音）。戻り値は高音→低音の順で、最後の要素がルート。
 */
export function getInitialVoicing(chordName: string, baseOctave: number = 4): number[] {
  const { pitchClasses, rootPitchClass } = getChordPitchClasses(chordName);
  if (pitchClasses.length === 0) return [];

  const baseMidi = (baseOctave + 1) * 12; // C4 = 60
  const upperPcs = pitchClasses.filter((pc) => pc !== rootPitchClass);
  const voiced: number[] = [];
  let nextLower = baseMidi + 11;

  // 上声部：ルート以外を高音から配置
  for (const pc of upperPcs.sort((a, b) => b - a)) {
    let note = baseMidi + pc;
    while (note > nextLower) note -= 12;
    while (note < 36) note += 12;
    voiced.push(note);
    nextLower = note - 1;
  }

  // バス：ルートを必ず最低音に（ルール2）
  let rootNote = baseMidi + rootPitchClass;
  while (rootNote > nextLower) rootNote -= 12;
  if (rootNote < 36) rootNote += 12;
  voiced.push(rootNote);

  const sorted = voiced.sort((a, b) => b - a);
  const bassPitchClass = sorted[sorted.length - 1] % 12;
  if (bassPitchClass !== rootPitchClass) {
    console.warn('[voiceLeading] getInitialVoicing: 最低音がルートと一致しません', { bassPitchClass, rootPitchClass });
  }
  return sorted;
}
