import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

interface SavedSession {
  id: number;
  topic: string;
  participants: string;
  messages: string;
  created_at: string;
  updated_at: string;
}

interface Message {
  speaker: string;
  message: string;
  timestamp: Date;
  isUser: boolean;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const savedSessions = await invoke<SavedSession[]>('get_saved_sessions');
      setSessions(savedSessions);
    } catch (error) {
      console.error('セッション取得エラー:', error);
      alert('セッションの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const continueSession = async (session: SavedSession) => {
    try {
      // セッションデータを復元
      const participants = JSON.parse(session.participants);
      const messages: Message[] = JSON.parse(session.messages);
      
      // playページに必要なデータを localStorage に保存
      localStorage.setItem('resumeSession', JSON.stringify({
        sessionId: session.id,
        topic: session.topic,
        participants,
        messages,
        isResume: true
      }));
      
      // playページに遷移
      navigate('/play');
      
    } catch (error) {
      console.error('セッション復元エラー:', error);
      alert('セッションの復元に失敗しました');
    }
  };

  const deleteSession = async (sessionId: number) => {
    if (!confirm('このセッションを削除しますか？')) return;
    
    try {
      await invoke('delete_session', { sessionId });
      alert('セッションを削除しました');
      loadSessions(); // リストを再読み込み
    } catch (error) {
      console.error('削除エラー:', error);
      alert('セッションの削除に失敗しました');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP');
  };

  const getMessageCount = (messagesStr: string) => {
    try {
      const messages = JSON.parse(messagesStr);
      return Array.isArray(messages) ? messages.length : 0;
    } catch {
      return 0;
    }
  };

  return (
    <VStack height="100vh" p={6} gap={6} bg={{ base: "gray.50", _dark: "gray.900" }}>
      {/* ヘッダー */}
      <HStack width="100%" justify="space-between" align="center">
        <Text fontSize="2xl" fontWeight="bold" color={{ base: "gray.800", _dark: "gray.100" }}>
          🗂️ 議論セッション管理
        </Text>
        <HStack gap={3}>
          <Button 
            colorScheme="blue" 
            onClick={() => navigate('/config')}
          >
            新しく始める
          </Button>
          <Button 
            variant="outline" 
            onClick={() => navigate('/start')}
          >
            戻る
          </Button>
        </HStack>
      </HStack>

      {/* セッション一覧 */}
      <Box width="100%" maxW="800px" flex={1}>
        {loading ? (
          <VStack justify="center" align="center" height="200px">
            <Spinner size="lg" />
            <Text>セッションを読み込み中...</Text>
          </VStack>
        ) : sessions.length === 0 ? (
          <VStack justify="center" align="center" height="200px" gap={4}>
            <Text fontSize="lg" color="gray.500">保存されたセッションはありません</Text>
            <Button 
              colorScheme="green" 
              onClick={() => navigate('/config')}
            >
              新しい議論を始める
            </Button>
          </VStack>
        ) : (
          <VStack gap={4} width="100%">
            {sessions.map((session) => (
              <CardRoot 
                key={session.id} 
                width="100%" 
                bg={{ base: "white", _dark: "gray.800" }}
                shadow="md"
                _hover={{ shadow: "lg", transform: "translateY(-2px)" }}
                transition="all 0.2s"
              >
                <CardBody>
                  <VStack align="stretch" gap={3}>
                    <HStack justify="space-between" align="flex-start">
                      <VStack align="stretch" flex={1} gap={2}>
                        <Text 
                          fontSize="lg" 
                          fontWeight="bold"
                          color={{ base: "gray.800", _dark: "gray.100" }}
                        >
                          📋 {session.topic}
                        </Text>
                        <HStack gap={4} color="gray.500" fontSize="sm">
                          <Text>💬 {getMessageCount(session.messages)}メッセージ</Text>
                          <Text>📅 {formatDate(session.updated_at)}</Text>
                        </HStack>
                      </VStack>
                      <HStack gap={2}>
                        <Button 
                          size="sm" 
                          colorScheme="green"
                          onClick={() => continueSession(session)}
                        >
                          続きから
                        </Button>
                        <Button 
                          size="sm" 
                          colorScheme="red" 
                          variant="outline"
                          onClick={() => deleteSession(session.id)}
                        >
                          削除
                        </Button>
                      </HStack>
                    </HStack>
                  </VStack>
                </CardBody>
              </CardRoot>
            ))}
          </VStack>
        )}
      </Box>
    </VStack>
  );
}
