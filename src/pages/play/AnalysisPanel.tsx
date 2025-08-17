/**
 * @packageDocumentation
 * 議論分析パネル。Playページで生成された `DiscussionAnalysis` を視覚的に表示し、
 * 必要に応じて再分析（最新分析の実行）をトリガーできるUIを提供します。
 */

import { Box, HStack, Text, Badge, Button } from '@chakra-ui/react';
import { DiscussionAnalysis } from './PlayTypes';

/**
 * `AnalysisPanel` の受け渡しプロパティ。
 */
export interface AnalysisPanelProps {
  /** 分析結果（未実行時は null） */
  analysis: DiscussionAnalysis | null;
  /** 分析実行中フラグ（ボタンの活性状態と表示に利用） */
  analyzing: boolean;
  /** 分析の再実行ハンドラ（最新状態での再解析を呼び出す） */
  onRefresh: () => void;
  /** 再分析が可能か（メッセージが十分に存在する等の条件を満たすと true） */
  canRefresh: boolean;
}

/**
 * 議論分析結果を表示するパネル。
 *
 * - 主要論点/各参加者の立場/主な対立点/共通認識/未探索の論点 をカード/バッジで表示
 * - `canRefresh=true` のときに「最新分析を実行」ボタンを表示
 */
export function AnalysisPanel({
  analysis,
  analyzing,
  onRefresh,
  canRefresh,
}: AnalysisPanelProps) {
  return (
    <>
      <HStack justify="space-between" align="center" mb={3}>
        <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
        {canRefresh && (
          <Button size="xs" colorPalette="green" variant="outline" onClick={onRefresh} disabled={analyzing}>{analyzing ? '分析中...' : '最新分析を実行'}</Button>
        )}
      </HStack>

      {!analysis && (
        <Box textAlign="center" py={8}>
          <Text color="fg.muted" mb={3}>まだ分析データがありません</Text>
          {canRefresh ? (
            <Button size="sm" colorPalette="green" onClick={onRefresh} disabled={analyzing}>{analyzing ? '分析中...' : '議論を分析する'}</Button>
          ) : (
            <Text fontSize="sm" color="fg.muted">議論が進むと分析できるようになります</Text>
          )}
        </Box>
      )}

      {analysis && (
        <>
          {analysis.mainPoints && analysis.mainPoints.length > 0 && (
            <Box mb={4}>
              <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🎯 主要論点</Text>
              {analysis.mainPoints.map((point, index) => (
                <Box key={index} mb={2} p={3} bg="green.subtle" borderRadius="md" borderLeft="4px solid" borderColor="green.solid">
                  <Text fontWeight="semibold" fontSize="sm">{point.point}</Text>
                  <Text fontSize="xs" color="fg.muted" mt={1}>{point.description}</Text>
                </Box>
              ))}
            </Box>
          )}

          {analysis.participantStances && analysis.participantStances.length > 0 && (
            <Box mb={4}>
              <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">👥 各参加者の立場</Text>
              {analysis.participantStances.map((stance, index) => (
                <Box key={index} mb={3} p={3} bg="green.subtle" borderRadius="md">
                  <Text fontWeight="bold" fontSize="sm" color="green.fg">{stance.participant === 'ユーザー' ? 'あなた' : stance.participant}</Text>
                  <Text fontSize="sm" mt={1}>{stance.stance}</Text>
                  {stance.keyArguments && stance.keyArguments.length > 0 && (
                    <Box mt={2}>
                      <Text fontSize="xs" color="fg.muted" mb={1}>主な論拠:</Text>
                      {stance.keyArguments.map((arg, argIndex) => (
                        <Text key={argIndex} fontSize="xs" color="fg.subtle" ml={2}>• {arg}</Text>
                      ))}
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          )}

          {analysis.conflicts && analysis.conflicts.length > 0 && (
            <Box mb={4}>
              <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">⚔️ 主な対立点</Text>
              {analysis.conflicts.map((conflict, index) => (
                <Box key={index} mb={2} p={3} bg="red.subtle" borderRadius="md" borderLeft="4px solid" borderColor="red.solid">
                  <Text fontWeight="semibold" fontSize="sm">{conflict.issue}</Text>
                  <Text fontSize="xs" color="fg.muted" mt={1}>{conflict.description}</Text>
                  <HStack mt={2} gap={1} wrap="wrap">
                    {conflict.sides && conflict.sides.map((side, sideIndex) => (
                      <Badge key={sideIndex} colorPalette="red" variant="subtle" size="xs">{side}</Badge>
                    ))}
                  </HStack>
                </Box>
              ))}
            </Box>
          )}

          {analysis.commonGround && analysis.commonGround.length > 0 && (
            <Box>
              <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🤝 共通認識</Text>
              {analysis.commonGround.map((common, index) => (
                <Box key={index} mb={2} p={3} bg="green.subtle" borderRadius="md" borderLeft="4px solid" borderColor="green.solid">
                  <Text fontSize="sm">{common}</Text>
                </Box>
              ))}
            </Box>
          )}

          {analysis.unexploredAreas && analysis.unexploredAreas.length > 0 && (
            <Box>
              <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🔍 未探索の論点</Text>
              <HStack wrap="wrap" gap={1}>
                {analysis.unexploredAreas.map((area, index) => (
                  <Badge key={index} colorPalette="green" variant="subtle" size="sm">{area}</Badge>
                ))}
              </HStack>
            </Box>
          )}
        </>
      )}
    </>
  );
}
