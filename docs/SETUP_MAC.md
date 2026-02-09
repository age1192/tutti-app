# MacでのDevelopment Buildセットアップ手順

このドキュメントでは、iPhoneでexpo-router v6を使用したアプリを動作させるためのDevelopment Buildのセットアップ方法を説明します。

## 前提条件

### 必要なソフトウェア

1. **Xcode**（最新版推奨）
   - App Storeからインストール
   - コマンドラインツールもインストール:
     ```bash
     xcode-select --install
     ```

2. **CocoaPods**
   - Rubyのgemパッケージマネージャーを使用:
     ```bash
     sudo gem install cocoapods
     ```
   - インストール確認:
     ```bash
     pod --version
     ```

3. **Node.js**（v18以上推奨）
   - 既にインストール済みの場合は確認:
     ```bash
     node --version
     npm --version
     ```

4. **Expo CLI**（グローバルインストール推奨）
   ```bash
   npm install -g expo-cli
   ```

## セットアップ手順

### 1. プロジェクトをMacにコピー

WindowsのプロジェクトフォルダをMacにコピーします。

**方法A: USBメモリやクラウドストレージを使用**
- プロジェクトフォルダ全体をコピー
- `.git`フォルダも含める（Gitリポジトリの場合）

**方法B: Gitを使用（推奨）**
```bash
# Macで
git clone <repository-url>
cd my-expo-app
```

**方法C: ネットワーク共有**
- WindowsとMacが同じネットワーク上にある場合、ファイル共有を使用

### 2. Macでプロジェクトを開く

```bash
# プロジェクトディレクトリに移動
cd /path/to/my-expo-app

# 現在のディレクトリを確認
pwd
```

### 3. 依存関係のインストール

```bash
# npmパッケージをインストール
npm install

# インストールが完了したことを確認
npm list --depth=0
```

### 4. iOSフォルダの準備（初回のみ）

**重要**: `ios`フォルダが存在しない場合は、先に`npx expo prebuild`を実行してネイティブフォルダを生成する必要があります。

```bash
# iOSとAndroidのネイティブフォルダを生成
npx expo prebuild

# iOSフォルダのみを生成する場合
npx expo prebuild --platform ios
```

**注意**: 
- `prebuild`を実行すると、`ios`と`android`フォルダが自動生成されます
- これらのフォルダは`.gitignore`に追加することを推奨（生成されたファイルはGitで管理しない）

既に`ios`フォルダが存在する場合:

```bash
# CocoaPodsの依存関係をインストール
cd ios
pod install
cd ..
```

### 5. Development Buildの作成

#### 5.1 ネイティブフォルダの生成（初回のみ）

**重要**: `ios`フォルダが存在しない場合は、先に`prebuild`を実行してください。

```bash
# iOSフォルダを生成
npx expo prebuild --platform ios

# または、iOSとAndroidの両方を生成
npx expo prebuild
```

**注意**: 
- `prebuild`を実行すると、`ios`フォルダが生成されます
- このフォルダは`.gitignore`に追加することを推奨します

#### 5.2 シミュレーターでビルド（推奨：初回テスト）

```bash
# iOSシミュレーターでビルド＆起動
npx expo run:ios

# 特定のシミュレーターを指定する場合
npx expo run:ios --device "iPhone 15 Pro"
```

**初回ビルド時の注意点:**
- ビルドには5-15分程度かかります
- Xcodeが自動的に開き、ビルドプロセスが開始されます
- シミュレーターが自動的に起動し、アプリがインストールされます

#### 5.3 実機（iPhone）でビルド

**事前準備:**
1. iPhoneをMacにUSBケーブルで接続
2. iPhoneで「このコンピューターを信頼」をタップ
3. XcodeでApple Developerアカウントを設定（無料アカウントでも可）

**ビルドコマンド:**
```bash
# 接続されたiPhoneでビルド
npx expo run:ios --device

# または、デバイス名を指定
npx expo run:ios --device "Your iPhone Name"
```

**Apple Developerアカウントの設定:**
1. Xcodeを開く
2. `Xcode` → `Settings` → `Accounts`
3. `+`ボタンをクリックしてApple IDを追加
4. 無料アカウントでも開発用ビルドは可能

### 6. ビルド後の動作

#### 6.1 初回ビルド後

- Development BuildアプリがiPhone/シミュレーターにインストールされます
- アプリを起動すると、Expo Dev Clientの画面が表示されます

#### 6.2 開発の継続

**Windows PCから開発を続ける場合:**

1. **Windows PCで:**
   ```bash
   # Expo開発サーバーを起動
   npx expo start
   ```

2. **MacのDevelopment Buildアプリで:**
   - QRコードをスキャン
   - または、開発サーバーのURLを入力

**Macから開発を続ける場合:**

```bash
# MacでExpo開発サーバーを起動
npx expo start

# Development BuildアプリでQRコードをスキャン
```

## トラブルシューティング

### エラー1: iosフォルダが存在しない

**症状:**
```
Error: ios folder not found
```

**解決方法:**
```bash
# ネイティブフォルダを生成
npx expo prebuild --platform ios

# その後、ビルドを実行
npx expo run:ios
```

### エラー2: CocoaPodsのインストールエラー

**症状:**
```
[!] CocoaPods could not find compatible versions
```

**解決方法:**
```bash
# CocoaPodsを更新
sudo gem install cocoapods

# iOSフォルダをクリーンアップ
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

### エラー3: Xcodeのコマンドラインツールが見つからない

**症状:**
```
xcode-select: error: tool 'xcodebuild' requires Xcode
```

**解決方法:**
```bash
# コマンドラインツールをインストール
xcode-select --install

# Xcodeのパスを設定
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### エラー4: ビルドエラー（依存関係の問題）

**症状:**
```
The following build commands failed
```

**解決方法:**
```bash
# 完全にクリーンアップして再ビルド
cd ios
rm -rf Pods Podfile.lock build
pod deintegrate
pod install
cd ..

# プロジェクトをクリーンビルド
npx expo run:ios --clean
```

### エラー5: 実機でのビルドエラー（署名の問題）

**症状:**
```
Code signing is required for product type 'Application'
```

**解決方法:**
1. Xcodeでプロジェクトを開く:
   ```bash
   open ios/MyExpoApp.xcworkspace
   ```
2. `Signing & Capabilities`タブで:
   - `Automatically manage signing`にチェック
   - `Team`を選択（Apple IDでログイン）
3. 再度ビルド:
   ```bash
   npx expo run:ios --device
   ```

### エラー6: Metroバンドラーのポートが使用中

**症状:**
```
Port 8081 is already in use
```

**解決方法:**
```bash
# ポート8081を使用しているプロセスを終了
lsof -ti:8081 | xargs kill -9

# または別のポートを使用
npx expo start --port 8082
```

### エラー7: シミュレーターが見つからない

**症状:**
```
No simulators found
```

**解決方法:**
```bash
# 利用可能なシミュレーターを一覧表示
xcrun simctl list devices

# 特定のシミュレーターを起動
xcrun simctl boot "iPhone 15 Pro"
open -a Simulator
```

## よくある質問（FAQ）

### Q1: ビルドに時間がかかりすぎる

**A:** 初回ビルドは時間がかかります（5-15分）。2回目以降はキャッシュが効いて速くなります。

### Q2: Windows PCから開発を続けられるか

**A:** はい。Development Buildアプリを一度インストールすれば、Windows PCから`npx expo start`を実行し、MacのアプリでQRコードをスキャンすれば開発を続けられます。

### Q3: Expo GoとDevelopment Buildの違いは？

**A:**
- **Expo Go**: 制限あり（一部のネイティブモジュールが使えない）
- **Development Build**: 制限なし（カスタムネイティブモジュールも使用可能）

### Q4: 実機でのビルドにはApple Developer Programが必要？

**A:** いいえ。無料のApple IDでも開発用ビルドは可能です。ただし、App Storeへの公開には有料アカウント（年間$99）が必要です。

### Q5: ビルドしたアプリを他のiPhoneにインストールできる？

**A:** 開発用ビルドは、ビルド時に登録したデバイスでのみ動作します。他のデバイスで使うには、そのデバイスのUDIDを登録して再ビルドする必要があります。

## 次のステップ

Development Buildが正常に動作したら:

1. **開発を続ける**
   - Windows PCから`npx expo start`を実行
   - MacのDevelopment BuildアプリでQRコードをスキャン

2. **本番ビルドの準備**
   - EAS Buildを使用してApp Store/Google Play用のビルドを作成
   - 詳細は[EAS Build Documentation](https://docs.expo.dev/build/introduction/)を参照

3. **パフォーマンスの最適化**
   - プロダクションビルドの最適化
   - バンドルサイズの削減

## 参考リンク

- [Expo Development Build Documentation](https://docs.expo.dev/development/introduction/)
- [Expo Router Documentation](https://docs.expo.dev/router/introduction/)
- [React Native Documentation](https://reactnative.dev/docs/getting-started)
- [Xcode Documentation](https://developer.apple.com/documentation/xcode)
