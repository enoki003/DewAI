#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::command;
use reqwest::Client;
use serde_json::json;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SavedSession {
    pub id: i64,
    pub topic: String,
    pub participants: String, // JSON string
    pub messages: String, // JSON string
    pub created_at: String,
    pub updated_at: String,
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
    participant_name: String,
    role: String,
    description: String,
    conversation_history: String,
    discussion_topic: String,
) -> Result<String, String> {
    println!("🤖 generate_ai_response 呼び出し: participant_name={}, role={}, description={}, conversation_history={}, discussion_topic={}", 
        participant_name, role, description, conversation_history, discussion_topic);
    
    let xml_prompt = format!(
        r#"<discussion_context>
<discussion_topic>{discussion_topic}</discussion_topic>

<participant>
<name>{participant_name}</name>
<role>{role}</role>
<description>{description}</description>
</participant>

<conversation_history>
{conversation_history}
</conversation_history>

<discussion_guidelines>
議論を深めるために、以下のいずれかの要素を必ず含めてください：

1. 前の発言者への適切な反応
   - 質問に対しては：「〜という問いについて、私は...」「この問題については...」
   - 意見に対しては：「〜さんの〜という意見について」「先ほどの〜の件ですが」「〜の指摘は興味深いですね」

2. 深掘りの要素
   - 具体例や事例の提示
   - "なぜ〜なのでしょうか？"という疑問
   - "もし〜だったらどうでしょう？"という仮定
   - "実際には〜ではないでしょうか"という検証

3. 新しい視点の提供
   - "別の角度から考えると"
   - "〜の観点では"
   - "実践的には"
   - "長期的に見ると"

4. 建設的な対話
   - 反対意見でも理由を明確に
   - 代替案や改善案の提示
   - 共通点の発見と課題の明確化
</discussion_guidelines>

<instructions>
あなたは{participant_name}という{role}です。{description}

議論のテーマは「{discussion_topic}」です。
上記のdiscussion_guidelinesに従い、議論を深める発言をしてください。

重要：会話履歴で「ユーザー」と表示されているのは実際の人間の参加者です。この発言は必ず考慮に入れてください。

必須要件：
- 前の発言者に具体的に反応する（質問に対しては意見を、意見に対しては反応を）
- 「ユーザー」が質問をしている場合は、質問に対する自分の立場を明確に表明する
- 「ユーザー」が意見を述べている場合は、その意見に対して賛成・反対・補足などの反応をする
- 具体例、疑問、仮定、検証のいずれかを含める
- {participant_name}らしい視点と口調を維持
- 議論を前進させる内容にする
- 人間の参加者（ユーザー）の意見を尊重し、適切に応答する

回答は{participant_name}の発言内容のみを返してください。説明や注釈は不要です。
日本語で250文字程度で発言してください。
</instructions>
</discussion_context>"#,
        discussion_topic = discussion_topic,
        participant_name = participant_name,
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

// 議論分析エンジン - 論点と立場をリアルタイム分析
#[command]
async fn analyze_discussion_points(
    discussion_topic: String,
    conversation_history: String,
    participants: Vec<String>,
) -> Result<String, String> {
    println!("🔍 analyze_discussion_points 呼び出し");
    
    let participants_list = participants.join(", ");
    let xml_prompt = format!(
        r#"<discussion_analysis>
<topic>{discussion_topic}</topic>
<participants>{participants_list}</participants>

<current_conversation>
{conversation_history}
</current_conversation>

<instructions>
この議論を分析し、以下の要素を抽出してください：

1. **主要論点** - 議論の中心となっている具体的な争点
2. **各参加者の立場** - 参加者ごとの現在の見解や主張
3. **対立点** - 参加者間で意見が分かれている具体的なポイント
4. **共通認識** - 参加者が共有している認識や合意点
5. **未探索領域** - まだ十分に議論されていない関連トピック

JSON形式で以下の構造で出力してください：

{{
  "mainPoints": [
    {{
      "point": "論点の具体的な内容",
      "description": "論点の詳細説明"
    }}
  ],
  "participantStances": [
    {{
      "participant": "参加者名",
      "stance": "その参加者の立場・主張",
      "keyArguments": ["主要な論拠1", "主要な論拠2"]
    }}
  ],
  "conflicts": [
    {{
      "issue": "対立している具体的な問題",
      "sides": ["立場A", "立場B"],
      "description": "対立の詳細"
    }}
  ],
  "commonGround": [
    "共通認識1",
    "共通認識2"
  ],
  "unexploredAreas": [
    "未探索トピック1",
    "未探索トピック2"
  ]
}}

重要：
- 参加者の立場は現在の発言に基づいて動的に分析する
- 「ユーザー」も他の参加者と同様に分析対象に含める
- 実際の発言内容から具体的に抽出する
- 推測や仮定は避け、発言に基づいた分析のみ行う
- 出力は純粋なJSONのみで、マークダウンのコードブロック（```json）や説明文は一切含めない
- 必ず有効なJSON形式で応答すること
</instructions>
</discussion_analysis>"#,
        discussion_topic = discussion_topic,
        participants_list = participants_list,
        conversation_history = conversation_history
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
    
    let participants_list = participants.join(", ");
    let xml_prompt = format!(
        r#"<discussion_summary>
<topic>{discussion_topic}</topic>
<participants>{participants_list}</participants>

<conversation_to_summarize>
{conversation_history}
</conversation_to_summarize>

<instructions>
以下の議論を要約してください。テーマは「{discussion_topic}」です。

重要：各参加者の「立場」を固定化せず、「議論の争点」を中心に要約してください。

要約に含めるべき要素：
1. 議論で浮上した主要な争点・論点
2. 提起された具体例や事例
3. 検証が必要な仮定や課題
4. 参加者間で生まれた疑問や質問
5. 未解決の問題や深掘りが必要な点

要約は以下の形式で出力してください：

【議論の争点】
- 争点1: [具体的な論点]
- 争点2: [具体的な論点]

【提起された具体例・事例】
- [具体例1]
- [具体例2]

【検証が必要な仮定】
- [仮定1]: [検証ポイント]
- [仮定2]: [検証ポイント]

【未解決の課題】
- [課題1]: [深掘りの必要性]
- [課題2]: [検討が必要な理由]

【次の議論の方向性】
- [継続すべき論点]
- [新たに検討すべき視点]

この要約により、議論が深化し続けるようにしてください。
</instructions>
</discussion_summary>"#,
        discussion_topic = discussion_topic,
        participants_list = participants_list,
        conversation_history = conversation_history
    );

    generate_text(xml_prompt).await
}

// データベース関連のコマンド（一時的に簡易実装）

// 議論セッションを保存
#[command]
async fn save_discussion_session(
    topic: String,
    _participants: String,
    _messages: String,
) -> Result<String, String> {
    println!("💾 議論セッション保存: {}", topic);
    
    // 一時的に簡単な実装 - 後でデータベースに置き換える
    let session_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    Ok(format!("session_{}", session_id))
}

// 保存された議論セッションの一覧を取得
#[command]
async fn get_saved_sessions() -> Result<Vec<SavedSession>, String> {
    println!("📚 保存済みセッション一覧取得");
    
    // 一時的にダミーデータを返す
    let sessions = vec![
        SavedSession {
            id: 1,
            topic: "AIの倫理について".to_string(),
            participants: "[\"哲学者\", \"技術者\", \"倫理学者\"]".to_string(),
            messages: "[]".to_string(),
            created_at: "2024-01-01 10:00:00".to_string(),
            updated_at: "2024-01-01 11:00:00".to_string(),
        }
    ];
    
    Ok(sessions)
}

// 特定のセッションを取得
#[command]
async fn get_session_by_id(session_id: i64) -> Result<SavedSession, String> {
    println!("📖 セッション取得: ID {}", session_id);
    
    // 一時的にダミーデータを返す
    Ok(SavedSession {
        id: session_id,
        topic: "AIの倫理について".to_string(),
        participants: "[\"哲学者\", \"技術者\", \"倫理学者\"]".to_string(),
        messages: "[]".to_string(),
        created_at: "2024-01-01 10:00:00".to_string(),
        updated_at: "2024-01-01 11:00:00".to_string(),
    })
}

// セッションを更新（会話を継続した場合）
#[command]
async fn update_discussion_session(
    session_id: i64,
    _messages: String,
) -> Result<(), String> {
    println!("📝 セッション更新: ID {}", session_id);
    
    // 一時的に何もしない
    Ok(())
}

// セッションを削除
#[command]
async fn delete_session(session_id: i64) -> Result<(), String> {
    println!("🗑️ セッション削除: ID {}", session_id);
    
    // 一時的に何もしない
    Ok(())
}

fn main() {
    println!("🚀 Tauri バックエンド起動");

    // 一時的にSQLプラグインとマイグレーションを無効化
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            is_model_loaded,
            generate_text,
            generate_ai_response,
            start_discussion,
            summarize_discussion,
            analyze_discussion_points,
            save_discussion_session,
            get_saved_sessions,
            get_session_by_id,
            update_discussion_session,
            delete_session
        ])
        .run(tauri::generate_context!())
        .expect("Tauri 起動失敗");
}
