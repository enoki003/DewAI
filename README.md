# DewAI

**手軽なAI対話アプリケーション**

DewAIは、ローカルのOllama AIモデルを使用したデスクトップチャットアプリケーションです。Tauriを使用してRustバックエンドとReactフロントエンドを組み合わせ、プライベートで高速なAI対話体験を提供します。

## 特徴

- **完全プライベート**: すべてのAI処理がローカルで実行
- **高速**: Tauriによるデスクトップアプリ
- **モダンUI**: Chakra UI v3による美しいインターフェース
- **カスタマイズ可能**: AI個性設定（名前、役割、説明）
- **リアルタイム**: 即座のAI応答とチャット履歴
- **安全な永続化**: SQLite にセッションと分析を保存（ローカルファイル）

## クイックスタート

### 前提条件

1. **Node.js** (v18以上)
2. **Rust** (最新版)
3. **Ollama** がインストールされ、`gemma3:4b`モデルがダウンロード済み

```bash
# Ollamaのインストール（未インストールの場合）
# https://ollama.ai からダウンロード

# モデルのダウンロード
ollama pull gemma3:4b

# Ollamaサーバーの起動（デフォルト: localhost:11434）
ollama serve
```

### インストールと起動

```bash
# リポジトリのクローン
git clone https://github.com/enoki003/DewAI.git
cd DewAI

# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev
```

## アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React Frontend │    │   Tauri Backend │    │   Ollama API    │
│                 │    │                 │    │                 │
│ • Chakra UI v3  │◄──►│ • Rust Commands │◄──►│ • gemma3:4b     │
│ • TypeScript    │    │ • HTTP Client   │    │ • localhost:11434│
│ • HashRouter    │    │ • JSON API      │    │ • Local Models  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
           ▲
           │
           └── SQLite (tauri-plugin-sql) にセッション/分析を永続化
```

## プロジェクト構造

```
DewAI/
├── src/                      # Reactフロントエンド
│   ├── components/
│   │   ├── EnhancedChatAPP.tsx   # 旧チャットUI（参考）
│   │   └── ui/                   # Chakra UI プロバイダー/通知
│   ├── hooks/
│   │   └── useAIModel.tsx        # AI通信・モデル管理（Ollama）
│   ├── pages/
│   │   ├── start.tsx             # スタート（導線）
│   │   ├── home.tsx              # ホーム
│   │   ├── config.tsx            # AI設定（名前/役割/説明）
│   │   ├── sessions.tsx          # セッション一覧/再開
│   │   ├── database.tsx          # DB情報表示
│   │   ├── play.tsx              # メインチャット
│   │   └── play/                 # Playページの分割モジュール（2025-08）
│   │       ├── AnalysisPanel.tsx # 議論分析の共通パネル
│   │       ├── PlayTypes.ts      # BotProfile/TalkMessage等の型
│   │       └── useTurn.ts        # 次ターン算出の純関数フック
│   ├── utils/
│   │   └── database.ts           # SQLite CRUD・スキーマ初期化
│   └── main.tsx                  # エントリ（Provider + HashRouter）
├── src-tauri/                   # Rustバックエンド
│   ├── src/
│   │   ├── main.rs              # Tauriコマンド & Ollama連携
│   │   ├── lib.rs
│   │   └── prompts.rs
│   ├── tauri.conf.json
│   └── Cargo.toml
├── docs/
│   ├── storage.md               # SQLiteスキーマ/保存仕様
│   ├── architecture.md          # システム構成/フロー
│   └── user-guide.md            # 利用ガイド
└── package.json
```

## データベースとセッション保存

- データベース: SQLite（`@tauri-apps/plugin-sql`）
- DBファイル: アプリローカル（例: `dewai.db`）
- スキーマ: `sessions`, `session_analysis`, `session_meta`（必要インデックス/PRAGMA含む）
- 振る舞い:
  - セッションの作成/更新時に自動スキーマ初期化
  - 参加者編集は `participants` JSON を更新
  - 分析や要約は `session_analysis` に保存
  - セッション削除で関連データを自動削除（FK ON DELETE CASCADE）

詳細は `docs/storage.md` を参照してください。

## 開発コマンド

```bash
# 開発モード（ホットリロード付き）
npm run dev

# 本番ビルド
npm run build

# Tauri開発モード
npm run tauri dev

# Tauri本番ビルド
npm run tauri build

# プレビュー
npm run preview

# 配布用リリースビルド
npm run build:release

# Docker開発環境の構築
npm run build:docker

# Docker開発環境の起動
npm run dev:docker

# Docker開発環境の再ビルド＆起動
npm run dev:docker-build
```

## 配布用パッケージのビルド

### Windows
```batch
build-release.bat
```

### Linux/macOS
```bash
chmod +x build-release.sh
./build-release.sh
```

### 手動ビルド
```bash
npm install
npm run build
npm run tauri build
```

生成されたパッケージは `src-tauri/target/release/bundle/` に格納されます。

## 画面ガイド

- 設定（Config）: AIの「名前・役割・説明」を設定。ユーザー参加の有無も選択。
- プレイ（Play）:
  - 下部入力欄から発言（ユーザー参加ON時）。
  - 右上「分析」ボタンで分析パネルを開閉（モバイルはオーバーレイ）。
  - ヘッダーの「AI編集」で参加者編集ドロワーを開き、AIの追加/削除/編集が可能。
  - 戻る操作時は保存完了を短時間待機するため、直近の発言が失われにくい。
- セッション（Sessions）: 過去のセッション一覧と再開。
- データベース（Database）: 保存状況の参考情報。

## 要約/分析のタイミング（実装）

- 要約（summary）
  - 初回: 発言数が12件以上でフル要約を実行
  - 以降: 直近の追加が4件以上でインクリメンタル要約
  - UI/処理は `messages` の変更に同期したデバウンス済み `useEffect` で発火
- 分析（analysis）
  - 3ターン毎（`turnCount % 3 === 0`）に実行
  - 解析結果はJSON整形/検証後に保存し、共通パネル `AnalysisPanel` で表示

## 最近の変更（2025-08）

- Playページをモジュール分割（`pages/play/`）
  - `AnalysisPanel.tsx`: 分析UIを共通化（デスクトップ/モバイルで再利用）
  - `PlayTypes.ts`: BotProfile/TalkMessage/DiscussionAnalysis 型を集約
  - `useTurn.ts`: 次ターン算出を純関数化し再利用
- トリガーの安定化
  - 要約/分析は `useEffect` + デバウンスで最新stateを基準に発火
  - 3ターン毎の分析で重複起動を防止（最後に分析したターンを保持）
- レース条件対策
  - AI自動連鎖時の多重実行を抑止するガードを導入
- スクロール体験
  - 最下部検知で「↓ 新しいメッセージを表示する」ボタンを表示
  - 自動スクロールはユーザーの手動スクロールを尊重

## 技術スタック

### フロントエンド
- **React 18**
- **TypeScript**
- **Chakra UI v3**（HashRouter, Provider 構成）
- **React Router (HashRouter)**
- **Vite**

### バックエンド
- **Rust / Tauri**
- **reqwest**（Ollama HTTP クライアント）
- **tokio**
- **@tauri-apps/plugin-sql (SQLite)** ← 追加

### AI統合
- **Ollama**（localhost:11434）
- **gemma3:4b**（デフォルトモデル）

## 使用方法

1. アプリ起動後、「新しく開始」するをクリックしAIの設定をする
2. 「議論を開始する」をクリックで議論を開始
3. 必要に応じて「分析」を開き、論点/立場/対立/共通認識を確認
4. 参加者を変更する場合は「AI編集」から保存
5. 「続きから開始する」で過去の議論を再開可能

## プライバシー

- すべてのAI処理はローカルで実行
- インターネット接続は不要（Ollamaモデル使用時）
- チャット履歴はSQLiteにローカル保存
- 外部サーバーにデータ送信なし

## 謝辞

- [Tauri](https://tauri.app/)
- [Ollama](https://ollama.ai/)
- [Chakra UI](https://chakra-ui.com/)

## 推奨IDE設定

- [VS Code](https://code.visualstudio.com/) + [Tauri 拡張](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
