# 技術仕様書

## 1. 概要

### 1.1 プロジェクト名
Ensemble Support App（合奏支援アプリ）

### 1.2 目的
吹奏楽・オーケストラの合奏練習を支援するモバイルアプリケーション

### 1.3 対象プラットフォーム
- iOS
- Android

---

## 2. 技術スタック

### 2.1 フレームワーク
| 技術 | バージョン | 用途 |
|------|-----------|------|
| Expo | ~54.x | アプリケーションフレームワーク |
| React Native | 0.81.x | UIフレームワーク |
| TypeScript | 5.x | 型安全な開発 |

### 2.2 主要ライブラリ
| ライブラリ | 用途 |
|-----------|------|
| expo-router | ファイルベースルーティング |
| zustand | 軽量状態管理 |
| react-native-audio-api | Web Audio API準拠の音声合成 |
| @react-native-async-storage/async-storage | ローカルデータ永続化 |
| react-native-reanimated | 高性能アニメーション |
| expo-haptics | 触覚フィードバック |

---

## 3. アプリケーション構造

### 3.1 ディレクトリ構成
```
my-expo-app/
├── app/                          # expo-router ページ
│   ├── _layout.tsx               # ルートレイアウト
│   ├── index.tsx                 # ホーム画面
│   ├── metronome.tsx             # メトロノーム画面
│   ├── harmony.tsx               # ハーモニー画面
│   └── program/
│       ├── index.tsx             # プログラム一覧
│       └── [id].tsx              # プログラム編集
├── components/
│   ├── ui/                       # 共通UIコンポーネント
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Slider.tsx
│   │   └── SegmentedControl.tsx
│   ├── metronome/
│   │   ├── MetronomeVisual.tsx   # 振り子アニメーション
│   │   ├── BeatIndicator.tsx     # 拍インジケーター
│   │   ├── TempoControl.tsx      # テンポ制御
│   │   └── TimeSignature.tsx     # 拍子選択
│   └── harmony/
│       ├── PianoKeyboard.tsx     # ピアノ鍵盤
│       ├── PianoKey.tsx          # 個別キー
│       ├── OctaveShift.tsx       # 音域移動
│       └── TuningControl.tsx     # 音律・ピッチ設定
├── hooks/
│   ├── useAudioEngine.ts         # 音声エンジン管理
│   ├── useMetronome.ts           # メトロノームロジック
│   ├── useProgramPlayer.ts       # プログラム再生
│   └── useHaptics.ts             # 触覚フィードバック
├── stores/
│   ├── useMetronomeStore.ts      # メトロノーム状態
│   ├── useHarmonyStore.ts        # ハーモニー状態
│   └── useProgramStore.ts        # プログラム状態
├── utils/
│   ├── pitchUtils.ts             # 音律計算
│   ├── programUtils.ts           # プログラムデータ操作
│   └── constants.ts              # 定数定義
├── types/
│   └── index.ts                  # 型定義
├── styles/
│   ├── colors.ts                 # カラーパレット
│   ├── typography.ts             # フォント定義
│   └── spacing.ts                # 間隔定義
└── docs/                         # ドキュメント
```

### 3.2 画面遷移図
```
[Home]
  ├── [Metronome]
  │     └── [Program List]
  │           └── [Program Editor]
  └── [Harmony]
```

---

## 4. 機能仕様

### 4.1 メトロノーム機能

#### 4.1.1 基本仕様
| 項目 | 仕様 |
|------|------|
| テンポ範囲 | 20 - 300 BPM |
| テンポ精度 | 1 BPM 単位 |
| 拍子 | 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8, 12/8 |
| タイミング精度 | < 10ms 誤差 |

#### 4.1.2 音声仕様
| 項目 | 仕様 |
|------|------|
| アクセント音 | 1000Hz, 50ms |
| 通常ビート音 | 800Hz, 30ms |
| 波形 | サイン波 |
| エンベロープ | Attack: 5ms, Decay: 45ms |

#### 4.1.3 タップテンポ
- 最低2回のタップで計測開始
- 直近4回のタップ間隔の平均を使用
- 2秒以上の間隔でリセット

#### 4.1.4 拍分割（サブディビジョン）
| 分割タイプ | 1拍あたり | 周波数 | 説明 |
|------------|-----------|--------|------|
| 4分音符 | 1回 | 1000Hz/800Hz | メインビート（アクセント/通常） |
| 8分音符 | 2回 | 600Hz | 2分割 |
| 3連符 | 3回 | 500Hz | 3分割 |
| 16分音符 | 4回 | 400Hz | 4分割 |

- 各分割タイプの音量を0-100%で個別調整可能
- 複数の分割タイプを同時に有効化可能
- タップでオン/オフの切り替え

### 4.2 プログラムメトロノーム

#### 4.2.1 セクション定義
```typescript
interface Section {
  id: string;
  name: string;
  tempo: number;        // BPM
  timeSignature: {
    numerator: number;  // 分子
    denominator: number; // 分母
  };
  measures: number;     // 小節数
  countIn: boolean;     // カウントイン有無
}

interface Program {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  sections: Section[];
}
```

#### 4.2.2 再生仕様
- セクション間は途切れなく遷移
- 現在のセクション・小節・拍をリアルタイム表示
- 一時停止・再開可能

### 4.3 ハーモニー

#### 4.3.1 鍵盤仕様
| 項目 | 仕様 |
|------|------|
| 表示範囲 | 2オクターブ（25鍵） |
| 音域 | C1 〜 C7（ボタンで移動） |
| マルチタッチ | 最大10音同時発音 |

#### 4.3.2 音律仕様

**平均律（Equal Temperament）**
```
frequency = baseFreq × 2^(semitones/12)
```

**純正律（Just Intonation）**
| 音程 | 比率 | セント |
|------|------|--------|
| ユニゾン | 1/1 | 0 |
| 短2度 | 16/15 | 112 |
| 長2度 | 9/8 | 204 |
| 短3度 | 6/5 | 316 |
| 長3度 | 5/4 | 386 |
| 完全4度 | 4/3 | 498 |
| 増4度/減5度 | 45/32 | 590 |
| 完全5度 | 3/2 | 702 |
| 短6度 | 8/5 | 814 |
| 長6度 | 5/3 | 884 |
| 短7度 | 9/5 | 1018 |
| 長7度 | 15/8 | 1088 |
| オクターブ | 2/1 | 1200 |

#### 4.3.3 基準ピッチ
- 初期値: A4 = 440 Hz
- 調整範囲: 430 Hz 〜 450 Hz
- 調整単位: 1 Hz

#### 4.3.4 音声仕様
| 項目 | 仕様 |
|------|------|
| 波形 | サイン波（ピュアトーン） |
| Attack | 10ms |
| Release | 100ms |
| 最大同時発音数 | 10 |

---

## 5. データ仕様

### 5.1 ローカルストレージキー
| キー | 内容 |
|------|------|
| `@programs` | プログラム一覧（JSON配列） |
| `@settings` | アプリ設定 |
| `@metronome_last` | 最後のメトロノーム設定 |
| `@harmony_last` | 最後のハーモニー設定 |

### 5.2 設定データ構造
```typescript
interface AppSettings {
  hapticEnabled: boolean;
  keepScreenOn: boolean;
  defaultTempo: number;
  defaultTimeSignature: TimeSignature;
  defaultPitch: number;  // A4基準周波数
  defaultTuning: 'equal' | 'just';
}
```

---

## 6. UI/UX仕様

### 6.1 カラーパレット
```typescript
const colors = {
  // 背景
  background: {
    primary: '#0D0D0D',    // メイン背景
    secondary: '#1A1A1A',  // カード背景
    tertiary: '#262626',   // 入力フィールド
  },
  // アクセント
  accent: {
    primary: '#D4AF37',    // ゴールド
    secondary: '#B8860B',  // ダークゴールド
    highlight: '#FFD700',  // ハイライト
  },
  // テキスト
  text: {
    primary: '#FFFFFF',
    secondary: '#B3B3B3',
    muted: '#666666',
  },
  // 状態
  status: {
    active: '#4CAF50',     // 再生中
    error: '#F44336',
  },
  // 鍵盤
  keyboard: {
    white: '#F5F5F5',
    whitePressed: '#E0E0E0',
    black: '#1A1A1A',
    blackPressed: '#333333',
  },
};
```

### 6.2 タイポグラフィ
```typescript
const typography = {
  // BPM表示など大きな数値
  displayLarge: {
    fontSize: 72,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  // セクション見出し
  heading: {
    fontSize: 24,
    fontWeight: '600',
  },
  // 本文
  body: {
    fontSize: 16,
    fontWeight: '400',
  },
  // 補足テキスト
  caption: {
    fontSize: 12,
    fontWeight: '400',
  },
};
```

### 6.3 間隔
```typescript
const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};
```

### 6.4 アニメーション仕様
| 要素 | アニメーション | 時間 |
|------|--------------|------|
| 振り子 | スイング | ビート間隔 |
| ビートインジケーター | スケール + 透明度 | 100ms |
| 鍵盤押下 | スケール(0.95) + 色変化 | 50ms |
| 画面遷移 | スライド | 300ms |

---

## 7. パフォーマンス要件

| 項目 | 目標値 |
|------|--------|
| 起動時間 | < 2秒 |
| メトロノーム遅延 | < 10ms |
| 鍵盤発音遅延 | < 20ms |
| メモリ使用量 | < 150MB |
| CPU使用率（再生中） | < 15% |

---

## 8. テスト計画

### 8.1 単体テスト
- 音律計算の正確性
- プログラムデータ操作
- タップテンポ計算

### 8.2 統合テスト
- 音声再生のタイミング精度
- 画面遷移
- データ永続化

### 8.3 デバイステスト
- iOS（iPhone SE, iPhone 15）
- Android（Pixel 6, Galaxy S23）
