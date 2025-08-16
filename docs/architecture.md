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
- モデル: gemma3:4b を既定（変更可能）

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
│ Router/Vite    │    │ Commands      │    │  gemma3:4b      │
└──────────────┘    └──────────────┘    └────────────────┘
```

- FE: `useAIModel.tsx` が Rust コマンドを呼び出し
- BE: `main.rs` が Ollama `/api/generate` 他へ HTTP 経由で接続
- 保存: SQLite（`@tauri-apps/plugin-sql`）にセッションと分析を永続化

## 4. データモデル
- セッション: { id, topic, participants(json), messages(json), model, created_at, updated_at }
  - participants(json): { userParticipates: boolean, aiData: [{ name, role, description }] }
  - messages(json): [{ speaker, message, isUser, timestamp }]
- session_analysis: { id, session_id, kind(summary|analysis|...), payload(json), created_at }
- session_meta: { session_id, last_opened_at }

SQLite スキーマの詳細は `docs/storage.md` を参照。

## 5. フロー/シーケンス（概要）

- 議論開始（/play）
  1) is_model_loaded → 未起動ならエラー通知
  2) ユーザー発言 → messagesへpush → useEffectで要約/分析の条件判定
  3) AIターン: `generateAIResponse` を順序実行（自動連鎖はガードで多重抑止）
  4) autoSaveSession（新規は作成、以後は更新）

- セッション復元（/sessions→/play）
  1) getSessionById → config/participants/messages/model を復元
  2) 最終発言者に基づき currentTurn を決定（`useTurn.ts` の算出ロジック使用）

## 6. 実装上の要点
- 要約: 初回は12発言以上でフル、以降は4件以上の差分でインクリメンタル
- 分析: 3ターン毎に実行、JSONを整形/修復（`jsonrepair`）して検証
- UI: Chakra v3のAPIに準拠（CardRoot/FieldRootなどの新API）
- モデル: FEで選択した `selectedModel` を Rust へ渡して一貫利用
- スクロール: 自動スクロールは手動操作を尊重し、復帰ボタンを提供

## 7. エラーハンドリング/タイムアウト
- Rust reqwest クライアントにタイムアウト/リトライ（指数バックオフ）
- UIは日本語の簡潔なトースト/バッジで状態を可視化

## 8. パフォーマンス最適化
- 現状: stream=false で一括応答
- 改善案: ストリーミング対応、リスト仮想化、メモ化、要約/分析のさらなる間引き

## 9. 配布/運用
- バンドル: `npm run tauri build` で Windows インストーラなどを生成
- 今後: バージョニング、CHANGELOG、自動アップデータ検討

## 10. 保守性向上のための分割（2025-08）
- `pages/play/AnalysisPanel.tsx`: 分析UIを共通化（デスクトップ/モバイル）
- `pages/play/PlayTypes.ts`: BotProfile/TalkMessage/DiscussionAnalysis 型を集約
- `pages/play/useTurn.ts`: 次ターン算出の純関数
- `pages/play.tsx`: 監視トリガ（useEffect + デバウンス）、自動連鎖ガードの導入

## 付録: 用語
- 参加者: ユーザー/AIの発話主体
- AIデータ: { name, role, description }
- 要約履歴: historySummary
- 直近ターン保持: KEEP_RECENT_TURNS
