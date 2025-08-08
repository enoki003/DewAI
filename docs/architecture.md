# DewAI アーキテクチャ

本書は技術概要、構成図、データフロー、設計上の判断を記載します。

## 1. 背景と目的
- 完全ローカル/プライバシー重視でAI議論体験を提供
- 軽量クロスプラットフォーム（Tauri）とモダンUI（React/Chakra）
- 学習/議論/ブレストの生産性向上

## 2. 要件定義

### 2.1 機能要件（ユースケース抜粋）
- 設定: テーマとAI参加者（名前/役割/説明）の作成・編集
- 議論: ユーザー/AI のターン進行、要約、分析
- セッション: 自動保存、同一トピックの継続上書き、一覧/再開/削除
- モデル: gemma3:1b/4b の選択

### 2.2 非機能要件
- パフォーマンス: 体感待ち時間を最小化（将来ストリーミング対応）
- 可用性: Ollama 未起動時は明確なエラー提示
- プライバシー: 外部送信なし、ローカル保存
- 保守性: FE/BE 分離、型安全、UIコンポーネントの統一

## 3. 全体構成

```
┌──────────────┐    ┌──────────────┐    ┌────────────────┐
│ React + Chakra │    │  Tauri (Rust) │    │   Ollama API   │
│ TypeScript     │◄──►│ reqwest       │◄──►│  localhost:11434│
│ Router/Vite    │    │ Commands      │    │  gemma3:1b/4b   │
└──────────────┘    └──────────────┘    └────────────────┘
```

- FE: `useAIModel.tsx` が Rust コマンドを呼び出し
- BE: `main.rs` が Ollama `/api/generate` へ HTTP 経由で接続
- 保存: 現状は localStorage + JSON（将来 SQLite へ移行予定）

## 4. データモデル（現状）
- セッション: { id, topic, participants(json), messages(json), model, created_at, updated_at }
  - participants(json): { userParticipates: boolean, aiData: [{ name, role, description }] }
  - messages(json): [{ speaker, message, isUser, timestamp }]
- localStorage: `aiConfig`, `currentSessionInfo`

（将来案）SQLite スキーマ
```
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  topic TEXT NOT NULL,
  participants TEXT NOT NULL, -- JSON
  messages TEXT NOT NULL,     -- JSON
  model TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## 5. フロー/シーケンス（概要）

- 議論開始（/play）
  1) is_model_loaded → 未起動ならダイアログ
  2) ユーザー発言 → messagesへpush → 要約/分析チェック
  3) AIターン: 各AIについて generate_ai_response(model=selectedModel) を順序実行
  4) 終了時 autoSaveSession（新規は作成、以後は更新）

- セッション復元（/sessions→/play）
  1) getSessionById → config/participants/messages/model を復元
  2) 最終発言者に基づき currentTurn を決定

## 6. 実装上の要点
- 要約: 4ターンごとに過去を圧縮し直近のみ保持
- 分析: 3ターンごとに実行、JSON整形/検証
- UI: Chakra v3のDialog/Checkbox APIに準拠
- モデル: FEで選択した `selectedModel` を Rust へ渡して一貫利用

## 7. エラーハンドリング/タイムアウト（改善済）
- Rust reqwest クライアントに 10s タイムアウトを設定
- `/api/generate` 呼び出しは最大3回の指数バックオフリトライ
- ユーザー向けには日本語の簡潔なエラーに正規化

## 8. パフォーマンス最適化（課題と改善案）
- 現状: stream=false で一括応答
- 改善案: ストリーミング対応、要約/分析の間引き、モデルprewarm

## 9. 配布/運用
- バンドル: `npm run tauri build` で Windows インストーラ生成
- 今後: バージョニング(SemVer), CHANGELOG, 自動アップデータ検討

## 10. セキュリティ/プライバシー
- 完全ローカル、外部送信なし
- ログ: プロンプトの一部マスキング実装

## 付録: 用語
- 参加者: ユーザー/AIの発話主体
- AIデータ: { name, role, description }
- 要約履歴: summarizedHistory
- 直近ターン: RECENT_TURNS_TO_KEEP
