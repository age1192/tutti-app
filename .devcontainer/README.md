# GitHub Codespaces セットアップ

このプロジェクトはGitHub Codespacesで動作確認できます。

## 使い方

1. GitHubリポジトリにプッシュ
2. GitHubリポジトリのページで「Code」ボタンをクリック
3. 「Codespaces」タブを選択
4. 「Create codespace on main」をクリック
5. Codespaceが起動したら、ターミナルで以下を実行：

```bash
npm run start:tunnel
```

6. QRコードが表示されるので、スマホのExpo Goアプリでスキャン

## ポート転送

以下のポートが自動的に転送されます：
- 8081: Expo Metro Bundler
- 19000-19002: Expo DevTools

## 注意事項

- Tunnelモードを使用するため、インターネット接続が必要です
- 初回起動時は依存パッケージのインストールに時間がかかります
