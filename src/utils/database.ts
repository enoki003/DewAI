import Database from '@tauri-apps/plugin-sql';

// データベース接続の管理
let db: Database | null = null;

export interface SavedSession {
  id: number;
  topic: string;
  participants: string; // JSON string
  messages: string; // JSON string
  created_at: string;
  updated_at: string;
}

// データベース接続を取得
async function getDatabase(): Promise<Database> {
  if (!db) {
    console.log('💾 SQLiteデータベース接続開始...');
    db = await Database.load('sqlite:data.db');
    console.log('✅ SQLiteデータベース接続完了');
  }
  return db;
}

// 議論セッションを保存
export async function saveSession(
  topic: string,
  participants: string,
  messages: string
): Promise<number> {
  console.log('💾 セッション保存開始:', topic);
  
  const database = await getDatabase();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  const result = await database.execute(
    'INSERT INTO discussion_sessions (topic, participants, messages, created_at, updated_at) VALUES ($1, $2, $3, $4, $5)',
    [topic, participants, messages, now, now]
  );
  
  const sessionId = result.lastInsertId;
  if (sessionId === undefined) {
    throw new Error('セッション保存に失敗しました: IDが取得できませんでした');
  }
  console.log('✅ セッション保存完了: ID', sessionId);
  return sessionId;
}

// 議論セッションを更新
export async function updateSession(
  sessionId: number,
  messages: string
): Promise<void> {
  console.log('🔄 セッション更新開始: ID', sessionId);
  
  const database = await getDatabase();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  
  await database.execute(
    'UPDATE discussion_sessions SET messages = $1, updated_at = $2 WHERE id = $3',
    [messages, now, sessionId]
  );
  
  console.log('✅ セッション更新完了: ID', sessionId);
}

// 全セッション一覧を取得
export async function getAllSessions(): Promise<SavedSession[]> {
  console.log('📋 全セッション取得開始');
  
  const database = await getDatabase();
  const result = await database.select<SavedSession[]>(
    'SELECT id, topic, participants, messages, created_at, updated_at FROM discussion_sessions ORDER BY updated_at DESC'
  );
  
  console.log('✅ セッション取得完了:', result.length, '件');
  return result;
}

// 特定セッションを取得
export async function getSessionById(sessionId: number): Promise<SavedSession | null> {
  console.log('📖 セッション取得開始: ID', sessionId);
  
  const database = await getDatabase();
  const result = await database.select<SavedSession[]>(
    'SELECT id, topic, participants, messages, created_at, updated_at FROM discussion_sessions WHERE id = $1',
    [sessionId]
  );
  
  if (result.length > 0) {
    console.log('✅ セッション取得完了: ID', sessionId);
    return result[0];
  } else {
    console.log('⚠️ セッションが見つかりません: ID', sessionId);
    return null;
  }
}

// セッションを削除
export async function deleteSession(sessionId: number): Promise<void> {
  console.log('🗑️ セッション削除開始: ID', sessionId);
  
  const database = await getDatabase();
  await database.execute(
    'DELETE FROM discussion_sessions WHERE id = $1',
    [sessionId]
  );
  
  console.log('✅ セッション削除完了: ID', sessionId);
}

// データベース接続を閉じる
export async function closeDatabase(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    console.log('🔒 データベース接続を閉じました');
  }
}
