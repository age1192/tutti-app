# Git操作手順（Windows ↔ Mac）

## クイックリファレンス（簡略版）

### Windows PCで変更をプッシュ（最小限）

```powershell
cd c:\dev\my-expo-app
git add .
git commit -m "変更内容の説明"
git push
```

### Macで最新の変更を取得（最小限）

```bash
cd ~/Desktop/tutti-app
git pull
npx expo run:ios
```

---

## 詳細手順

### Windows PCで変更をプッシュする手順

PowerShellで以下を実行：

```powershell
# プロジェクトフォルダに移動
cd c:\dev\my-expo-app

# 変更を確認（スキップ可能）
git status

# 変更をステージング
git add .

# コミット（変更内容を説明するメッセージを入力）
git commit -m "変更内容の説明"

# GitHubにプッシュ
git push
```

**スキップ可能な手順**:
- `git status` - 変更内容を確認したい場合のみ実行

### Macで最新の変更を取得する手順

Macのターミナルで以下を実行：

```bash
# プロジェクトフォルダに移動
cd ~/Desktop/tutti-app

# 最新の変更を取得
git pull

# 依存関係が変更されている場合のみ再インストール（スキップ可能）
npm install

# iOSビルドを再実行（ログが表示されます）
npx expo run:ios
```

### ログの確認方法

**ターミナルで確認**:
- `npx expo run:ios`を実行したターミナルに、アプリのログ（`console.log`、`console.warn`、`console.error`）が表示されます
- `[Audio]`で始まるログがオーディオ関連のログです

**Xcodeで確認**:
- Xcodeを開いて、下部のデバッグコンソール（Debug Area）でログを確認できます
- Xcodeのメニューから「View」→「Debug Area」→「Show Debug Area」を選択

**シミュレーター/実機のログ**:
- シミュレーターまたは実機に接続している場合、ターミナルに直接ログが出力されます

**スキップ可能な手順**:
- `npm install` - `package.json`や`package-lock.json`が変更されていない場合はスキップ可能

---

## よくある操作

### 変更を確認せずにプッシュしたい場合

```powershell
cd c:\dev\my-expo-app
git add .
git commit -m "変更内容"
git push
```

### Macで依存関係の再インストールをスキップする場合

```bash
cd ~/Desktop/tutti-app
git pull
npx expo run:ios
```

---

**最終更新**: 2026-01-31
