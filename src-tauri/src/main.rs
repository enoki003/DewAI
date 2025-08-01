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

// AI応答生成（XMLフォーマットプロンプト＋generate_text）
#[command]
async fn generate_ai_response(
    name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
) -> Result<String, String> {
    println!("🤖 generate_ai_response 呼び出し: {}", name);
    
    let xml_prompt = format!(
        r#"<discussion_context>
<discussion_topic>{discussion_topic}</discussion_topic>

<participant>
<name>{name}</name>
<role>{role}</role>
<description>{description}</description>
</participant>

<conversation_history>
{conversation_history}
</conversation_history>

<instructions>
あなたは{name}という{role}です。{description}

議論のテーマは「{discussion_topic}」です。
これまでの議論の流れを踏まえて、このテーマに関して{name}として自然で建設的な発言をしてください。

以下の点を意識してください：
- 議論のテーマ「{discussion_topic}」に沿った発言
- あなたの役職と専門性を活かした視点
- 他の参加者の意見に対する反応や補足
- 議論を深める質問や提案
- {name}らしい口調と人格
- テーマから逸れない一貫性のある議論

回答は{name}の発言内容のみを返してください。説明や注釈は不要です。
日本語で200文字程度で簡潔に発言してください。
</instructions>
</discussion_context>"#,
        discussion_topic = discussion_topic,
        name = name,
        role = role, 
        description = description,
        conversation_history = if conversation_history.is_empty() { 
            "まだ発言はありません。議論を開始してください。".to_string() 
        } else { 
            conversation_history 
        }
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
    
    let participants_list = participants.join(", ");
    let xml_prompt = format!(
        r#"<discussion_start>
<topic>{topic}</topic>
<participants>{participants_list}</participants>

<instructions>
議論のテーマは「{topic}」です。
参加者は{participants_list}です。

議論を開始するための導入的な発言をしてください。以下の要素を含めてください：
- テーマの紹介
- 議論の方向性の提案
- 参加者への問いかけ

自然で建設的な議論の開始を促すような発言をお願いします。
</instructions>
</discussion_start>"#,
        topic = topic,
        participants_list = participants_list
    );

    generate_text(xml_prompt).await
}

fn main() {
    println!("🚀 Tauri バックエンド起動");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            is_model_loaded,
            generate_text,
            generate_ai_response,
            start_discussion
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}