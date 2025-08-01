# DewAI

**軽量で手軽なAI対話アプリケーション**

DewAIは、ローカルのOllama AIモデルを使用したデスクトップチャットアプリケーションです。Tauriを使用してRustバックエンドとReactフロントエンドを組み合わせ、プライベートで高速なAI対話体験を提供します。

## 特徴

- **完全プライベート**: すべてのAI処理がローカルで実行
- **高速**: Tauriによる軽量なデスクトップアプリ
- **モダンUI**: Chakra UI v3による美しいインターフェース
- **カスタマイズ可能**: AI個性設定（名前、役割、説明）
- **リアルタイム**: 即座のAI応答とチャット履歴

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

# Ollamaサーバーの起動
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
│ • Router        │    │ • JSON API      │    │ • Local Models  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## プロジェクト構造

```
DewAI/
├── src/                      # Reactフロントエンド
│   ├── components/           # UIコンポーネント
│   │   ├── EnhancedChatAPP.tsx  # メインチャット画面
│   │   └── ui/              # Chakra UIプロバイダー
│   ├── hooks/               # カスタムフック
│   │   └── useAIModel.tsx   # AI通信とモデル管理
│   ├── pages/               # ページコンポーネント
│   │   ├── home.tsx         # ホーム画面
│   │   ├── config.tsx       # AI設定画面
│   │   └── play.tsx         # チャット画面
│   └── main.tsx             # アプリエントリーポイント
├── src-tauri/               # Rustバックエンド
│   ├── src/
│   │   └── main.rs          # Tauriコマンドとオラマ通信
│   ├── Cargo.toml           # Rust依存関係
│   └── tauri.conf.json      # Tauri設定
└── package.json             # Node.js依存関係
```

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
```

## 技術スタック

### フロントエンド
- **React 18** - UIライブラリ
- **TypeScript** - 型安全性
- **Chakra UI v3** - コンポーネントライブラリ
- **React Router** - ルーティング（HashRouter使用）
- **Vite** - ビルドツール

### バックエンド
- **Rust** - システムプログラミング言語
- **Tauri** - デスクトップアプリフレームワーク
- **reqwest** - HTTP クライアント
- **tokio** - 非同期ランタイム

### AI統合
- **Ollama** - ローカルLLMサーバー
- **gemma3:4b** - デフォルトAIモデル

## 使用方法

1. **ホーム画面**: 「始める」ボタンでアプリを開始
2. **設定画面**: AI の個性を設定（名前、役割、説明文）
3. **チャット画面**: AI との対話を開始

## プライバシー

- すべてのAI処理はローカルで実行
- インターネット接続は不要（Ollamaモデル使用時）
- チャット履歴はローカルに保存
- 外部サーバーにデータ送信なし

## コントリビューション

1. このリポジトリをフォーク
2. 機能ブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

This project is licensed under the ISC License.

## 謝辞

- [Tauri](https://tauri.app/) - 素晴らしいデスクトップアプリフレームワーク
- [Ollama](https://ollama.ai/) - ローカルLLM実行環境
- [Chakra UI](https://chakra-ui.com/) - 美しいReactコンポーネント

## 推奨IDE設定

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
