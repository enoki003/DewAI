#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::command;
use reqwest::Client;
use serde_json::json;
use std::time::Duration; // 追加
use tokio::time::sleep; // 追加
// use tauri_plugin_sql::{Migration, MigrationKind};

// リクエスト設定（タイムアウト/リトライ）
const REQUEST_TIMEOUT_SECS: u64 = 10; // 10秒タイムアウト
const MAX_RETRIES: u8 = 3; // 最大3回リトライ

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

// Ollama /api/generate 呼び出し（共通・タイムアウト/リトライ付き）
async fn call_ollama_generate(model: &str, prompt: &str) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTPクライアント初期化失敗: {}", e))?;

    let body = json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let mut attempt: u8 = 1;
    loop {
        println!("Ollama API へリクエスト送信中... (モデル: {}, 試行: {}/{})", model, attempt, MAX_RETRIES);
        let resp = client
            .post("http://localhost:11434/api/generate")
            .json(&body)
            .send()
            .await;

        match resp {
            Ok(res) => {
                println!("レスポンス受信、ステータス: {}", res.status());
                let json: serde_json::Value = res.json().await.map_err(|e| format!("JSONパース失敗: {}", e))?;
                if let Some(resp_text) = json["response"].as_str() {
                    println!("応答取得成功: {}文字", resp_text.len());
                    return Ok(resp_text.to_string());
                } else {
                    let err = format!("応答フィールドなし: {:?}", json);
                    println!("{}", err);
                    if attempt >= MAX_RETRIES { return Err("応答なし".into()); }
                }
            }
            Err(e) => {
                println!("リクエスト失敗: {}", e);
                if attempt >= MAX_RETRIES {
                    return Err(format!("リクエスト失敗: {}", e));
                }
            }
        }

        // バックオフ
        let backoff_ms = 300u64.saturating_mul(2u64.saturating_pow((attempt - 1) as u32));
        println!("{}ms 後に再試行します...", backoff_ms);
        sleep(Duration::from_millis(backoff_ms)).await;
        attempt += 1;
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

// テキスト生成（デフォルトモデル）
#[command]
async fn generate_text(prompt: String) -> Result<String, String> {
    println!("generate_text 呼び出し: prompt = {}", mask_prompt_for_log(&prompt));
    println!("プロンプト長: {}文字", prompt.len());

    // 設定からモデル名を取得（デフォルト: gemma3:4b）
    let model_name = get_selected_model().await;
    println!("使用モデル: {}", model_name);

    call_ollama_generate(&model_name, &prompt).await
}

// 現在選択されているモデルを取得
async fn get_selected_model() -> String {
    // とりあえずlocalStorageから読み取る機能はないので、デフォルトを返す
    // フロントエンド側でモデル設定を管理
    "gemma3:4b".to_string()
}

// 利用可能なモデル一覧を取得
#[command]
async fn get_available_models() -> Result<Vec<String>, String> {
    println!("利用可能なモデル一覧を取得中...");
    let client = Client::builder()
        .timeout(Duration::from_secs(REQUEST_TIMEOUT_SECS))
        .build()
        .map_err(|e| format!("HTTPクライアント初期化失敗: {}", e))?;

    let res = client
        .get("http://localhost:11434/api/tags")
        .send()
        .await
        .map_err(|e| {
            let error_msg = format!("モデル一覧取得失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    let json: serde_json::Value = res
        .json()
        .await
        .map_err(|e| {
            let error_msg = format!("JSONパース失敗: {}", e);
            println!("{}", error_msg);
            error_msg
        })?;

    if let Some(models) = json["models"].as_array() {
        let model_names: Vec<String> = models
            .iter()
            .filter_map(|model| model["name"].as_str())
            .filter(|name| name.starts_with("gemma3:1b") || name.starts_with("gemma3:4b"))
            .map(|s| s.to_string())
            .collect();
        
        println!("利用可能なGemma3モデル: {:?}", model_names);
        Ok(model_names)
    } else {
        println!("モデル一覧が見つかりません");
        // デフォルトモデルを返す
        Ok(vec!["gemma3:4b".to_string(), "gemma3:1b".to_string()])
    }
}

// モデル選択付きテキスト生成
#[command]
async fn generate_text_with_model(prompt: String, model: String) -> Result<String, String> {
    println!("generate_text_with_model 呼び出し: model = {}, prompt = {}", model, mask_prompt_for_log(&prompt));
    
    // 指定されたモデルが許可リストにあるかチェック
    if !model.starts_with("gemma3:1b") && !model.starts_with("gemma3:4b") {
        return Err("サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。".to_string());
    }

    call_ollama_generate(&model, &prompt).await
}

// AI応答生成（XMLフォーマットプロンプト）
#[command]
async fn generate_ai_response(
    participant_name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
    model: String, // 追加: 選択モデル
) -> Result<String, String> {
    println!(
        "generate_ai_response 呼び出し: participant_name={}, role={}, description={}, conversation_history=[{}文字], discussion_topic={}, model={}",
        participant_name,
        role,
        description,
        conversation_history.len(),
        discussion_topic,
        model
    );

    // モデル許可チェック
    if !model.starts_with("gemma3:1b") && !model.starts_with("gemma3:4b") {
        return Err("サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。".to_string());
    }

    println!("プロンプト生成開始...");
    let xml_prompt = prompts::build_ai_response_prompt(
        &participant_name,
        &role,
        &description,
        &conversation_history,
        &discussion_topic,
    );
    println!("プロンプト生成完了: {}文字", xml_prompt.len());

    call_ollama_generate(&model, &xml_prompt).await
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
    model: String, // 追加
) -> Result<String, String> {
    println!("analyze_discussion_points 呼び出し (model={})", model);
    if !model.starts_with("gemma3:1b") && !model.starts_with("gemma3:4b") {
        return Err("サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。".to_string());
    }
    let xml_prompt = prompts::build_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    call_ollama_generate(&model, &xml_prompt).await
}

// 議論分析エンジン - 直近の発言のみを対象とした高速分析
#[command]
async fn analyze_recent_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
    model: String, // 追加
) -> Result<String, String> {
    println!("analyze_recent_discussion 呼び出し (model={})", model);
    if !model.starts_with("gemma3:1b") && !model.starts_with("gemma3:4b") {
        return Err("サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。".to_string());
    }
    let xml_prompt = prompts::build_lightweight_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    call_ollama_generate(&model, &xml_prompt).await
}

// 議論要約エンジン
#[command]
async fn summarize_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>, // 参加者名のリスト
    model: String, // 追加
) -> Result<String, String> {
    println!("summarize_discussion 呼び出し (model={})", model);
    if !model.starts_with("gemma3:1b") && !model.starts_with("gemma3:4b") {
        return Err("サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。".to_string());
    }
    let xml_prompt = prompts::build_discussion_summary_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    call_ollama_generate(&model, &xml_prompt).await
}

fn main() {
    println!("Tauri バックエンド起動");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // テスト用コマンド
            test_generate_text,
            // AI関連コマンド
            is_model_loaded,
            generate_text,
            generate_text_with_model,
            get_available_models,
            generate_ai_response,
            start_discussion,
            analyze_discussion_points,
            analyze_recent_discussion,
            summarize_discussion,
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}
