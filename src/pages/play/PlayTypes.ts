// 共通の型定義（Playページ関連）

export interface TalkMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

export interface BotProfile {
  name: string;
  role: string;
  description: string;
}

export interface ScreenConfig {
  discussionTopic: string;
  aiData: BotProfile[];
  participate: boolean; // ユーザーが参加するか
}

// 議論分析結果の型（AnalysisPanel/Playの両方で利用）
export interface DiscussionAnalysis {
  mainPoints: Array<{
    point: string;
    description: string;
  }>;
  participantStances: Array<{
    participant: string;
    stance?: string;
    keyArguments?: string[];
  }>;
  conflicts: Array<{
    issue: string;
    description?: string;
    sides?: string[];
  }>;
  commonGround: string[];
  unexploredAreas: string[];
}
