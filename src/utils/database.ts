// ローカルストレージベースのデータベース実装

export interface SavedSession {
  id: number;
  topic: string;
  participants: string; // JSON string
  messages: string; // JSON string
  model: string; // 使用AIモデル名 (例: "gemma3:1b")
  created_at: string;
  updated_at: string;
}

// ローカルストレージからセッションデータを取得
function getSessionsFromStorage(): SavedSession[] {
  try {
    const sessionsData = localStorage.getItem('dewai_sessions');
    return sessionsData ? JSON.parse(sessionsData) : [];
  } catch (error) {
    console.error('セッションデータの読み込みエラー:', error);
    return [];
  }
}

// ローカルストレージにセッションデータを保存
function saveSessionsToStorage(sessions: SavedSession[]): void {
  try {
    localStorage.setItem('dewai_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('セッションデータの保存エラー:', error);
    throw error;
  }
}

// 次のIDを生成
function getNextId(): number {
  const sessions = getSessionsFromStorage();
  return sessions.length > 0 ? Math.max(...sessions.map(s => s.id)) + 1 : 1;
}

// 議論セッションを保存
export async function saveSession(
  topic: string,
  participants: string,
  messages: string,
  model: string = 'gemma3:4b' // デフォルトモデル
): Promise<number> {
  console.log('💾 セッション保存開始:', topic);
  
  const sessions = getSessionsFromStorage();
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  const sessionId = getNextId();
  
  const newSession: SavedSession = {
    id: sessionId,
    topic,
    participants,
    messages,
    model,
    created_at: now,
    updated_at: now
  };
  
  sessions.push(newSession);
  saveSessionsToStorage(sessions);
  
  console.log('✅ セッション保存完了: ID', sessionId);
  return sessionId;
}

// 議論セッションを更新（メッセージ）
export async function updateSession(
  sessionId: number,
  messages: string
): Promise<void> {
  console.log('🔄 セッション更新開始: ID', sessionId);
  
  const sessions = getSessionsFromStorage();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);
  
  if (sessionIndex === -1) {
    throw new Error(`セッション ID ${sessionId} が見つかりません`);
  }
  
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  sessions[sessionIndex].messages = messages;
  sessions[sessionIndex].updated_at = now;
  
  saveSessionsToStorage(sessions);
  
  console.log('✅ セッション更新完了: ID', sessionId);
}

// 議論セッションの参加者情報を更新（AI情報など）
export async function updateSessionParticipants(
  sessionId: number,
  participants: string
): Promise<void> {
  console.log('🧑‍🤝‍🧑 参加者情報更新開始: ID', sessionId);

  const sessions = getSessionsFromStorage();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    throw new Error(`セッション ID ${sessionId} が見つかりません`);
  }

  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  sessions[sessionIndex].participants = participants;
  sessions[sessionIndex].updated_at = now;

  saveSessionsToStorage(sessions);

  console.log('✅ 参加者情報更新完了: ID', sessionId);
}

// 全セッション一覧を取得
export async function getAllSessions(): Promise<SavedSession[]> {
  console.log('📋 全セッション取得開始');
  
  const sessions = getSessionsFromStorage();
  // updated_at でソート（新しい順）
  sessions.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  
  console.log('✅ セッション取得完了:', sessions.length, '件');
  return sessions;
}

// 特定セッションを取得
export async function getSessionById(sessionId: number): Promise<SavedSession | null> {
  console.log('📖 セッション取得開始: ID', sessionId);
  
  const sessions = getSessionsFromStorage();
  const session = sessions.find(s => s.id === sessionId);
  
  if (session) {
    console.log('✅ セッション取得完了: ID', sessionId);
    return session;
  } else {
    console.log('⚠️ セッションが見つかりません: ID', sessionId);
    return null;
  }
}

// セッションを削除
export async function deleteSession(sessionId: number): Promise<void> {
  console.log('🗑️ セッション削除開始: ID', sessionId);
  
  const sessions = getSessionsFromStorage();
  const filteredSessions = sessions.filter(s => s.id !== sessionId);
  
  if (sessions.length === filteredSessions.length) {
    throw new Error(`セッション ID ${sessionId} が見つかりません`);
  }
  
  saveSessionsToStorage(filteredSessions);
  
  console.log('✅ セッション削除完了: ID', sessionId);
}

// データベース接続を閉じる（ローカルストレージの場合は何もしない）
export async function closeDatabase(): Promise<void> {
  console.log('🔒 データベース接続を閉じました（ローカルストレージ）');
}
