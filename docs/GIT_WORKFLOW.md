# Git操作手順（Windows ↔ Mac）

このドキュメントでは、Windows PCとMac間でコードを同期するためのGit操作手順を説明します。

## 前提条件

- Gitがインストールされていること
- GitHubアカウントが作成されていること
- リモートリポジトリが設定されていること

## Windows側での操作

### 1. 変更をステージング

```powershell
# すべての変更をステージング
git add .

# 特定のファイルのみステージングする場合
git add <ファイル名>
```

### 2. 変更をコミット

```powershell
# コミットメッセージを付けてコミット
git commit -m "変更内容の説明"

# 例：
git commit -m "メトロノーム画面のUI改善"
```

### 3. リモートリポジトリにプッシュ

```powershell
# mainブランチにプッシュ
git push origin main

# 初回プッシュの場合（ブランチを設定）
git push -u origin main
```

### 4. プッシュ前の確認（推奨）

```powershell
# 変更内容を確認
git status

# コミット履歴を確認
git log --oneline -5
```

## Mac側での操作

### 1. 最新の変更を取得

```bash
# リモートリポジトリから最新の変更を取得
git pull origin main

# または、fetchしてからmerge
git fetch origin
git merge origin/main
```

### 2. 変更を確認

```bash
# 変更されたファイルを確認
git status

# 最新のコミット履歴を確認
git log --oneline -5
```

### 3. iOSアプリのビルド・実行

```bash
# Expo開発サーバーを起動
npx expo start

# 実機で実行（iPhone接続時）
npx expo run:ios --device

# シミュレーターで実行
npx expo run:ios
```

## よくある操作パターン

### パターン1: Windowsで開発 → Macでテスト

1. **Windows側**
   ```powershell
   git add .
   git commit -m "変更内容"
   git push origin main
   ```

2. **Mac側**
   ```bash
   git pull origin main
   npx expo start
   ```

### パターン2: Macで修正 → Windowsに反映

1. **Mac側**
   ```bash
   git add .
   git commit -m "修正内容"
   git push origin main
   ```

2. **Windows側**
   ```powershell
   git pull origin main
   ```

## トラブルシューティング

### プッシュが失敗する場合

```powershell
# リモートリポジトリのURLを確認
git remote -v

# リモートURLを設定/変更
git remote set-url origin https://github.com/ユーザー名/リポジトリ名.git
```

### プル時にコンフリクトが発生した場合

```bash
# コンフリクトファイルを確認
git status

# コンフリクトを解決後
git add .
git commit -m "コンフリクト解決"
git push origin main
```

### 変更を破棄したい場合

```powershell
# 未コミットの変更を破棄（注意：変更が失われます）
git checkout .

# または、特定のファイルのみ
git checkout <ファイル名>
```

## 注意事項

- **コミット前に必ず`git status`で変更内容を確認すること**
- **重要な変更は必ずコミットしてからプッシュすること**
- **Mac側でプルする前に、未コミットの変更がないか確認すること**
- **コンフリクトが発生した場合は、慎重に解決すること**

## 参考コマンド一覧

### Windows (PowerShell)

```powershell
# 状態確認
git status
git log --oneline -5

# 変更をステージング
git add .

# コミット
git commit -m "メッセージ"

# プッシュ
git push origin main

# プル
git pull origin main
```

### Mac (Terminal)

```bash
# 状態確認
git status
git log --oneline -5

# 変更をステージング
git add .

# コミット
git commit -m "メッセージ"

# プッシュ
git push origin main

# プル
git pull origin main

# iOSビルド
npx expo run:ios --device
```

## Git設定（初回のみ）

### Windows側

```powershell
# ユーザー名とメールアドレスを設定
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# 設定確認
git config --global --list
```

### Mac側

```bash
# ユーザー名とメールアドレスを設定
git config --global user.name "Your Name"
git config --global user.email "your-email@example.com"

# 設定確認
git config --global --list
```

---

**最終更新**: 2026-01-31
