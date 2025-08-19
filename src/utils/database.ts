/**
 * @packageDocumentation
 * データベース操作ユーティリティ。
 * 
 * DewAI で使用するSQLiteデータベースの操作を提供します。
 * - セッション管理（保存・更新・削除・取得）
 * - 分析結果の保存・取得
 * - メタデータ管理（最終オープン時刻など）
 * - スキーマ初期化とインデックス管理
 */
import Database from '@tauri-apps/plugin-sql'

/**
 * 保存されたセッションのデータ構造。
 * 議論の全データを格納するメインテーブルのレコード。
 */
export interface SavedSession {
  /** セッションの一意ID */
  id: number;
  /** 議論のテーマ */
  topic: string;
  /** 参加者情報（JSON文字列） */
  participants: string; // JSON string
  /** メッセージ履歴（JSON文字列） */
  messages: string; // JSON string
  /** 使用AIモデル名（例: "gemma3:1b"） */
  model: string;
  /** 作成日時（ISO文字列） */
  created_at: string;
  /** 更新日時（ISO文字列） */
  updated_at: string;
}

/**
 * セッション分析結果のデータ構造。
 * AI生成による議論分析情報を格納するテーブルのレコード。
 */
export interface SessionAnalysisRow {
  /** 分析レコードの一意ID */
  id: number;
  /** 関連するセッションID */
  session_id: number;
  /** 分析の種類（'analysis' | 'summary' | 'light' など） */
  kind: string;
  /** 分析結果データ（JSON文字列） */
  payload: string;
  /** 作成日時（ISO文字列） */
  created_at: string;
}

/** データベース接続インスタンス */
let db: Database | null = null;
/** メタテーブル初期化フラグ */
let metaInitialized = false;
/** 全体スキーマ初期化フラグ */
let schemaInitialized = false;

/**
 * データベース接続を取得または作成します。
 * @returns Database インスタンス
 */
function getDb(): Database {
  if (!db) db = Database.get('sqlite:dewai.db');
  return db;
}

/**
 * データベーススキーマを初期化します。
 * - PRAGMA設定（外部キー制約、WALモード）
 * - テーブル作成（sessions, session_analysis, session_meta）
 * - インデックス作成（パフォーマンス向上）
 * 
 * 初回のみ実行され、以降は高速に処理をスキップします。
 */
async function ensureSchema() {
  if (schemaInitialized) return;
  const conn = getDb();

  // PRAGMA 設定
  await conn.execute('PRAGMA foreign_keys = ON');
  await conn.execute('PRAGMA journal_mode = WAL');

  // メインテーブル
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS sessions (\
      id INTEGER PRIMARY KEY,\
      topic TEXT NOT NULL,\
      participants TEXT NOT NULL,\
      messages TEXT NOT NULL,\
      model TEXT NOT NULL,\
      created_at TEXT NOT NULL,\
      updated_at TEXT NOT NULL\
    )'
  );

  // 解析結果テーブル（外部キー付き）
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS session_analysis (\
      id INTEGER PRIMARY KEY,\
      session_id INTEGER NOT NULL,\
      kind TEXT NOT NULL,\
      payload TEXT NOT NULL,\
      created_at TEXT NOT NULL,\
      FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE\
    )'
  );

  // メタテーブル（既存ロジック維持）
  await ensureSessionMetaTable();

  // インデックス
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_session_meta_last_opened ON session_meta(last_opened_at)');
  await conn.execute('CREATE INDEX IF NOT EXISTS idx_session_analysis_session_created ON session_analysis(session_id, created_at)');

  schemaInitialized = true;
}

/**
 * セッションメタテーブルを確実に初期化します。
 * 最後に開いた時刻を管理するためのテーブルです。
 */
async function ensureSessionMetaTable() {
  if (metaInitialized) return;
  const conn = getDb();
  // セッションの「最近開いた」時刻を管理するメタテーブル
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS session_meta (session_id INTEGER PRIMARY KEY, last_opened_at TEXT NOT NULL)'
  );
  metaInitialized = true;
}

/**
 * セッションの最終オープン時刻を更新します。
 * セッション一覧での「最近開いた順」ソートに使用されます。
 * 
 * @param sessionId 更新対象のセッションID
 */
export async function updateSessionLastOpened(sessionId: number): Promise<void> {
  await ensureSchema();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'INSERT INTO session_meta (session_id, last_opened_at) VALUES ($1, $2) ON CONFLICT(session_id) DO UPDATE SET last_opened_at = excluded.last_opened_at',
    [sessionId, now]
  );
}

/**
 * 新しい議論セッションを保存します。
 * 
 * @param topic 議論のテーマ
 * @param participants 参加者情報（JSON文字列）
 * @param messages メッセージ履歴（JSON文字列）
 * @param model 使用AIモデル名（既定: "gemma3:4b"）
 * @returns 新規作成されたセッションID
 */
export async function saveSession(
  topic: string,
  participants: string,
  messages: string,
  model: string = 'gemma3:4b'
): Promise<number> {
  await ensureSchema();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const result = await conn.execute(
    'INSERT INTO sessions (topic, participants, messages, model, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)',
    [topic, participants, messages, model, now, now]
  );
  const newId = result.lastInsertId ?? 0;

  // 新規作成直後は「最近開いた」にも反映
  if (newId > 0) {
    await updateSessionLastOpened(newId);
  }
  return newId;
}

/**
 * 既存セッションのメッセージ履歴を更新します。
 * 
 * @param sessionId 更新対象のセッションID
 * @param messages 新しいメッセージ履歴（JSON文字列）
 */
export async function updateSession(sessionId: number, messages: string): Promise<void> {
  await ensureSchema();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'UPDATE sessions SET messages = $1, updated_at = $2 WHERE id = $3',
    [messages, now, sessionId]
  );
}

/**
 * 既存セッションの参加者情報を更新します。
 * 
 * @param sessionId 更新対象のセッションID
 * @param participants 新しい参加者情報（JSON文字列）
 */
export async function updateSessionParticipants(sessionId: number, participants: string): Promise<void> {
  await ensureSchema();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'UPDATE sessions SET participants = $1, updated_at = $2 WHERE id = $3',
    [participants, now, sessionId]
  );
}

/**
 * 全セッションを取得します。
 * 最近開いた順 → 更新日時降順でソートされます。
 * 
 * @returns セッション配列（空の場合は空配列）
 */
export async function getAllSessions(): Promise<SavedSession[]> {
  try {
    await ensureSchema();
    const conn = getDb();
    const rows = await conn.select<SavedSession[]>(
      'SELECT s.id, s.topic, s.participants, s.messages, s.model, s.created_at, s.updated_at \
       FROM sessions s \
       LEFT JOIN session_meta m ON m.session_id = s.id \
       ORDER BY datetime(COALESCE(m.last_opened_at, s.updated_at)) DESC'
    );
    return rows ?? [];
  } catch (e) {
    // DBが未初期化/空などのケースでは空配列でスルー
    console.warn('[db] getAllSessions: 空/未初期化として扱います:', e);
    return [];
  }
}

/**
 * 指定されたIDのセッションを取得します。
 * 
 * @param sessionId 取得対象のセッションID
 * @returns セッションデータ（存在しない場合はnull）
 */
export async function getSessionById(sessionId: number): Promise<SavedSession | null> {
  await ensureSchema();
  const conn = getDb();
  const rows = await conn.select<SavedSession[]>(
    'SELECT id, topic, participants, messages, model, created_at, updated_at FROM sessions WHERE id = $1',
    [sessionId]
  );
  return rows?.[0] ?? null;
}

/**
 * 指定されたセッションを削除します。
 * 関連する分析データ・メタデータも含めて削除されます。
 * 
 * @param sessionId 削除対象のセッションID
 */
export async function deleteSession(sessionId: number): Promise<void> {
  await ensureSchema();
  const conn = getDb();
  // 念のため明示的に子テーブルとメタを削除（外部キーON/CASCADEでも冪等）
  await conn.execute('DELETE FROM session_analysis WHERE session_id = $1', [sessionId]);
  await conn.execute('DELETE FROM session_meta WHERE session_id = $1', [sessionId]);
  await conn.execute('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

/**
 * データベース接続を適切に閉じます。
 * アプリケーション終了時に呼び出してください。
 */
export async function closeDatabase(): Promise<void> {
  const conn = getDb();
  await conn.close();
}

/**
 * セッションの分析結果を保存します。
 * 
 * @param sessionId 関連するセッションID
 * @param kind 分析の種類（'analysis' | 'summary' | 'light' など）
 * @param payload 分析結果データ（JSON文字列）
 * @returns 新規作成された分析レコードID
 */
export async function saveSessionAnalysis(
  sessionId: number,
  kind: string,
  payload: string
): Promise<number> {
  await ensureSchema();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const result = await conn.execute(
    'INSERT INTO session_analysis (session_id, kind, payload, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, kind, payload, now]
  );
  return result.lastInsertId ?? 0;
}

/**
 * セッションの分析結果を取得します。
 * 最新の分析結果から順番に返されます。
 * 
 * @param sessionId 対象セッションID
 * @param kind 取得する分析の種類（指定しない場合は全種類）
 * @param limit 取得件数の上限（既定: 10件）
 * @returns 分析結果の配列
 */
export async function getSessionAnalysis(
  sessionId: number,
  kind?: string,
  limit: number = 10
): Promise<SessionAnalysisRow[]> {
  await ensureSchema();
  const conn = getDb();
  if (kind) {
    const rows = await conn.select<SessionAnalysisRow[]>(
      'SELECT id, session_id, kind, payload, created_at FROM session_analysis WHERE session_id = $1 AND kind = $2 ORDER BY datetime(created_at) DESC LIMIT $3',
      [sessionId, kind, limit]
    );
    return rows ?? [];
  } else {
    const rows = await conn.select<SessionAnalysisRow[]>(
      'SELECT id, session_id, kind, payload, created_at FROM session_analysis WHERE session_id = $1 ORDER BY datetime(created_at) DESC LIMIT $2',
      [sessionId, limit]
    );
    return rows ?? [];
  }
}
