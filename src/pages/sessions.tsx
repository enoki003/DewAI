import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner, Heading } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  showSessionDeleteSuccess,
  showSessionDeleteError,
  showGenericError 
} from '../components/ui/notifications';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { getAllSessions, deleteSession as deleteDatabaseSession, SavedSession } from '../utils/database';

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
      const savedSessions = await getAllSessions();
      setSessions(savedSessions);
    } catch (error) {
      console.error('セッション取得エラー:', error);
      showGenericError('セッションの取得に失敗しました', `エラー詳細: ${error}`);
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
      showGenericError('セッションの復元に失敗しました', `エラー詳細: ${error}`);
    }
  };

  const deleteSession = async (sessionId: number, sessionTopic: string) => {
    try {
      await deleteDatabaseSession(sessionId);
      showSessionDeleteSuccess(sessionTopic);
      loadSessions(); // リストを再読み込み
    } catch (error) {
      console.error('削除エラー:', error);
      showSessionDeleteError(`${error}`);
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

  const getParticipantInfo = (participantsStr: string) => {
    try {
      const participantsData = JSON.parse(participantsStr);
      
      // 新形式（完全なAI情報付き）の場合
      if (participantsData.aiData && Array.isArray(participantsData.aiData)) {
        const aiNames = participantsData.aiData.map((ai: any) => ai.name);
        const userParticipates = participantsData.userParticipates || false;
        const participants = userParticipates ? ['あなた', ...aiNames] : aiNames;
        return participants.join(', ');
      }
      
      // 旧形式（名前のみ）の場合
      if (Array.isArray(participantsData)) {
        return participantsData.map(p => p === 'ユーザー' ? 'あなた' : p).join(', ');
      }
      
      return '不明な参加者';
    } catch {
      return '参加者情報の解析に失敗';
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
        <Heading size="2xl">過去の議論セッション</Heading>
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
                          <Text>📦 {session.model || 'モデル不明'}</Text>
                        </HStack>
                        <Text color="gray.600" fontSize="sm">
                          参加者: {getParticipantInfo(session.participants)}
                        </Text>
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
                        <ConfirmDialog
                          trigger={
                            <Button 
                              size="sm" 
                              colorPalette="red" 
                              variant="outline"
                            >
                              削除
                            </Button>
                          }
                          title="セッションの削除"
                          message={`「${session.topic}」を削除しますか？この操作は取り消せません。`}
                          confirmText="削除"
                          cancelText="キャンセル"
                          variant="destructive"
                          onConfirm={() => deleteSession(session.id, session.topic)}
                        />
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
