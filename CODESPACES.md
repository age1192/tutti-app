# GitHub Codespaces での動作確認方法

## 前提条件

- GitHubアカウント
- スマホにExpo Goアプリをインストール（iOS/Android）

## 手順

### 1. GitHubリポジトリにプッシュ

```bash
git add .
git commit -m "Add Codespaces configuration"
git push origin main
```

### 2. GitHub Codespacesを起動

1. GitHubリポジトリのページを開く
2. 「Code」ボタンをクリック
3. 「Codespaces」タブを選択
4. 「Create codespace on main」をクリック
5. Codespaceが起動するまで待つ（1-2分）

### 3. Expoサーバーを起動

Codespaceのターミナルで以下を実行：

```bash
npm run start:tunnel
```

### 4. スマホで確認

1. スマホでExpo Goアプリを開く
2. ターミナルに表示されるQRコードをスキャン
3. アプリが読み込まれるまで待つ

## トラブルシューティング

### QRコードが表示されない場合

- ポート転送が正しく設定されているか確認
- `--tunnel`オプションが正しく動作しているか確認

### 接続できない場合

- スマホとCodespaceが同じネットワークに接続されている必要はありません（tunnelモードのため）
- Expo Goアプリが最新版か確認

### パフォーマンスが遅い場合

- Codespaceのマシンサイズを上げる（Settings > Codespaces > Machine type）
