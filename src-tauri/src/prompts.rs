// プロンプト管理モジュール
// 各種AI操作用のプロンプトテンプレートを一元管理
const TPL_DISCUSSION_ANALYSIS: &str = r#"<discussion_analysis>
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

{
  "mainPoints": [
    {
      "point": "論点の具体的な内容",
      "description": "論点の詳細説明"
    }
  ],
  "participantStances": [
    {
      "participant": "参加者名",
      "stance": "その参加者の立場・主張",
      "keyArguments": ["主要な論拠1", "主要な論拠2"]
    }
  ],
  "conflicts": [
    {
      "issue": "対立している具体的な問題",
      "sides": ["立場A", "立場B"],
      "description": "対立の詳細"
    }
  ],
  "commonGround": [
    "共通認識1",
    "共通認識2"
  ],
  "unexploredAreas": [
    "未探索トピック1",
    "未探索トピック2"
  ]
}

重要：
- 必ず有効なJSON形式で応答すること
</instructions>
</discussion_analysis>"#;

const TPL_AI_PROFILES: &str = r#"<ai_profiles_generation>
<topic>{discussion_topic}</topic>
<count>{count}</count>
<hints>{hint_line}</hints>

<instructions>
次の議論テーマに適したAI参加者プロフィールを{count}名分、JSON配列のみで生成してください。
各要素は必ず次のキーを含めてください： name, role, description。

要件：
- name: 参加者の短い日本語の名前（一般的な人名）。　テーマにそぐわなくてよいから、多様な名前を使用してください。
- role: テーマに関連する役職/立場/専門領域。
- description: 100文字前後で、その人物の視点・価値観・発言スタイルを簡潔に説明。　テーマにそぐわなくてよいから、個性的な視点を持たせてください。
- 視点がバラけるように、賛成・反対・懐疑・中立・実務など多様性を持たせる。テーマにそぐわなくてよいから、個性的な視点を持たせてください。
- 参加者同士で名前・役割の重複は避ける。

出力フォーマット（必ず純粋なJSONのみにしてください。）：

[
  { "name": "", "role": "", "description": "" }
]
</instructions>
</ai_profiles_generation>"#;

// XMLエスケープ（最低限）
fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
     .replace('\'', "&apos;")
}

/// AI応答生成用のプロンプトテンプレートを構築
pub fn build_ai_response_prompt(
    participant_name: &str,
    role: &str,
    description: &str,
    conversation_history: &str,
    discussion_topic: &str,
) -> String {
    let formatted_history = if conversation_history.is_empty() {
        "まだ発言はありません。議論を開始してください。".to_string()
    } else {
        // 会話履歴を最適化（最新15発言程度に制限してパフォーマンス向上）
        optimize_conversation_for_analysis(conversation_history, 15)
    };
    let topic_e = xml_escape(discussion_topic);
    let name_e = xml_escape(participant_name);
    let role_e = xml_escape(role);
    let desc_e = xml_escape(description);
    let hist_e = xml_escape(&formatted_history);

    format!(
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
議論を深めるために、以下のいずれかの要素を含めてください：

1. 深掘りの要素
2. 新しい視点の提供
3. 建設的な対話

</discussion_guidelines>

<instructions>
あなたは{participant_name}で、役職または職業が{role}です。{description}

議論のテーマは「{discussion_topic}」です。
上記のdiscussion_guidelinesに従い、議論を深める発言をしてください。

重要：会話履歴で「ユーザー」と表示されているのは参加者の一人です。そして、あなたはあくまで{participant_name}であり、{participant_name}として発言してください。

必須要件：
- 前の発言者に具体的に反応する（質問に対しては意見を、意見に対しては反応を）
- 「ユーザー」が質問をしている場合は、質問に対する自分の立場を明確に表明する
- 「ユーザー」が意見を述べている場合は、その意見に対して賛成・反対・補足などの反応をする
- 具体例、疑問、仮定、検証のいずれかを含める
- {participant_name}らしい視点と口調を維持
- 議論を前進させる内容にする
- 人間の参加者（ユーザー）の意見を尊重し、適切に応答する
- 発言は一言二言程度で、短くすることを心がけてください


回答は{participant_name}の発言内容のみを返してください。説明や注釈は不要です。
日本語で口語の文章で発言してください。
</instructions>
</discussion_context>"#,
        discussion_topic = topic_e,
        participant_name = name_e,
        role = role_e,
        description = desc_e,
        conversation_history = hist_e
    )
}

/// 議論開始用のプロンプトテンプレートを構築
pub fn build_discussion_start_prompt(topic: &str, participants: &[String]) -> String {
    let participants_list = participants.iter().map(|s| xml_escape(s)).collect::<Vec<_>>().join(", ");
    let topic_e = xml_escape(topic);
    
    format!(
        r#"<discussion_start>
<topic>{topic}</topic>
<participants>{participants_list}</participants>

<instructions>
議論のテーマは「{topic}」です。
参加者は{participants_list}です。

議論を開始するための導入的な発言をしてください。以下の要素を含めてください：
- 主張の提示
- 主張の根拠
- 参加者への問いかけ

自然で建設的な議論の開始を促すような発言をお願いします。
</instructions>
</discussion_start>"#,
        topic = topic_e,
        participants_list = participants_list
    )
}

/// 議論分析用のプロンプトテンプレートを構築
pub fn build_discussion_analysis_prompt(
    discussion_topic: &str,
    conversation_history: &str,
    participants: &[String],
) -> String {
    let participants_list = participants.iter().map(|s| xml_escape(s)).collect::<Vec<_>>().join(", ");
    let topic_e = xml_escape(discussion_topic);
    let hist_e = xml_escape(conversation_history);

    TPL_DISCUSSION_ANALYSIS
        .replace("{discussion_topic}", &topic_e)
        .replace("{participants_list}", &participants_list)
        .replace("{conversation_history}", &hist_e)
}

/// 議論要約用のプロンプトテンプレートを構築
pub fn build_discussion_summary_prompt(
    discussion_topic: &str,
    conversation_history: &str,
    participants: &[String],
) -> String {
    let participants_list = participants.iter().map(|s| xml_escape(s)).collect::<Vec<_>>().join(", ");
    let topic_e = xml_escape(discussion_topic);
    let hist_e = xml_escape(conversation_history);
    
    format!(
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
        discussion_topic = topic_e,
        participants_list = participants_list,
        conversation_history = hist_e
    )
}

/// インクリメンタル要約プロンプト（既存要約 + 差分発言を統合して新しい要約を再構築）
pub fn build_incremental_summary_prompt(
    discussion_topic: &str,
    previous_summary: &str,
    new_messages: &str,
    participants: &[String],
) -> String {
    let topic_e = xml_escape(discussion_topic);
    let prev_e = xml_escape(previous_summary);
    let diff_e = xml_escape(new_messages);
    let participants_list = participants.iter().map(|s| xml_escape(s)).collect::<Vec<_>>().join(", ");
    format!(r#"<incremental_discussion_summary>
<topic>{topic}</topic>
<participants>{participants}</participants>

<previous_summary>
{previous_summary}
</previous_summary>

<new_messages>
{new_messages}
</new_messages>

<instructions>
上記の previous_summary はこれまでの議論の要約です。new_messages は今回新たに追加された発言のみです。
これらを統合し、同じフォーマット/粒度で最新の包括的要約を再生成してください。

要件:
- 既存の重要論点/未解決事項を維持しつつ、新規発言で追加/修正/解決された点を反映
- 重複は統合し簡潔化
- 以前の要約から削除すべき内容が明確な場合のみ削除（根拠のなく失われた情報は削除しない）
- 形式は従来の【議論の争点】【提起された具体例・事例】... 等の見出し構造をそのまま踏襲
- 追加された具体例/仮定/未解決課題を適切なセクションに組み込む
- 出力は完全な最新要約のみ（差分表示や説明文を含めない）
</instructions>
</incremental_discussion_summary>"#,
        topic = topic_e,
        participants = participants_list,
        previous_summary = prev_e,
        new_messages = diff_e,
    )
}

/// 会話履歴を分析用に最適化（重要な発言のみ抽出・要約）
pub fn optimize_conversation_for_analysis(conversation_history: &str, max_messages: usize) -> String {
    if conversation_history.is_empty() || conversation_history == "まだ発言はありません。議論を開始してください。" {
        return "まだ発言はありません。".to_string();
    }

    let msgs = split_messages_heuristic(conversation_history);
    if msgs.len() <= max_messages {
        return conversation_history.to_string();
    }

    let start = msgs.len().saturating_sub(max_messages);
    let recent = msgs[start..].join("\n");
    format!("{}[...以前の発言は省略...]", recent)
}

/// AI参加者設定（名前・役職・説明）をJSONで生成するプロンプト
pub fn build_ai_profiles_prompt(
    discussion_topic: &str,
    desired_count: usize,
    style_hint: &str,
) -> String {
    // バリデーションは呼び出し側に委ねたいが、当面は上限のみ適用
    let count = if desired_count == 0 { 1 } else { desired_count.min(10) };
    let hint_line = if style_hint.is_empty() {
        String::from("（特別な指定はありません）")
    } else {
        format!("ヒント: {}", xml_escape(style_hint))
    };

    let topic_e = xml_escape(discussion_topic);

    TPL_AI_PROFILES
        .replace("{discussion_topic}", &topic_e)
        .replace("{count}", &count.to_string())
        .replace("{hint_line}", &hint_line)
}

// ---（以下 split_messages_heuristic など既存の補助関数がこの下にある場合そのまま）---
// 既存のヘルパー関数がこのファイル末尾にあるなら保持

/// 発言履歴文字列をざっくり行単位で分割するヒューリスティック関数（元実装から必要最小限再構築）
fn split_messages_heuristic(history: &str) -> Vec<String> {
    let mut out = Vec::new();
    for line in history.split('\n') {
        let trimmed = line.trim();
        if trimmed.is_empty() { continue; }
        // 発言者ラベルっぽいパターンで始まるか、適度な長さの文を1行として扱う
        if trimmed.contains(':') || trimmed.chars().count() > 8 {
            out.push(trimmed.to_string());
        }
    }
    if out.is_empty() && !history.trim().is_empty() {
        out.push(history.trim().to_string());
    }
    out
}
