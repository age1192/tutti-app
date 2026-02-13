/**
 * コード再生の組み込みテンプレート
 * アプリインストール時から利用可能
 *
 * 【テンプレートの構成音の指定方法】
 * テンプレートは useSpecifiedVoicing: true により、measures[].midiNotes をそのまま使用します。
 * 構成音を指定する方法は2通りあります：
 *
 * 1) createMeasure の第3引数で指定
 *    createMeasure('id', 'C', [60, 64, 67])
 *    → C を Root(C4), 3rd(E4), 5th(G4) の指定ボイシングで再生
 *
 * 2) measures 内で midiNotes を直接記述
 *    { id: 'm1', chordName: 'C', midiNotes: [48, 52, 55, 60] }
 *    → 任意の構成音を指定可能
 *
 * 【MIDIノート番号の目安】
 *   C4=60, D4=62, E4=64, F4=65, G4=67, A4=69, B4=71
 *   1オクターブ上げる場合は +12、下げる場合は -12
 */
import { chordNameToMidiNotes } from './chordUtils';
import { TIME_SIGNATURES } from './constants';

export interface PlaybackTemplate {
  id: string;
  name: string;
  measures: Array<{
    id: string;
    chordName: string;
    midiNotes: number[];
  }>;
  tempo: number;
  timeSignature: { numerator: number; denominator: number };
  metronomeEnabled: boolean;
  createdAt: number; // テンプレートは 0（表示では「テンプレート」と表示）
  /** テンプレートのみ: true のとき measures[].midiNotes をそのまま使用（声部連結なし） */
  useSpecifiedVoicing?: boolean;
}

/**
 * 小節を作成
 * @param id 小節のユニークID
 * @param chordName コード名（表示用・例: "C", "Dm7", "G7"）
 * @param customMidiNotes 構成音を独自指定する場合。省略時は chordName から自動生成
 *   例: [60, 64, 67] で C の Root-3rd-5th を指定
 */
function createMeasure(id: string, chordName: string, customMidiNotes?: number[]) {
  return {
    id,
    chordName,
    midiNotes: customMidiNotes ?? chordNameToMidiNotes(chordName, 4),
  };
}

export const PLAYBACK_TEMPLATES: PlaybackTemplate[] = [
  {
    id: 'template-basic',
    name: '基本的な I-IV-V（C, F, G）',
    measures: [
      createMeasure('t7-m1', 'C', [48, 60, 64, 67]),   // C4, E4, G4
      createMeasure('t7-m2', 'F', [41, 60, 65, 69]),   
      createMeasure('t7-m3', 'G7', [43, 62, 65, 71]),   
      createMeasure('t7-m4', 'C', [48, 60, 64, 72]),   
    ],
    tempo: 120,
    timeSignature: TIME_SIGNATURES[3], // 4/4
    metronomeEnabled: true,
    createdAt: 0,
    useSpecifiedVoicing: true,
  },
  {
    id: 'template-canon',
    name: 'カノン進行',
    measures: [
      createMeasure('t3-m1', 'C'),
      createMeasure('t3-m2', 'G'),
      createMeasure('t3-m3', 'Am'),
      createMeasure('t3-m4', 'Em'),
      createMeasure('t3-m5', 'F'),
      createMeasure('t3-m6', 'C'),
      createMeasure('t3-m7', 'F'),
      createMeasure('t3-m8', 'G'),
    ],
    tempo: 90,
    timeSignature: TIME_SIGNATURES[3], // 4/4
    metronomeEnabled: true,
    createdAt: 0,
    useSpecifiedVoicing: false, // カスタム音高なし → 声部連結を使用
  },
  {
    id: 'template-scale',
    name: 'スケール練習',
    measures: [
      createMeasure('t6-m1', 'C',[48, 52, 55, 60]),
      createMeasure('t6-m2', 'G',[43, 55, 59, 62]),
      createMeasure('t6-m3', 'C',[48, 55, 60, 64]),
      createMeasure('t6-m4', 'F',[45, 57, 60, 65]),
      createMeasure('t6-m5', 'C',[40, 60, 60, 67]),
      createMeasure('t6-m6', 'F',[41, 60, 65, 69]),
      createMeasure('t6-m7', 'G7',[43, 62, 65, 71]),
      createMeasure('t6-m8', 'C',[48, 60, 64, 72]),
      createMeasure('t6-m9', 'Am',[45, 57, 64, 72]),
      createMeasure('t6-m10', 'Em',[52, 55, 64, 71]),
      createMeasure('t6-m11', 'F',[53, 57, 60, 69]),
      createMeasure('t6-m12', 'C',[52, 55, 60, 67]),
      createMeasure('t6-m13', 'F',[45, 60, 60, 65]),
      createMeasure('t6-m14', 'C',[43, 60, 60, 64]),
      createMeasure('t6-m15', 'G7',[43, 53, 59, 62]),
      createMeasure('t6-m16', 'C',[48, 52, 60, 60]),
    ],
    tempo: 90,
    timeSignature: TIME_SIGNATURES[3], // 4/4
    metronomeEnabled: true,
    createdAt: 0,
    useSpecifiedVoicing: true,
  },
];

export function isTemplateId(id: string): boolean {
  return id.startsWith('template-');
}

export function getTemplateById(id: string): PlaybackTemplate | undefined {
  return PLAYBACK_TEMPLATES.find((t) => t.id === id);
}
