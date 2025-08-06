#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::{command, AppHandle};
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
        // UTF-8文字境界を考慮して50文字分を取得
        let mut boundary = 50;
        while boundary > 0 && !prompt.is_char_boundary(boundary) {
            boundary -= 1;
        }
        if boundary == 0 {
            return "[プロンプトが表示できません]".to_string();
        }
        
        format!("{}...[{}文字省略]", &prompt[..boundary], prompt.chars().count() - prompt[..boundary].chars().count())
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

// テキスト生成のテスト用コマンド
#[command]
async fn test_generate_text() -> Result<String, String> {
    println!("🧪 テスト用generate_text呼び出し開始");
    
    let test_prompt = "こんにちは。あなたの名前は何ですか？日本語で短く答えてください。".to_string();
    println!("🔍 テストプロンプト: {}", test_prompt);
    
    generate_text(test_prompt).await
}

// テキスト生成
#[command]
async fn generate_text(prompt: String) -> Result<String, String> {
    println!("🧠 generate_text 呼び出し: prompt = {}", mask_prompt_for_log(&prompt));
    println!("🔍 プロンプト長: {}文字", prompt.len());

    let client = Client::new();
    let body = json!({
        "model": "gemma3:4b",
        "prompt": prompt,
        "stream": false
    });

    println!("📡 Ollama API へリクエスト送信中...");
    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("❌ リクエスト失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    println!("📥 レスポンス受信、ステータス: {}", res.status());
    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| {
            let error_msg = format!("❌ JSONパース失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    println!("🔍 Ollama応答JSON: {:?}", json);
    if let Some(resp) = json["response"].as_str() {
        println!("📦 応答取得成功: {}文字", resp.len());
        Ok(resp.to_string())
    } else {
        let error_msg = format!("⚠️ 応答フィールドなし: {:?}", json);
        println!("{}", error_msg);
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
    
    println!("🔧 プロンプト生成開始...");
    let xml_prompt = prompts::build_ai_response_prompt(
        &participant_name,
        &role,
        &description,
        &conversation_history,
        &discussion_topic,
    );
    println!("✅ プロンプト生成完了: {}文字", xml_prompt.len());

    println!("🚀 generate_text呼び出し開始...");
    let result = generate_text(xml_prompt).await;
    println!("📋 generate_text結果: {:?}", 
        result.as_ref().map(|s| format!("成功({}文字)", s.len())).unwrap_or_else(|e| format!("エラー: {}", e)));
    result
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
    _app: AppHandle,
    topic: String,
    participants: String,
    messages: String,
) -> Result<i64, String> {
    println!("💾 議論セッション保存開始: {}", topic);
    println!("📊 保存データ詳細 - 参加者: {}, メッセージ数: {}", participants, messages.len());
    
    // 現在はフロントエンド側でSQL実行を行う設計のため、
    // バックエンドではバリデーションのみ実行してモックIDを返す
    if topic.trim().is_empty() {
        return Err("議論トピックが空です".to_string());
    }
    
    let session_id = chrono::Utc::now().timestamp(); // タイムスタンプをIDとして使用
    println!("✅ セッション保存完了: ID {}", session_id);
    Ok(session_id)
}

// 議論セッションを更新
#[command]
async fn update_discussion_session(
    _app: AppHandle,
    session_id: i64,
    _messages: String,
) -> Result<(), String> {
    println!("🔄 議論セッション更新開始: ID {}", session_id);
    
    // フロントエンド側でSQL実行を行う設計のため、
    // バックエンドでは成功レスポンスを返す
    println!("✅ セッション更新完了: ID {}", session_id);
    Ok(())
}

// 全セッション一覧を取得
#[command]
async fn get_all_sessions(_app: AppHandle) -> Result<Vec<SavedSession>, String> {
    println!("📋 全セッション取得開始");
    
    // フロントエンド側でSQL実行を行う設計のため、
    // バックエンドでは空のリストを返す（フロントエンドで実際のデータを取得）
    let sessions: Vec<SavedSession> = vec![];
    println!("✅ セッション取得完了: {}件（フロントエンド側で実際のデータを取得）", sessions.len());
    Ok(sessions)
}

// 特定セッションを取得
#[command]
async fn get_session_by_id(
    _app: AppHandle,
    session_id: i64,
) -> Result<Option<SavedSession>, String> {
    println!("📖 セッション取得開始: ID {}", session_id);
    
    // フロントエンド側でSQL実行を行う設計のため、
    // バックエンドではNoneを返す（フロントエンドで実際のデータを取得）
    println!("⚠️ セッションが見つかりません: ID {}（フロントエンド側で実際のデータを取得）", session_id);
    Ok(None)
}

// セッションを削除
#[command]
async fn delete_session(
    _app: AppHandle,
    session_id: i64,
) -> Result<(), String> {
    println!("🗑️ セッション削除開始: ID {}", session_id);
    
    // フロントエンド側でSQL実行を行う設計のため、
    // バックエンドでは成功レスポンスを返す
    println!("✅ セッション削除完了: ID {}", session_id);
    Ok(())
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
        },
        Migration {
            version: 2,
            description: "update_participants_schema_comment",
            sql: "-- Schema update: participants field now stores JSON with {userParticipates: boolean, aiData: [{name, role, description}]}
                  -- This is a no-op migration to document the schema change
                  SELECT 1;",
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
            // テスト用コマンド
            test_generate_text,
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
