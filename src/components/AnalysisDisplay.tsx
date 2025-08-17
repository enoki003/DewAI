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

/** 分析結果の構造 */
export interface AnalysisResult {
  mainPoints: { point: string; description: string }[];
  participantStances: { 
    participant: string; 
    stance: string; 
    keyArguments: string[] 
  }[];
  conflicts: { 
    issue: string; 
    sides: string[]; 
    description: string 
  }[];
  progressAssessment: {
    overallProgress: string;
    nextSteps: string[];
    keyChallenges: string[];
  };
}

/** AnalysisDisplay コンポーネントのプロパティ */
export interface AnalysisDisplayProps {
  /** 解析済みの議論情報。未解析時はnull */
  analysis: AnalysisResult | null;
  /** 表示中セッションのメッセージ一覧（統計表示に使用） */
  messages: DiscussionMessage[];
}

/**
 * 議論の分析結果をカード形式で表示します。
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
