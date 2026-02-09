# Git操作手順（Windows ↔ Mac）

CHANGELOGとバージョン情報を更新しました。プッシュ/プルの手順です。

## Windows PCで変更をプッシュする手順

PowerShellで以下を実行：

```powershell
# プロジェクトフォルダに移動
cd c:\dev\my-expo-app

# 変更を確認
git status

# 変更をステージング
git add .

# コミット（変更内容を説明するメッセージを入力）
git commit -m "v1.3.7: SATBボイシング編集、iOS対応、クラッシュ修正"

# GitHubにプッシュ
git push
```

## Macで最新の変更を取得する手順

Macのターミナルで以下を実行：

```bash
# プロジェクトフォルダに移動
cd ~/Desktop/tootie-app

# 最新の変更を取得
git pull

# 依存関係が変更されている場合は再インストール（必要に応じて）
npm install

# iOSビルドを再実行
npx expo run:ios
```

---

**最終更新**: 2026-01-31
