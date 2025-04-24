#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use reqwest::Client;
use serde_json::json;

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
        "model": "gemma3:4b", // モデル名（必要に応じて変えて）
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

// AI応答生成（プロンプト合成＋generate_text）
#[command]
async fn generate_ai_response(
    name: String,
    role: String,
    description: String,
    conversation_history: String,
    query: String,
) -> Result<String, String> {
    println!("🤖 generate_ai_response 呼び出し");
    let prompt = format!(
        "あなたは{name}という名前の{role}です。{description}\n\
         これまでの会話:\n{conversation_history}\n\
         ユーザーの質問: {query}\nあなたの応答:"
    );

    generate_text(prompt).await
}

fn main() {
    println!("🚀 Tauri バックエンド起動");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            is_model_loaded,
            generate_text,
            generate_ai_response
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}