/**
 * カラーパレット
 * Concept: Playful Harmony - シンプルで視認性が高く、ポップなライトテーマ
 */
export const colors = {
  // 背景
  background: {
    primary: '#F8F9FA',    // メイン背景（目に優しいオフホワイト）
    secondary: '#FFFFFF',  // カード背景
    tertiary: '#EDF2F7',   // 入力フィールド
  },
  // アクセント（機能ごとに色分け）
  accent: {
    primary: '#3B82F6',    // メインアクション（綺麗なブルー - Tailwind blue-500）
    primaryDark: '#2563EB', // ホバー/アクティブ時（blue-600）
    primaryLight: '#EFF6FF', // 選択状態の背景（blue-50）
  },
  // 機能別カラー
  functional: {
    rhythm: '#FF9F43',     // メトロノーム・リズム系（オレンジ）
    harmony: '#2ECC71',    // ハーモニー・純正律（グリーン）
    stop: '#FF7675',       // 停止・リセット（ソフトレッド）
  },
  // テキスト
  text: {
    primary: '#2D3436',    // メイン文字（チャコールグレー）
    secondary: '#636E72',  // サブ文字
    muted: '#B2BEC3',      // 非活性・補足
  },
  // 状態
  status: {
    active: '#2ECC71',     // 再生中
    error: '#FF7675',
  },
  // UI状態（コンポーネント用）
  ui: {
    success: '#2ECC71',
    error: '#FF7675',
    warning: '#FF9F43',
    info: '#3B82F6', // 綺麗なブルー
  },
  // 境界線
  border: {
    default: '#DFE6E9',    // 通常の境界線
    strong: '#B2BEC3',     // 強調したい境界線
  },
  // 鍵盤
  keyboard: {
    white: '#FFFFFF',      // 白鍵
    whitePressed: '#E2E8F0',
    black: '#2D3436',      // 黒鍵
    blackPressed: '#4A5568',
  },
} as const;

export type Colors = typeof colors;
