/**
 * @packageDocumentation
 * セッション一覧ページ（Sessions）。保存済みの議論セッションの閲覧・再開・参加者編集・削除を行えます。
 */

import { Box, VStack, HStack, Text, Button, CardRoot, CardBody, Spinner, Heading } from '@chakra-ui/react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  showSessionDeleteSuccess,
  showSessionDeleteError,
  showGenericError,
} from '../components/ui/notifications';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { getAllSessions, deleteSession as deleteDatabaseSession, SavedSession, updateSessionParticipants, updateSessionLastOpened } from '../utils/database';
import { useAIModel } from '../hooks/useAIModel';
import { ParticipantEditorDrawer, BotProfile as DrawerBotProfile } from '../components/ParticipantEditorDrawer';

/** セッション内の単一メッセージ */
interface Message {
  speaker: string;
  message: string;
  timestamp: Date;
  isUser: boolean;
}

/** 参加者プロファイル（このページ内の型定義） */
interface BotProfile {
  name: string;
  role: string;
  description: string;
}

/**
 * 保存済みセッションの一覧と操作を提供するページコンポーネント。
 *
 * - 続きから開始（Play復元フロー起動）
 * - 参加者編集（DrawerでAI人数/プロフィール/ユーザー参加可否を変更）
 * - 削除（確認ダイアログ付き）
 */
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

  useEffect(() => {
    loadSessions();
  }, []);

  /** セッション一覧をロード */
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

  /** 指定セッションを復元してPlayへ遷移 */
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

      // 「最近開いたセッション」を更新
      await updateSessionLastOpened(session.id);
      
      // playページに遷移
      navigate('/play');
      
    } catch (error) {
      console.error('セッション復元エラー:', error);
      showGenericError('セッションの復元に失敗しました', `エラー詳細: ${error}`);
    }
  };

  /** 指定セッションを削除して一覧を更新 */
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

  /** 参加者編集ドロワーを開く */
  const openEdit = (session: SavedSession) => {
    try {
      const participantsData = JSON.parse(session.participants);
      let bots: BotProfile[] = [];
      let userParticipates = false;

      if (participantsData && participantsData.aiData && Array.isArray(participantsData.aiData)) {
        bots = participantsData.aiData;
        userParticipates = !!participantsData.userParticipates;
      } 

      setEditingSession(session);
      setEditingBots(bots);
      setEditUserParticipates(userParticipates);
      setEditOpen(true);
    } catch (e) {
      console.error('参加者データ解析エラー:', e);
      showGenericError('参加者データの解析に失敗しました', `${e}`);
    }
  };

  /** ISO文字列から日本語ロケールの日時へ */
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ja-JP');
  };

  /** メッセージ配列の長さを取得 */
  const getMessageCount = (messagesStr: string) => {
    try {
      const messages = JSON.parse(messagesStr);
      return Array.isArray(messages) ? messages.length : 0;
    } catch {
      return 0;
    }
  };

  /** 参加者情報の表示用テキストを構築 */
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
      <ParticipantEditorDrawer
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditingSession(null); }}
        initialBots={editingBots}
        initialUserParticipates={editUserParticipates}
        onSave={async (bots, userParticipates) => {
          if (!editingSession) return;
          setEditUserParticipates(userParticipates);
          setEditingBots(bots as DrawerBotProfile[]);
          const participantsData = { userParticipates, aiData: bots };
          await updateSessionParticipants(editingSession.id, JSON.stringify(participantsData));
          await loadSessions();
        }}
      />
    </VStack>
  );
}
