# 開発ガイド

## 1. 開発環境セットアップ

### 1.1 必要な環境
- Node.js 18.x 以上
- npm または yarn
- Expo Go アプリ（iOS/Android）
- VS Code または Cursor（推奨）

### 1.2 初期セットアップ

```bash
# リポジトリクローン後
cd my-expo-app

# 依存パッケージインストール
npm install

# 開発サーバー起動
npm start
```

### 1.3 デバイスでの確認
1. Expo Goアプリをインストール
2. ターミナルに表示されるQRコードをスキャン
3. アプリが起動

---

## 2. プロジェクト構成

### 2.1 重要なファイル

| ファイル | 説明 |
|---------|------|
| `app.json` | Expoの設定 |
| `package.json` | 依存パッケージ管理 |
| `tsconfig.json` | TypeScript設定 |
| `babel.config.js` | Babel設定 |

### 2.2 ディレクトリ説明

| ディレクトリ | 説明 |
|-------------|------|
| `app/` | expo-routerのページ（画面） |
| `components/` | 再利用可能なコンポーネント |
| `hooks/` | カスタムReactフック |
| `stores/` | Zustand状態管理 |
| `utils/` | ユーティリティ関数 |
| `types/` | TypeScript型定義 |
| `styles/` | スタイル定数 |
| `docs/` | ドキュメント |

---

## 3. 開発ワークフロー

### 3.1 新機能の追加

1. `docs/TASKS.md` で該当タスクを「🔄 進行中」に更新
2. ブランチを作成（任意）
3. 実装
4. テスト
5. `docs/TASKS.md` で「✅ 完了」に更新
6. `docs/CHANGELOG.md` に変更を記録

### 3.2 コーディング規約

#### ファイル命名
- コンポーネント: `PascalCase.tsx`
- フック: `useCamelCase.ts`
- ユーティリティ: `camelCase.ts`
- 型定義: `index.ts` または `types.ts`

#### コンポーネント構造
```typescript
// 1. インポート
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// 2. 型定義
interface Props {
  title: string;
  onPress?: () => void;
}

// 3. コンポーネント
export const MyComponent: React.FC<Props> = ({ title, onPress }) => {
  // 4. フック
  const [state, setState] = useState(false);

  // 5. ハンドラー
  const handlePress = () => {
    onPress?.();
  };

  // 6. レンダリング
  return (
    <View style={styles.container}>
      <Text>{title}</Text>
    </View>
  );
};

// 7. スタイル
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

---

## 4. 音声エンジン

### 4.1 react-native-audio-api の使い方

```typescript
import { AudioContext } from 'react-native-audio-api';

// コンテキスト作成
const audioContext = new AudioContext();

// オシレーター作成
const oscillator = audioContext.createOscillator();
oscillator.type = 'sine';
oscillator.frequency.value = 440; // Hz

// ゲイン（音量）作成
const gainNode = audioContext.createGain();
gainNode.gain.value = 0.5;

// 接続
oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);

// 再生
oscillator.start();

// 停止（0.1秒後）
oscillator.stop(audioContext.currentTime + 0.1);
```

### 4.2 音律計算

```typescript
// 平均律
const getEqualTemperamentFrequency = (
  semitones: number, 
  baseFreq: number = 440
): number => {
  return baseFreq * Math.pow(2, semitones / 12);
};

// 純正律（C基準）
const justIntonationRatios: Record<number, number> = {
  0: 1,      // C
  1: 16/15,  // C#
  2: 9/8,    // D
  3: 6/5,    // D#
  4: 5/4,    // E
  5: 4/3,    // F
  6: 45/32,  // F#
  7: 3/2,    // G
  8: 8/5,    // G#
  9: 5/3,    // A
  10: 9/5,   // A#
  11: 15/8,  // B
};
```

---

## 5. 状態管理（Zustand）

### 5.1 ストア作成例

```typescript
import { create } from 'zustand';

interface MetronomeState {
  tempo: number;
  isPlaying: boolean;
  timeSignature: { numerator: number; denominator: number };
  
  setTempo: (tempo: number) => void;
  togglePlaying: () => void;
  setTimeSignature: (sig: { numerator: number; denominator: number }) => void;
}

export const useMetronomeStore = create<MetronomeState>((set) => ({
  tempo: 120,
  isPlaying: false,
  timeSignature: { numerator: 4, denominator: 4 },
  
  setTempo: (tempo) => set({ tempo }),
  togglePlaying: () => set((state) => ({ isPlaying: !state.isPlaying })),
  setTimeSignature: (timeSignature) => set({ timeSignature }),
}));
```

### 5.2 使用方法

```typescript
const MyComponent = () => {
  const tempo = useMetronomeStore((state) => state.tempo);
  const setTempo = useMetronomeStore((state) => state.setTempo);
  
  return <TempoSlider value={tempo} onChange={setTempo} />;
};
```

---

## 6. テスト

### 6.1 手動テスト項目

#### メトロノーム
- [ ] テンポ変更が即座に反映される
- [ ] 拍子変更が次の小節から適用される
- [ ] タップテンポが正確に計測される
- [ ] 長時間再生でもずれが発生しない

#### ハーモニー
- [ ] 全ての鍵盤が正しい音程で発音する
- [ ] マルチタッチで和音が演奏できる
- [ ] 音律切替で音程が変わる
- [ ] 基準ピッチ変更が反映される

---

## 7. ビルドとデプロイ

### 7.1 開発ビルド

```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### 7.2 プロダクションビルド

```bash
# EASを使用
npx eas build --platform ios
npx eas build --platform android
```

---

## 8. トラブルシューティング

### 8.1 よくある問題

| 問題 | 解決策 |
|------|--------|
| Metro bundlerエラー | `npx expo start -c` でキャッシュクリア |
| パッケージが見つからない | `npm install` を再実行 |
| 音が出ない | AudioContextの初期化をユーザー操作後に行う |
| アニメーションがカクつく | `useNativeDriver: true` を確認 |

### 8.2 デバッグ

```bash
# React Native Debuggerを開く
# Expo Goアプリでシェイク → "Debug Remote JS"
```
