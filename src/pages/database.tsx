/**
 * @packageDocumentation
 * データベース統計ページ。保存済みセッションから簡単な統計（総数/直近7日）を計算して表示します。
 */

import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner, Heading, Badge } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllSessions } from '../utils/database';

/** DB統計の表示用オブジェクト */
interface DatabaseStats {
  total_sessions: number;
  recent_sessions: number;
}

/**
 * データベース統計を表示するページコンポーネント。
 *
 * - getAllSessions() を用いて統計を算出
 * - 再取得ボタン/セッション一覧への導線を提供
 */
export default function DatabasePage() {
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStats();
  }, []);

  /** 統計の再取得 */
  const loadStats = async () => {
    try {
      setLoading(true);
      // SQLite から統計を計算
      const sessions = await getAllSessions();
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      
      const recentSessions = sessions.filter(session => {
        const sessionDate = new Date(session.updated_at);
        return sessionDate >= sevenDaysAgo;
      });
      
      const dbStats: DatabaseStats = {
        total_sessions: sessions.length,
        recent_sessions: recentSessions.length
      };
      
      setStats(dbStats);
    } catch (error) {
      console.error('統計取得エラー:', error);
      alert('データベース統計の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  return (
    <VStack height="100vh" p={6} gap={6}>
      <Button 
        variant="ghost" 
        position="absolute" 
        top={4} 
        left={4}
        onClick={() => navigate('/start')}
      >
        ← 戻る
      </Button>
      
      <VStack gap={4} textAlign="center" maxW="2xl" mx="auto">
        <Heading size="2xl">データベース統計</Heading>
        <Text color="fg.muted">DewAIデータベースの使用状況</Text>
      </VStack>

      {/* 統計情報 */}
      <Box width="100%" maxW="2xl" mx="auto" flex={1}>
        {loading ? (
          <VStack justify="center" align="center" height="200px">
            <Spinner size="lg" />
            <Text>統計を読み込み中...</Text>
          </VStack>
        ) : stats ? (
          <VStack gap={4} width="100%">
            <CardRoot width="100%">
              <CardBody>
                <VStack align="stretch" gap={4}>
                  <Text fontSize="lg" fontWeight="bold" color="green.fg">
                    📊 セッション統計
                  </Text>
                  
                  <HStack justify="space-between">
                    <Text>総セッション数:</Text>
                    <Badge colorPalette="blue" variant="solid" size="lg">
                      {stats.total_sessions}件
                    </Badge>
                  </HStack>
                  
                  <HStack justify="space-between">
                    <Text>直近7日間のセッション:</Text>
                    <Badge colorPalette="green" variant="solid" size="lg">
                      {stats.recent_sessions}件
                    </Badge>
                  </HStack>
                  
                  <Box pt={4} borderTop="1px solid" borderColor="border.muted">
                    <Text fontSize="sm" color="fg.muted">
                      💡 データストレージ: SQLite（ローカルファイル dewai.db）
                    </Text>
                  </Box>
                </VStack>
              </CardBody>
            </CardRoot>

            <CardRoot width="100%">
              <CardBody>
                <VStack align="stretch" gap={4}>
                  <Text fontSize="lg" fontWeight="bold" color="green.fg">
                    🔧 データベース管理
                  </Text>
                  
                  <VStack gap={2}>
                    <Button 
                      colorPalette="blue" 
                      variant="outline"
                      onClick={loadStats}
                      width="100%"
                    >
                      📈 統計を更新
                    </Button>
                    
                    <Button 
                      colorPalette="green" 
                      variant="outline"
                      onClick={() => navigate('/sessions')}
                      width="100%"
                    >
                      📚 セッション一覧を表示
                    </Button>
                  </VStack>
                </VStack>
              </CardBody>
            </CardRoot>
          </VStack>
        ) : (
          <VStack justify="center" align="center" height="200px">
            <Text color="fg.muted">統計データを取得できませんでした</Text>
            <Button onClick={loadStats}>再試行</Button>
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
