# Windows で Android Development Build を動かす手順

Expo Go を使わず、全機能が使える Android アプリをエミュレータで起動するためのセットアップです。

---

## どこから始める？

**「一番のやり方がわからない」** 場合の進め方:

1. **まず「1. JDK と JAVA_HOME」** の **ステップ 1-1** から順にやる  
   → Android Studio を入れて、JAVA_HOME を設定する
2. それが終わったら **「2. エミュレータ（AVD）」** の **ステップ 2-1** から  
   → 仮想 Android 端末を作って起動する
3. 最後に **「3. ビルド＆起動」**  
   → `npx expo run:android` でアプリをビルドしてエミュレータにインストール

**1 → 2 → 3** の順で、それぞれのステップを上から順番に進めてください。

---

## 完了済み

1. **app.json に `expo-dev-client` プラグインを追加**
2. **`npx expo prebuild --platform android`** で `android/` フォルダを生成

## 前提（必須）

- **Git for Windows**：`react-native-audio-api` がビルド時に `bash` を使用するため必要です。  
  - 未インストールの場合: https://git-scm.com/ からインストール  
  - インストール時に「Add Git to PATH」を選択しておくと確実です

## 残りの作業

### 1. JDK のインストールと JAVA_HOME の設定（詳細手順）

Android ビルドには **Java Development Kit (JDK)** が必要です。ここでは **Android Studio を入れて、その中に入っている JDK を JAVA_HOME に設定する** 方法を、操作ごとに書きます。

---

#### ステップ 1-1: Android Studio をダウンロード

1. ブラウザで **https://developer.android.com/studio** を開く
2. **「Download Android Studio」** の緑ボタンをクリック
3. 利用規約に同意して、exe ファイル（例: `android-studio-xxxx-windows.exe`）をダウンロード

---

#### ステップ 1-2: Android Studio をインストール

1. ダウンロードした **exe をダブルクリック** して起動
2. **Next** をクリックして進む
3. **Standard** が選ばれていることを確認して **Next**
4. インストール先は **デフォルトのままで OK**（`C:\Program Files\Android\Android Studio` など）
5. **Install** をクリック → 終わったら **Finish**
6. 起動時には **「Import Android Studio Settings」** が出たら **Do not import** を選んで **OK** でよい

---

#### ステップ 1-3: JDK のフォルダの場所を確認する

Android Studio には **JDK が最初から入っています**。そのフォルダパスをあとで使います。

1. **エクスプローラー** を開く（`Win + E`）
2. アドレス欄に次のどちらかを入力して Enter:
   - `C:\Program Files\Android\Android Studio\jbr`
   - または `C:\Program Files\Android\Android Studio\jre`
3. その中に **bin** というフォルダがあれば OK  
   - 大抵は **jbr** のほうが使われます。`jbr` がなければ `jre` を試す

**メモするパスの例（自分の環境に合わせて）:**

- `C:\Program Files\Android\Android Studio\jbr`

※ 32bit 版の Android Studio なら `C:\Program Files (x86)\Android\Android Studio\jbr` のこともあります。

---

#### ステップ 1-4: 環境変数「JAVA_HOME」を追加する

1. **Windows の検索**（`Win + S`）で **「環境変数」** と入力
2. **「システム環境変数の編集」** を開く  
   （または **「環境変数を編集」** など、環境変数の設定が開くものを選ぶ）
3. 下の方の **「環境変数(N)…」** をクリック
4. **「ユーザー環境変数」** の **「新規(N)…」** をクリック
5. **変数名:** に `JAVA_HOME` と入力
6. **変数値:** に、さっきメモした JDK のフォルダパスを入力  
   - 例: `C:\Program Files\Android\Android Studio\jbr`  
   - 末尾の `\` は付けなくて OK
7. **OK** を押して閉じる

---

#### ステップ 1-5: 「Path」に JAVA_HOME の bin を追加する

1. 同じ **「環境変数」** のウィンドウの **「ユーザー環境変数」** の一覧で
2. **Path** を選んで **「編集(I)…」** をクリック
3. **「新規(N)」** をクリック
4. 次の **1 行** をそのまま入力:
   ```
   %JAVA_HOME%\bin
   ```
5. **OK** を押す
6. 開いている環境変数のウィンドウをすべて **OK** で閉じる

---

#### ステップ 1-6: 設定が効いているか確認する

**重要:** 環境変数を変えたあとは、**いったんターミナル（PowerShell など）を閉じて、新しく開き直す**必要があります。

1. **PowerShell** または **コマンドプロンプト** を **新規で** 開く
2. 次の 2 つを **1 行ずつ** 入力して Enter:

   ```powershell
   java -version
   ```

   → `openjdk` や `java version "17"` など、バージョンが表示されれば OK

   ```powershell
   echo $env:JAVA_HOME
   ```

   （コマンドプロンプトの場合は `echo %JAVA_HOME%`）

   → `C:\Program Files\Android\Android Studio\jbr` のように、さっき入れたパスが表示されれば OK

3. **「java は認識されません」** や **何も出ない** ときは:
   - ターミナルを閉じて **もう一度** 開き直す
   - JAVA_HOME と Path を **もう一度** 見直す（typo や余計なスペースがないか）

---

#### 方法 B: Android Studio を使わず JDK だけ入れる場合

1. **https://adoptium.net/** を開く
2. **Temurin 17 (LTS)** を選んで Windows 用の **msi** をダウンロード
3. インストール時に **「Set JAVA_HOME variable」** にチェックを入れる（自動で JAVA_HOME が設定される）
4. インストール後、**新しいターミナル** を開いて `java -version` で確認

### 2. Android エミュレータ（AVD）の準備（詳細手順）

アプリを表示する **仮想の Android 端末** を作成して起動します。

---

#### ステップ 2-1: Android Studio を開く

1. **Android Studio** を起動
2. 初回ならセットアップウィザードが始まる → **Next** で進めてよい（必要なものは自動で入ります）
3. ウィザードが終わると **Welcome** 画面が出る

---

#### ステップ 2-2: Device Manager を開く

1. Welcome 画面の右側の **「More Actions」** をクリック
2. **「Virtual Device Manager」** をクリック  
   （すでにプロジェクトを開いている場合は、メニュー **Tools** → **Device Manager**）

---

#### ステップ 2-3: 新しい仮想デバイスを作る

1. **「Create Device」**（または **「Create Virtual Device」**）をクリック
2. **「Phone」** が選ばれていることを確認
3. 一覧から端末を 1 つ選ぶ（例: **Pixel 7** や **Pixel 6**）→ **Next**
4. **「System Image」** の画面で、**「Recommended」** タブから OS を 1 つ選ぶ（例: **Tiramisu (API 33)** や **UpsideDownCake (API 34)**）
5. 右に **「Download」** と出ていればクリック → ダウンロード完了まで待つ
6. 選んだ行が **Downloaded** になったら **Next**
7. 名前はそのままで **Finish** をクリック

これで AVD が 1 つ作成された状態になります。

---

#### ステップ 2-4: エミュレータを起動する

1. Device Manager の一覧に、今作った AVD が表示される
2. その行の右端にある **▶（再生ボタン）** をクリック
3. しばらくすると **Android の画面がウィンドウで起動** する
4. ロック画面が出たら **上にスワイプ** してホーム画面まで進む

このウィンドウが **仮想 Android 端末** です。この状態のままにしておきます。

### 3. ビルド＆起動（JAVA_HOME とエミュレータが準備できてから）

**注意:** この手順は **ステップ 1（JAVA_HOME）** と **ステップ 2（AVD 起動）** が済んでから行ってください。

1. **エミュレータ（AVD）を起動した状態** にしておく（ステップ 2-4 の画面が表示されている）
2. **PowerShell** または **コマンドプロンプト** を **新しく** 開く
3. プロジェクトフォルダに移動:
   ```powershell
   cd c:\dev\my-expo-app
   ```
4. 次を実行:
   ```powershell
   npx expo run:android
   ```
5. 初回は Gradle のダウンロードなどで **数分〜十数分** かかることがあります
6. ビルドが終わると、起動中のエミュレータに **アプリが自動でインストールされ、起動** します

---

### 4. よくあるエラーと対処

| エラー | 対処 |
|--------|------|
| **JAVA_HOME is not set** | ステップ 1（JAVA_HOME・Path）をやり直す。ターミナルを**閉じて開き直して**から再度 `npx expo run:android` を実行 |
| **SDK location not found** | `android/local.properties` を作成し、`sdk.dir=C:\\Users\\<ユーザー名>\\AppData\\Local\\Android\\Sdk` を記述（`\` は `\\` に）。Android Studio の **File → Settings → Languages & Frameworks → Android SDK** で実際のパスを確認 |
| **Tag mismatch**（builder-8.2.1.jar 等のダウンロード失敗） | Gradle キャッシュ破損の可能性。PowerShell で `Remove-Item -Recurse -Force "$env:USERPROFILE\.gradle\caches\modules-2\files-2.1\com.android.tools.build"` など該当パッケージのキャッシュを削除して再ビルド |
| **Reanimated / Worklets require new architecture** | `android/gradle.properties` と `app.json` の `newArchEnabled` を `true` に設定（本プロジェクトは済） |
| **expo-barcode-scanner の Kotlin コンパイルエラー** | 非推奨のため本プロジェクトでは削除済み。QR ファイル読み取りは Web 版のみ対応 |
| **Port 8081 is being used** | 別の `npx expo start` などが動いている。そのターミナルで **Ctrl+C** で止めるか、タブを閉じる。その後もう一度 `npx expo run:android` |
| **No Android devices found** | エミュレータ（AVD）が起動しているか確認。ステップ 2-4 のとおり **▶** で起動してから再実行 |
| **java は認識されません** | 環境変数変更後、**ターミナルを開き直していない**可能性が高い。いったん閉じて新しいウィンドウで開き直す |
| **gradle-8.14.3-bin.zip.lck アクセス拒否** | 他の Gradle / ビルドプロセスがロック中。**すべてのターミナルで `npx expo run:android` や Gradle を止め**、必要なら `.gradle\wrapper\dists\...` 内の `.lck` を削除して再実行 |
| **downloadPrebuiltBinaries / command 'bash'** | `react-native-audio-api` が bash を必要とします。**Git for Windows**（https://git-scm.com/）をインストールし、PATH に Git の `bin` を含めてください。本プロジェクトでは `patches/` で Git Bash を自動検出するパッチを適用済み |
| **音が出ない（エミュレーター）** | エミュレーターの設定でオーディオを有効にする必要があります。下記の「音声出力について」を参照 |

## 音声出力について

### Androidエミュレーターで音が出ない場合

Androidエミュレーターでは、デフォルトでオーディオが無効になっている場合があります。以下の手順で有効にしてください：

1. **エミュレーターの設定を開く**
   - Android Studioでエミュレーターを起動
   - エミュレーターの右側にある「...」（3点メニュー）をクリック
   - 「Settings」を選択

2. **オーディオ設定を有効にする**
   - 「Audio」セクションで以下を確認：
     - 「Audio playback」にチェックを入れる
     - 「Audio input」にチェックを入れる（チューナー機能を使用する場合）
   - 「Save」をクリック

3. **エミュレーターを再起動**
   - 設定を反映するためにエミュレーターを再起動してください

4. **実機でのテストを推奨**
   - エミュレーターでの音声出力は不安定な場合があります
   - 実機でのテストを推奨します

### Web Audio APIについて

このアプリはWeb Audio APIを使用して音声を生成しています。Androidエミュレーターでは、Web Audio APIのサポートが制限されている場合があります。

## まとめ

| 手順 | 状態 |
|------|------|
| app.json に expo-dev-client 追加 | ✅ 済 |
| npx expo prebuild --platform android | ✅ 済 |
| JDK インストール & JAVA_HOME 設定 | ⏳ 要対応 |
| AVD 作成・起動 | ⏳ 要対応 |
| npx expo run:android | ⏳ 上記後に実行 |

JAVA_HOME を設定し、エミュレータを起動してから `npx expo run:android` を再実行してください。

---

**Google Play へのリリース** 手順は [RELEASE_ANDROID.md](./RELEASE_ANDROID.md) を参照してください。
