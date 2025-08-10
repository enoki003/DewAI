import Database from '@tauri-apps/plugin-sql'

export interface SavedSession {
  id: number;
  topic: string;
  participants: string; // JSON string
  messages: string; // JSON string
  model: string; // 使用AIモデル名 (例: "gemma3:1b")
  created_at: string;
  updated_at: string;
}

export interface SessionAnalysisRow {
  id: number;
  session_id: number;
  kind: string; // 'analysis' | 'summary' | 'light' など
  payload: string; // JSON string
  created_at: string;
}

let db: Database | null = null;
let metaInitialized = false;

function getDb(): Database {
  if (!db) db = Database.get('sqlite:dewai.db');
  return db;
}

async function ensureSessionMetaTable() {
  if (metaInitialized) return;
  const conn = getDb();
  // セッションの「最近開いた」時刻を管理するメタテーブル
  await conn.execute(
    'CREATE TABLE IF NOT EXISTS session_meta (session_id INTEGER PRIMARY KEY, last_opened_at TEXT NOT NULL)'
  );
  metaInitialized = true;
}

// セッションの「最終オープン時刻」を更新（存在しなければ作成）
export async function updateSessionLastOpened(sessionId: number): Promise<void> {
  await ensureSessionMetaTable();
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'INSERT INTO session_meta (session_id, last_opened_at) VALUES ($1, $2) ON CONFLICT(session_id) DO UPDATE SET last_opened_at = excluded.last_opened_at',
    [sessionId, now]
  );
}

// 議論セッションを保存（新規）
export async function saveSession(
  topic: string,
  participants: string,
  messages: string,
  model: string = 'gemma3:4b'
): Promise<number> {
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

// メッセージ更新
export async function updateSession(sessionId: number, messages: string): Promise<void> {
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'UPDATE sessions SET messages = $1, updated_at = $2 WHERE id = $3',
    [messages, now, sessionId]
  );
}

// 参加者情報更新
export async function updateSessionParticipants(sessionId: number, participants: string): Promise<void> {
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  await conn.execute(
    'UPDATE sessions SET participants = $1, updated_at = $2 WHERE id = $3',
    [participants, now, sessionId]
  );
}

// 全セッション取得（最近開いた順 → なければ更新日時降順）
export async function getAllSessions(): Promise<SavedSession[]> {
  await ensureSessionMetaTable();
  const conn = getDb();
  const rows = await conn.select<SavedSession[]>(
    'SELECT s.id, s.topic, s.participants, s.messages, s.model, s.created_at, s.updated_at \
     FROM sessions s \
     LEFT JOIN session_meta m ON m.session_id = s.id \
     ORDER BY datetime(COALESCE(m.last_opened_at, s.updated_at)) DESC'
  );
  return rows ?? [];
}

// ID指定取得
export async function getSessionById(sessionId: number): Promise<SavedSession | null> {
  const conn = getDb();
  const rows = await conn.select<SavedSession[]>(
    'SELECT id, topic, participants, messages, model, created_at, updated_at FROM sessions WHERE id = $1',
    [sessionId]
  );
  return rows?.[0] ?? null;
}

// 削除
export async function deleteSession(sessionId: number): Promise<void> {
  const conn = getDb();
  await conn.execute('DELETE FROM sessions WHERE id = $1', [sessionId]);
  await ensureSessionMetaTable();
  await conn.execute('DELETE FROM session_meta WHERE session_id = $1', [sessionId]);
}

// DBクローズ
export async function closeDatabase(): Promise<void> {
  const conn = getDb();
  await conn.close();
}

// 解析結果の保存
export async function saveSessionAnalysis(
  sessionId: number,
  kind: string,
  payload: string
): Promise<number> {
  const conn = getDb();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const result = await conn.execute(
    'INSERT INTO session_analysis (session_id, kind, payload, created_at) VALUES ($1, $2, $3, $4)',
    [sessionId, kind, payload, now]
  );
  return result.lastInsertId ?? 0;
}

// 解析結果の取得（最新から）
export async function getSessionAnalysis(
  sessionId: number,
  kind?: string,
  limit: number = 10
): Promise<SessionAnalysisRow[]> {
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
