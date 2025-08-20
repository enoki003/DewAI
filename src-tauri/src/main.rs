#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod prompts;

use tauri::command;
use reqwest::Client;
use serde_json::json;
use tauri_plugin_sql::Builder as SqlBuilder;
use once_cell::sync::Lazy;
use tokio::sync::broadcast::{self, error::TryRecvError};
use tokio::time::{sleep, Duration};

// リトライ最大回数
const MAX_RETRIES: u8 = 3;

// 許可モデルとエラーメッセージ（共通化）
const ALLOWED_MODEL_PREFIXES: [&str; 2] = ["gemma3:1b", "gemma3:4b"];
const ERR_UNSUPPORTED_MODEL: &str = "サポートされていないモデルです。gemma3:1bまたはgemma3:4bを使用してください。";

fn is_allowed_model(model: &str) -> bool {
    ALLOWED_MODEL_PREFIXES.iter().any(|p| model.starts_with(p))
}

// キャンセル制御: グローバル broadcast チャンネル
static CANCEL_TX: Lazy<broadcast::Sender<()>> = Lazy::new(|| {
    let (tx, _rx) = broadcast::channel(8);
    tx
});

/// 進行中のOllama呼び出しをキャンセルする
#[command]
async fn cancel_ongoing_requests() {
    let _ = CANCEL_TX.send(());
}

// ログ用のプロンプトマスキング関数
fn mask_prompt_for_log(prompt: &str) -> String {
    if prompt.len() <= 100 {
        prompt.to_string()
    } else {
        // 50文字分を取得
        let mut boundary = 50;
        while boundary > 0 && !prompt.is_char_boundary(boundary) {
            boundary -= 1;
        }
        if boundary == 0 { return "[プロンプトが表示できません]".to_string(); }
        format!("<{}>...[{}文字省略]", &prompt[..boundary], prompt.chars().count() - prompt[..boundary].chars().count())
    }
}

//生成呼び出し。失敗時指数バックオフで再試行。キャンセルに対応。
async fn call_ollama_generate(model: &str, prompt: &str) -> Result<String, String> {
    let client = Client::builder()
        .build()
        .map_err(|e| format!("HTTPクライアント初期化失敗: {}", e))?;

    let body = json!({ "model": model, "prompt": prompt, "stream": false });

    let mut attempt: u8 = 1;
    // 各呼び出しごとに購読者を作成
    let mut cancel_rx = CANCEL_TX.subscribe();

    loop {
        // 事前キャンセルチェック（try_recv は TryRecvError を返す）
        match cancel_rx.try_recv() {
            Ok(_) => { return Err("キャンセルされました".into()); }
            Err(TryRecvError::Closed) => { return Err("キャンセルされました".into()); }
            Err(TryRecvError::Lagged(_)) => { return Err("キャンセルされました".into()); }
            Err(TryRecvError::Empty) => {}
        }

        println!("Ollama API リクエスト送信 (model={}, attempt={}/{})", model, attempt, MAX_RETRIES);
        // 送信→応答の待機をタイムアウト/キャンセルとレースさせる
        let fut = client.post("http://localhost:11434/api/generate").json(&body).send();
        tokio::select! {
            _ = cancel_rx.recv() => {
                return Err("キャンセルされました".into());
            }
            resp = fut => {
                match resp {
                    Ok(res) => {
                        println!("ステータス: {}", res.status());
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
                        if attempt >= MAX_RETRIES { return Err(format!("リクエスト失敗: {}", e)); }
                    }
                }
            }
        }
        let backoff_ms = 300u64.saturating_mul(2u64.saturating_pow((attempt - 1) as u32));
        println!("{}ms 後に再試行...", backoff_ms);
        // キャンセルも監視しつつ待機
        let mut waited = 0u64;
        while waited < backoff_ms {
            match cancel_rx.try_recv() {
                Ok(_) => { return Err("キャンセルされました".into()); }
                Err(TryRecvError::Closed) => { return Err("キャンセルされました".into()); }
                Err(TryRecvError::Lagged(_)) => { return Err("キャンセルされました".into()); }
                Err(TryRecvError::Empty) => {}
            }
            let step = 50u64.min(backoff_ms - waited);
            sleep(Duration::from_millis(step)).await;
            waited += step;
        }
        attempt += 1;
    }
}



// ================= 以降フロントエンドとの通信用コマンド =================

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
        // タイムアウト指定撤廃
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
    if !is_allowed_model(&model) { return Err(ERR_UNSUPPORTED_MODEL.to_string()); }
    let xml_prompt = prompts::build_discussion_analysis_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    call_ollama_generate(&model, &xml_prompt).await
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
    if !is_allowed_model(&model) { return Err(ERR_UNSUPPORTED_MODEL.to_string()); }
    let xml_prompt = prompts::build_discussion_summary_prompt(
        &discussion_topic,
        &conversation_history,
        &participants,
    );
    call_ollama_generate(&model, &xml_prompt).await
}

// AIプロフィール生成
#[command]
async fn generate_ai_profiles(
    discussion_topic: String,
    desired_count: Option<u32>,
    style_hint: Option<String>,
    model: String,
) -> Result<String, String> {
    println!(
        "generate_ai_profiles 呼び出し: topic='{}', count={:?}, model={}",
        discussion_topic,
        desired_count,
        model
    );
    if !is_allowed_model(&model) { return Err(ERR_UNSUPPORTED_MODEL.to_string()); }
    let prompt = prompts::build_ai_profiles_prompt(
        &discussion_topic,
        desired_count.unwrap_or(4) as usize,
        style_hint.unwrap_or_default().as_str(),
    );
    call_ollama_generate(&model, &prompt).await
}

// インクリメンタル要約（前回要約 + 新規メッセージのみ）
#[command]
async fn incremental_summarize_discussion(
    discussion_topic: String,
    previous_summary: String,
    new_messages: String,
    participants: Vec<String>,
    model: String,
) -> Result<String, String> {
    println!(
        "incremental_summarize_discussion 呼び出し (model={}, prev_summary_len={}, new_msgs_len={})",
        model,
        previous_summary.len(),
        new_messages.len()
    );
    if !is_allowed_model(&model) { return Err(ERR_UNSUPPORTED_MODEL.to_string()); }
    let prompt = prompts::build_incremental_summary_prompt(
        &discussion_topic,
        &previous_summary,
        &new_messages,
        &participants,
    );
    call_ollama_generate(&model, &prompt).await
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
            summarize_discussion,
            generate_ai_profiles,
            incremental_summarize_discussion,
            cancel_ongoing_requests
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
