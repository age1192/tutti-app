# タスク管理票

## プロジェクト概要
- **プロジェクト名**: Ensemble Support App（合奏支援アプリ）
- **開始日**: 2026-01-27
- **目標**: 吹奏楽・オーケストラ向けの本番品質アプリ

---

## 進捗サマリー

| フェーズ | 状態 | 進捗 |
|---------|------|------|
| Phase 1: プロジェクト構成 | ✅ 完了 | 100% |
| Phase 2: 音声エンジン | ✅ 完了 | 100% |
| Phase 3: 基本メトロノーム | ✅ 完了 | 100% |
| Phase 4: ハーモニー | ✅ 完了 | 100% |
| Phase 5: プログラムメトロノーム | ✅ 完了 | 100% |
| Phase 6: UI/UXブラッシュアップ | ✅ 完了 | 100% |
| Phase 7: メトロノーム拡張機能 | ✅ 完了 | 100% |

**全体進捗: 100%**

---

## Phase 1: プロジェクト構成

### 1.1 依存パッケージのインストール
| タスク | 状態 | 備考 |
|--------|------|------|
| expo-router インストール | ✅ | ナビゲーション |
| react-native-safe-area-context | ✅ | SafeArea対応 |
| react-native-screens | ✅ | 画面管理 |
| expo-linking | ✅ | ディープリンク |
| expo-constants | ✅ | 定数管理 |
| zustand | ✅ | 状態管理 |
| @react-native-async-storage/async-storage | ✅ | データ永続化 |
| react-native-audio-api | ✅ | 音声合成 |

### 1.2 プロジェクト構成の作成
| タスク | 状態 | 備考 |
|--------|------|------|
| app/ ディレクトリ作成 | ✅ | expo-router用 |
| _layout.tsx 作成 | ✅ | ルートレイアウト |
| index.tsx 作成 | ✅ | ホーム画面 |
| metronome.tsx 作成 | ✅ | メトロノーム画面（プレースホルダー） |
| harmony.tsx 作成 | ✅ | ハーモニー画面（プレースホルダー） |
| program/ ディレクトリ作成 | ✅ | プログラム管理 |
| components/ 作成 | ✅ | コンポーネント |
| hooks/ 作成 | ✅ | カスタムフック（プレースホルダー） |
| stores/ 作成 | ✅ | Zustandストア（プレースホルダー） |
| utils/ 作成 | ✅ | ユーティリティ |
| types/ 作成 | ✅ | 型定義 |

### 1.3 設定ファイルの更新
| タスク | 状態 | 備考 |
|--------|------|------|
| app.json 更新 | ✅ | expo-router設定、scheme追加 |
| package.json 更新 | ✅ | main を expo-router/entry に変更 |
| tsconfig.json 作成 | ✅ | TypeScript設定 |
| babel.config.js 更新 | ✅ | babel設定 |

---

## Phase 2: 音声エンジン

### 2.1 オーディオコンテキスト
| タスク | 状態 | 備考 |
|--------|------|------|
| AudioContext 初期化 | ✅ | react-native-audio-api |
| useAudioEngine フック作成 | ✅ | hooks/useAudioEngine.ts |
| 音声再生テスト | ✅ | メトロノーム・ハーモニー画面で確認可能 |

### 2.2 トーン生成
| タスク | 状態 | 備考 |
|--------|------|------|
| OscillatorNode 実装 | ✅ | サイン波 |
| GainNode 実装 | ✅ | 音量制御 |
| エンベロープ（ADSR）実装 | ✅ | playTone, startNote/stopNote |

### 2.3 メトロノーム音
| タスク | 状態 | 備考 |
|--------|------|------|
| クリック音生成 | ✅ | playClick(isAccent) |
| アクセント音 | ✅ | 1000Hz / 800Hz |
| タイミング精度テスト | ✅ | scheduleClick で高精度スケジューリング対応 |

---

## Phase 3: 基本メトロノーム

### 3.1 メトロノームロジック
| タスク | 状態 | 備考 |
|--------|------|------|
| useMetronome フック作成 | ✅ | hooks/useMetronome.ts |
| テンポ制御（20-300 BPM） | ✅ | ±1, ±10 ボタン |
| 拍子設定 | ✅ | 8種類の拍子対応 |
| 再生/停止制御 | ✅ | toggle 関数 |

### 3.2 UI コンポーネント
| タスク | 状態 | 備考 |
|--------|------|------|
| TempoControl 作成 | ✅ | テンポ表示・調整 |
| BeatIndicator 作成 | ✅ | 拍表示（アクセント対応） |
| TimeSignatureSelector 作成 | ✅ | 拍子選択UI |
| PlayButton 作成 | ✅ | 再生/停止ボタン |
| TapTempoButton 作成 | ✅ | タップテンポ機能 |

### 3.3 画面統合
| タスク | 状態 | 備考 |
|--------|------|------|
| MetronomeScreen 実装 | ✅ | 全コンポーネント統合 |
| 状態管理連携 | ✅ | Zustand useMetronomeStore |

---

## Phase 4: ハーモニー

### 4.1 音律計算
| タスク | 状態 | 備考 |
|--------|------|------|
| pitchUtils.ts 作成 | ✅ | Phase 1で作成済み |
| 平均律計算 | ✅ | getEqualTemperamentFrequency |
| 純正律計算 | ✅ | getJustIntonationFrequency |
| 基準ピッチ設定 | ✅ | 430-450Hz 対応 |

### 4.2 鍵盤UI
| タスク | 状態 | 備考 |
|--------|------|------|
| PianoKeyboard コンポーネント | ✅ | 2オクターブ、リアルなデザイン |
| 白鍵・黒鍵レンダリング | ✅ | 白鍵の上に黒鍵配置 |
| タッチイベント処理 | ✅ | PanResponder使用 |
| グリッサンド対応 | ✅ | スライドで連続発音 |
| 音域移動ボタン | ✅ | C1〜C6 対応 |

### 4.3 画面統合
| タスク | 状態 | 備考 |
|--------|------|------|
| HarmonyScreen 実装 | ✅ | 横画面/縦画面対応 |
| 横画面対応 | ✅ | expo-screen-orientation |
| 音律切替UI | ✅ | 平均律/純正律切替 |
| ピッチ設定UI | ✅ | ±1Hz 調整 |
| HarmonyControls | ✅ | コントロールパネル |

---

## Phase 5: プログラムメトロノーム

### 5.1 データ構造
| タスク | 状態 | 備考 |
|--------|------|------|
| Program 型定義 | ✅ | types/index.ts |
| Section 型定義 | ✅ | テンポ、拍子、小節数、カウントイン |
| programUtils.ts 作成 | ✅ | AsyncStorage連携、セクション操作 |

### 5.2 プログラム実行
| タスク | 状態 | 備考 |
|--------|------|------|
| セクション遷移ロジック | ✅ | useProgramMetronome.ts |
| 現在位置トラッキング | ✅ | PlaybackPosition型 |
| カウントイン機能 | ✅ | セクションごとに設定可能 |

### 5.3 保存・読み込み
| タスク | 状態 | 備考 |
|--------|------|------|
| AsyncStorage 連携 | ✅ | STORAGE_KEYS.PROGRAMS |
| プログラム保存 | ✅ | saveProgram() |
| プログラム読み込み | ✅ | loadPrograms() |
| プログラム削除 | ✅ | deleteProgram() |

### 5.4 UI
| タスク | 状態 | 備考 |
|--------|------|------|
| ProgramList 画面 | ✅ | app/program/index.tsx |
| ProgramEditor 画面 | ✅ | app/program/[id].tsx |
| セクション編集UI | ✅ | SectionEditor.tsx |
| 進行状況表示 | ✅ | ProgramProgress.tsx |
| プログラム再生画面 | ✅ | app/program/play.tsx |

---

## Phase 6: UI/UXブラッシュアップ

### 6.1 デザインシステム
| タスク | 状態 | 備考 |
|--------|------|------|
| カラーパレット定義 | ✅ | styles/colors.ts |
| タイポグラフィ定義 | ✅ | styles/typography.ts |
| 共通UIコンポーネント | ✅ | Button, Card, IconButton, LoadingOverlay |

### 6.2 アニメーション
| タスク | 状態 | 備考 |
|--------|------|------|
| 振り子アニメーション | ✅ | Pendulum.tsx (Reanimated) |
| ビートパルス | ✅ | BeatPulse.tsx |
| ボタンアニメーション | ✅ | withSpring |
| カードアニメーション | ✅ | タップ時スケール |

### 6.3 UX改善
| タスク | 状態 | 備考 |
|--------|------|------|
| ハプティクス | ✅ | useHaptics フック |
| 画面常時点灯 | ✅ | useKeepAwake フック |
| ローディングオーバーレイ | ✅ | LoadingOverlay コンポーネント |

---

## Phase 7: メトロノーム拡張機能

### 7.1 拍分割（サブディビジョン）機能
| タスク | 状態 | 備考 |
|--------|------|------|
| SubdivisionType, SubdivisionSettings 型定義 | ✅ | types/index.ts |
| useMetronomeStore 拡張 | ✅ | 分割設定の状態管理 |
| useAudioEngine 拡張 | ✅ | playSubdivisionClick 関数 |
| useMetronome 拡張 | ✅ | 分割音スケジューリング |
| SubdivisionControl コンポーネント | ✅ | 音量スライダーUI |
| メトロノーム画面統合 | ✅ | app/metronome.tsx |

### 7.2 分割タイプ仕様
| 分割タイプ | 1拍あたり | 周波数 |
|------------|-----------|--------|
| 4分音符 | 1回 | 1000Hz(アクセント)/800Hz(通常) |
| 8分音符 | 2回 | 600Hz |
| 3連符 | 3回 | 500Hz |
| 16分音符 | 4回 | 400Hz |

---

## 凡例

| 記号 | 意味 |
|------|------|
| ✅ | 完了 |
| 🔄 | 進行中 |
| ⏳ | 未着手 | 
| ❌ | 中止/スキップ |
| 🐛 | バグあり |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-01-27 | 初版作成 |
| 2026-01-27 | Phase 1 完了 - プロジェクト構成、expo-router設定、Zustandストア、スタイル定義 |
| 2026-01-27 | Phase 2 完了 - useAudioEngineフック、トーン生成、クリック音、持続音対応 |
| 2026-01-27 | Phase 3 完了 - メトロノームUI、タップテンポ、Zustand状態管理 |
| 2026-01-27 | Phase 4 完了 - ピアノ鍵盤UI、横画面対応、グリッサンド、音律切替 |
| 2026-01-27 | Phase 5 完了 - プログラムメトロノーム、セクション管理、AsyncStorage連携 |
| 2026-01-27 | Phase 6 完了 - UI/UXブラッシュアップ、アニメーション、ハプティクス、画面常時点灯 |
| 2026-01-28 | Phase 7 完了 - 拍分割（サブディビジョン）機能、4分/8分/3連/16分音符対応、音量スライダー |