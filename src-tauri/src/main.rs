#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::command;
use tauri::Emitter;
use reqwest::Client;
use serde_json::json;
use std::time::Duration;
use tokio::time::sleep;
use tauri_plugin_sql::Builder as SqlBuilder;

// リクエスト設定（タイムアウト/リトライ）
const REQUEST_TIMEOUT_SECS: u64 = 120; // 120秒タイムアウト
const MAX_RETRIES: u8 = 3; // 最大3回リトライ
// 議論分析のための延長タイムアウト
const ANALYSIS_TIMEOUT_SECS: u64 = 120; // 最大120秒まで待つ

// 許可モデルとエラーメッセージ（共通化）
const ALLOWED_MODEL_PREFIXES: [&str; 2] = ["gemma3:1b", "gemma3:4b"];
const ERR_UNSUPPORTED_MODEL: &str = "サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。";

fn is_allowed_model(model: &str) -> bool {
    ALLOWED_MODEL_PREFIXES.iter().any(|p| model.starts_with(p))
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

// タイムアウト秒を引数で受け取る共通関数
async fn call_ollama_generate_with_timeout(model: &str, prompt: &str, timeout_secs: u64) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| format!("HTTPクライアント初期化失敗: {}", e))?;

    let body = json!({
        "model": model,
        "prompt": prompt,
        "stream": false
    });

    let mut attempt: u8 = 1;
    loop {
        println!("Ollama API へリクエスト送信中... (モデル: {}, 試行: {}/{}, timeout={}s)", model, attempt, MAX_RETRIES, timeout_secs);
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

// 既存のデフォルト関数は上記を呼び出す
async fn call_ollama_generate(model: &str, prompt: &str) -> Result<String, String> {
    call_ollama_generate_with_timeout(model, prompt, REQUEST_TIMEOUT_SECS).await
}

// ストリーミング版（逐次トークンをイベントで通知）
async fn call_ollama_generate_stream(window: &tauri::Window, model: &str, prompt: &str, event_name: &str) -> Result<String, String> {
    let client = Client::builder()
        .timeout(Duration::from_secs(ANALYSIS_TIMEOUT_SECS.max(REQUEST_TIMEOUT_SECS)))
        .build()
        .map_err(|e| format!("HTTPクライアント初期化失敗: {}", e))?;

    let body = json!({
        "model": model,
        "prompt": prompt,
        "stream": true
    });

    let mut attempt: u8 = 1;
    loop {
        println!("Ollama API(Streaming) へリクエスト送信中... (モデル: {}, 試行: {}/{})", model, attempt, MAX_RETRIES);
        let send_res = client
            .post("http://localhost:11434/api/generate")
            .json(&body)
            .send()
            .await;

        match send_res {
            Ok(mut res) => {
                if !res.status().is_success() {
                    let st = res.status();
                    println!("ステータスエラー: {}", st);
                    if attempt >= MAX_RETRIES { return Err(format!("ステータスエラー: {}", st)); }
                } else {
                    let mut buffer = String::new();
                    let mut full = String::new();
                    loop {
                        match res.chunk().await {
                            Ok(Some(bytes)) => {
                                let chunk_str = String::from_utf8_lossy(&bytes);
                                buffer.push_str(&chunk_str);
                                while let Some(pos) = buffer.find('\n') {
                                    let line = buffer[..pos].to_string();
                                    buffer.drain(..=pos);
                                    let trimmed = line.trim();
                                    if trimmed.is_empty() { continue; }
                                    if let Ok(v) = serde_json::from_str::<serde_json::Value>(trimmed) {
                                        if let Some(token) = v["response"].as_str() {
                                            if !token.is_empty() {
                                                full.push_str(token);
                                                let _ = window.emit(event_name, json!({ "token": token }));
                                            }
                                        }
                                        if v["done"].as_bool() == Some(true) {
                                            let _ = window.emit(event_name, json!({ "done": true, "full": full }));
                                            return Ok(full);
                                        }
                                    }
                                }
                            }
                            Ok(None) => {
                                // ストリーム終了
                                let _ = window.emit(event_name, json!({ "done": true, "full": full }));
                                return Ok(full);
                            }
                            Err(e) => {
                                println!("ストリーム読み取り失敗: {}", e);
                                if attempt >= MAX_RETRIES { return Err(format!("ストリーム読み取り失敗: {}", e)); }
                                break; // リトライへ
                            }
                        }
                    }
                }
            }
            Err(e) => {
                println!("ストリーミング送信失敗: {}", e);
                if attempt >= MAX_RETRIES {
                    return Err(format!("ストリーミング送信失敗: {}", e));
                }
            }
        }

        // バックオフ
        let backoff_ms = 300u64.saturating_mul(2u64.saturating_pow((attempt - 1) as u32));
        println!("{}ms 後に再試行します...(stream)", backoff_ms);
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

    // デフォルトは gemma3:4b を使用（フロントからは generate_text_with_model を推奨）
    let model_name = "gemma3:4b".to_string();
    println!("使用モデル: {}", model_name);

    call_ollama_generate(&model_name, &prompt).await
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
            .filter(|name| is_allowed_model(name))
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
    println!(
        "generate_text_with_model 呼び出し: model = {}, prompt = {}",
        model,
        mask_prompt_for_log(&prompt)
    );
    
    // 指定されたモデルが許可リストにあるかチェック
    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
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
    model: String,
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
    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
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
    model: String,
) -> Result<String, String> {
    println!("analyze_discussion_points 呼び出し (model={})", model);
    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
    }
    let xml_prompt = prompts::build_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    // タイムアウト延長版を使用
    call_ollama_generate_with_timeout(&model, &xml_prompt, ANALYSIS_TIMEOUT_SECS).await
}

// 議論分析エンジン - 直近の発言のみを対象とした高速分析
#[command]
async fn analyze_recent_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
    model: String,
) -> Result<String, String> {
    println!("analyze_recent_discussion 呼び出し (model={})", model);
    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
    }
    let xml_prompt = prompts::build_lightweight_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    // タイムアウト延長版を使用
    call_ollama_generate_with_timeout(&model, &xml_prompt, ANALYSIS_TIMEOUT_SECS).await
}

// 議論要約（全文対象）
#[command]
async fn summarize_discussion(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
    model: String,
) -> Result<String, String> {
    println!("summarize_discussion 呼び出し (model={})", model);
    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
    }
    let xml_prompt = prompts::build_discussion_summary_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    // 要約も長めに待機
    call_ollama_generate_with_timeout(&model, &xml_prompt, ANALYSIS_TIMEOUT_SECS).await
}

// ストリーミング対応のAI応答
#[command]
async fn generate_ai_response_stream(
    window: tauri::Window,
    participant_name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
    model: String,
) -> Result<String, String> {
    println!(
        "generate_ai_response_stream 呼び出し: participant_name={}, role={}, discussion_topic={}, model={}",
        participant_name,
        role,
        discussion_topic,
        model
    );

    if !is_allowed_model(&model) {
        return Err(ERR_UNSUPPORTED_MODEL.to_string());
    }

    let xml_prompt = prompts::build_ai_response_prompt(
        &participant_name,
        &role,
        &description,
        &conversation_history,
        &discussion_topic,
    );

    // イベント名は固定（フロント側で購読）
    call_ollama_generate_stream(&window, &model, &xml_prompt, "ai-stream").await
}

// =========================
// Tauri アプリ エントリポイント
// =========================
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(SqlBuilder::default().build())
        .invoke_handler(tauri::generate_handler![
            is_model_loaded,
            test_generate_text,
            generate_text,
            get_available_models,
            generate_text_with_model,
            generate_ai_response,
            start_discussion,
            analyze_discussion_points,
            analyze_recent_discussion,
            summarize_discussion,
            generate_ai_response_stream
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
