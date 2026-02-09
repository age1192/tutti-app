/**
 * タイポグラフィ - TECH_SPECに基づく定義
 */
import { TextStyle, Platform } from 'react-native';

// Android用のフォント設定（中国語っぽいフォントを避ける）
const getFontFamily = (defaultFamily?: string) => {
  if (Platform.OS === 'android') {
    // Androidではシステムフォントを使用（日本語対応）
    return Platform.select({
      android: 'sans-serif', // デフォルトのsans-serifフォント
      default: defaultFamily,
    });
  }
  return defaultFamily;
};

export const typography = {
  // BPM表示など大きな数値
  displayLarge: {
    fontSize: 64,
    fontWeight: '600',
    fontFamily: getFontFamily('monospace'),
    letterSpacing: -1,
  } as TextStyle,
  // セクション見出し
  heading: {
    fontSize: 20,
    fontWeight: '500',
    fontFamily: getFontFamily(),
    letterSpacing: 0.2,
  } as TextStyle,
  // 本文
  body: {
    fontSize: 15,
    fontWeight: '400',
    fontFamily: getFontFamily(),
    letterSpacing: 0.1,
  } as TextStyle,
  // 補足テキスト
  caption: {
    fontSize: 11,
    fontWeight: '400',
    fontFamily: getFontFamily(),
    letterSpacing: 0.1,
  } as TextStyle,
} as const;

export type Typography = typeof typography;
