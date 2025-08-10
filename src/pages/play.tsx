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
} from '@chakra-ui/react';
import {
  FieldRoot,
  FieldLabel
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
import { saveSession, updateSession, getSessionById, updateSessionParticipants, saveSessionAnalysis } from '../utils/database';
import { extractTopicsFromSummary } from "../utils/text";
import { updateSessionLastOpened } from '../utils/database';

interface AICharacter {
  name: string;
  role: string;
  description: string;
}

interface DiscussionMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

interface AIConfig {
  aiData: AICharacter[];
  participate: boolean;
  discussionTopic: string;
}

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
  
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0); // 0: ユーザー, 1+: AI順番
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discussionStarted, setDiscussionStarted] = useState(false);
  
  // セッション関連の状態
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isResumedSession, setIsResumedSession] = useState(false);
  const [previousPage, setPreviousPage] = useState<string>('/start'); // 戻り先管理
  const [isWaitingForResume, setIsWaitingForResume] = useState(false); // セッション復元時のAIターン待機状態
  const [isSaving, setIsSaving] = useState(false); // セッション保存中フラグ
  
  // 要約システム用の新しい状態
  const [summarizedHistory, setSummarizedHistory] = useState<string>(''); // 要約された過去の議論
  const [recentMessages, setRecentMessages] = useState<DiscussionMessage[]>([]); // 直近3ターンの会話
  const [totalTurns, setTotalTurns] = useState(0); // 総ターン数
  const [currentTopics, setCurrentTopics] = useState<string[]>([]); // 現在の議論の争点
  // 進行表示: 要約/分析
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Debug: recentMessagesの状態をログ出力（TypeScript警告回避）
  console.log('Recent messages count:', recentMessages.length);
  
  // 議論分析システム用の状態
  const [discussionAnalysis, setDiscussionAnalysis] = useState<DiscussionAnalysis | null>(null);
  
  // デバッグ用：分析結果が更新された時のログ
  useEffect(() => {
    if (discussionAnalysis) {
      console.log('議論分析結果更新:', discussionAnalysis);
      console.log('mainPoints:', discussionAnalysis.mainPoints);
      console.log('participantStances:', discussionAnalysis.participantStances);
    }
  }, [discussionAnalysis]);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingAIData, setEditingAIData] = useState<AICharacter[]>([]);
  // 追加: 参加者トグルとタブ選択状態
  const [editParticipate, setEditParticipate] = useState<boolean>(false);
  const [activeEditTab, setActiveEditTab] = useState<string>('ai-0');
  
  // 自動スクロール制御用の状態
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const scrollTimeoutRef = useRef<number | null>(null);

  // 自動スクロール関数
  const scrollToBottom = useCallback(() => {
    if (messageAreaRef.current && shouldAutoScroll && !isUserScrolling) {
      messageAreaRef.current.scrollTop = messageAreaRef.current.scrollHeight;
    }
  }, [shouldAutoScroll, isUserScrolling]);

  // ユーザーによる手動スクロールを検出
  const handleScroll = useCallback(() => {
    if (!messageAreaRef.current) return;
    
    const { scrollTop, scrollHeight, clientHeight } = messageAreaRef.current;
    const isAtBottom = Math.abs(scrollHeight - scrollTop - clientHeight) < 10;
    
    // スクロール位置に基づいて自動スクロールのON/OFFを制御
    setShouldAutoScroll(isAtBottom);
    
    // ユーザーがスクロール中であることを示すフラグ
    setIsUserScrolling(true);
    
    // スクロール終了を検出するためのタイマー
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = window.setTimeout(() => {
      setIsUserScrolling(false);
    }, 150);
  }, []);

  // メッセージが変更された時の自動スクロール
  useEffect(() => {
    if (messages.length > 0) {
      // 少し遅延を入れて確実にDOMが更新された後にスクロール
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, scrollToBottom]);
  
  const RECENT_TURNS_TO_KEEP = 4; // 保持する直近ターン数

  useEffect(() => {
    // セッション復元チェック
    const resumeData = localStorage.getItem('resumeSession');
    if (resumeData) {
      try {
        const parsed = JSON.parse(resumeData);
        if (parsed.isResume) {
          // データベースからセッション詳細を取得
          const loadSessionFromDatabase = async () => {
            try {
              console.log('データベースからセッション復元中:', parsed.sessionId);
              const sessionData = await getSessionById(parsed.sessionId);
              
              if (!sessionData) {
                throw new Error('セッションが見つかりません');
              }
              
              console.log('セッションデータ取得成功:', sessionData);
              
              // セッション設定を復元
              console.log('セッション状態設定中... SessionID:', parsed.sessionId);
              setCurrentSessionId(parsed.sessionId);
              setIsResumedSession(true);
              console.log('セッション状態設定完了 (currentSessionId:', parsed.sessionId, ', isResumedSession: true)');
              
              // 参加者データを解析
              let participantsData;
              let aiData: AICharacter[] = [];
              let userParticipates = false;
              
              try {
                // 新しい形式（完全なAI情報付き）でパース
                participantsData = JSON.parse(sessionData.participants);
                if (participantsData.aiData && Array.isArray(participantsData.aiData)) {
                  aiData = participantsData.aiData;
                  userParticipates = participantsData.userParticipates || false;
                  console.log('新形式の参加者データ復元:', { aiData, userParticipates });
                } else {
                  throw new Error('新形式ではない');
                }
              } catch {
                // 旧形式（名前のみ）の場合
                const participantNames = JSON.parse(sessionData.participants);
                userParticipates = participantNames.includes('ユーザー');
                aiData = participantNames
                  .filter((p: string) => p !== 'ユーザー')
                  .map((name: string) => ({
                    name,
                    role: '復元されたAI', // 旧データの場合はデフォルト値
                    description: 'セッション復元時に作成されました'
                  }));
                console.log('⚠️ 旧形式の参加者データ復元:', { aiData, userParticipates });
              }
              
              setConfig({
                discussionTopic: sessionData.topic,
                aiData,
                participate: userParticipates
              });
              
              // セッションで使用していたモデルを復元
              if (sessionData.model && sessionData.model !== selectedModel) {
                console.log('セッション復元: モデル切り替え', selectedModel, '→', sessionData.model);
                changeModel(sessionData.model);
                showModelChangeNotice(sessionData.model);
              }
              
              // メッセージを復元（データベースの最新データを使用）
              const savedMessages = JSON.parse(sessionData.messages);
              const messagesWithDateTimestamp = savedMessages.map((msg: any) => ({
                ...msg,
                timestamp: new Date(msg.timestamp)
              }));
              setMessages(messagesWithDateTimestamp);
              
              // Ollama接続チェック後に議論状態を復元
              const modelStatus = await checkModelStatus();
              if (!modelStatus) {
                console.log('⚠️ セッション復元: Ollama接続なし、議論は一時停止状態');
                showOllamaConnectionError();
                // 議論開始フラグは立てずに、メッセージのみ復元
              } else {
                setDiscussionStarted(true);
                console.log('✅ セッション復元: Ollama接続あり、議論状態を復元');
                showSessionResumeHint();
              }

              // 最近開いた更新
              try {
                await updateSessionLastOpened(parsed.sessionId);
              } catch (e) {
                console.warn('last_opened_at 更新に失敗:', e);
              }
              
              // ターン状態を復元：最後の発言者に基づいて次のターンを決定
              if (messagesWithDateTimestamp.length > 0) {
                const lastMessage = messagesWithDateTimestamp[messagesWithDateTimestamp.length - 1];
                const lastSpeaker = lastMessage.speaker;
                
                if (lastSpeaker === 'ユーザー') {
                  // 最後がユーザーの発言なら、次はAIのターン（待機状態）
                  setCurrentTurn(1);
                  setIsWaitingForResume(true); // AIターンの場合は待機状態に設定
                  console.log('🔄 ターン復元: ユーザーの後 → AI(1)のターン（待機中）');
                } else {
                  // 最後がAIの発言なら、次のAIまたはユーザーのターンを決定
                  const aiNames = aiData.map(ai => ai.name);
                  const lastAIIndex = aiNames.indexOf(lastSpeaker);
                  
                  if (lastAIIndex >= 0 && lastAIIndex < aiNames.length - 1) {
                    // 次のAIのターン（待機状態）
                    setCurrentTurn(lastAIIndex + 2);
                    setIsWaitingForResume(true);
                    console.log(`🔄 ターン復元: ${lastSpeaker}の後 → ${aiNames[lastAIIndex + 1]}(${lastAIIndex + 2})のターン（待機中）`);
                  } else {
                    // 全AIが発言済みなら、ユーザーのターン（参加している場合）または最初のAIのターン
                    const nextTurn = userParticipates ? 0 : 1;
                    setCurrentTurn(nextTurn);
                    if (nextTurn > 0) {
                      setIsWaitingForResume(true); // AIターンの場合は待機状態
                    }
                    console.log('🔄 ターン復元: 全AI発言済み → ', userParticipates ? 'ユーザー(0)' : 'AI(1)', 'のターン', nextTurn > 0 ? '（待機中）' : '');
                  }
                }
              } else {
                // メッセージがない場合は開始状態
                const initialTurn = userParticipates ? 0 : 1;
                setCurrentTurn(initialTurn);
                if (initialTurn > 0) {
                  setIsWaitingForResume(true); // AIターンの場合は待機状態
                }
                console.log('🔄 ターン復元: メッセージなし → ', userParticipates ? 'ユーザー(0)' : 'AI(1)', 'のターン', initialTurn > 0 ? '（待機中）' : '');
              }
              
              console.log('✅ セッション復元完了:', messagesWithDateTimestamp.length, 'メッセージ');
            } catch (error) {
              console.error('❌ セッション復元失敗:', error);
              // エラーの場合は通常の設定読み込みに進む
            }
            localStorage.removeItem('resumeSession'); // 一度使ったら削除
          };
          
          loadSessionFromDatabase();
          setPreviousPage('/sessions'); // セッション復元の場合は/sessionsに戻る
          return;
        }
      } catch (error) {
        console.error('セッション復元エラー:', error);
      }
    }

    // 通常の設定データを読み込み（新規作成）
    const savedConfig = localStorage.getItem('aiConfig');
    if (!savedConfig) {
      navigate('/config');
      return;
    }
    
    try {
      const parsedConfig: AIConfig = JSON.parse(savedConfig);
      console.log('📋 設定データ読み込み成功:', parsedConfig);
      setConfig(parsedConfig);
      setPreviousPage('/config'); // 新規作成の場合は/configに戻る
      
      // 以前は同一トピックの既存セッションへ自動で紐付けていたが、
      // 誤更新の原因となるため廃止（続きからは/sessions経由のresumeSessionのみ許可）
    } catch (error) {
      console.error('設定データの読み込みに失敗:', error);
      navigate('/config');
    }
  }, [navigate]);

  const participants = config ? [
    ...(config.participate ? [{ name: 'あなた', role: 'あなた', description: '議論の参加者' }] : []),
    ...config.aiData
  ] : [];

  const startDiscussion = async () => {
    if (isSaving) {
      console.log('💾 保存処理中のため、議論開始をスキップ');
      return;
    }
    
    // Ollama接続チェック
    if (!isModelLoaded) {
      console.log('❌ Ollama接続なし、議論開始を中止');
      showOllamaConnectionError();
      return;
    }
    
    console.log('🎯 startDiscussion 呼び出し', { config, discussionStarted, isProcessing });
    
    // 新規議論開始時の初期化（セッションIDはクリアしない）
    if (!isResumedSession) {
      console.log('🆕 新規議論開始: 初期化処理');
      // 常に新規セッションとして保存させるため、セッションIDをクリア
      setCurrentSessionId(null);
      setIsResumedSession(false);
    }
    
    if (!config?.participate) {
      // ユーザーが参加しない場合、AIだけで議論開始
      setCurrentTurn(1);
      setDiscussionStarted(true);
      setIsWaitingForResume(false); // 新規開始時は待機状態をリセット
      processAITurn(1);
    } else {
      setDiscussionStarted(true);
      setIsWaitingForResume(false); // 新規開始時は待機状態をリセット
    }
  };

  // AIの応答を再開する関数
  const resumeAIResponse = async () => {
    if (isSaving) {
      console.log('💾 保存処理中のため、AI応答再開をスキップ');
      return;
    }
    
    console.log('🔄 AI応答再開:', { currentTurn, isWaitingForResume });
    
    // Ollama接続チェック
    if (!isModelLoaded) {
      console.log('❌ Ollama接続なし、AI応答再開を中止');
      showOllamaConnectionError();
      return;
    }
    
    setIsWaitingForResume(false);
    try {
      await processAITurn();
    } catch (error) {
      console.error('❌ AI応答再開エラー:', error);
      showAIResponseError('AI参加者', `${error}`);
    }
  };

  const handleUserSubmit = async () => {
    const trimmedInput = userInput.trim();
    
    // 入力検証
    if (!trimmedInput || isProcessing || isSaving) {
      console.log('🚫 ユーザー発言スキップ:', { hasInput: !!trimmedInput, isProcessing });
      return;
    }
    
    // 長さ制限チェック（10,000文字まで）
    if (trimmedInput.length > 10000) {
      showInputTooLongWarning(trimmedInput.length);
      return;
    }

    try {
      console.log(`📝 ユーザー発言開始（文字数: ${trimmedInput.length}）`);

      const userMessage: DiscussionMessage = {
        speaker: 'ユーザー',
        message: trimmedInput,
        isUser: true,
        timestamp: new Date()
      };

      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      setRecentMessages(prev => [...prev, userMessage]);
      setUserInput('');
      setCurrentTurn(1); // 次はAIのターン
      setTotalTurns(prev => prev + 1);
      
      console.log('👤 ユーザー発言処理完了、自動保存実行前:', {
        messageCount: updatedMessages.length,
        currentSessionId,
        isResumedSession
      });
      
      
      // 要約チェックを実行
      await checkAndSummarize();

      // 定期的な議論分析
      await checkAndAnalyze();
      
      console.log('🤖 AI応答開始...');
      // AI応答を順番に処理
      try {
        setIsWaitingForResume(false); // AI応答開始時に待機状態をリセット
        await processAITurn(1);
        console.log('✅ AI応答完了');
      } catch (error) {
        console.error('❌ AI応答エラー:', error);
        showAIResponseError('AI参加者', `${error}`);
      }
    } catch (error) {
      console.error('❌ ユーザー発言処理エラー:', error);
      showGenericError('メッセージ送信に失敗しました', `${error}`);
      // エラー時は入力をクリアしない
    }
  };

  // 要約が必要かチェックし、実行する関数
  const checkAndSummarize = async () => {
    if (!config || messages.length < RECENT_TURNS_TO_KEEP + 2) return;

    try {
      // 現在の全メッセージから要約対象を抽出（直近分を除く）
      const messagesToSummarize = messages.slice(0, -RECENT_TURNS_TO_KEEP);
      if (messagesToSummarize.length === 0) return;

      const conversationHistory = messagesToSummarize
        .map(msg => `${msg.speaker}: ${msg.message}`)
        .join('\n');

      const participants = [
        ...(config.participate ? ['ユーザー'] : []),
        ...config.aiData.map(ai => ai.name)
      ];

      setIsSummarizing(true);
      const summary = await summarizeDiscussion(
        config.discussionTopic,
        conversationHistory,
        participants
      );

      // 要約を保存し、直近メッセージのみ保持
      setSummarizedHistory(prev => prev ? `${prev}\n\n${summary}` : summary);
      setRecentMessages(messages.slice(-RECENT_TURNS_TO_KEEP));
      
      // 争点を抽出（簡単な実装）
      const topics = extractTopicsFromSummary(summary);
      setCurrentTopics(topics);

      // DBに要約を保存（セッションがあれば）
      if (currentSessionId && currentSessionId > 0) {
        try {
          await saveSessionAnalysis(currentSessionId, 'summary', JSON.stringify({ summary, topics }));
        } catch (e) {
          console.warn('要約保存に失敗:', e);
        }
      }
      
      console.log('要約完了:', summary);
    } catch (error) {
      console.error('要約エラー:', error);
      showAnalysisError('議論要約', `${error}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  // 定期的な議論分析（3ターンごと）
  const checkAndAnalyze = async () => {
    if (!config || totalTurns % 3 !== 0 || totalTurns === 0 || messages.length < 3) {
      return;
    }

    console.log(`${totalTurns}ターン目に到達。議論分析を実行します...`);
    await analyzeCurrentDiscussion();
  };

  // 議論分析を実行する関数
  const analyzeCurrentDiscussion = async () => {
    if (!config || messages.length === 0 || isSaving) {
      console.log('⚠️ 分析スキップ:', { 
        hasConfig: !!config,
        messageCount: messages.length,
        isSaving
      });
      return;
    }

    try {
      console.log('🔍 議論分析を実行中...', { messageCount: messages.length, config: config.discussionTopic });
      setIsAnalyzing(true);
      
      const conversationHistory = messages
        .map(msg => `${msg.speaker}: ${msg.message}`)
        .join('\n');

      const participants = [
        ...(config.participate ? ['ユーザー'] : []),
        ...config.aiData.map(ai => ai.name)
      ];

      console.log('📤 分析リクエスト送信:', { participants, historyLength: conversationHistory.length });

      const analysisResult = await analyzeDiscussionPoints(
        config.discussionTopic,
        conversationHistory,
        participants
      );

      console.log('📥 分析レスポンス受信:', analysisResult);

      // JSONパース（マークダウンコードブロックを除去）
      try {
        // ```json と ``` を除去
        let cleanedResult = analysisResult.trim();
        if (cleanedResult.startsWith('```json')) {
          cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResult.startsWith('```')) {
          cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        console.log('🧹 クリーニング後:', cleanedResult);
        
        const parsedAnalysis = JSON.parse(cleanedResult);
        console.log('🔍 パース結果の型チェック:', typeof parsedAnalysis, parsedAnalysis);
        
        // データ構造の検証
        if (parsedAnalysis && typeof parsedAnalysis === 'object') {
          // 必要なプロパティが存在するかチェック
          const validAnalysis: DiscussionAnalysis = {
            mainPoints: Array.isArray(parsedAnalysis.mainPoints) ? 
              parsedAnalysis.mainPoints.filter((point: any) => 
                point && typeof point === 'object' && 
                typeof point.point === 'string' && 
                typeof point.description === 'string'
              ) : [],
            participantStances: Array.isArray(parsedAnalysis.participantStances) ? parsedAnalysis.participantStances.filter((s: any) => s && typeof s.participant === 'string') : [],
            conflicts: Array.isArray(parsedAnalysis.conflicts) ? parsedAnalysis.conflicts.filter((c: any) => c && typeof c.issue === 'string') : [],
            commonGround: Array.isArray(parsedAnalysis.commonGround) ? parsedAnalysis.commonGround.filter((item: any) => typeof item === 'string') : [],
            unexploredAreas: Array.isArray(parsedAnalysis.unexploredAreas) ? parsedAnalysis.unexploredAreas.filter((item: any) => typeof item === 'string') : []
          };
          
          setDiscussionAnalysis(validAnalysis);
          showAnalysisSuccess();

          // DBに分析結果を保存（セッションがあれば）
          if (currentSessionId && currentSessionId > 0) {
            try {
              await saveSessionAnalysis(currentSessionId, 'analysis', JSON.stringify(validAnalysis));
            } catch (e) {
              console.warn('分析結果保存に失敗:', e);
            }
          }

          console.log('✅ 議論分析完了:', validAnalysis);
        } else {
          throw new Error('分析結果が有効なオブジェクトではありません');
        }
      } catch (parseError) {
        console.error('❌ 分析結果のJSONパースに失敗:', parseError);
        console.log('Raw analysis result:', analysisResult);
        showAnalysisError('議論分析', `JSON解析に失敗しました: ${parseError}`);
      }
    } catch (error) {
      console.error('❌ 議論分析エラー:', error);
      showAnalysisError('議論分析', `${error}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 自動セッション保存関数（サイレント）
  const autoSaveSession = async (messagesToSave?: DiscussionMessage[]) => {
    // 既に保存中の場合はスキップ
    if (isSaving) {
      console.log('💾 保存処理中のため、重複保存をスキップ');
      return;
    }
    
    const currentMessages = messagesToSave || messages;
    console.log('💾 自動セッション保存開始:', { 
      currentSessionId, 
      isResumedSession, 
      messageCount: currentMessages.length,
      hasConfig: !!config,
      configTopic: config?.discussionTopic,
      configAiData: config?.aiData?.length || 0,
      usingPassedMessages: !!messagesToSave,
      sessionIdType: typeof currentSessionId,
      sessionIdValue: currentSessionId
    });
    
    if (!config || currentMessages.length === 0) {
      console.log('⏭️ 保存対象データなし、スキップ:', { 
        hasConfig: !!config, 
        messageCount: currentMessages.length 
      });
      return;
    }

    setIsSaving(true);
    try {
      // 参加者情報を完全な形で保存（名前、役職、説明を含む）
      const participantsData = {
        userParticipates: config.participate,
        aiData: config.aiData // AI情報全体を保存
      };
      
      console.log('📦 保存データ準備完了:', {
        participantsData: participantsData,
        topic: config.discussionTopic,
        messageCount: currentMessages.length,
        messagesPreview: currentMessages.slice(-2).map(m => ({ speaker: m.speaker, message: m.message.substring(0, 50) + '...' }))
      });

      // セッションIDの有無を厳密にチェック
      if (currentSessionId && currentSessionId > 0) {
        // 既存セッションの更新
        console.log('🔄 既存セッション更新中:', currentSessionId, '(型:', typeof currentSessionId, ')');
        await updateSession(
          currentSessionId,
          JSON.stringify(currentMessages)
        );
        console.log('✅ セッション更新完了（自動保存）');
      } else {
        // 新規セッションとして保存（メッセージが1つ以上ある場合のみ）
        if (currentMessages.length === 0) {
          console.log('⏭️ メッセージが空のため、セッション作成をスキップ');
          return;
        }
        
        console.log('📝 新規セッション作成中... (currentSessionId:', currentSessionId, ', isResumedSession:', isResumedSession, ')');
        const sessionId = await saveSession(
          config.discussionTopic,
          JSON.stringify(participantsData), // 完全な参加者データを保存
          JSON.stringify(currentMessages),
          selectedModel // 使用モデル名を保存
        );
        console.log('📝 新規セッション作成結果:', sessionId, '(型:', typeof sessionId, ')');
        setCurrentSessionId(sessionId);
        setIsResumedSession(true);
        
        // 以前は localStorage に currentSessionInfo を保存していましたが、
        // 自動で既存セッションへ紐付く誤動作を避けるため、保存を廃止しました。
        // （続きから再開する場合は /sessions 経由で明示的に resumeSession を設定します）
        
        console.log('✅ 新規セッション作成完了（自動保存）:', sessionId);
      }
    } catch (error) {
      console.error('自動保存エラー:', error);
      // サイレント処理のためアラートは出さない
    } finally {
      setIsSaving(false);
    }
  };

  // AI編集ダイアログを開く関数（Drawerに変更）
  const openEditDialog = () => {
    if (config) {
      setEditingAIData([...config.aiData]);
      setEditParticipate(!!config.participate);
      setActiveEditTab('ai-0');
      setShowEditDialog(true);
    }
  };

  // 追加: AIを追加/削除
  const addAI = () => {
    setEditingAIData(prev => {
      if (prev.some(ai => !ai.name?.trim())) {
        showGenericError('AIの追加ができません', '未入力のAI名があります。先に入力してください。');
        return prev;
      }
      const next = [...prev, { name: '', role: '', description: '' }];
      setActiveEditTab(`ai-${next.length - 1}`);
      return next;
    });
  };
  const removeAI = (index: number) => {
    setEditingAIData(prev => {
      const next = prev.filter((_, i) => i !== index);
      const newIndex = Math.max(0, Math.min(index, next.length - 1));
      setActiveEditTab(`ai-${newIndex}`);
      return next;
    });
  };

  // AI編集を保存する関数（participateも反映）
  const saveAIEdit = async () => {
    if (config) {
      // 入力バリデーション（少なくとも名前は必須）
      if (editingAIData.some(ai => !ai.name?.trim())) {
        showGenericError('AI編集の保存に失敗', '各AIの「名前」は必須です。');
        return;
      }
      const updatedConfig = {
        ...config,
        aiData: editingAIData,
        participate: editParticipate,
      };
      setConfig(updatedConfig);
      
      // localStorageも更新
      localStorage.setItem('aiConfig', JSON.stringify(updatedConfig));

      // 現在のセッションがあればparticipantsも更新
      try {
        if (currentSessionId && currentSessionId > 0) {
          const participantsData = {
            userParticipates: updatedConfig.participate,
            aiData: updatedConfig.aiData
          };
          await updateSessionParticipants(currentSessionId, JSON.stringify(participantsData));
          console.log('✅ セッションの参加者情報を更新しました: ID', currentSessionId);
          showParticipantsUpdateSuccess();
        }
      } catch (e) {
        console.error('参加者情報の更新に失敗:', e);
        showParticipantsUpdateError(`${e}`);
      }
      
      setShowEditDialog(false);
    }
  };

  // AIデータを更新する関数
  const updateAIData = (index: number, field: keyof AICharacter, value: string) => {
    const updated = [...editingAIData];
    updated[index] = { ...updated[index], [field]: value };
    setEditingAIData(updated);
  };

  // AIのターンを処理する関数（要約+直近Kターンを考慮）
  const processAITurn = async (turnOverride?: number) => {
    if (!config) {
      console.log('⚠️ AIターン処理スキップ: 設定未読込');
      return;
    }
    if (isProcessing || isSaving) {
      console.log('⏳ 既に処理中のためスキップ', { isProcessing, isSaving });
      return;
    }
    if (!isModelLoaded) {
      showOllamaConnectionError();
      return;
    }

    const turn = typeof turnOverride === 'number' ? turnOverride : currentTurn;
    if (turn === 0) {
      console.log('👤 ユーザーのターンのためAI処理は実行しません');
      return;
    }

    const aiIndex = turn - 1;
    const ai = config.aiData[aiIndex];
    if (!ai) {
      console.log('⚠️ 対応するAIが見つかりません', { currentTurn: turn, aiIndex });
      return;
    }

    try {
      setIsProcessing(true);
      // 会話履歴を構築（要約 + 直近Kターン）
      const recentLines = messages
        .slice(-RECENT_TURNS_TO_KEEP)
        .map(m => `${m.speaker}: ${m.message}`)
        .join('\n');
      const conversationHistory = summarizedHistory
        ? `${summarizedHistory}\n${recentLines}`
        : recentLines;

      console.log('🤖 AI応答生成開始:', { ai: ai.name, historyLen: conversationHistory.length });

      const response = await generateAIResponse(
        ai.name,
        ai.role,
        ai.description,
        conversationHistory,
        config.discussionTopic
      );

      const aiMessage: DiscussionMessage = {
        speaker: ai.name,
        message: response,
        isUser: false,
        timestamp: new Date(),
      };

      const updated = [...messages, aiMessage];
      setMessages(updated);
      setTotalTurns(prev => prev + 1);

      // セッション自動保存
      try {
        await autoSaveSession(updated);
      } catch (e) {
        console.warn('自動保存に失敗:', e);
      }

      // 次のターンへ
      const nextAIIndex = aiIndex + 1;
      if (config.participate) {
        // ユーザー参加: 全AIが発言したらユーザーへ
        setCurrentTurn(nextAIIndex < config.aiData.length ? nextAIIndex + 1 : 0);
      } else {
        // ユーザー不参加: 次のAI、最後なら最初のAIに戻す
        setCurrentTurn(nextAIIndex < config.aiData.length ? nextAIIndex + 1 : 1);
      }
    } catch (error) {
      console.error('🤖 AI応答生成エラー:', error);
      showAIResponseError(ai?.name || 'AI', `${error}`);
    } finally {
      setIsProcessing(false);
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
      {/* メインコンテンツエリア */}
      <VStack 
        gap={{ base: 2, md: 4 }} 
        p={{ base: 3, md: 6 }} 
        flex="1" 
        overflow="hidden"
        pb={{ base: "220px", md: "200px" }}
      >
        {/* 下部入力エリア分のパディングをさらに増加 */}
      {/* ヘッダー */}
      <Box width="100%" borderBottom="1px solid" borderColor="border.muted" pb={{ base: 2, md: 4 }}>
        <Stack 
          direction={{ base: "column", md: "row" }}
          justify="space-between" 
          align={{ base: "start", md: "center" }}
          width="100%"
          gap={{ base: 2, md: 0 }}
        >
          <Button onClick={() => navigate(previousPage)} size={{ base: "xs", md: "sm" }} variant="ghost">
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
              onClick={openEditDialog}
            >
              <Text display={{ base: "none", md: "block" }}>AI編集</Text>
              <Text display={{ base: "block", md: "none" }}>✏️</Text>
            </Button>
          </HStack>
        </Stack>

      </Box>

      {/* 参加者表示 */}
      <Stack 
        direction={{ base: "column", lg: "row" }}
        wrap="wrap" 
        gap={2} 
        justify="space-between" 
        width="100%"
      >
        <HStack wrap="wrap" gap={2} flex="1">
          {participants.map((participant, index) => (
            <Badge
              key={index}
              colorPalette={currentTurn === index ? "green" : "gray"}
              variant={currentTurn === index ? "solid" : "outline"}
              size={{ base: "sm", md: "md" }}
            >
              {participant.name} ({participant.role})
            </Badge>
          ))}
        </HStack>
        
        {/* 要約システム情報 */}
        <HStack gap={1} wrap="wrap" justify={{ base: "start", lg: "end" }}>
          <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
            ターン: {totalTurns}
          </Badge>
          {summarizedHistory && (
            <Badge colorPalette="green" variant="outline" size={{ base: "sm", md: "md" }}>
              要約済み
            </Badge>
          )}
        </HStack>
      </Stack>

      {/* 処理ステータス表示（要約/分析） */}
      {(isSummarizing || isAnalyzing) && (
        <Box 
          width="100%" 
          p={{ base: 2, md: 3 }}
          bg="bg.panel" 
          borderRadius="md" 
          border="1px solid" 
          borderColor="border.muted"
        >
          {isSummarizing && (
            <HStack gap={2}>
              <Spinner colorPalette="green" size="sm" />
              <Text fontSize={{ base: "xs", md: "sm" }}>📝 議論を要約中です。少々時間がかかる場合がございます。</Text>
            </HStack>
          )}
          {isAnalyzing && (
            <HStack gap={2} mt={isSummarizing ? 2 : 0}>
              <Spinner colorPalette="green" size="sm" />
              <Text fontSize={{ base: "xs", md: "sm" }}>📊 議論を分析中です。少々時間がかかる場合がございます。</Text>
            </HStack>
          )}
        </Box>
      )}

      {/* 現在の争点表示 */}
      {currentTopics.length > 0 && (
        <Box 
          width="100%" 
          p={{ base: 2, md: 3 }}
          bg="green.subtle" 
          borderRadius="md" 
          border="1px solid" 
          borderColor="green.muted"
        >
          <Text fontSize={{ base: "xs", md: "sm" }} fontWeight="bold" mb={2}>🎯 現在の議論の争点:</Text>
          <HStack wrap="wrap" gap={1}>
            {currentTopics.map((topic, index) => (
              <Badge key={index} colorPalette="green" variant="subtle" size={{ base: "xs", md: "sm" }}>
                {topic}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {/* 議論分析ボタン */}
      <HStack width="100%" justify="flex-end" gap={3}>
        <Button 
          size={{ base: "sm", md: "md" }}
          colorPalette="green" 
          variant={showAnalysis ? "solid" : "outline"}
          onClick={() => {
            setShowAnalysis(!showAnalysis);
            // 分析パネルを開く時のみ、データがない場合だけ自動実行
            if (!showAnalysis && !discussionAnalysis && messages.length > 2) {
              analyzeCurrentDiscussion();
            }
          }}
        >
          <Text display={{ base: "none", md: "block" }}>
            {showAnalysis ? '分析パネルを閉じる' : '議論分析パネルを開く'}
          </Text>
          <Text display={{ base: "block", md: "none" }}>
            {showAnalysis ? '分析を閉じる' : '📊 分析'}
          </Text>
        </Button>
      </HStack>

      {/* 議論開始前 */}
      {!discussionStarted && (
        <VStack gap={4} flex={1} justify="center" p={{ base: 4, md: 0 }}>
          <Text fontSize={{ base: "md", md: "lg" }}>議論の準備ができました</Text>
          <Text fontSize={{ base: "sm", md: "md" }}>参加者: {participants.length}人</Text>
          <VStack gap={2}>
            <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">
              💬 {config.participate ? '下部の入力エリアから議論を開始できます' : '下部のボタンから自動議論を開始できます'}
            </Text>
            <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted" textAlign="center">
              🎯 テーマ: {config.discussionTopic}
            </Text>
          </VStack>
        </VStack>
      )}

      {/* 議論中 - レスポンシブレイアウト */}
      {discussionStarted && (
        <Stack 
          direction={{ base: "column", lg: "row" }}
          gap={4} 
          flex={1} 
          align="stretch" 
          width="100%"
        >
          {/* メッセージ履歴エリア */}
          <Box 
            ref={messageAreaRef}
            onScroll={handleScroll}
            flex={{ base: "1", lg: showAnalysis ? "2" : "1" }}
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
            {/* メッセージエリアに下部マージン追加 */}
            {messages.map((msg, index) => (
              <ChatMessage 
                key={index}
                message={msg}
                index={index}
              />
            ))}
            
            {isProcessing && (
              <Box textAlign="center" p={4}>
                <Spinner colorPalette="green" />
                <Text mt={2}>
                  {currentTurn > 0 && config.aiData[currentTurn - 1]
                    ? `（${config.aiData[currentTurn - 1].name}）が考え中`
                    : 'AI応答を生成中...'}
                </Text>
              </Box>
            )}
            
            {/* メッセージエリア内の下部スペーサー（固定入力エリア分の余白） */}
            <Box height={{ base: "20px", md: "30px" }} />
            
            {/* 自動スクロール制御ボタン（底部にいない場合のみ表示） */}
            {!shouldAutoScroll && messages.length > 0 && (
              <Box position="sticky" bottom={2} textAlign="center" mt={2}>
                <Button
                  size="sm"
                  colorPalette="green"
                  variant="solid"
                  onClick={() => {
                    setShouldAutoScroll(true);
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

          {/* デスクトップ用分析パネル */}
          {showAnalysis && (
            <Box 
              display={{ base: "none", lg: "block" }}
              flex="1"
              minWidth="350px"
              maxHeight="calc(100vh - 450px)"
              overflowY="auto"
              p={4}
              bg="green.subtle" 
              borderRadius="md" 
              mb={4} 
              border="1px solid" 
              borderColor="green.muted"
            >
              <HStack justify="space-between" align="center" mb={3}>
                <Text fontSize={{ base: "md", md: "lg" }} fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
                {messages.length > 2 && (
                  <Button 
                    size="xs" 
                    colorPalette="green" 
                    variant="outline"
                    onClick={() => {
                      analyzeCurrentDiscussion();
                    }}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '分析中...' : '最新分析を実行'}
                  </Button>
                )}
              </HStack>

              {/* 分析データがない場合の表示 */}
              {!discussionAnalysis && (
                <Box textAlign="center" py={8}>
                  <Text color="fg.muted" mb={3}>まだ分析データがありません</Text>
                  {messages.length > 2 ? (
                    <Button 
                      size="sm" 
                      colorPalette="green" 
                      onClick={analyzeCurrentDiscussion}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? '分析中...' : '議論を分析する'}
                    </Button>
                  ) : (
                    <Text fontSize="sm" color="fg.muted">
                      議論が進むと分析できるようになります
                    </Text>
                  )}
                </Box>
              )}

              {/* 分析データがある場合の表示 */}
              {discussionAnalysis && (
                <>
                  {/* 主要論点 */}
                  {discussionAnalysis.mainPoints && discussionAnalysis.mainPoints.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🎯 主要論点</Text>
                      {discussionAnalysis.mainPoints.map((point, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="green.subtle" 
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="green.solid"
                        >
                          <Text fontWeight="semibold" fontSize="sm">{point.point}</Text>
                          <Text fontSize="xs" color="fg.muted" mt={1}>{point.description}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 参加者の立場 */}
                  {discussionAnalysis.participantStances && discussionAnalysis.participantStances.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">👥 各参加者の立場</Text>
                      {discussionAnalysis.participantStances.map((stance, index) => (
                        <Box key={index} mb={3} p={3} bg="green.subtle" borderRadius="md">
                          <Text fontWeight="bold" fontSize="sm" color="green.fg">
                            {stance.participant === 'ユーザー' ? 'あなた' : stance.participant}
                          </Text>
                          <Text fontSize="sm" mt={1}>{stance.stance}</Text>
                          {stance.keyArguments && stance.keyArguments.length > 0 && (
                            <Box mt={2}>
                              <Text fontSize="xs" color="fg.muted" mb={1}>主な論拠:</Text>
                              {stance.keyArguments.map((arg, argIndex) => (
                                <Text key={argIndex} fontSize="xs" color="fg.subtle" ml={2}>
                                  • {arg}
                                </Text>
                              ))}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 対立点 */}
                  {discussionAnalysis.conflicts && discussionAnalysis.conflicts.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">⚔️ 主な対立点</Text>
                      {discussionAnalysis.conflicts.map((conflict, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="red.subtle"
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="red.solid"
                        >
                          <Text fontWeight="semibold" fontSize="sm">{conflict.issue}</Text>
                          <Text fontSize="xs" color="fg.muted" mt={1}>{conflict.description}</Text>
                          <HStack mt={2} gap={1} wrap="wrap">
                            {conflict.sides && conflict.sides.map((side, sideIndex) => (
                              <Badge key={sideIndex} colorPalette="red" variant="subtle" size="xs">
                                {side}
                              </Badge>
                            ))}
                          </HStack>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 共通認識 */}
                  {discussionAnalysis.commonGround && discussionAnalysis.commonGround.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🤝 共通認識</Text>
                      {discussionAnalysis.commonGround.map((common, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="green.subtle"
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="green.solid"
                        >
                          <Text fontSize="sm">{common}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 未探索領域 */}
                  {discussionAnalysis.unexploredAreas && discussionAnalysis.unexploredAreas.length > 0 && (
                    <Box>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🔍 未探索の論点</Text>
                      <HStack wrap="wrap" gap={1}>
                        {discussionAnalysis.unexploredAreas.map((area, index) => (
                          <Badge key={index} colorPalette="green" variant="subtle" size="sm">
                            {area}
                          </Badge>
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

      {/* ここでメインのコンテンツVStackを閉じる */}
      </VStack>

      {/* モバイル用分析オーバーレイパネル */}
      {showAnalysis && (
        <Box
          display={{ base: "block", lg: "none" }}
          position="fixed"
          top="0"
          left="0"
          right="0"
          bottom="0"
          bg="blackAlpha.600"
          zIndex="modal"
          onClick={() => setShowAnalysis(false)}
        >
          <Box
            position="absolute"
            top="50%"
            left="50%"
            transform="translate(-50%, -50%)"
            bg="bg"
            borderRadius="lg"
            border="1px solid"
            borderColor="border.muted"
            boxShadow="xl"
            maxWidth="90vw"
            maxHeight="80vh"
            width="full"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            {/* モバイル用ヘッダー */}
            <HStack
              justify="space-between"
              align="center"
              p={4}
              borderBottom="1px solid"
              borderColor="border.muted"
            >
              <Text fontSize="lg" fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
              <HStack gap={2}>
                {messages.length > 2 && (
                  <Button 
                    size="xs" 
                    colorPalette="green" 
                    variant="outline"
                    onClick={() => {
                      analyzeCurrentDiscussion();
                    }}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? '分析中...' : '更新'}
                  </Button>
                )}
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => setShowAnalysis(false)}
                >
                  ✕
                </Button>
              </HStack>
            </HStack>

            {/* モバイル用分析内容 */}
            <Box
              p={4}
              maxHeight="calc(80vh - 80px)"
              overflowY="auto"
            >
              {/* 分析データがない場合の表示 */}
              {!discussionAnalysis && (
                <Box textAlign="center" py={8}>
                  <Text color="fg.muted" mb={3}>まだ分析データがありません</Text>
                  {messages.length > 2 ? (
                    <Button 
                      size="sm" 
                      colorPalette="green" 
                      onClick={analyzeCurrentDiscussion}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? '分析中...' : '議論を分析する'}
                    </Button>
                  ) : (
                    <Text fontSize="sm" color="fg.muted">
                      議論が進むと分析できるようになります
                    </Text>
                  )}
                </Box>
              )}

              {/* 分析データがある場合の表示 */}
              {discussionAnalysis && (
                <>
                  {/* 主要論点 */}
                  {discussionAnalysis.mainPoints && discussionAnalysis.mainPoints.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🎯 主要論点</Text>
                      {discussionAnalysis.mainPoints.map((point, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="green.subtle" 
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="green.solid"
                        >
                          <Text fontWeight="semibold" fontSize="sm">{point.point}</Text>
                          <Text fontSize="xs" color="fg.muted" mt={1}>{point.description}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 参加者の立場 */}
                  {discussionAnalysis.participantStances && discussionAnalysis.participantStances.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">👥 各参加者の立場</Text>
                      {discussionAnalysis.participantStances.map((stance, index) => (
                        <Box key={index} mb={3} p={3} bg="green.subtle" borderRadius="md">
                          <Text fontWeight="bold" fontSize="sm" color="green.fg">
                            {stance.participant === 'ユーザー' ? 'あなた' : stance.participant}
                          </Text>
                          <Text fontSize="sm" mt={1}>{stance.stance}</Text>
                          {stance.keyArguments && stance.keyArguments.length > 0 && (
                            <Box mt={2}>
                              <Text fontSize="xs" color="fg.muted" mb={1}>主な論拠:</Text>
                              {stance.keyArguments.map((arg, argIndex) => (
                                <Text key={argIndex} fontSize="xs" color="fg.subtle" ml={2}>
                                  • {arg}
                                </Text>
                              ))}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 対立点 */}
                  {discussionAnalysis.conflicts && discussionAnalysis.conflicts.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">⚔️ 主な対立点</Text>
                      {discussionAnalysis.conflicts.map((conflict, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="red.subtle"
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="red.solid"
                        >
                          <Text fontWeight="semibold" fontSize="sm">{conflict.issue}</Text>
                          <Text fontSize="xs" color="fg.muted" mt={1}>{conflict.description}</Text>
                          <HStack mt={2} gap={1} wrap="wrap">
                            {conflict.sides && conflict.sides.map((side, sideIndex) => (
                              <Badge key={sideIndex} colorPalette="red" variant="subtle" size="xs">
                                {side}
                              </Badge>
                            ))}
                          </HStack>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 共通認識 */}
                  {discussionAnalysis.commonGround && discussionAnalysis.commonGround.length > 0 && (
                    <Box mb={4}>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🤝 共通認識</Text>
                      {discussionAnalysis.commonGround.map((common, index) => (
                        <Box 
                          key={index} 
                          mb={2} 
                          p={3} 
                          bg="green.subtle"
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="green.solid"
                        >
                          <Text fontSize="sm">{common}</Text>
                        </Box>
                      ))}
                    </Box>
                  )}

                  {/* 未探索領域 */}
                  {discussionAnalysis.unexploredAreas && discussionAnalysis.unexploredAreas.length > 0 && (
                    <Box>
                      <Text fontSize="md" fontWeight="bold" mb={2} color="green.fg">🔍 未探索の論点</Text>
                      <HStack wrap="wrap" gap={1}>
                        {discussionAnalysis.unexploredAreas.map((area, index) => (
                          <Badge key={index} colorPalette="green" variant="subtle" size="sm">
                            {area}
                          </Badge>
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

      {/* 固定下部入力エリア */}
      <Box 
        borderTop="1px solid" 
        borderColor="border.muted" 
        bg="bg" 
        p={{ base: 3, md: 4 }}
        width="100%"
        minWidth="100%"
      >
        {/* ユーザー入力エリア */}
        {config.participate && (
          <VStack width="100%" gap={2}>
            {currentTurn === 0 && !isProcessing ? (
              <>
                <Text fontWeight="bold" fontSize={{ base: "sm", md: "md" }}>あなたのターンです</Text>
                {!isModelLoaded && (
                  <Text fontSize={{ base: "xs", md: "sm" }} color="red.solid">
                    ⚠️ AIモデルが準備できていません。Ollamaが起動しているか確認してください。
                  </Text>
                )}
                <Text fontSize={{ base: "xs", md: "sm" }} color="fg.muted">
                  💡 議論を深めるヒント: 多様な視点や疑問、具体例や根拠を示して論点を深掘りしてください
                </Text>
              </>
            ) : (
              <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
                {isProcessing
                  ? (currentTurn > 0 && config.aiData[currentTurn - 1]
                      ? `（${config.aiData[currentTurn - 1].name}）が考え中`
                      : 'AI応答を生成中...')
                  : (!discussionStarted ? '議論を開始してください' : 'AIのターンです')}
              </Text>
            )}
            
            <VStack align="stretch" gap={2} width="100%" flex="1">
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder={
                  !discussionStarted ? "議論開始後に入力できます" :
                  currentTurn === 0 && !isProcessing ?
                    "あなたの意見や質問を入力してください..." :
                  "他の参加者のターンです"
                }
                resize="none"
                rows={3}
                fontSize={{ base: "sm", md: "md" }}
                disabled={!discussionStarted || currentTurn !== 0 || isProcessing || isSaving}
                maxLength={10000}
                width="100%"
                minWidth="100%"
              />
              
              {/* 文字数カウンター */}
              <HStack justify="space-between">
                <Text fontSize="xs" color="gray.500">
                  {userInput.length}/10,000文字
                </Text>
                {userInput.length > 9000 && (
                  <Text fontSize="xs" color="orange.500">
                    残り{10000 - userInput.length}文字
                  </Text>
                )}
              </HStack>
            </VStack>
            
            <HStack width="100%" gap={2}>
              {!discussionStarted ? (
                <>
                  <Button 
                    colorPalette="green" 
                    onClick={startDiscussion}
                    disabled={!isModelLoaded || isProcessing || isSaving}
                    flex="1"
                    size={{ base: "sm", md: "md" }}
                  >
                    {!isModelLoaded ? 'Ollamaが起動していません' : 
                     isSaving ? '保存中...' :
                     isProcessing ? '処理中...' : '議論を開始する'}
                  </Button>

                </>
              ) : (
                <Button 
                  colorPalette="green" 
                  onClick={
                    isWaitingForResume && currentTurn > 0 ? resumeAIResponse : 
                    handleUserSubmit
                  }
                  disabled={
                    isWaitingForResume && currentTurn > 0 ? false :
                    /* 復元時の再開ボタンは常に有効 */
                    (!userInput.trim() || !isModelLoaded || currentTurn !== 0 || isProcessing || isSaving)
                  }
                  flex="1"
                  size={{ base: "sm", md: "md" }}
                >
                  {!isModelLoaded ? 'Ollamaが起動していません' : 
                   isWaitingForResume && currentTurn > 0 ? '応答を再開する' :
                   currentTurn !== 0 ? 'AIのターンです' :
                   isSaving ? '保存中...' :
                   isProcessing ? '処理中...' : '発言する'}
                </Button>
              )}
              
              {/* AI自動議論モード用ボタン */}
              {discussionStarted && !config.participate && !isProcessing && (
                <Button 
                  colorPalette="green" 
                  onClick={isWaitingForResume ? resumeAIResponse : () => processAITurn()}
                  size={{ base: "sm", md: "md" }}
                  variant="outline"
                >
                  {isWaitingForResume ? '応答を再開する' : '次の発言を生成'}
                </Button>
              )}
            </HStack>
          </VStack>
        )}
        
        {/* ユーザーが参加しない場合のAI制御エリア */}
        {!config.participate && (
          <VStack width="100%" gap={2}>
            <Text fontSize={{ base: "sm", md: "md" }} color="fg.muted" textAlign="center">
              {isProcessing
                ? (currentTurn > 0 && config.aiData[currentTurn - 1]
                    ? `（${config.aiData[currentTurn - 1].name}）が考え中`
                    : 'AI応答を生成中...')
                : (!discussionStarted ? '議論を開始してください' : 'AI自動議論モード')}
            </Text>
            
            <Button 
              colorPalette="green" 
              onClick={discussionStarted ? () => processAITurn() : startDiscussion}
              disabled={isProcessing || !config || isSaving}
              size={{ base: "sm", md: "md" }}
              width="100%"
            >
              {!discussionStarted ? '議論開始' :
               isSaving ? '保存中...' :
               isProcessing ? '処理中...' : '次の発言を生成'}
            </Button>
          </VStack>
        )}
        
        
      </Box>

      {/* AI編集ドロワー（セクション選択・緑テーマ） */}
      <Drawer.Root open={showEditDialog} onOpenChange={(d) => setShowEditDialog(d.open)} placement="end" size="md">
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
                    checked={editParticipate}
                    onCheckedChange={(val: any) => setEditParticipate(typeof val === 'boolean' ? val : !!val?.checked)}
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
                        {editingAIData.map((_, idx) => (
                          <Tabs.Trigger key={idx} value={`ai-${idx}`}>
                            AI {idx + 1}
                          </Tabs.Trigger>
                        ))}
                      </Tabs.List>
                      <Button size="xs" variant="outline" onClick={addAI} disabled={editingAIData.some(ai => !ai.name?.trim())}>＋ AIを追加</Button>
                    </VStack>

                    <Box flex="1">
                      {editingAIData.map((ai, idx) => (
                        <Tabs.Content key={idx} value={`ai-${idx}`}>
                          <Box p={3} borderRadius="md" border="1px solid" borderColor="border.muted">
                            <VStack align="stretch" gap={3}>
                              <HStack justify="space-between">
                                <Text fontWeight="bold" color="green.fg">AI {idx + 1}</Text>
                                <Button size="xs" variant="outline" colorPalette="red" onClick={() => removeAI(idx)} disabled={editingAIData.length <= 1}>このAIを削除</Button>
                              </HStack>
                              <FieldRoot>
                                <FieldLabel>名前</FieldLabel>
                                <Input value={ai.name} onChange={(e) => updateAIData(idx, 'name', e.target.value)} placeholder="AI の名前" />
                              </FieldRoot>
                              <FieldRoot>
                                <FieldLabel>役職</FieldLabel>
                                <Input value={ai.role} onChange={(e) => updateAIData(idx, 'role', e.target.value)} placeholder="例：専門家、司会、反対派 など" />
                              </FieldRoot>
                              <FieldRoot>
                                <FieldLabel>説明</FieldLabel>
                                <Textarea rows={3} value={ai.description} onChange={(e) => updateAIData(idx, 'description', e.target.value)} placeholder="得意分野や性格、役割など" />
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
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>キャンセル</Button>
                <Button colorPalette="green" onClick={saveAIEdit} disabled={editingAIData.some(ai => !ai.name?.trim())}>保存</Button>
              </HStack>
            </Drawer.Footer>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </Box>
  );
};
export default PlayPage;