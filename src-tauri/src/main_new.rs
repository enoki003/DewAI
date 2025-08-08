#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::command;
use reqwest::Client;
use serde_json::json;
use serde::{Deserialize, Serialize};
use tauri_plugin_sql::{Migration, MigrationKind};
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

// ログ用のプロンプトマスキング関数
fn mask_prompt_for_log(prompt: &str) -> String {
    if prompt.len() <= 100 {
        prompt.to_string()
    } else {
        format!("{}...[{}文字省略]", &prompt[..50], prompt.len() - 50)
    }
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
    println!("🧠 generate_text 呼び出し: prompt = {}", mask_prompt_for_log(&prompt));

    let client = Client::new();
    let body = json!({
        "model": "gemma3:4b",
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
    println!("🤖 generate_ai_response 呼び出し: participant_name={}, role={}, description={}, conversation_history=[{}文字], discussion_topic={}", 
        participant_name, role, description, conversation_history.len(), discussion_topic);
    
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

// データベース関連のコマンド（SQLite実装）

// 議論セッションを保存
#[command]
async fn save_discussion_session(
    app: tauri::AppHandle,
    topic: String,
    participants: String,
    messages: String,
) -> Result<i64, String> {
    println!("💾 議論セッション保存開始: {}", topic);
    println!("📊 保存データ詳細 - 参加者: {}, メッセージ数: {}", participants, messages.len());
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let result = tauri_plugin_sql::query(
        &app,
        "INSERT INTO discussion_sessions (topic, participants, messages, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        vec![topic.clone(), participants, messages, now.clone(), now]
    ).await;
    
    match result {
        Ok(rows) => {
            if let Some(row) = rows.last() {
                if let Ok(session_id) = row.get::<i64, _>("id") {
                    println!("✅ セッション保存完了: ID {}", session_id);
                    return Ok(session_id);
                }
            }
            // fallback: last_insert_rowidを使用
            let id_result = tauri_plugin_sql::query(
                &app,
                "SELECT last_insert_rowid() as id",
                Vec::<String>::new()
            ).await;
            
            match id_result {
                Ok(id_rows) => {
                    if let Some(id_row) = id_rows.first() {
                        let session_id = id_row.get::<i64, _>("id").unwrap_or(0);
                        println!("✅ セッション保存完了: ID {}", session_id);
                        Ok(session_id)
                    } else {
                        Err("IDの取得に失敗しました".to_string())
                    }
                }
                Err(e) => Err(format!("IDクエリエラー: {}", e))
            }
        }
        Err(e) => {
            println!("❌ セッション保存失敗: {}", e);
            Err(format!("データベースエラー: {}", e))
        }
    }
}

// 議論セッションを更新
#[command]
async fn update_discussion_session(
    app: tauri::AppHandle,
    session_id: i64,
    messages: String,
) -> Result<(), String> {
    println!("🔄 議論セッション更新開始: ID {}", session_id);
    
    let now = chrono::Utc::now().format("%Y-%m-%d %H:%M:%S").to_string();
    
    let result = tauri_plugin_sql::query(
        &app,
        "UPDATE discussion_sessions SET messages = ?1, updated_at = ?2 WHERE id = ?3",
        vec![messages, now, session_id.to_string()]
    ).await;
    
    match result {
        Ok(_) => {
            println!("✅ セッション更新完了: ID {}", session_id);
            Ok(())
        }
        Err(e) => {
            println!("❌ セッション更新失敗: {}", e);
            Err(format!("データベースエラー: {}", e))
        }
    }
}

// 全セッション一覧を取得
#[command]
async fn get_all_sessions(app: tauri::AppHandle) -> Result<Vec<SavedSession>, String> {
    println!("📋 全セッション取得開始");
    
    let result = tauri_plugin_sql::query(
        &app,
        "SELECT id, topic, participants, messages, created_at, updated_at FROM discussion_sessions ORDER BY updated_at DESC",
        Vec::<String>::new()
    ).await;
    
    match result {
        Ok(rows) => {
            let sessions: Vec<SavedSession> = rows.iter().map(|row| {
                SavedSession {
                    id: row.get::<i64, _>("id").unwrap_or(0),
                    topic: row.get::<String, _>("topic").unwrap_or_default(),
                    participants: row.get::<String, _>("participants").unwrap_or_default(),
                    messages: row.get::<String, _>("messages").unwrap_or_default(),
                    created_at: row.get::<String, _>("created_at").unwrap_or_default(),
                    updated_at: row.get::<String, _>("updated_at").unwrap_or_default(),
                }
            }).collect();
            
            println!("✅ セッション取得完了: {}件", sessions.len());
            Ok(sessions)
        }
        Err(e) => {
            println!("❌ セッション取得失敗: {}", e);
            Err(format!("データベースエラー: {}", e))
        }
    }
}

// 特定セッションを取得
#[command]
async fn get_session_by_id(
    app: tauri::AppHandle,
    session_id: i64,
) -> Result<Option<SavedSession>, String> {
    println!("📖 セッション取得開始: ID {}", session_id);
    
    let result = tauri_plugin_sql::query(
        &app,
        "SELECT id, topic, participants, messages, created_at, updated_at FROM discussion_sessions WHERE id = ?1",
        vec![session_id.to_string()]
    ).await;
    
    match result {
        Ok(rows) => {
            if let Some(row) = rows.first() {
                let session = SavedSession {
                    id: row.get::<i64, _>("id").unwrap_or(0),
                    topic: row.get::<String, _>("topic").unwrap_or_default(),
                    participants: row.get::<String, _>("participants").unwrap_or_default(),
                    messages: row.get::<String, _>("messages").unwrap_or_default(),
                    created_at: row.get::<String, _>("created_at").unwrap_or_default(),
                    updated_at: row.get::<String, _>("updated_at").unwrap_or_default(),
                };
                println!("✅ セッション取得完了: ID {}", session_id);
                Ok(Some(session))
            } else {
                println!("⚠️ セッションが見つかりません: ID {}", session_id);
                Ok(None)
            }
        }
        Err(e) => {
            println!("❌ セッション取得失敗: {}", e);
            Err(format!("データベースエラー: {}", e))
        }
    }
}

// セッションを削除
#[command]
async fn delete_session(
    app: tauri::AppHandle,
    session_id: i64,
) -> Result<(), String> {
    println!("🗑️ セッション削除開始: ID {}", session_id);
    
    let result = tauri_plugin_sql::query(
        &app,
        "DELETE FROM discussion_sessions WHERE id = ?1",
        vec![session_id.to_string()]
    ).await;
    
    match result {
        Ok(_) => {
            println!("✅ セッション削除完了: ID {}", session_id);
            Ok(())
        }
        Err(e) => {
            println!("❌ セッション削除失敗: {}", e);
            Err(format!("データベースエラー: {}", e))
        }
    }
}

fn main() {
    println!("🚀 Tauri バックエンド起動（SQLite版）");

    // データベースマイグレーション設定
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_discussion_sessions_table",
            sql: "CREATE TABLE IF NOT EXISTS discussion_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                topic TEXT NOT NULL,
                participants TEXT NOT NULL,
                messages TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );",
            kind: MigrationKind::Up,
        }
    ];

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:data.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            // AI関連コマンド
            is_model_loaded,
            generate_text,
            generate_ai_response,
            start_discussion,
            analyze_discussion_points,
            analyze_recent_discussion,
            summarize_discussion,
            // データベース関連コマンド
            save_discussion_session,
            update_discussion_session,
            get_all_sessions,
            get_session_by_id,
            delete_session
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}
