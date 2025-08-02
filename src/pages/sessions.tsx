import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner, Heading } from '@chakra-ui/react';
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
        <Heading size="2xl">議論セッション管理</Heading>
        <Text color="fg.muted">保存された議論から続きを選択してください</Text>
      </VStack>

      {/* セッション一覧 */}
      <Box width="100%" maxW="2xl" mx="auto" flex={1}>
        {loading ? (
          <VStack justify="center" align="center" height="200px">
            <Spinner size="lg" />
            <Text>セッションを読み込み中...</Text>
          </VStack>
        ) : sessions.length === 0 ? (
          <VStack justify="center" align="center" height="200px" gap={4}>
            <Text color="fg.muted">保存されたセッションがありません</Text>
            <Button 
              colorPalette="green" 
              variant="solid"
              onClick={() => navigate('/config')}
            >
              新しい議論を始める
            </Button>
          </VStack>
        ) : (
          <VStack gap={4} width="100%">
            {sessions.map((session) => (
              <CardRoot key={session.id} width="100%">
                <CardBody>
                  <VStack align="stretch" gap={3}>
                    <HStack justify="space-between" align="flex-start">
                      <VStack align="stretch" flex={1} gap={2}>
                        <Text 
                          fontWeight="bold"
                          color={{ base: "gray.800", _dark: "gray.100" }}
                        >
                          {session.topic}
                        </Text>
                        <HStack gap={4} color="gray.500" fontSize="sm">
                          <Text>{getMessageCount(session.messages)}メッセージ</Text>
                          <Text>{formatDate(session.updated_at)}</Text>
                        </HStack>
                      </VStack>
                      <HStack gap={2}>
                        <Button 
                          size="sm" 
                          colorPalette="green"
                          variant="solid"
                          onClick={() => continueSession(session)}
                        >
                          続きから
                        </Button>
                        <Button 
                          size="sm" 
                          colorPalette="red" 
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
