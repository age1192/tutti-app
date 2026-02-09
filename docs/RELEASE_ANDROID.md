# Android アプリを Google Play にリリースする手順

Android を先にリリースする場合の、**今の段階からストア公開まで**の手順です。  
EAS Build（Expo Application Services）を使う想定です。

---

## 全体の流れ

| 段階 | やること | 所要目安 |
|------|----------|----------|
| **1. 準備** | Expo・Google アカウント、EAS 設定 | 30分〜1時間 |
| **2. 本番ビルド** | `eas build --platform android` で AAB 作成 | 10〜20分（EAS 上） |
| **3. Play Console 準備** | 開発者登録・アプリ作成・内部テスト準備 | 1時間前後 |
| **4. 初回アップロード（手動）** | AAB を Play Console にアップロード | 15分前後 |
| **5. ストア公開の設定** | プライバシーポリシー・ストア情報など | 1〜2時間 |
| **6. 審査・公開** | テスト〜本番トラックへプロモート | 数日 |

**重要:** 初回だけは **必ず手動で Play Console から AAB をアップロード**する必要があります（Google の制限）。2回目以降は `eas submit` で自動化できます。

---

## 1. 準備

### 1-1. Expo アカウントと EAS CLI

1. [Expo](https://expo.dev) でアカウント作成（未作成なら）
2. EAS CLI を入れてログイン:
   ```bash
   npm install -g eas-cli
   eas login
   ```

### 1-2. プロジェクトに EAS を設定

本プロジェクトには **`eas.json`** を用意済みです。

- **`build.production`**: ストア提出用の **AAB** をビルドします
- **`build.preview`**: 社内テスト用の **APK**（`distribution: internal`）
- **`submit.production.android.track`**: `eas submit` 利用時は **内部テスト** に提出します（本番に出したいときは `production` に変更）

未作成の場合は `eas build:configure` で生成できます。先に Android だけビルドする場合は `eas build -p android` でプラットフォームを限定してください。

### 1-3. Google Play Developer アカウント

1. [Google Play 開発者コンソール](https://play.google.com/apps/publish/signup/) にアクセス
2. **開発者として登録**（一度きり **$25**）
3. 利用規約などに同意して登録完了

### 1-4. すでに済んでいること（確認用）

- `app.json` の `expo.android.package`: `com.ensemble.support` ✅
- `android/` は `npx expo prebuild --platform android` 済み ✅  
→ このまま EAS でビルドして問題ありません。

---

## 2. 本番ビルド（AAB を作る）

### 2-1. ビルド実行

```bash
cd c:\dev\my-expo-app
eas build --platform android --profile production
```

- 初回は **署名用キー** をどうするか聞かれたら、**EAS で管理** を選ぶと楽です
- ビルドはクラウドで実行され、[Expo ダッシュボード](https://expo.dev) で進捗を確認できます
- 終わったら **Download** から **`.aab`** を取得

### 2-2. バージョンについて

- **versionCode**: 毎回必ず増やす必要あり。`app.json` に `expo.android.versionCode` を書くか、[EAS のリモートバージョン](https://docs.expo.dev/build-reference/app-versions/) で自動インクリメント可能
- **versionName**: `app.json` の `expo.version`（現在 `1.0.11`）が使われます。リリースごとに適宜更新

---

## 3. Play Console の準備

### 3-1. アプリを作成

1. [Google Play Console](https://play.google.com/apps/publish/) を開く
2. **「アプリを作成」** をクリック
3. **アプリ名**・**デフォルト言語**・**アプリ or ゲーム**・**無料 or 有料** を入力して **「アプリを作成」**

### 3-2. 内部テストの準備（初回リリースに必要）

1. ダッシュボードで **「今すぐテストを開始」** → **「タスクを表示」** を開く
2. **テスト** → **内部テスト** へ進む
3. **テスター** で **「メールリストを作成」** し、テスト用メールアドレスを登録 → **保存**

---

## 4. 初回アップロード（手動）

**ここだけ必ず手動**で行います。

1. Play Console → **テスト** → **内部テスト**
2. **「新しいリリースを作成」**
3. **アプリの整合性** 画面:
   - **「署名キーを選択」** → **「Google 管理のキー」** を選ぶ（推奨）
4. **App bundles** の **「アップロード」** をクリック
5. 手元の **`.aab`**（`eas build` で取得したもの）を選択してアップロード
6. **リリース名**（例: `1.0.11 (1)`）を入力 → **次へ**
7. **「プレビューして確定」** で内容を確認 → **「保存して公開」**

初回リリースが内部テストトラックに作成されます。

---

## 5. ストア公開に必要な設定

本番（Production）に出す前に、Play Console の **「アプリを設定」** 以下を済ませます。

| 項目 | 内容 |
|------|------|
| **プライバシーポリシー** | 必須。Web の URL を登録。マイク利用などがある場合は記載すること |
| **アプリのアクセス** | 制限がある場合は「すべての機能にアクセス可能」など適宜選択 |
| **広告** | アプリに広告を含むか **含まない** を選択 |
| **対象者・コンテンツ** | 対象年齢・アプリの種類など |
| **ストア掲載情報** | ショート説明・詳細説明・スクリーンショットなど |

- スクリーンショットなどの **ストアアセット** は [Expo のストアアセットガイド](https://docs.expo.dev/guides/store-assets/) も参照
- チューナーでマイクを使っているため、**データの安全性** で「音声データ」などの扱いを適切に設定すること

---

## 6. 内部テスト → 本番公開

1. 内部テストで動作確認する
2. 問題なければ **「リリースをプロモート」** で **本番** または **クローズドテスト** へ
3. 本番トラックで **「審査に提出」** すると、Google の審査のあとストアに公開されます

---

## 7. 2回目以降のリリース（自動提出）

初回を手動アップロードしたあと、**Google Service Account** を EAS に登録すると、`eas submit` で自動提出できます。

### 7-1. Google Service Account の作成・登録

1. [Expo のガイド](https://expo.fyi/creating-google-service-account) に従い、Service Account を作成
2. Play Console でその Service Account に権限を付与
3. EAS ダッシュボード → 対象プロジェクト → **Credentials** → **Android** → **Add a Google Service Account Key** で JSON キーをアップロード

### 7-2. 提出用プロファイル

本プロジェクトの `eas.json` には、`submit.production.android.track: "internal"` が設定済みです。`eas submit` 実行時は **内部テスト** トラックへ提出されます。

- 本番ストアに出すときは、`track` を `"production"` に変更してから `eas submit` を実行してください。
- `track` の値: `internal`（内部テスト） / `alpha` / `beta` / `production`

### 7-3. ビルド＋提出の一括実行

```bash
eas build --platform android --profile production --auto-submit
```

ビルド完了後に、指定したトラックへ自動で提出されます。

---

## 8. よくあること・トラブル

| 状況 | 対処 |
|------|------|
| **「プライバシーポリシーが必要」** | プライバシーポリシー用の Web ページを用意し、Play Console の該当項目に URL を登録 |
| **versionCode の重複** | 以前より大きな `versionCode` にする。`app.json` の `expo.android.versionCode` か EAS のリモートバージョンで管理 |
| **署名エラー** | 初回は **EAS 管理のキー** を使い、Play Console では **Google 管理のキー** を選択。別のキーで署名した AAB はアップロードできない |
| **開発ビルドと本番の違い** | 開発用は `eas build -p android --profile development`（expo-dev-client 入り）。ストア提出用は `production` で AAB をビルドすること |

---

## 9. ローカル開発ビルドとの関係

- **エミュレータ・実機での開発**: `SETUP_ANDROID_WINDOWS.md` のとおり、`npx expo run:android` で Debug ビルドを動かします
- **ストア用リリース**: 上記のとおり **EAS Build の `production`** で AAB を作成し、Play Console に提出します  
→ 開発ビルドとリリースビルドは別手順です。

---

## まとめチェックリスト

- [ ] Expo アカウント作成・`eas login`
- [ ] `eas build:configure` で `eas.json` 作成
- [ ] Google Play 開発者登録（$25）
- [ ] `eas build --platform android --profile production` で AAB 取得
- [ ] Play Console でアプリ作成・内部テスト用メールリスト準備
- [ ] **初回のみ** AAB を手動アップロード（Google 管理のキーを選択）
- [ ] プライバシーポリシー・ストア情報・データの安全性などを設定
- [ ] 内部テストで確認 → 本番へプロモート → 審査提出
- [ ] （任意）Google Service Account を EAS に登録し、2回目以降は `eas submit` で自動提出

上から順に進めれば、今の状態から Android アプリをストアにリリースできます。
