// 共通型定義（Playページ周辺）

/**
 * AI参加者のプロフィール
 */
export interface BotProfile {
  /** 表示名（例: "分析家ボット"） */
  name: string;
  /** 役割や肩書き（例: "批判的思考の専門家"） */
  role: string;
  /** ふるまい・口調・専門領域などの説明 */
  description: string;
}

/**
 * チャットの1メッセージ
 */
export interface TalkMessage {
  /** 話者名（"ユーザー" または AI の name） */
  speaker: string;
  /** 本文。最大1万文字までを想定 */
  message: string;
  /** ユーザー発話かどうか（UIスタイルに利用） */
  isUser: boolean;
  /** 発話時刻 */
  timestamp: Date;
}

/**
 * 画面構成の保存フォーマット
 */
export interface ScreenConfig {
  /** AI参加者一覧 */
  aiData: BotProfile[];
  /** ユーザーが議論に参加するか */
  participate: boolean;
  /** 議論テーマ（例: "生成AIの教育利用"） */
  discussionTopic: string;
}

/**
 * 議論の分析結果
 */
export interface DiscussionAnalysis {
  /** 主な論点の配列 */
  mainPoints: { point: string; description: string }[];
  /** 参加者ごとの立場や主張 */
  participantStances: {
    /** 参加者名（"ユーザー" は人間） */
    participant: string;
    /** その参加者の立場・主張の要約 */
    stance: string;
    /** 立場を支える主要な論拠 */
    keyArguments: string[];
  }[];
  /** 争点や対立箇所 */
  conflicts: {
    /** 対立している具体的論点 */
    issue: string;
    /** 代表的な立場の側（例: "賛成", "慎重論" など） */
    sides: string[];
    /** 対立の背景や補足説明 */
    description: string;
  }[];
  /** 合意点（共有される前提・方針） */
  commonGround: string[];
  /** まだ掘り下げられていない論点 */
  unexploredAreas: string[];
}
