import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner, Heading, Input, Textarea, Checkbox, Drawer, FieldRoot, FieldLabel, Tabs } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  showSessionDeleteSuccess,
  showSessionDeleteError,
  showGenericError,
  showParticipantsUpdateSuccess,
} from '../components/ui/notifications';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { getAllSessions, deleteSession as deleteDatabaseSession, SavedSession, updateSessionParticipants, updateSessionLastOpened } from '../utils/database';
import { useAIModel } from '../hooks/useAIModel';

interface Message {
  speaker: string;
  message: string;
  timestamp: Date;
  isUser: boolean;
}

// 参加者プロファイル
interface BotProfile {
  name: string;
  role: string;
  description: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SavedSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { isModelLoaded } = useAIModel();

  // 編集ドロワー用状態（プレイ画面と統一: タブ＋緑テーマ）
  const [editOpen, setEditOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<SavedSession | null>(null);
  const [editingBots, setEditingBots] = useState<BotProfile[]>([]);
  const [editUserParticipates, setEditUserParticipates] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<string>('ai-0');

  useEffect(() => {
    loadSessions();
  }, []);

  const loadSessions = async () => {
    try {
      setLoading(true);
      const savedSessions = await getAllSessions();
      setSessions(savedSessions);
    } catch (error) {
      console.warn('セッション取得（空として扱う）:', error);
      setSessions([]);
      // トーストは出さない（空DBを想定ケースとしてスルー）
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

      // 「最近開いた」を更新
      await updateSessionLastOpened(session.id);
      
      // playページに遷移（即開始）
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

  // 参加者情報の編集ドロワーを開く
  const openEdit = (session: SavedSession) => {
    try {
      const participantsData = JSON.parse(session.participants);
      let bots: BotProfile[] = [];
      let userParticipates = false;

      if (participantsData && participantsData.aiData && Array.isArray(participantsData.aiData)) {
        bots = participantsData.aiData;
        userParticipates = !!participantsData.userParticipates;
      } else if (Array.isArray(participantsData)) {
        // 旧形式：名前だけの配列
        userParticipates = participantsData.includes('ユーザー');
        bots = participantsData
          .filter((p: string) => p !== 'ユーザー')
          .map((name: string) => ({ name, role: 'AI', description: '' }));
      }

      setEditingSession(session);
      setEditingBots(bots);
      setEditUserParticipates(userParticipates);
      setActiveEditTab('ai-0');
      setEditOpen(true);
    } catch (e) {
      console.error('参加者データ解析エラー:', e);
      showGenericError('参加者データの解析に失敗しました', `${e}`);
    }
  };

  const updateBotField = (index: number, field: keyof BotProfile, value: string) => {
    setEditingBots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as BotProfile;
      return next;
    });
  };

  const addBot = () => {
    setEditingBots(prev => {
      const next = [...prev, { name: '', role: '', description: '' }];
      setActiveEditTab(`ai-${next.length - 1}`);
      return next;
    });
  };

  const removeBot = (index: number) => {
    setEditingBots(prev => {
      const next = prev.filter((_, i) => i !== index);
      const newIndex = Math.max(0, Math.min(index, next.length - 1));
      setActiveEditTab(`ai-${newIndex}`);
      return next;
    });
  };

  const saveEdit = async () => {
    if (!editingSession) return;

    try {
      const participantsData = {
        userParticipates: editUserParticipates,
        aiData: editingBots,
      };

      await updateSessionParticipants(editingSession.id, JSON.stringify(participantsData));
      showParticipantsUpdateSuccess();
      setEditOpen(false);
      setEditingSession(null);
      await loadSessions();
    } catch (e) {
      console.error('参加者更新エラー:', e);
      showGenericError('参加者情報の保存に失敗しました', `${e}`);
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
        const names = participantsData.aiData.map((ai: any) => ai.name);
        const user = participantsData.userParticipates || false;
        const participants = user ? ['あなた', ...names] : names;
        return participants.join(', ');
      }
      
      // 旧形式（名前のみ）の場合
      if (Array.isArray(participantsData)) {
        return participantsData.map((p: string) => p === 'ユーザー' ? 'あなた' : p).join(', ');
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
              disabled={!isModelLoaded}
            >
              {!isModelLoaded ? 'Ollama未接続' : '新しい議論を始める'}
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
                        {/* 左から: 続きから / 編集 / 削除 の順 */}
                        <Button 
                          size="sm" 
                          colorPalette="green"
                          variant="solid"
                          onClick={() => continueSession(session)}
                          disabled={!isModelLoaded}
                        >
                          {!isModelLoaded ? 'Ollama未接続' : '続きから'}
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => openEdit(session)}
                        >
                          編集
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

      {/* 編集ドロワー（右側パネル・タブ付きでプレイ画面と統一） */}
      <Drawer.Root open={editOpen} onOpenChange={(d) => setEditOpen(d.open)} placement="end" size="md">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack justify="space-between" w="full">
                <Drawer.Title>AI参加者の編集</Drawer.Title>
                <Drawer.CloseTrigger />
              </HStack>
            </Drawer.Header>

            <Drawer.Body>
              <VStack align="stretch" gap={4}>
                {/* 参加者設定 */}
                <Box p={3} bg="green.subtle" borderRadius="md" border="1px solid" borderColor="green.muted">
                  <Checkbox.Root
                    checked={editUserParticipates}
                    onCheckedChange={(details) => setEditUserParticipates(!!details.checked)}
                  >
                    <Checkbox.Control />
                    <Checkbox.Label>あなた（ユーザー）も参加する</Checkbox.Label>
                  </Checkbox.Root>
                </Box>

                {/* AIごとの編集（タブ） */}
                <Tabs.Root value={activeEditTab} onValueChange={(details: any) => setActiveEditTab(details.value)} orientation="vertical">
                  <HStack align="stretch" gap={4}>
                    <VStack minW={{ base: 'full', md: '180px' }} align="stretch" gap={2}>
                      <Tabs.List>
                        {editingBots.map((_, idx) => (
                          <Tabs.Trigger key={idx} value={`ai-${idx}`}>
                            AI {idx + 1}
                          </Tabs.Trigger>
                        ))}
                      </Tabs.List>
                      <Button size="xs" variant="outline" onClick={addBot}>＋ AIを追加</Button>
                    </VStack>

                    <Box flex="1">
                      {editingBots.map((ai, idx) => (
                        <Tabs.Content key={idx} value={`ai-${idx}`}>
                          <Box p={3} borderRadius="md" border="1px solid" borderColor="border.muted">
                            <VStack align="stretch" gap={3}>
                              <HStack justify="space-between">
                                <Text fontWeight="bold" color="green.fg">AI {idx + 1}</Text>
                                <Button size="xs" variant="outline" colorPalette="red" onClick={() => removeBot(idx)} disabled={editingBots.length <= 1}>このAIを削除</Button>
                              </HStack>
                              <FieldRoot>
                                <FieldLabel>名前</FieldLabel>
                                <Input value={ai.name} onChange={(e) => updateBotField(idx, 'name', e.target.value)} placeholder="AI の名前" />
                              </FieldRoot>
                              <FieldRoot>
                                <FieldLabel>役職</FieldLabel>
                                <Input value={ai.role} onChange={(e) => updateBotField(idx, 'role', e.target.value)} placeholder="例：専門家、司会、反対派 など" />
                              </FieldRoot>
                              <FieldRoot>
                                <FieldLabel>説明</FieldLabel>
                                <Textarea rows={3} value={ai.description} onChange={(e) => updateBotField(idx, 'description', e.target.value)} placeholder="得意分野や性格、役割など" />
                              </FieldRoot>
                            </VStack>
                          </Box>
                        </Tabs.Content>
                      ))}
                    </Box>
                  </HStack>
                </Tabs.Root>
              </VStack>
            </Drawer.Body>

            <Drawer.Footer>
              <HStack w="full" justify="flex-end">
                <Button variant="outline" onClick={() => setEditOpen(false)}>キャンセル</Button>
                <Button colorPalette="green" onClick={saveEdit}>保存</Button>
              </HStack>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </VStack>
  );
}
