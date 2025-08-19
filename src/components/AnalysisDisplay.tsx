/**
 * @packageDocumentation
 * 議論の分析結果を視覚的に表示するコンポーネント群。
 * - 主な論点の表示
 * - 参加者の立場の可視化
 * - 対立点の明示
 * - 進行状況評価と簡易統計の表示
 */

/**
 * 議論の分析結果を視覚的に表示するコンポーネント群。
 * - 主な論点
 * - 参加者の立場
 * - 対立点
 * - 進行状況評価 と簡易統計
 */

import React from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Badge 
} from '@chakra-ui/react';

/** 議論メッセージの最小構造 */
export interface DiscussionMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

/** 
 * 議論の分析結果データ構造。
 * AI分析により生成される包括的な議論分析情報を格納します。
 */
export interface AnalysisResult {
  /** 
   * 主な論点の配列。
   * 議論で取り上げられた重要なポイントとその説明。
   */
  mainPoints: { 
    /** 論点の要約 */
    point: string; 
    /** 論点の詳細説明 */
    description: string 
  }[];
  
  /** 
   * 参加者ごとの立場や主張。
   * 各参加者の意見の立ち位置を整理したもの。
   */
  participantStances: { 
    /** 参加者名（"ユーザー" または AI名） */
    participant: string; 
    /** その参加者の立場・主張の要約 */
    stance: string; 
    /** 立場を支える主要な論拠の配列 */
    keyArguments: string[] 
  }[];
  
  /** 
   * 争点や対立箇所。
   * 参加者間で意見が分かれている論点の詳細。
   */
  conflicts: { 
    /** 対立している具体的論点 */
    issue: string; 
    /** 代表的な立場の側（例: "賛成", "慎重論" など） */
    sides: string[]; 
    /** 対立の背景や補足説明 */
    description: string 
  }[];
  
  /** 
   * 進行状況の評価。
   * 議論の現状と今後の方向性に関する分析。
   */
  progressAssessment: {
    /** 全体的な進行状況の評価 */
    overallProgress: string;
    /** 今後の議論で取り組むべき次のステップ */
    nextSteps: string[];
    /** 現在直面している主要な課題 */
    keyChallenges: string[];
  };
}

/** 
 * AnalysisDisplay コンポーネントのプロパティ。
 * 分析結果表示に必要なデータを定義します。
 */
export interface AnalysisDisplayProps {
  /** 
   * 解析済みの議論情報。
   * null の場合は「分析待ち」メッセージを表示します。
   */
  analysis: AnalysisResult | null;
  /** 
   * 表示中セッションのメッセージ一覧。
   * 統計情報（メッセージ数など）の表示に使用されます。
   */
  messages: DiscussionMessage[];
}

/**
 * 議論の分析結果をカード形式で表示するコンポーネント。
 * 
 * AI分析により生成された議論の分析情報を視覚的に整理して表示します。
 * 表示内容：
 * - 主要な論点とその説明
 * - 参加者ごとの立場と根拠
 * - 対立点と争点の詳細
 * - 進行状況評価と今後の方向性
 * - 簡易統計情報（メッセージ数、参加者数など）
 * 
 * @param props - コンポーネントのプロパティ
 * @returns 分析結果表示要素または分析待ちメッセージ
 * 
 * @example
 * ```tsx
 * <AnalysisDisplay
 *   analysis={discussionAnalysis}
 *   messages={allMessages}
 * />
 * ```
 */
export const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({
  analysis,
  messages
}) => {
  if (!analysis) {
    return (
      <Box p={4} borderRadius="md" bg="gray.50">
        <Text color="gray.500" textAlign="center">
          議論が進むと分析結果がここに表示されます
        </Text>
      </Box>
    );
  }

  return (
    <VStack gap={6} align="stretch">
      {/* 主要なポイント */}
      <Box>
        <Text fontWeight="bold" mb={3} color="green.600">
          🎯 主要なポイント
        </Text>
        <VStack gap={2} align="stretch">
          {analysis.mainPoints.map((point, index) => (
            <Box key={index} p={3} bg="green.50" borderRadius="md">
              <Text fontWeight="semibold">{point.point}</Text>
              <Text fontSize="sm" color="gray.600" mt={1}>
                {point.description}
              </Text>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* 参加者の立場 */}
      <Box>
        <Text fontWeight="bold" mb={3} color="blue.600">
          👥 参加者の立場
        </Text>
        <VStack gap={3} align="stretch">
          {analysis.participantStances.map((stance, index) => (
            <Box key={index} p={3} bg="blue.50" borderRadius="md">
              <HStack justify="space-between" mb={2}>
                <Badge colorPalette="blue">{stance.participant}</Badge>
                <Text fontSize="sm" fontWeight="semibold">
                  {stance.stance}
                </Text>
              </HStack>
              <VStack align="start" gap={1}>
                {stance.keyArguments.map((arg, argIndex) => (
                  <Text key={argIndex} fontSize="sm" color="gray.700">
                    • {arg}
                  </Text>
                ))}
              </VStack>
            </Box>
          ))}
        </VStack>
      </Box>

      {/* 対立点 */}
      {analysis.conflicts.length > 0 && (
        <Box>
          <Text fontWeight="bold" mb={3} color="red.600">
            ⚡ 対立点・争点
          </Text>
          <VStack gap={3} align="stretch">
            {analysis.conflicts.map((conflict, index) => (
              <Box key={index} p={3} bg="red.50" borderRadius="md">
                <Text fontWeight="semibold" mb={2}>{conflict.issue}</Text>
                <Text fontSize="sm" color="gray.700" mb={2}>
                  {conflict.description}
                </Text>
                <HStack wrap="wrap" gap={2}>
                  {conflict.sides.map((side, sideIndex) => (
                    <Badge key={sideIndex} colorPalette="red" variant="outline">
                      {side}
                    </Badge>
                  ))}
                </HStack>
              </Box>
            ))}
          </VStack>
        </Box>
      )}

      {/* 進行状況評価 */}
      <Box>
        <Text fontWeight="bold" mb={3} color="purple.600">
          📊 進行状況評価
        </Text>
        <VStack gap={3} align="stretch">
          <Box p={3} bg="purple.50" borderRadius="md">
            <Text fontWeight="semibold" mb={2}>全体的な進行状況</Text>
            <Text fontSize="sm" color="gray.700">
              {analysis.progressAssessment.overallProgress}
            </Text>
          </Box>
          
          <Box p={3} bg="orange.50" borderRadius="md">
            <Text fontWeight="semibold" mb={2}>次のステップ</Text>
            <VStack align="start" gap={1}>
              {analysis.progressAssessment.nextSteps.map((step, index) => (
                <Text key={index} fontSize="sm" color="gray.700">
                  • {step}
                </Text>
              ))}
            </VStack>
          </Box>
          
          <Box p={3} bg="yellow.50" borderRadius="md">
            <Text fontWeight="semibold" mb={2}>主要な課題</Text>
            <VStack align="start" gap={1}>
              {analysis.progressAssessment.keyChallenges.map((challenge, index) => (
                <Text key={index} fontSize="sm" color="gray.700">
                  • {challenge}
                </Text>
              ))}
            </VStack>
          </Box>
        </VStack>
      </Box>

      {/* 統計情報 */}
      <Box p={3} bg="gray.100" borderRadius="md">
        <Text fontWeight="semibold" mb={2}>📈 議論統計</Text>
        <HStack gap={4} fontSize="sm" color="gray.600">
          <Text>総メッセージ数: {messages.length}</Text>
          <Text>参加者数: {analysis.participantStances.length}</Text>
          <Text>争点数: {analysis.conflicts.length}</Text>
        </HStack>
      </Box>
    </VStack>
  );
};
