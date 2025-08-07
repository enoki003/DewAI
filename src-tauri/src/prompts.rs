// プロンプト管理モジュール
// 各種AI操作用のプロンプトテンプレートを一元管理

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
議論を深めるために、以下のいずれかの要素を必ず含めてください：

1. 前の発言者への適切な反応
   - 質問に対しては：「〜という問いについて、私は...」「この問題については...」
   - 意見に対しては：「〜という意見について」「先ほどの〜の件ですが」「〜の指摘は興味深いですね」

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
        conversation_history = formatted_history
    )
}

/// 議論開始用のプロンプトテンプレートを構築
pub fn build_discussion_start_prompt(topic: &str, participants: &[String]) -> String {
    let participants_list = participants.join(", ");
    
    format!(
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
    )
}

/// 議論分析用のプロンプトテンプレートを構築
pub fn build_discussion_analysis_prompt(
    discussion_topic: &str,
    conversation_history: &str,
    participants: &[String],
) -> String {
    let participants_list = participants.join(", ");
    
    format!(
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
    )
}

/// 議論要約用のプロンプトテンプレートを構築
pub fn build_discussion_summary_prompt(
    discussion_topic: &str,
    conversation_history: &str,
    participants: &[String],
) -> String {
    let participants_list = participants.join(", ");
    
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
        discussion_topic = discussion_topic,
        participants_list = participants_list,
        conversation_history = conversation_history
    )
}

/// 会話履歴を分析用に最適化（重要な発言のみ抽出・要約）
pub fn optimize_conversation_for_analysis(conversation_history: &str, max_messages: usize) -> String {
    if conversation_history.is_empty() || conversation_history == "まだ発言はありません。議論を開始してください。" {
        return "まだ発言はありません。".to_string();
    }

    // 発言を行単位で分割（簡易的な実装）
    let lines: Vec<&str> = conversation_history.lines().collect();
    
    if lines.len() <= max_messages {
        return conversation_history.to_string();
    }

    // 直近のmax_messages件の発言を取得
    let recent_messages = lines.iter()
        .rev()
        .take(max_messages)
        .rev()
        .cloned()
        .collect::<Vec<_>>()
        .join("\n");

    format!("{}[...以前の発言は省略...]", recent_messages)
}

/// 議論分析用プロンプト（最近の発言のみを対象）
pub fn build_lightweight_discussion_analysis_prompt(
    discussion_topic: &str,
    conversation_history: &str,
    participants: &[String],
) -> String {
    let participants_list = participants.join(", ");
    
    // 会話履歴を最適化（最新10発言程度に制限）
    let optimized_history = optimize_conversation_for_analysis(conversation_history, 10);
    
    format!(
        r#"<discussion_analysis>
<topic>{discussion_topic}</topic>
<participants>{participants_list}</participants>

<recent_conversation>
{optimized_history}
</recent_conversation>

<instructions>
直近の議論内容を分析し、以下の要素を簡潔に抽出してください：

1. **現在の主要論点** - 最近の発言で議論されている具体的な争点（最大3点）
2. **活発な参加者の立場** - 最近発言した参加者の現在の見解
3. **新たな対立点** - 最近浮上した意見の相違（あれば）
4. **直近の議論の方向性** - 議論がどの方向に進んでいるか

JSON形式で以下の構造で出力してください：

{{
  "currentMainPoints": [
    {{
      "point": "論点の具体的な内容",
      "recentness": "高/中/低"
    }}
  ],
  "activeParticipants": [
    {{
      "participant": "参加者名",
      "recentStance": "最近の立場・主張",
      "engagement": "発言の活発度（高/中/低）"
    }}
  ],
  "newConflicts": [
    {{
      "issue": "新たに対立している問題",
      "description": "対立の概要"
    }}
  ],
  "discussionDirection": "議論の現在の方向性（一文で）"
}}

重要：
- 最近の発言内容のみに基づいて分析する
- 「ユーザー」も他の参加者と同様に分析対象に含める
- 推測は避け、実際の発言に基づいた分析のみ行う
- 出力は純粋なJSONのみで、マークダウンのコードブロックや説明文は一切含めない
- 必ず有効なJSON形式で応答すること
</instructions>
</discussion_analysis>"#,
        discussion_topic = discussion_topic,
        participants_list = participants_list,
        optimized_history = optimized_history
    )
}
