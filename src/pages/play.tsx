import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Button, 
  Text, 
  Textarea, 
  Spinner, 
  Badge,
  Stack,
  Input,
  Drawer,
  Tabs,
  Checkbox,
  FieldRoot,
  FieldLabel,
} from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';
import { useNavigate } from 'react-router-dom';
import { 
  showAIResponseError, 
  showAnalysisError,
  showAnalysisSuccess,
  showParticipantsUpdateSuccess,
  showParticipantsUpdateError,
  showModelChangeNotice,
  showOllamaConnectionError,
  showInputTooLongWarning,
  showGenericError,
  showSessionResumeHint
} from '../components/ui/notifications';
import { ChatMessage } from '../components/ui/chat-message';
import { saveSession, updateSession, getSessionById, updateSessionParticipants, saveSessionAnalysis, updateSessionLastOpened } from '../utils/database';
import { extractTopicsFromSummary } from "../utils/text";

// 参加者（AIプロファイル）
interface BotProfile {
  name: string;
  role: string;
  description: string;
}

// メッセージ1件
interface TalkMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

// 画面設定（参加者/テーマ）
interface ScreenConfig {
  aiData: BotProfile[];
  participate: boolean;
  discussionTopic: string;
}

// 議論分析結果
interface DiscussionAnalysis {
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
  commonGround: string[];
  unexploredAreas: string[];
}

const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { generateAIResponse, summarizeDiscussion, analyzeDiscussionPoints, isModelLoaded, selectedModel, changeModel, checkModelStatus } = useAIModel();
  
  // 画面状態
  const [config, setConfig] = useState<ScreenConfig | null>(null);
  const [messages, setMessages] = useState<TalkMessage[]>([]);
  const [turnIndex, setTurnIndex] = useState(0); // 0: ユーザー, 1+ : AI順番
  const [inputText, setInputText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false); // 応答生成中
  const [isActive, setIsActive] = useState(false); // 議論中か
  
  // セッション管理
  const [sessionId, setSessionId] = useState<number | null>(null);
  const sessionIdRef = useRef<number | null>(null); // 最新ID保持
  useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);
  const [isResumed, setIsResumed] = useState(false);
  const [backPath, setBackPath] = useState<string>('/start');
  const [awaitingAIResume, setAwaitingAIResume] = useState(false); // 復元直後にAIの続き待ちか
  const [isSavingSession, setIsSavingSession] = useState(false);
  const resumeHintShownRef = useRef(false);
  const pendingMessagesRef = useRef<TalkMessage[] | null>(null); // 保存キュー
  
  // 要約/分析のための保持
  const [historySummary, setHistorySummary] = useState<string>(''); // 累積要約
  const [, setRecentWindow] = useState<TalkMessage[]>([]); // 直近期
  const [turnCount, setTurnCount] = useState(0);
  const [activeTopics, setActiveTopics] = useState<string[]>([]);
  const [summarizing, setSummarizing] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  
  // 分析結果
  const [analysis, setAnalysis] = useState<DiscussionAnalysis | null>(null);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  
  // 参加者編集
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBots, setEditingBots] = useState<BotProfile[]>([]);
  const [includeUser, setIncludeUser] = useState<boolean>(false);
  const [editTab, setEditTab] = useState<string>('ai-0');

  // 参加者編集ハンドラ群
  const openEditor = () => {
    if (!config) return;
    // 現在の設定を編集用にコピー
    setEditingBots(config.aiData.map((b) => ({ ...b })));
    setIncludeUser(!!config.participate);
    setEditTab('ai-0');
    setEditorOpen(true);
  };

  const addBot = () => {
    setEditingBots((prev) => {
      const next = [...prev, { name: `AI ${prev.length + 1}`, role: '参加者', description: '' }];
      // 新規タブへ移動
      setEditTab(`ai-${next.length - 1}`);
      return next;
    });
  };

  const removeBot = (idx: number) => {
    setEditingBots((prev) => {
      if (prev.length <= 1) return prev; // 最低1名は必須
      const next = prev.filter((_, i) => i !== idx);
      // タブ選択調整
      const newIndex = Math.min(idx, next.length - 1);
      setEditTab(`ai-${newIndex}`);
      return next;
    });
  };

  const updateBotField = (idx: number, field: keyof BotProfile, value: string) => {
    setEditingBots((prev) => prev.map((b, i) => (i === idx ? { ...b, [field]: value } : b)));
  };

  const saveBotEdits = async () => {
    if (!config) return;
    try {
      // 入力検証
      if (editingBots.some((b) => !b.name || !b.name.trim())) {
        showParticipantsUpdateError('AI名を入力してください');
        return;
      }
      const aiData = editingBots.map((b) => ({
        name: b.name.trim(),
        role: (b.role || '').trim(),
        description: (b.description || '').trim(),
      }));

      // 設定更新
      setConfig((prev) => (prev ? { ...prev, aiData, participate: includeUser } : prev));

      // DBへparticipantsを反映
      if (sessionIdRef.current && sessionIdRef.current > 0) {
        try {
          await updateSessionParticipants(
            sessionIdRef.current,
            JSON.stringify({ userParticipates: includeUser, aiData })
          );
        } catch (e) {
          console.warn('[participants] DB更新失敗:', e);
        }
      }

      // ターン整合（AI数が減った場合のはみ出しを防止）
      setTurnIndex((prev) => {
        if (prev === 0) return includeUser ? 0 : aiData.length > 0 ? 1 : 0;
        const aiIdx = prev - 1;
        if (aiIdx >= aiData.length) {
          return includeUser ? 0 : aiData.length > 0 ? 1 : 0;
        }
        return prev;
      });

      showParticipantsUpdateSuccess();
      setEditorOpen(false);
    } catch (e) {
      console.error('[participants] 更新失敗:', e);
      showParticipantsUpdateError(`${e}`);
    }
  };
  
  // スクロール制御
  const messageListRef = useRef<HTMLDivElement>(null);
  const [, setUserScrolling] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollTimerRef = useRef<number | null>(null);
  const autoScrollRef = useRef(true);
  const userScrollingRef = useRef(false);

  // 末尾にスクロール
  const scrollToBottom = useCallback(() => {
    const el = messageListRef.current;
    if (!el) return;
    if (autoScrollRef.current && !userScrollingRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, []);

  // 手動スクロール検知
  const handleScroll = useCallback(() => {
    if (!messageListRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messageListRef.current;
    const atBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    setAutoScroll(atBottom);
    autoScrollRef.current = atBottom;
    setUserScrolling(true);
    userScrollingRef.current = true;
    if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      setUserScrolling(false);
      userScrollingRef.current = false;
    }, 150);
  }, []);

  // メッセージ更新時スクロール
  useEffect(() => {
    if (messages.length > 0) {
      const id = window.setTimeout(() => scrollToBottom(), 100);
      return () => window.clearTimeout(id);
    }
  }, [messages, scrollToBottom]);
  
  const KEEP_RECENT_TURNS = 4; // 直近保持

  // 初期化/復元
  useEffect(() => {
    const resumeData = localStorage.getItem('resumeSession');
    if (resumeData) {
      try {
        const parsed = JSON.parse(resumeData);
        if (parsed.isResume) {
          const load = async () => {
            try {
              console.log('[resume] 開始 id=', parsed.sessionId);
              const session = await getSessionById(parsed.sessionId);
              if (!session) throw new Error('セッションが見つかりません');

              // セッション状態
              setSessionId(parsed.sessionId);
              sessionIdRef.current = parsed.sessionId;
              setIsResumed(true);

              // 参加者復元（新形式のみ）
              const participantsObj = JSON.parse(session.participants);
              if (!participantsObj || !Array.isArray(participantsObj.aiData)) {
                throw new Error('participantsフォーマットが不正です');
              }
              const bots: BotProfile[] = participantsObj.aiData;
              const userParticipates = !!participantsObj.userParticipates;
              setConfig({ discussionTopic: session.topic, aiData: bots, participate: userParticipates });

              // 使用モデル復元
              if (session.model && session.model !== selectedModel) {
                changeModel(session.model);
                showModelChangeNotice(session.model);
              }

              // メッセージ復元
              const saved: TalkMessage[] = JSON.parse(session.messages).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
              setMessages(saved);

              // モデル状態確認→議論状態
              const ok = await checkModelStatus();
              if (ok) {
                setIsActive(true);
                if (!resumeHintShownRef.current) {
                  showSessionResumeHint();
                  resumeHintShownRef.current = true;
                }
              } else {
                showOllamaConnectionError();
              }

              // 最近開いた更新
              try { await updateSessionLastOpened(parsed.sessionId); } catch (e) { console.warn('[resume] last_opened_at 更新失敗:', e); }

              // 次ターン決定
              if (saved.length > 0) {
                const last = saved[saved.length - 1];
                const lastSpeaker = last.speaker;
                if (lastSpeaker === 'ユーザー') {
                  setTurnIndex(1);
                  setAwaitingAIResume(true);
                } else {
                  const aiNames = bots.map(b => b.name);
                  const idx = aiNames.indexOf(lastSpeaker);
                  if (idx >= 0 && idx < aiNames.length - 1) {
                    setTurnIndex(idx + 2);
                    setAwaitingAIResume(true);
                  } else {
                    const next = userParticipates ? 0 : 1;
                    setTurnIndex(next);
                    if (next > 0) setAwaitingAIResume(true);
                  }
                }
              } else {
                const initial = userParticipates ? 0 : 1;
                setTurnIndex(initial);
                if (initial > 0) setAwaitingAIResume(true);
              }

              console.log('[resume] 完了 msg=', saved.length);
            } catch (e) {
              console.error('[resume] 失敗:', e);
            }
            localStorage.removeItem('resumeSession');
          };
          load();
          setBackPath('/sessions');
          return;
        }
      } catch (e) {
        console.error('[resume] エラー:', e);
      }
    }

    // 新規開始: localStorageの設定を読む
    const savedConfig = localStorage.getItem('aiConfig');
    if (!savedConfig) { navigate('/config'); return; }
    try {
      const parsed: ScreenConfig = JSON.parse(savedConfig);
      console.log('[init] 設定読込');
      setConfig(parsed);
      setBackPath('/config');
    } catch (e) {
      console.error('[init] 設定読込失敗:', e);
      navigate('/config');
    }
  }, []);

  // 表示用参加者（ユーザーを先頭に付与）
  const displayParticipants = config ? [
    ...(config.participate ? [{ name: 'あなた', role: 'あなた', description: '議論の参加者' }] : []),
    ...config.aiData
  ] : [];

  // 議論開始
  const startSession = async () => {
    if (isSavingSession) { console.log('[session] 保存中のため開始を待機'); return; }
    if (!isModelLoaded) { console.log('[session] モデル未接続'); showOllamaConnectionError(); return; }

    // 新規時はセッションIDをリセット
    if (!isResumed) {
      setSessionId(null);
      sessionIdRef.current = null;
      setIsResumed(false);
    }

    if (!config?.participate) {
      setTurnIndex(1);
      setIsActive(true);
      setAwaitingAIResume(false);
      runAITurn(1);
    } else {
      setIsActive(true);
      setAwaitingAIResume(false);
    }
  };

  // 復元後のAI続き
  const continueAIResponse = async () => {
    if (isSavingSession) { console.log('[session] 保存中のため続行待機'); return; }
    if (!isModelLoaded) { console.log('[session] モデル未接続'); showOllamaConnectionError(); return; }
    setAwaitingAIResume(false);
    try { await runAITurn(); } catch (e) { console.error('[ai] 続行失敗:', e); showAIResponseError('AI参加者', `${e}`); }
  };

  // ユーザー送信
  const handleSubmit = async () => {
    const trimmed = inputText.trim();
    if (!trimmed || isGenerating || isSavingSession) { console.log('[input] 無効または処理中'); return; }
    if (trimmed.length > 10000) { showInputTooLongWarning(trimmed.length); return; }

    try {
      const userMsg: TalkMessage = { speaker: 'ユーザー', message: trimmed, isUser: true, timestamp: new Date() };
      const next = [...messages, userMsg];
      setMessages(next);
      setRecentWindow(prev => [...prev, userMsg]);
      setInputText('');
      setTurnIndex(1);
      setTurnCount(prev => prev + 1);

      try { await autoSaveSession(next); } catch (e) { console.warn('[save] 直後保存失敗:', e); }

      await summarizeIfNeeded();
      await analyzeIfNeeded();

      try {
        setAwaitingAIResume(false);
        await runAITurn(1);
      } catch (e) {
        console.error('[ai] 応答失敗:', e);
        showAIResponseError('AI参加者', `${e}`);
      }
    } catch (e) {
      console.error('[input] 送信失敗:', e);
      showGenericError('メッセージ送信に失敗しました', `${e}`);
    }
  };

  // 必要に応じて要約
  const summarizeIfNeeded = async () => {
    if (!config || messages.length < KEEP_RECENT_TURNS + 2) return;
    try {
      const target = messages.slice(0, -KEEP_RECENT_TURNS);
      if (target.length === 0) return;
      const history = target.map(m => `${m.speaker}: ${m.message}`).join('\n');
      const parts = [ ...(config.participate ? ['ユーザー'] : []), ...config.aiData.map(a => a.name) ];

      setSummarizing(true);
      const summary = await summarizeDiscussion(config.discussionTopic, history, parts);

      setHistorySummary(prev => prev ? `${prev}\n\n${summary}` : summary);
      setRecentWindow(messages.slice(-KEEP_RECENT_TURNS));
      setActiveTopics(extractTopicsFromSummary(summary));

      if (sessionId && sessionId > 0) {
        try { await saveSessionAnalysis(sessionId, 'summary', JSON.stringify({ summary, topics: extractTopicsFromSummary(summary) })); } catch (e) { console.warn('[save] 要約保存失敗:', e); }
      }
    } catch (e) {
      console.error('[summary] 失敗:', e);
      showAnalysisError('議論要約', `${e}`);
    } finally {
      setSummarizing(false);
    }
  };

  // 必要に応じて分析（3ターン毎）
  const analyzeIfNeeded = async () => {
    if (!config || turnCount % 3 !== 0 || turnCount === 0 || messages.length < 3) return;
    await runAnalysis();
  };

  // 分析実行
  const runAnalysis = async () => {
    if (!config || messages.length === 0 || isSavingSession) {
      console.log('[analysis] 条件未満でスキップ');
      return;
    }
    try {
      setAnalyzing(true);
      const history = messages.map(m => `${m.speaker}: ${m.message}`).join('\n');
      const parts = [ ...(config.participate ? ['ユーザー'] : []), ...config.aiData.map(a => a.name) ];
      const result = await analyzeDiscussionPoints(config.discussionTopic, history, parts);

      try {
        let cleaned = result.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        else if (cleaned.startsWith('```')) cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
        const parsed = JSON.parse(cleaned);
        const valid: DiscussionAnalysis = {
          mainPoints: Array.isArray(parsed.mainPoints) ? parsed.mainPoints.filter((p: any) => p && typeof p.point === 'string' && typeof p.description === 'string') : [],
          participantStances: Array.isArray(parsed.participantStances) ? parsed.participantStances.filter((s: any) => s && typeof s.participant === 'string') : [],
          conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts.filter((c: any) => c && typeof c.issue === 'string') : [],
          commonGround: Array.isArray(parsed.commonGround) ? parsed.commonGround.filter((x: any) => typeof x === 'string') : [],
          unexploredAreas: Array.isArray(parsed.unexploredAreas) ? parsed.unexploredAreas.filter((x: any) => typeof x === 'string') : [],
        };
        setAnalysis(valid);
        showAnalysisSuccess();
        if (sessionId && sessionId > 0) {
          try { await saveSessionAnalysis(sessionId, 'analysis', JSON.stringify(valid)); } catch (e) { console.warn('[save] 分析保存失敗:', e); }
        }
      } catch (pe) {
        console.error('[analysis] JSON解析失敗:', pe);
        console.log('raw:', result);
        showAnalysisError('議論分析', `JSON解析に失敗しました: ${pe}`);
      }
    } catch (e) {
      console.error('[analysis] 実行失敗:', e);
      showAnalysisError('議論分析', `${e}`);
    } finally {
      setAnalyzing(false);
    }
  };

  // サイレント保存（保存中は最新スナップショットをキューに入れて完了後に再保存）
  const autoSaveSession = async (messagesToSave?: TalkMessage[]) => {
    const current = messagesToSave || messages;
    if (!config || current.length === 0) { console.log('[save] 保存対象なし'); return; }

    if (isSavingSession) {
      pendingMessagesRef.current = current;
      console.log('[save] 保存中→最新スナップショットをキューに登録');
      return;
    }

    setIsSavingSession(true);
    try {
      const participantsData = { userParticipates: config.participate, aiData: config.aiData };
      const currentId = sessionIdRef.current;
      if (currentId && currentId > 0) {
        await updateSession(currentId, JSON.stringify(current));
      } else {
        const newId = await saveSession(
          config.discussionTopic,
          JSON.stringify(participantsData),
          JSON.stringify(current),
          selectedModel
        );
        setSessionId(newId);
        sessionIdRef.current = newId;
        setIsResumed(true);
      }
    } catch (e) {
      console.error('[save] 失敗:', e);
    } finally {
      setIsSavingSession(false);
      if (pendingMessagesRef.current) {
        const pending = pendingMessagesRef.current;
        pendingMessagesRef.current = null;
        await autoSaveSession(pending);
      }
    }
  };

  // AIターン
  const runAITurn = async (turnOverride?: number) => {
    if (!config) { console.log('[ai] 設定未読込'); return; }
    if (isGenerating || isSavingSession) { console.log('[ai] 多重実行スキップ'); return; }
    if (!isModelLoaded) { showOllamaConnectionError(); return; }

    const turn = typeof turnOverride === 'number' ? turnOverride : turnIndex;
    if (turn === 0) { console.log('[ai] ユーザーのターン'); return; }

    const aiIdx = turn - 1;
    const bot = config.aiData[aiIdx];
    if (!bot) { console.log('[ai] 対応参加者なし', { turn }); return; }

    try {
      setIsGenerating(true);
      const recentLines = messages.slice(-KEEP_RECENT_TURNS).map(m => `${m.speaker}: ${m.message}`).join('\n');
      const history = historySummary ? `${historySummary}\n${recentLines}` : recentLines;

      const response = await generateAIResponse(bot.name, bot.role, bot.description, history, config.discussionTopic);

      const aiMsg: TalkMessage = { speaker: bot.name, message: response, isUser: false, timestamp: new Date() };

      const snapshot = [...messages, aiMsg];
      setMessages(snapshot);
      setTurnCount(prev => prev + 1);

      try { await autoSaveSession(snapshot); } catch (e) { console.warn('[save] 自動保存失敗:', e); }

      const nextIdx = aiIdx + 1;
      if (config.participate) {
        setTurnIndex(nextIdx < config.aiData.length ? nextIdx + 1 : 0);
      } else {
        setTurnIndex(nextIdx < config.aiData.length ? nextIdx + 1 : 1);
      }
    } catch (e) {
      console.error('[ai] 応答生成失敗:', e);
      showAIResponseError(bot?.name || 'AI', `${e}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 戻る前に短時間保存を待機
  const handleBack = async () => {
    try {
      await autoSaveSession(messages);
      const start = Date.now();
      while (isSavingSession || pendingMessagesRef.current) {
        await new Promise((r) => setTimeout(r, 100));
        if (Date.now() - start > 2000) break; // 最大2秒待機
      }
    } catch (e) {
      console.warn('[back] 保存待機中にエラー:', e);
    } finally {
      navigate(backPath);
    }
  };

  if (!config) {
    return (
      <Box p={8} textAlign="center">
        <Spinner size="lg" />
        <Text mt={4}>設定を読み込み中...</Text>
      </Box>
    );
  }

  return (
    <Box height="100vh" display="flex" flexDirection="column">
      {/* コンテンツ */}
      <VStack 
        gap={{ base: 2, md: 4 }} 
        p={{ base: 3, md: 6 }} 
        flex="1" 
        overflow="hidden"
        pb={{ base: "220px", md: "200px" }}
      >
        {/* ヘッダー */}
        <Box width="100%" borderBottom="1px solid" borderColor="border.muted" pb={{ base: 2, md: 4 }}>
          <Stack 
            direction={{ base: "column", md: "row" }}
            justify="space-between" 
            align={{ base: "start", md: "center" }}
            width="100%"
            gap={{ base: 2, md: 0 }}
          >
            <Button onClick={handleBack} size={{ base: "xs", md: "sm" }} variant="ghost">
              ← 戻る
            </Button>
            <Text 
              fontSize={{ base: "md", md: "xl" }} 
              fontWeight="bold"
              textAlign={{ base: "left", md: "center" }}
              flex={{ base: "none", md: "1" }}
            >
              テーマ: {config.discussionTopic}
            </Text>
            <HStack gap={2} minWidth={{ base: "auto", md: "120px" }} justify="flex-end">
              <Button 
                size={{ base: "xs", md: "sm" }} 
                variant="outline"
                colorPalette="green"
                onClick={openEditor}
              >
                <Text display={{ base: "none", md: "block" }}>AI編集</Text>
                <Text display={{ base: "block", md: "none" }}>✏️</Text>
              </Button>
            </HStack>
          </Stack>
        </Box>

        {/* 参加者 */}
        <Stack 
          direction={{ base: "column", lg: "row" }}
          wrap="wrap" 
          gap={2} 
          justify="space-between" 
          width="100%"
        >
          <HStack wrap="wrap" gap={2} flex="1">
            {displayParticipants.map((p, index) => (
              <Badge
                key={index}
                colorPalette={turnIndex === index ? "green" : "gray"}
                variant={turnIndex === index ? "solid" : "outline"}
                size={{ base: "sm", md: "md" }}
              >
                {p.name} ({p.role})
              </Badge>
            ))}
          </HStack>
          <HStack gap={1} wrap="wrap" justify={{ base: "start", lg: "end" }}>
            <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
              ターン: {turnCount}
            </Badge>
            {historySummary && (
              <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
                要約済み
              </Badge>
            )}
          </HStack>
        </Stack>

        {/* 状態表示 */}
        {(summarizing || analyzing) && (
          <Box width="100%" p={{ base: 2, md: 3 }} bg="bg.panel" borderRadius="md" border="1px solid" borderColor="border.muted">
            {summarizing && (
              <HStack gap={2}><Spinner colorPalette="green" size="sm" /><Text fontSize={{ base: "xs", md: "sm" }}>📝 議論を要約中です。少々時間がかかる場合がございます。</Text></HStack>
            )}
            {analyzing && (
              <HStack gap={2} mt={summarizing ? 2 : 0}><Spinner colorPalette="green" size="sm" /><Text fontSize={{ base: "xs", md: "sm" }}>📊 議論を分析中です。少々時間がかかる場合がございます。</Text></HStack>
            )}
          </Box>
        )}

        {/* 争点 */}
        {activeTopics.length > 0 && (
          <Box width="100%" p={{ base: 2, md: 3 }} bg="green.subtle" borderRadius="md" border="1px solid" borderColor="green.muted">
            <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" mb={2}>🎯 現在の議論の争点:</Text>
            <HStack wrap="wrap" gap={1}>
              {activeTopics.map((t, i) => (
                <Badge key={i} colorPalette="green" variant="subtle" size={{ base: "xs", md: "sm" }}>{t}</Badge>
              ))}
            </HStack>
          </Box>
        )}

        {/* 分析パネル */}
        <HStack width="100%" justify="flex-end" gap={3}>
          <Button 
            size={{ base: "sm", md: "md" }}
            colorPalette="green" 
            variant={analysisOpen ? "solid" : "outline"}
            onClick={() => {
              setAnalysisOpen(!analysisOpen);
              if (!analysisOpen && !analysis && messages.length > 2) runAnalysis();
            }}
          >
            <Text display={{ base: "none", md: "block" }}>{analysisOpen ? '分析パネルを閉じる' : '議論分析パネルを開く'}</Text>
            <Text display={{ base: "block", md: "none" }}>{analysisOpen ? '分析を閉じる' : '📊 分析'}</Text>
          </Button>
        </HStack>

        {/* 開始前 */}
        {!isActive && (
          <VStack gap={4} flex={1} justify="center" p={{ base: 4, md: 0 }}>
            <Text fontSize={{ base: "md", md: "lg" }}>議論の準備ができました</Text>
            <Text fontSize={{ base: "sm", md: "md" }}>参加者: {displayParticipants.length}人</Text>
            <VStack gap={2}>
              <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">💬 {config.participate ? '下部の入力エリアから議論を開始できます' : '下部のボタンから自動議論を開始できます'}</Text>
              <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">🎯 テーマ: {config.discussionTopic}</Text>
            </VStack>
          </VStack>
        )}

        {/* 進行中 */}
        {isActive && (
          <Stack direction={{ base: "column", lg: "row" }} gap={4} flex={1} align="stretch" width="100%">
            {/* メッセージ履歴 */}
            <Box 
              ref={messageListRef}
              onScroll={handleScroll}
              flex={{ base: "1", lg: analysisOpen ? "2" : "1" }}
              minHeight={{ base: "200px", md: "300px" }}
              maxHeight={{ base: "calc(100vh - 500px)", lg: "calc(100vh - 450px)" }}
              overflowY="auto" 
              border="1px solid" 
              borderColor="border.muted" 
              borderRadius="md" 
              p={{ base: 2, md: 4 }}
              transition="all 0.3s"
              mb={{ base: 4, md: 0 }}
            >
              {messages.map((msg, index) => (
                <ChatMessage key={index} message={msg} index={index} />
              ))}

              {isGenerating && (
                <Box textAlign="center" p={4}>
                  <Spinner colorPalette="green" />
                  <Text mt={2}>{turnIndex > 0 && config.aiData[turnIndex - 1] ? `（${config.aiData[turnIndex - 1].name}）が考え中` : 'AI応答を生成中...'}</Text>
                </Box>
              )}
              
              {/* 余白 */}
              <Box height={{ base: "20px", md: "30px" }} />
              
              {/* 下部へスクロールボタン */}
              {!autoScroll && messages.length > 0 && (
                <Box position="sticky" bottom={2} textAlign="center" mt={2}>
                  <Button
                    size="sm"
                    colorPalette="green"
                    variant="solid"
                    onClick={() => {
                      setAutoScroll(true);
                      autoScrollRef.current = true;
                      scrollToBottom();
                    }}
                    boxShadow="md"
                    opacity={0.7}
                    _hover={{ opacity: 1 }}
                    transition="opacity 0.2s"
                  >
                    ↓ 新しいメッセージを表示する
                  </Button>
                </Box>
              )}
            </Box>

            {/* デスクトップ分析 */}
            {analysisOpen && (
              <Box display={{ base: "none", lg: "block" }} flex="1" minWidth="350px" maxHeight="calc(100vh - 450px)" overflowY="auto" p={4} bg="green.subtle" borderRadius="md" mb={4} border="1px solid" borderColor="green.muted">
                <HStack justify="space-between" align="center" mb={3}>
                  <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
                  {messages.length > 2 && (
                    <Button size="xs" colorPalette="green" variant="outline" onClick={() => { runAnalysis(); }} disabled={analyzing}>{analyzing ? '分析中...' : '最新分析を実行'}</Button>
                  )}
                </HStack>

                {!analysis && (
                  <Box textAlign="center" py={8}>
                    <Text color="fg.muted" mb={3}>まだ分析データがありません</Text>
                    {messages.length > 2 ? (
                      <Button size="sm" colorPalette="green" onClick={runAnalysis} disabled={analyzing}>{analyzing ? '分析中...' : '議論を分析する'}</Button>
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
                      <Box mb={4}>
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
              </Box>
            )}
          </Stack>
        )}
      </VStack>

      {/* モバイル用 分析オーバーレイ */}
      {analysisOpen && (
        <Box display={{ base: "block", lg: "none" }} position="fixed" top="0" left="0" right="0" bottom="0" bg="blackAlpha.600" zIndex="modal" onClick={() => setAnalysisOpen(false)}>
          <Box position="absolute" top="50%" left="50%" transform="translate(-50%, -50%)" bg="bg" borderRadius="lg" border="1px solid" borderColor="border.muted" boxShadow="xl" maxWidth="90vw" maxHeight="80vh" width="full" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <HStack justify="space-between" align="center" p={4} borderBottom="1px solid" borderColor="border.muted">
              <Text fontSize="lg" fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
              <HStack gap={2}>
                {messages.length > 2 && (
                  <Button size="xs" colorPalette="green" variant="outline" onClick={() => { runAnalysis(); }} disabled={analyzing}>{analyzing ? '分析中...' : '更新'}</Button>
                )}
                <Button size="xs" variant="ghost" onClick={() => setAnalysisOpen(false)}>✕</Button>
              </HStack>
            </HStack>

            <Box p={4} maxHeight="calc(80vh - 80px)" overflowY="auto">
              {!analysis && (
                <Box textAlign="center" py={8}>
                  <Text color="fg.muted" mb={3}>まだ分析データがありません</Text>
                  {messages.length > 2 ? (
                    <Button size="sm" colorPalette="green" onClick={runAnalysis} disabled={analyzing}>{analyzing ? '分析中...' : '議論を分析する'}</Button>
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
                    <Box mb={4}>
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
            </Box>
          </Box>
        </Box>
      )}

      {/* 入力エリア（固定） */}
      <Box borderTop="1px solid" borderColor="border.muted" bg="bg" p={{ base: 3, md: 4 }} width="100%" minWidth="100%">
        {config.participate && (
          <VStack width="100%" gap={2}>
            {turnIndex === 0 && !isGenerating ? (
              <>
                <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>あなたのターンです</Text>
                {!isModelLoaded && (
                  <Text fontSize={{ base: "xs", md: "sm" }} color="red.solid">⚠️ AIモデルが準備できていません。Ollamaが起動しているか確認してください。</Text>
                )}
                <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted">💡 議論を深めるヒント: 多様な視点や疑問、具体例や根拠を示して論点を深掘りしてください</Text>
              </>
            ) : (
              <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
                {isGenerating
                  ? (turnIndex > 0 && config.aiData[turnIndex - 1]
                      ? `（${config.aiData[turnIndex - 1].name}）が考え中`
                      : 'AI応答を生成中...')
                  : (!isActive
                      ? '議論を開始してください'
                      : 'AIのターンです')}
              </Text>
            )}
            <VStack align="stretch" gap={2} width="100%" flex="1">
              <Textarea value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder={!isActive ? "議論開始後に入力できます" : turnIndex === 0 && !isGenerating ? "あなたの意見や質問を入力してください..." : "他の参加者のターンです"} resize="none" rows={3} fontSize={{ base: "sm", md: "md" }} disabled={!isActive || turnIndex !== 0 || isGenerating || isSavingSession} maxLength={10000} width="100%" minWidth="100%" />
              
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">{inputText.length}/10,000文字</Text>
                {inputText.length > 9000 && (<Text fontSize="xs" color="orange.500">残り{10000 - inputText.length}文字</Text>)}
              </HStack>
            </VStack>
            <HStack width="100%" gap={2}>
              {!isActive ? (
                <Button colorPalette="green" onClick={startSession} disabled={!isModelLoaded || isGenerating || isSavingSession} flex="1" size={{ base: "sm", md: "md" }}>{!isModelLoaded ? 'Ollamaが起動していません' : isSavingSession ? '保存中...' : isGenerating ? '処理中...' : '議論を開始する'}</Button>
              ) : (
                <Button colorPalette="green" onClick={awaitingAIResume && turnIndex > 0 ? continueAIResponse : handleSubmit} disabled={awaitingAIResume && turnIndex > 0 ? false : (!inputText.trim() || !isModelLoaded || turnIndex !== 0 || isGenerating || isSavingSession)} flex="1" size={{ base: "sm", md: "md" }}>
                  {!isModelLoaded ? 'Ollamaが起動していません' : awaitingAIResume && turnIndex > 0 ? '応答を再開する' : turnIndex !== 0 ? 'AIのターンです' : isSavingSession ? '保存中...' : '発言する'}
                </Button>
              )}
              {isActive && !config.participate && !isGenerating && (
                <Button colorPalette="green" onClick={awaitingAIResume ? continueAIResponse : () => runAITurn()} size={{ base: "sm", md: "md" }} variant="outline">{awaitingAIResume ? '応答を再開する' : '次の発言を生成'}</Button>
              )}
            </HStack>
          </VStack>
        )}

        {!config.participate && (
          <VStack width="100%" gap={2}>
            <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
              {isGenerating
                ? (turnIndex > 0 && config.aiData[turnIndex - 1]
                    ? `（${config.aiData[turnIndex - 1].name}）が考え中`
                    : 'AI応答を生成中...')
                : (!isActive
                    ? '議論を開始してください'
                    : 'AI自動議論モード')}
            </Text>
            <Button colorPalette="green" onClick={isActive ? () => runAITurn() : startSession} disabled={isGenerating || !config || isSavingSession} size={{ base: "sm", md: "md" }} width="100%">{!isActive ? '議論開始' : isSavingSession ? '保存中...' : isGenerating ? '処理中...' : '次の発言を生成'}</Button>
          </VStack>
        )}
      </Box>

      {/* 参加者編集ドロワー */}
      <Drawer.Root open={editorOpen} onOpenChange={(d) => setEditorOpen(d.open)} placement="end" size="md">
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content>
            <Drawer.Header>
              <HStack justify="space-between" w="full">
                <Text fontWeight="bold">AI参加者の編集</Text>
                <Drawer.CloseTrigger />
              </HStack>
            </Drawer.Header>

            <Drawer.Body>
              <VStack align="stretch" gap={4}>
                {/* 参加者設定 */}
                <Box p={3} bg="green.subtle" borderRadius="md" border="1px solid" borderColor="green.muted">
                  <Checkbox.Root
                    checked={includeUser}
                    onCheckedChange={(val: any) => setIncludeUser(typeof val === 'boolean' ? val : !!val?.checked)}
                  >
                    <Checkbox.Control />
                    <Checkbox.Label>あなた（ユーザー）も参加する</Checkbox.Label>
                  </Checkbox.Root>
                </Box>

                {/* AIごとの編集 */}
                <Tabs.Root value={editTab} onValueChange={(d: any) => setEditTab(d.value)} orientation="vertical">
                  <HStack align="stretch" gap={4}>
                    <VStack minW={{ base: 'full', md: '180px' }} align="stretch" gap={2}>
                      <Tabs.List>
                        {editingBots.map((_, idx) => (
                          <Tabs.Trigger key={idx} value={`ai-${idx}`}>AI {idx + 1}</Tabs.Trigger>
                        ))}
                      </Tabs.List>
                      <Button size="xs" variant="outline" onClick={addBot} disabled={editingBots.some(ai => !ai.name?.trim())}>＋ AIを追加</Button>
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
                <Button variant="outline" onClick={() => setEditorOpen(false)}>キャンセル</Button>
                <Button colorPalette="green" onClick={saveBotEdits} disabled={editingBots.some(ai => !ai.name?.trim())}>保存</Button>
              </HStack>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </Box>
  );
};
export default PlayPage;