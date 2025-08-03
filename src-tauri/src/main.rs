#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::command;
use reqwest::Client;
use serde_json::json;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::collections::HashMap;
use chrono;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SavedSession {
    pub id: i64,
    pub topic: String,
    pub participants: String, // JSON string
    pub messages: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewSession {
    pub topic: String,
    pub participants: String,
    pub messages: String,
}

// セッションストレージの管理
#[derive(Debug, Serialize, Deserialize, Default)]
struct SessionStorage {
    sessions: HashMap<i64, SavedSession>,
    next_id: i64,
}

// グローバル状態
struct AppState {
    storage: Mutex<SessionStorage>,
    data_file: PathBuf,
}

// モデルロード状態チェック（とりあえずOllamaが起きてるか）
#[command]
async fn is_model_loaded() -> bool {
    println!("🕵️ モデルロード状態確認中...");
    match reqwest::get("http://localhost:11434").await {
        Ok(_) => {
            println!("✅ Ollama 応答あり。モデル起動可能。");
            true
        },
        Err(e) => {
            println!("❌ Ollama からの応答なし: {}", e);
            false
        },
    }
}

// テキスト生成
#[command]
async fn generate_text(prompt: String) -> Result<String, String> {
    println!("🧠 generate_text 呼び出し: prompt = {}", prompt);

    let client = Client::new();
    let body = json!({
        "model": "gemma3:4b",
        // "model": "yuiseki/sarashina2.2:1b", 
        "prompt": prompt,
        "stream": false
    });

    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("❌ リクエスト失敗: {}", e))?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| format!("❌ JSONパース失敗: {}", e))?;

    if let Some(resp) = json["response"].as_str() {
        println!("📦 応答取得成功");
        Ok(resp.to_string())
    } else {
        println!("⚠️ 応答フィールドなし: {:?}", json);
        Err("応答なし".into())
    }
}

// AI応答生成（XMLフォーマットプロンプト＋generate_text）
#[command]
async fn generate_ai_response(
    participant_name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
) -> Result<String, String> {
    println!("🤖 generate_ai_response 呼び出し: participant_name={}, role={}, description={}, conversation_history={}, discussion_topic={}", 
        participant_name, role, description, conversation_history, discussion_topic);
    
    let xml_prompt = prompts::build_ai_response_prompt(
        &participant_name,
        &role,
        &description,
        &conversation_history,
        &discussion_topic,
    );

    generate_text(xml_prompt).await
}

// 議論開始のためのファシリテート
#[command]
async fn start_discussion(
    topic: String,
    participants: Vec<String>, // AI名のリスト
) -> Result<String, String> {
    println!("🎯 start_discussion 呼び出し: {}", topic);
    
    let xml_prompt = prompts::build_discussion_start_prompt(&topic, &participants);

    generate_text(xml_prompt).await
}

// 議論分析エンジン - 論点と立場をリアルタイム分析
#[command]
async fn analyze_discussion_points(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
) -> Result<String, String> {
    println!("🔍 analyze_discussion_points 呼び出し");
    
    let xml_prompt = prompts::build_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );

    generate_text(xml_prompt).await
}

// 軽量な議論分析エンジン - 直近の発言のみを対象とした高速分析
#[command]
async fn analyze_recent_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
) -> Result<String, String> {
    println!("🔍 analyze_recent_discussion 呼び出し（軽量版）");
    
    let xml_prompt = prompts::build_lightweight_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );

    generate_text(xml_prompt).await
}

// 議論要約エンジン
#[command]
async fn summarize_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>, // 参加者名のリスト
) -> Result<String, String> {
    println!("📝 summarize_discussion 呼び出し");
    
    let xml_prompt = prompts::build_discussion_summary_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );

    generate_text(xml_prompt).await
}

// データベース関連のコマンド（本格ファイルベース実装）

// セッションストレージのヘルパー関数
impl AppState {
    fn load_storage(&self) -> SessionStorage {
        if self.data_file.exists() {
            match fs::read_to_string(&self.data_file) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => SessionStorage::default(),
            }
        } else {
            SessionStorage::default()
        }
    }

    fn save_storage(&self, storage: &SessionStorage) -> Result<(), String> {
        let content = serde_json::to_string_pretty(storage)
            .map_err(|e| format!("シリアライゼーションエラー: {}", e))?;
        
        if let Some(parent) = self.data_file.parent() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("ディレクトリ作成エラー: {}", e))?;
        }
        
        fs::write(&self.data_file, content)
            .map_err(|e| format!("ファイル書き込みエラー: {}", e))?;
        
        Ok(())
    }
}

// 議論セッションを保存または更新（スマート保存）
#[command]
async fn save_or_update_discussion_session(
    state: tauri::State<'_, AppState>,
    session_id: Option<i64>, // None = 新規, Some(id) = 更新
    topic: String,
    participants: String,
    messages: String,
) -> Result<i64, String> {
    println!("💾 議論セッション保存/更新開始: {}", topic);
    println!("📊 データ詳細 - セッションID: {:?}, 参加者: {}, メッセージ数: {}", session_id, participants, messages.len());
    
    let mut storage_lock = state.storage.lock().unwrap();
    let mut storage = state.load_storage();
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let final_session_id = match session_id {
        // 既存セッションの更新
        Some(id) => {
            if let Some(existing_session) = storage.sessions.get_mut(&id) {
                existing_session.topic = topic;
                existing_session.participants = participants;
                existing_session.messages = messages;
                existing_session.updated_at = now;
                println!("🔄 既存セッション更新: ID {}", id);
                id
            } else {
                return Err(format!("更新対象のセッションが見つかりません: ID {}", id));
            }
        }
        // 新規セッション作成
        None => {
            storage.next_id += 1;
            let new_id = storage.next_id;
            
            let session = SavedSession {
                id: new_id,
                topic,
                participants,
                messages,
                created_at: now.clone(),
                updated_at: now,
            };
            
            storage.sessions.insert(new_id, session);
            println!("🆕 新規セッション作成: ID {}", new_id);
            new_id
        }
    };
    
    match state.save_storage(&storage) {
        Ok(_) => {
            *storage_lock = storage;
            println!("✅ セッション保存完了: ID {}", final_session_id);
            Ok(final_session_id)
        }
        Err(e) => {
            println!("❌ セッション保存失敗: {}", e);
            Err(e)
        }
    }
}

// 議論セッションを保存（従来版・下位互換のため残す）
#[command]
async fn save_discussion_session(
    state: tauri::State<'_, AppState>,
    topic: String,
    participants: String,
    messages: String,
) -> Result<i64, String> {
    println!("💾 議論セッション保存開始: {}", topic);
    println!("📊 保存データ詳細 - 参加者: {}, メッセージ数: {}", participants, messages.len());
    
    let mut storage_lock = state.storage.lock().unwrap();
    let mut storage = state.load_storage();
    
    storage.next_id += 1;
    let session_id = storage.next_id;
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let session = SavedSession {
        id: session_id,
        topic,
        participants,
        messages,
        created_at: now.clone(),
        updated_at: now,
    };
    
    storage.sessions.insert(session_id, session);
    
    match state.save_storage(&storage) {
        Ok(_) => {
            *storage_lock = storage;
            println!("✅ セッション保存完了: ID {}", session_id);
            Ok(session_id)
        }
        Err(e) => {
            println!("❌ セッション保存失敗: {}", e);
            Err(e)
        }
    }
}

// 同じトピック・参加者の既存セッションを検索
#[command]
async fn find_existing_session(
    state: tauri::State<'_, AppState>,
    topic: String,
    participants: String,
) -> Result<Option<SavedSession>, String> {
    println!("🔍 既存セッション検索: topic={}, participants={}", topic, participants);
    
    let storage = state.load_storage();
    
    // 同じトピックと参加者の組み合わせを探す
    for session in storage.sessions.values() {
        if session.topic == topic && session.participants == participants {
            println!("✅ 既存セッション発見: ID {}", session.id);
            return Ok(Some(session.clone()));
        }
    }
    
    println!("❌ 既存セッションなし");
    Ok(None)
}

// 保存された議論セッションの一覧を取得
#[command]
async fn get_saved_sessions(state: tauri::State<'_, AppState>) -> Result<Vec<SavedSession>, String> {
    println!("📚 保存済みセッション一覧取得");
    
    let storage = state.load_storage();
    let mut sessions: Vec<SavedSession> = storage.sessions.values().cloned().collect();
    
    // 更新日時でソート（新しい順）
    sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    
    println!("✅ セッション一覧取得完了: {}件", sessions.len());
    Ok(sessions)
}

// 特定のセッションを取得
#[command]
async fn get_session_by_id(state: tauri::State<'_, AppState>, session_id: i64) -> Result<SavedSession, String> {
    println!("📖 セッション取得: ID {}", session_id);
    
    let storage = state.load_storage();
    
    if let Some(session) = storage.sessions.get(&session_id) {
        println!("✅ セッション取得完了: {}", session.topic);
        Ok(session.clone())
    } else {
        Err(format!("セッションが見つかりません: ID {}", session_id))
    }
}

// セッションを更新（会話を継続した場合）
#[command]
async fn update_discussion_session(
    state: tauri::State<'_, AppState>,
    session_id: i64,
    messages: String,
) -> Result<(), String> {
    println!("📝 セッション更新開始: ID {}", session_id);
    println!("📊 更新データ詳細 - メッセージ数: {}", messages.len());
    
    let mut storage_lock = state.storage.lock().unwrap();
    let mut storage = state.load_storage();
    
    if let Some(session) = storage.sessions.get_mut(&session_id) {
        session.messages = messages;
        session.updated_at = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
        
        match state.save_storage(&storage) {
            Ok(_) => {
                *storage_lock = storage;
                println!("✅ セッション更新完了: ID {}", session_id);
                Ok(())
            }
            Err(e) => {
                println!("❌ セッション更新失敗: {}", e);
                Err(e)
            }
        }
    } else {
        let error_msg = format!("更新するセッションが見つかりません: ID {}", session_id);
        println!("❌ {}", error_msg);
        Err(error_msg)
    }
}

// セッションを削除
#[command]
async fn delete_session(state: tauri::State<'_, AppState>, session_id: i64) -> Result<(), String> {
    println!("🗑️ セッション削除: ID {}", session_id);
    
    let mut storage_lock = state.storage.lock().unwrap();
    let mut storage = state.load_storage();
    
    if storage.sessions.remove(&session_id).is_some() {
        state.save_storage(&storage)?;
        *storage_lock = storage;
        
        println!("✅ セッション削除完了: ID {}", session_id);
        Ok(())
    } else {
        Err(format!("削除するセッションが見つかりません: ID {}", session_id))
    }
}

fn main() {
    println!("🚀 Tauri バックエンド起動");

    // データディレクトリのパスを設定
    let data_dir = std::env::current_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("data");
    
    let data_file = data_dir.join("sessions.json");
    
    // アプリケーション状態を初期化
    let app_state = AppState {
        storage: Mutex::new(SessionStorage::default()),
        data_file,
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            is_model_loaded,
            generate_text,
            generate_ai_response,
            start_discussion,
            summarize_discussion,
            analyze_discussion_points,
            analyze_recent_discussion,
            save_discussion_session,
            save_or_update_discussion_session,
            find_existing_session,
            get_saved_sessions,
            get_session_by_id,
            update_discussion_session,
            delete_session
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}
