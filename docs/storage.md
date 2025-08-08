# DewAI ストレージ仕様

本書はセッション保存/復元と将来のDB移行方針を記す。

## 1. 目的
- セッションを安全かつ再現性高く保持
- 参加者編集/モデル変更の追従

## 2. 現状の実装
- 保存先: localStorage + アプリ内ユーティリティ（`src/utils/database.ts`）
- 主キー/索引: localStorage 管理（`currentSessionInfo`）

### 2.1 データ構造
- `sessions` レコード相当: { id, topic, participants, messages, model, created_at, updated_at }
- participants: JSON 文字列（新フォーマット）
```
{
  "userParticipates": boolean,
  "aiData": [
    { "name": string, "role": string, "description": string }, ...
  ]
}
```
- messages: JSON 文字列
```
[
  { "speaker": string, "message": string, "isUser": boolean, "timestamp": string }
]
```
- `aiConfig`（現在の設定）: { discussionTopic, aiData[], participate }
- `currentSessionInfo`: { sessionId, topic, timestamp }

### 2.2 ポリシー
- 同一トピックは継続上書き（新規保存は最初の1回のみ）
- `/play` 右上のAI編集は、アクティブなセッション参加者にも反映

## 3. 将来のSQLite移行
- ライブラリ: `@tauri-apps/plugin-sql`（既に依存追加済）
- 推奨スキーマ: `sessions`（id, topic, participants(json), messages(json), model, created_at, updated_at）
- マイグレーション: 既存 localStorage から初回起動時に移行
- 利点: 大容量/検索/ソート/バックアップ容易

## 4. エクスポート/インポート（将来）
- JSON エクスポート: 単一セッション/全セッション
- インポート: 互換チェック＋マージ
