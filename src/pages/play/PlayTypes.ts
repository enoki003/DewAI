// 共通型定義（Playページ周辺）

export interface BotProfile {
  name: string;
  role: string;
  description: string;
}

export interface TalkMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

export interface ScreenConfig {
  aiData: BotProfile[];
  participate: boolean;
  discussionTopic: string;
}

export interface DiscussionAnalysis {
  mainPoints: { point: string; description: string }[];
  participantStances: {
    participant: string;
    stance: string;
    keyArguments: string[];
  }[];
  conflicts: {
    issue: string;
    sides: string[];
    description: string;
  }[];
  commonGround: string[];
  unexploredAreas: string[];
}
