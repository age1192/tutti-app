/**
 * プログラムテキストパーサー
 * 
 * 構文: 拍子(小節数)-拍子(小節数)-...
 * 
 * 例:
 * - 4/4(8)           → 4/4拍子、8小節
 * - 4/4(4)-3/4(4)    → 4/4拍子4小節、次に3/4拍子4小節
 * - 2+2+3/8(2)       → 変拍子（2+2+3/8）で2小節
 * - 4/4(4)@120-3/4(4)@100 → テンポ指定付き
 * 
 * 完全な例:
 * 4/4(4)@120-3/4(4)-2+2+3/8(2)@100
 */

import { Section, TimeSignature } from '../types';

// パースエラー
export interface ParseError {
  position: number;
  message: string;
  suggestion?: string;
}

// パース結果
export interface ParseResult {
  success: boolean;
  sections?: Section[];
  errors?: ParseError[];
}

// セクション定義（テンポオプション付き）
interface SectionDef {
  timeSignature: TimeSignature;
  accentPattern?: number[];
  measures: number;
  tempo?: number;
}

/**
 * 拍子文字列をパース
 * 例: "4/4", "3/4", "2+2+3/8"
 */
function parseTimeSignature(input: string): { 
  timeSignature: TimeSignature; 
  accentPattern?: number[]; 
} | null {
  const trimmed = input.trim();
  
  // 変拍子: 2+2+3/8 形式
  const compoundMatch = trimmed.match(/^([\d+]+)\/(\d+)$/);
  if (compoundMatch) {
    const [, numeratorPart, denominator] = compoundMatch;
    const parts = numeratorPart.split('+').map(p => parseInt(p, 10));
    
    if (parts.some(p => isNaN(p) || p <= 0)) {
      return null;
    }
    
    const totalBeats = parts.reduce((a, b) => a + b, 0);
    const denom = parseInt(denominator, 10);
    
    if (isNaN(denom) || denom <= 0) {
      return null;
    }
    
    return {
      timeSignature: { numerator: totalBeats, denominator: denom },
      accentPattern: parts,
    };
  }
  
  // 通常の拍子: 4/4 形式
  const simpleMatch = trimmed.match(/^(\d+)\/(\d+)$/);
  if (simpleMatch) {
    const numerator = parseInt(simpleMatch[1], 10);
    const denominator = parseInt(simpleMatch[2], 10);
    
    if (numerator <= 0 || denominator <= 0) {
      return null;
    }
    
    return {
      timeSignature: { numerator, denominator },
    };
  }
  
  return null;
}

/**
 * セクション文字列をパース
 * 例: "4/4(8)", "3/4(4)@120", "2+2+3/8(2)"
 */
function parseSection(input: string, position: number): { 
  section: SectionDef; 
  error?: ParseError 
} {
  const trimmed = input.trim();
  
  // パターン: 拍子(小節数)[@テンポ]
  const match = trimmed.match(/^(.+?)\((\d+)\)(?:@(\d+))?$/);
  
  if (!match) {
    // 括弧がない場合
    if (!trimmed.includes('(')) {
      return {
        section: { timeSignature: { numerator: 4, denominator: 4 }, measures: 1 },
        error: {
          position,
          message: '小節数が指定されていません',
          suggestion: `${trimmed}(4) のように小節数を括弧で囲んでください`,
        },
      };
    }
    
    // 閉じ括弧がない場合
    if (trimmed.includes('(') && !trimmed.includes(')')) {
      return {
        section: { timeSignature: { numerator: 4, denominator: 4 }, measures: 1 },
        error: {
          position,
          message: '閉じ括弧 ) がありません',
          suggestion: `${trimmed}) のように閉じ括弧を追加してください`,
        },
      };
    }
    
    return {
      section: { timeSignature: { numerator: 4, denominator: 4 }, measures: 1 },
      error: {
        position,
        message: `無効なセクション形式: "${trimmed}"`,
        suggestion: '4/4(8) のような形式で入力してください',
      },
    };
  }
  
  const [, timeSigStr, measuresStr, tempoStr] = match;
  
  // 拍子をパース
  const tsResult = parseTimeSignature(timeSigStr);
  if (!tsResult) {
    return {
      section: { timeSignature: { numerator: 4, denominator: 4 }, measures: 1 },
      error: {
        position,
        message: `無効な拍子: "${timeSigStr}"`,
        suggestion: '4/4 または 2+2+3/8 のような形式で入力してください',
      },
    };
  }
  
  const measures = parseInt(measuresStr, 10);
  if (measures <= 0) {
    return {
      section: { timeSignature: { numerator: 4, denominator: 4 }, measures: 1 },
      error: {
        position,
        message: '小節数は1以上である必要があります',
        suggestion: `(${measures}) を (1) 以上に変更してください`,
      },
    };
  }
  
  const section: SectionDef = {
    timeSignature: tsResult.timeSignature,
    accentPattern: tsResult.accentPattern,
    measures,
  };
  
  if (tempoStr) {
    const tempo = parseInt(tempoStr, 10);
    if (tempo < 20 || tempo > 400) {
      return {
        section,
        error: {
          position,
          message: `テンポ ${tempo} は範囲外です（20-400）`,
          suggestion: '@120 のような有効なテンポを指定してください',
        },
      };
    }
    section.tempo = tempo;
  }
  
  return { section };
}

/**
 * プログラムテキストをパース
 */
export function parseProgramText(input: string, defaultTempo: number = 120): ParseResult {
  const trimmed = input.trim();
  
  if (!trimmed) {
    return {
      success: false,
      errors: [{
        position: 0,
        message: 'テキストが空です',
        suggestion: '4/4(8) のような形式で入力してください',
      }],
    };
  }
  
  // セクションに分割（-で区切り）
  const parts = trimmed.split('-');
  const sections: Section[] = [];
  const errors: ParseError[] = [];
  let currentPosition = 0;
  let currentTempo = defaultTempo;
  
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    
    if (!part.trim()) {
      errors.push({
        position: currentPosition,
        message: '空のセクションがあります',
        suggestion: '連続した - を削除してください',
      });
      currentPosition += part.length + 1;
      continue;
    }
    
    const { section, error } = parseSection(part, currentPosition);
    
    if (error) {
      errors.push(error);
    }
    
    // テンポが指定されていればそれを使用、なければ前のテンポを継続
    if (section.tempo) {
      currentTempo = section.tempo;
    }
    
    sections.push({
      id: `section-${i + 1}`,
      name: `セクション ${i + 1}`,
      tempo: currentTempo,
      timeSignature: section.timeSignature,
      measures: section.measures,
      countIn: i === 0, // 最初のセクションのみカウントイン
      accentPattern: section.accentPattern,
    });
    
    currentPosition += part.length + 1;
  }
  
  if (errors.length > 0) {
    return {
      success: false,
      sections,
      errors,
    };
  }
  
  return {
    success: true,
    sections,
  };
}

/**
 * セクション配列をテキストに変換
 */
export function sectionsToText(sections: Section[]): string {
  return sections.map((section, index) => {
    let text = '';
    
    // 拍子
    if (section.accentPattern && section.accentPattern.length > 1) {
      text = section.accentPattern.join('+') + '/' + section.timeSignature.denominator;
    } else {
      text = `${section.timeSignature.numerator}/${section.timeSignature.denominator}`;
    }
    
    // 小節数
    text += `(${section.measures})`;
    
    // テンポ（前のセクションと異なる場合、または最初のセクション）
    if (index === 0 || sections[index - 1].tempo !== section.tempo) {
      text += `@${section.tempo}`;
    }
    
    return text;
  }).join('-');
}

/**
 * 構文のヘルプテキスト
 */
export const SYNTAX_HELP = `
【構文】拍子(小節数) をハイフン - で区切って入力

【例】
• 4/4(8)           → 4/4拍子、8小節
• 4/4(4)-3/4(4)    → 4/4拍子4小節 → 3/4拍子4小節
• 2+2+3/8(2)       → 変拍子（2+2+3/8）で2小節
• 4/4(4)@120       → 4/4拍子4小節、テンポ120

【複合例】
4/4(4)@120-3/4(8)-2+2+3/8(2)@100
`.trim();
