#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::{command, AppHandle};
use reqwest::Client;
use serde_json::json;
use tauri_plugin_sql::{Migration, MigrationKind};

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

// モデルロード状態チェック
#[command]
async fn is_model_loaded() -> bool {
    println!("モデルロード状態確認中...");
    match reqwest::get("http://localhost:11434").await {
        Ok(_) => {
            println!("Ollama 応答あり。モデル起動可能。");
            true
        },
        Err(e) => {
            println!("Ollama からの応答なし: {}", e);
            false
        },
    }
}

// テキスト生成のテスト用コマンド
#[command]
async fn test_generate_text() -> Result<String, String> {
    println!("テスト用generate_text呼び出し開始");
    
    let test_prompt = "こんにちは。あなたの名前は何ですか？日本語で短く答えてください。".to_string();
    println!("テストプロンプト: {}", test_prompt);
    
    generate_text(test_prompt).await
}

// テキスト生成
#[command]
async fn generate_text(prompt: String) -> Result<String, String> {
    println!("generate_text 呼び出し: prompt = {}", mask_prompt_for_log(&prompt));
    println!("プロンプト長: {}文字", prompt.len());

    let client = Client::new();
    let body = json!({
        "model": "gemma3:4b",
        "prompt": prompt,
        "stream": false
    });

    println!("Ollama API へリクエスト送信中...");
    let res = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("リクエスト失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    println!("レスポンス受信、ステータス: {}", res.status());
    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| {
            let error_msg = format!("JSONパース失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    println!("Ollama応答JSON: {:?}", json);
    if let Some(resp) = json["response"].as_str() {
        println!("応答取得成功: {}文字", resp.len());
        Ok(resp.to_string())
    } else {
        let error_msg = format!("応答フィールドなし: {:?}", json);
        println!("{}", error_msg);
        Err("応答なし".into())
    }
}

// AI応答生成（XMLフォーマットプロンプト）
#[command]
async fn generate_ai_response(
    participant_name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
) -> Result<String, String> {
    println!("generate_ai_response 呼び出し: participant_name={}, role={}, description={}, conversation_history=[{}文字], discussion_topic={}", 
        participant_name, role, description, conversation_history.len(), discussion_topic);
    
    println!("プロンプト生成開始...");
    let xml_prompt = prompts::build_ai_response_prompt(
        &participant_name,
        &role,
        &description,
        &conversation_history,
        &discussion_topic,
    );
    println!("プロンプト生成完了: {}文字", xml_prompt.len());

    println!("generate_text呼び出し開始...");
    let result = generate_text(xml_prompt).await;
    println!("generate_text結果: {:?}", 
        result.as_ref().map(|s| format!("成功({}文字)", s.len())).unwrap_or_else(|e| format!("エラー: {}", e)));
    result
}

// 議論開始のためのファシリテート
#[command]
async fn start_discussion(
    topic: String,
    participants: Vec<String>, // AI名のリスト
) -> Result<String, String> {
    println!("start_discussion 呼び出し: {}", topic);
    
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
    println!("analyze_discussion_points 呼び出し");
    
    let xml_prompt = prompts::build_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );

    generate_text(xml_prompt).await
}

// 議論分析エンジン - 直近の発言のみを対象とした高速分析
#[command]
async fn analyze_recent_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
) -> Result<String, String> {
    println!("analyze_recent_discussion 呼び出し");
    
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
    println!("summarize_discussion 呼び出し");
    
    let xml_prompt = prompts::build_discussion_summary_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );

    generate_text(xml_prompt).await
}

fn main() {
    println!("Tauri バックエンド起動");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:data.db", vec![
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
                ])
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
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}
