# DewAI ストレージ仕様

本書はセッション保存/復元とDB仕様を記す。

## 1. 目的
- セッションを安全かつ再現性高く保持
- 参加者編集/モデル変更の追従

## 2. 現状の実装（SQLite）
- 保存先: SQLite (`@tauri-apps/plugin-sql`) ローカルファイル `dewai.db`
- 初期化: アプリ実行中に `src/utils/database.ts` の ensureSchema() が PRAGMA/テーブル/インデックスを作成

### 2.1 スキーマ
- sessions: { id INTEGER PK, topic TEXT, participants TEXT(JSON), messages TEXT(JSON), model TEXT, created_at TEXT, updated_at TEXT }
- session_analysis: { id INTEGER PK, session_id INTEGER FK -> sessions(id) ON DELETE CASCADE, kind TEXT, payload TEXT, created_at TEXT }
- session_meta: { session_id INTEGER PK, last_opened_at TEXT }

PRAGMA: foreign_keys=ON, journal_mode=WAL

索引:
- idx_sessions_updated_at(updated_at)
- idx_session_meta_last_opened(last_opened_at)
- idx_session_analysis_session_created(session_id, created_at)

### 2.2 データ構造例
- participants(JSON)
```
{
  "userParticipates": boolean,
  "aiData": [
    { "name": string, "role": string, "description": string }, ...
  ]
}
```
- messages(JSON)
```
[
  { "speaker": string, "message": string, "isUser": boolean, "timestamp": string }
]
```

## 3. ポリシー
- 同一トピックは継続上書き（新規保存は最初の1回のみ）
- `/play` のAI編集は、アクティブセッション参加者にも反映

## 4. エクスポート/インポート（将来）
- JSONエクスポート: 単一/全セッション
- インポート: 互換チェック＋マージ
