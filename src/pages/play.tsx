import React, { useState, useEffect } from 'react';
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
  Card,
  Group
} from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';

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
    const { generateAIResponse, summarizeDiscussion, analyzeDiscussionPoints, isModelLoaded } = useAIModel();
  
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0); // 0: ユーザー, 1+: AI順番
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discussionStarted, setDiscussionStarted] = useState(false);
  
  // セッション関連の状態
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [isResumedSession, setIsResumedSession] = useState(false);
  
  // 要約システム用の新しい状態
  const [summarizedHistory, setSummarizedHistory] = useState<string>(''); // 要約された過去の議論
  const [recentMessages, setRecentMessages] = useState<DiscussionMessage[]>([]); // 直近3ターンの会話
  const [totalTurns, setTotalTurns] = useState(0); // 総ターン数
  const [discussionPhase, setDiscussionPhase] = useState<'exploration' | 'deepening' | 'synthesis'>('exploration'); // 議論フェーズ
  const [currentTopics, setCurrentTopics] = useState<string[]>([]); // 現在の議論の争点
  
  // 議論分析システム用の状態
  const [discussionAnalysis, setDiscussionAnalysis] = useState<DiscussionAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  const TURNS_BEFORE_SUMMARY = 4; // 要約を実行するターン数（少し長めに）
  const RECENT_TURNS_TO_KEEP = 4; // 保持する直近ターン数

  useEffect(() => {
    // セッション復元チェック
    const resumeData = localStorage.getItem('resumeSession');
    if (resumeData) {
      try {
        const parsed = JSON.parse(resumeData);
        if (parsed.isResume) {
          // セッションを復元
          setCurrentSessionId(parsed.sessionId);
          setIsResumedSession(true);
          setConfig({
            discussionTopic: parsed.topic,
            aiData: parsed.participants.filter((p: string) => p !== 'ユーザー').map((name: string) => ({
              name,
              role: '', // 復元時は簡略化
              description: ''
            })),
            participate: parsed.participants.includes('ユーザー')
          });
          setMessages(parsed.messages);
          setDiscussionStarted(true);
          localStorage.removeItem('resumeSession'); // 一度使ったら削除
          return;
        }
      } catch (error) {
        console.error('セッション復元エラー:', error);
      }
    }

    // 通常の設定データを読み込み
    const savedConfig = localStorage.getItem('aiConfig');
    if (!savedConfig) {
      navigate('/config');
      return;
    }
    
    try {
      const parsedConfig: AIConfig = JSON.parse(savedConfig);
      setConfig(parsedConfig);
    } catch (error) {
      console.error('設定データの読み込みに失敗:', error);
      navigate('/config');
    }
  }, [navigate]);

  const participants = config ? [
    ...(config.participate ? [{ name: 'あなた', role: 'あなた', description: '議論の参加者' }] : []),
    ...config.aiData
  ] : [];

  const startDiscussion = () => {
    if (!config?.participate) {
      // ユーザーが参加しない場合、AIだけで議論開始
      setCurrentTurn(1);
      setDiscussionStarted(true);
      processAITurn();
    } else {
      setDiscussionStarted(true);
    }
  };

  const handleUserSubmit = async () => {
    if (!userInput.trim() || isProcessing) {
      console.log('🚫 ユーザー発言スキップ:', { userInput: userInput.trim(), isProcessing });
      return;
    }

    console.log('📝 ユーザー発言開始:', userInput.trim());

    const userMessage: DiscussionMessage = {
      speaker: 'ユーザー',
      message: userInput,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setRecentMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setCurrentTurn(1); // 次はAIのターン
    setTotalTurns(prev => prev + 1);
    
    // 議論フェーズの自動調整（ユーザー発言時も）
    if (totalTurns > 8 && discussionPhase === 'exploration') {
      setDiscussionPhase('deepening');
    } else if (totalTurns > 16 && discussionPhase === 'deepening') {
      setDiscussionPhase('synthesis');
    }

    // 定期的な議論分析（ユーザー発言後も）
    setTimeout(() => {
      checkAndAnalyze();
    }, 1000);
    
    console.log('🤖 AI応答開始...');
    // AI応答を順番に処理
    try {
      await processAITurn();
      console.log('✅ AI応答完了');
    } catch (error) {
      console.error('❌ AI応答エラー:', error);
      alert('AI応答でエラーが発生しました: ' + error);
    }
  };

  // 要約が必要かチェックし、実行する関数
  const checkAndSummarize = async () => {
    if (!config || totalTurns % TURNS_BEFORE_SUMMARY !== 0 || totalTurns === 0) {
      return;
    }

    console.log(`${totalTurns}ターン目に到達。要約を実行します...`);
    
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
      
      console.log('要約完了:', summary);
    } catch (error) {
      console.error('要約エラー:', error);
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

  const processAITurn = async () => {
    if (!config) {
      console.log('🚫 processAITurn: configがありません');
      return;
    }
    
    console.log('🤖 processAITurn開始:', { 
      aiCount: config.aiData.length, 
      currentTurn, 
      isProcessing,
      totalTurns 
    });
    
    setIsProcessing(true);
    
    try {
      // 要約チェックを実行
      await checkAndSummarize();

      // 定期的な議論分析
      await checkAndAnalyze();

      // 議論フェーズの自動調整
      if (totalTurns > 8 && discussionPhase === 'exploration') {
        setDiscussionPhase('deepening');
      } else if (totalTurns > 16 && discussionPhase === 'deepening') {
        setDiscussionPhase('synthesis');
      }

      // messagesの最新状態を参照する関数を作成
      const getCurrentMessages = () => {
        return new Promise<DiscussionMessage[]>((resolve) => {
          setMessages(currentMessages => {
            resolve(currentMessages);
            return currentMessages;
          });
        });
      };

      let latestMessages = await getCurrentMessages();
      console.log('📝 現在のメッセージ数:', latestMessages.length);
      
      for (let i = 0; i < config.aiData.length; i++) {
        const ai = config.aiData[i];
        console.log(`🤖 ${ai.name}の応答を生成中... (${i + 1}/${config.aiData.length})`);
        setCurrentTurn(i + 1);
        
        try {
          // 効率的な会話履歴を構築（要約 + 直近の会話）
          const recentConversation = latestMessages.slice(-RECENT_TURNS_TO_KEEP)
            .map(msg => `${msg.speaker}: ${msg.message}`)
            .join('\n');
          
          // フェーズ情報を含む会話履歴
          const phaseInstruction = getPhaseInstruction(discussionPhase, totalTurns);
          const conversationHistory = summarizedHistory 
            ? `${summarizedHistory}\n\n【直近の会話】\n${recentConversation}\n\n【議論フェーズ】\n${phaseInstruction}`
            : `${recentConversation}\n\n【議論フェーズ】\n${phaseInstruction}`;

          console.log(`📤 ${ai.name}にリクエスト送信:`, {
            topic: config.discussionTopic,
            historyLength: conversationHistory.length,
            phase: discussionPhase
          });

          const response = await generateAIResponse(
            ai.name,
            ai.role,
            ai.description,
            conversationHistory,
            config.discussionTopic
          );

          console.log(`📥 ${ai.name}の応答受信:`, response.substring(0, 100) + '...');

          const aiMessage: DiscussionMessage = {
            speaker: ai.name,
            message: response,
            isUser: false,
            timestamp: new Date()
          };

          // メッセージを追加し、最新状態を更新
          latestMessages = [...latestMessages, aiMessage];
          setMessages(latestMessages);
          setRecentMessages(prev => [...prev.slice(-RECENT_TURNS_TO_KEEP + 1), aiMessage]);
          setTotalTurns(prev => prev + 1);
          
          console.log(`✅ ${ai.name}の応答完了`);
          
          // 次のAIまで少し待機
          if (i < config.aiData.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (aiError) {
          console.error(`❌ ${ai.name}の応答エラー:`, aiError);
          // エラーメッセージをUIに表示
          const errorMessage: DiscussionMessage = {
            speaker: ai.name,
            message: `[エラー: 応答を生成できませんでした - ${aiError}]`,
            isUser: false,
            timestamp: new Date()
          };
          
          latestMessages = [...latestMessages, errorMessage];
          setMessages(latestMessages);
        }
      }
      
      // 全AIの発言が終わったらユーザーのターンに戻る
      setCurrentTurn(config.participate ? 0 : 1);
      console.log('🔄 全AI応答完了、ターン切り替え:', config.participate ? 'ユーザー' : 'AI継続');
    } catch (error) {
      console.error('❌ processAITurn全体エラー:', error);
      alert('AI応答の処理中にエラーが発生しました: ' + error);
    } finally {
      setIsProcessing(false);
      console.log('🏁 processAITurn完了');
    }
  };

  // 議論フェーズに応じた指示を生成
  const getPhaseInstruction = (phase: string, turns: number): string => {
    switch (phase) {
      case 'exploration':
        return `現在は議論の探索フェーズです（${turns}ターン目）。多様な視点を出し合い、論点を整理してください。`;
      case 'deepening':
        return `現在は議論の深化フェーズです（${turns}ターン目）。具体例や根拠を示し、論点を深く掘り下げてください。`;
      case 'synthesis':
        return `現在は議論の統合フェーズです（${turns}ターン目）。これまでの議論を踏まえ、解決策や結論を模索してください。`;
      default:
        return `議論を深めるために、具体的な質問や事例を交えて発言してください。`;
    }
  };

  // 要約から争点を抽出する関数
  const extractTopicsFromSummary = (summary: string): string[] => {
    const topics: string[] = [];
    // 「争点」「論点」「課題」などのキーワードを含む行を抽出
    const lines = summary.split('\n');
    lines.forEach(line => {
      if (line.includes('争点') || line.includes('論点') || line.includes('課題')) {
        const match = line.match(/[-・](.+?)[:：]/);
        if (match) {
          topics.push(match[1].trim());
        }
      }
    });
    return topics.slice(0, 3); // 最大3つまで
  };

  // 議論分析を実行する関数
  const analyzeCurrentDiscussion = async () => {
    if (!config || messages.length === 0) {
      console.log('⚠️ 分析スキップ: config またはメッセージなし');
      return;
    }

    try {
      console.log('🔍 議論分析を実行中...', { messageCount: messages.length, config: config.discussionTopic });
      setIsProcessing(true);
      
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
        
        const parsedAnalysis: DiscussionAnalysis = JSON.parse(cleanedResult);
        setDiscussionAnalysis(parsedAnalysis);
        console.log('✅ 議論分析完了:', parsedAnalysis);
      } catch (parseError) {
        console.error('❌ 分析結果のJSONパースに失敗:', parseError);
        console.log('Raw analysis result:', analysisResult);
        // パースエラーの場合は、エラーメッセージを表示
        alert('分析結果の解析に失敗しました。コンソールを確認してください。');
      }
    } catch (error) {
      console.error('❌ 議論分析エラー:', error);
      alert('議論分析でエラーが発生しました。');
    } finally {
      setIsProcessing(false);
    }
  };

  // 会話を保存する関数
  const saveCurrentSession = async () => {
    if (!config || messages.length === 0) {
      alert('保存できるデータがありません');
      return;
    }

    try {
      const participants = [
        ...(config.participate ? ['ユーザー'] : []),
        ...config.aiData.map(ai => ai.name)
      ];

      if (currentSessionId && isResumedSession) {
        // 既存セッションの更新
        await invoke('update_discussion_session', {
          sessionId: currentSessionId,
          messages: JSON.stringify(messages)
        });
        alert('セッションを更新しました');
      } else {
        // 新規セッションとして保存
        const sessionId = await invoke<number>('save_discussion_session', {
          topic: config.discussionTopic,
          participants: JSON.stringify(participants),
          messages: JSON.stringify(messages)
        });
        setCurrentSessionId(sessionId);
        setIsResumedSession(true);
        alert('新しいセッションとして保存しました');
      }
    } catch (error) {
      console.error('保存エラー:', error);
      alert('セッションの保存に失敗しました');
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
    <VStack gap={4} p={6} height="100vh">
      {/* ヘッダー */}
      <Box width="100%" borderBottom="1px solid" borderColor="border.muted" pb={4}>
        <HStack justify="space-between" align="center" width="100%">
          <Button onClick={() => navigate('/')} size="sm" variant="ghost">
            ← 戻る
          </Button>
          <Text fontSize="xl" fontWeight="bold">テーマ: {config.discussionTopic}</Text>
          <HStack gap={2} minWidth="120px" justify="flex-end">
            {(messages.length > 0 || discussionStarted) && (
              <Button 
                size="sm" 
                colorPalette="green" 
                variant="outline"
                onClick={saveCurrentSession}
                disabled={messages.length === 0}
              >
                💾 セッション保存
              </Button>
            )}
          </HStack>
        </HStack>

      </Box>

      {/* 参加者表示 */}
      <HStack wrap="wrap" gap={2} justify="space-between" width="100%">
        <HStack wrap="wrap" gap={2}>
          {participants.map((participant, index) => (
            <Badge
              key={index}
              colorPalette={currentTurn === index ? "green" : "gray"}
              variant={currentTurn === index ? "solid" : "outline"}
            >
              {participant.name} ({participant.role})
            </Badge>
          ))}
        </HStack>
        
        {/* 要約システム情報 */}
        <HStack gap={2}>
          <Badge colorPalette="green" variant="outline">
            ターン: {totalTurns}
          </Badge>
          <Badge 
            colorPalette={
              discussionPhase === 'exploration' ? 'green' : 
              discussionPhase === 'deepening' ? 'green' : 'green'
            } 
            variant="outline"
          >
            {discussionPhase === 'exploration' ? '探索' : 
             discussionPhase === 'deepening' ? '深化' : '統合'}フェーズ
          </Badge>
          {summarizedHistory && (
            <Badge colorPalette="green" variant="outline">
              要約済み
            </Badge>
          )}
        </HStack>
      </HStack>

      {/* 現在の争点表示 */}
      {currentTopics.length > 0 && (
        <Box 
          width="100%" 
          p={3} 
          bg="green.subtle" 
          borderRadius="md" 
          border="1px solid" 
          borderColor="green.muted"
        >
          <Text fontSize="sm" fontWeight="bold" mb={2}>🎯 現在の議論の争点:</Text>
          <HStack wrap="wrap" gap={1}>
            {currentTopics.map((topic, index) => (
              <Badge key={index} colorPalette="green" variant="subtle" size="sm">
                {topic}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {/* 議論分析ボタン */}
      <HStack width="100%" justify="center" gap={3}>
        <Button 
          size="sm" 
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
          {showAnalysis ? '分析パネルを閉じる' : '議論分析パネルを開く'}
        </Button>
      </HStack>

      {/* 議論開始前 */}
      {!discussionStarted && (
        <VStack gap={4} flex={1} justify="center">
          <Text fontSize="lg">議論の準備ができました</Text>
          <Text>参加者: {participants.length}人</Text>
          <Button colorPalette="green" size="lg" onClick={startDiscussion}>
            議論開始
          </Button>
        </VStack>
      )}

      {/* 議論中 - サイドパネル形式 */}
      {discussionStarted && (
        <HStack gap={4} flex={1} align="stretch" width="100%">
          {/* メッセージ履歴エリア */}
          <Box 
            flex={showAnalysis ? "2" : "1"}
            minHeight="400px"
            maxHeight="600px"
            overflowY="auto" 
            border="1px solid" 
            borderColor="border.muted" 
            borderRadius="md" 
            p={4}
            transition="all 0.3s"
          >
            {messages.map((msg, index) => (
              <Box 
                key={index} 
                mb={3}
                display="flex"
                justifyContent={msg.isUser ? "flex-end" : "flex-start"}
                alignItems="flex-start"
              >
                <Box
                  maxWidth="75%"
                  bg={msg.isUser ? "green.solid" : "bg.muted"}
                  color={msg.isUser ? "green.contrast" : "fg"}
                  p={3}
                  borderRadius="18px"
                  borderBottomRightRadius={msg.isUser ? "4px" : "18px"}
                  borderBottomLeftRadius={msg.isUser ? "18px" : "4px"}
                  boxShadow="sm"
                  border="none"
                  position="relative"
                >
                  <Text fontSize="xs" fontWeight="bold" mb={1} opacity={0.7}>
                    {msg.isUser ? 'あなた' : msg.speaker}
                  </Text>
                  <Text fontSize="sm" lineHeight="1.4">{msg.message}</Text>
                  <Text fontSize="xs" opacity={0.5} mt={2} textAlign="right">
                    {msg.timestamp.toLocaleTimeString()}
                  </Text>
                </Box>
              </Box>
            ))}
            
            {isProcessing && (
              <Box textAlign="center" p={4}>
                <Spinner colorPalette="green" />
                <Text mt={2}>
                  {currentTurn > 0 && config.aiData[currentTurn - 1] 
                    ? `${config.aiData[currentTurn - 1].name}が考え中...` 
                    : 'AI応答を生成中...'}
                </Text>
              </Box>
            )}
          </Box>

          {/* 分析パネル */}
          {showAnalysis && (
            <Box 
              flex="1"
              minWidth="350px"
              maxHeight="600px"
              overflowY="auto"
              p={4} 
              bg="green.subtle" 
              borderRadius="md" 
              border="1px solid" 
              borderColor="green.muted"
            >
              <HStack justify="space-between" align="center" mb={3}>
                <Text fontSize="lg" fontWeight="bold" color="green.fg">📊 議論分析結果</Text>
                {messages.length > 2 && (
                  <Button 
                    size="xs" 
                    colorPalette="green" 
                    variant="outline"
                    onClick={() => {
                      analyzeCurrentDiscussion();
                    }}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '分析中...' : '最新分析を実行'}
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
                      disabled={isProcessing}
                    >
                      {isProcessing ? '分析中...' : '議論を分析する'}
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
                          p={2} 
                          bg="bg.panel" 
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
                        <Box key={index} mb={3} p={3} bg="bg.panel" borderRadius="md">
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
                          p={2} 
                          layerStyle="fill.subtle"
                          borderRadius="md" 
                          borderLeft="4px solid" 
                          borderColor="red.solid"
                        >
                          <Text fontWeight="semibold" fontSize="sm">{conflict.issue}</Text>
                          <Text fontSize="xs" color="fg.muted" mt={1}>{conflict.description}</Text>
                          <HStack mt={1} gap={1}>
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
                          mb={1} 
                          p={2} 
                          layerStyle="fill.subtle"
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
                          <Badge key={index} colorPalette="green" variant="subtle" size="xs">
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
        </HStack>
      )}

      {/* ユーザー入力エリア */}
      {discussionStarted && config.participate && currentTurn === 0 && !isProcessing && (
        <VStack width="100%" gap={2}>
          <Text fontWeight="bold">あなたのターンです</Text>
          {!isModelLoaded && (
            <Text fontSize="sm" color="red.solid">
              ⚠️ AIモデルが準備できていません。Ollamaが起動しているか確認してください。
            </Text>
          )}
          <Text fontSize="sm" color="fg.muted">
            💡 議論を深めるヒント: 
            {discussionPhase === 'exploration' ? '多様な視点や疑問を提示してみてください' :
             discussionPhase === 'deepening' ? '具体例や根拠を示して論点を深掘りしてください' :
             '解決策や結論に向けた提案をしてみてください'}
          </Text>
          <Textarea
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={
              discussionPhase === 'exploration' ? "「なぜ〜なのでしょうか？」「もし〜だったら？」など..." :
              discussionPhase === 'deepening' ? "「具体的には〜」「例えば〜」「実際には〜」など..." :
              "「解決策として〜」「結論的には〜」「今後は〜」など..."
            }
            resize="none"
            rows={3}
          />
          <Button 
            colorPalette="green" 
            onClick={handleUserSubmit}
            disabled={!userInput.trim() || !isModelLoaded}
            width="full"
          >
            {!isModelLoaded ? 'Ollamaが起動していません' : '発言する'}
          </Button>
        </VStack>
      )}

      {/* AI自動議論モード */}
      {discussionStarted && !config.participate && !isProcessing && (
        <Button colorPalette="green" onClick={processAITurn}>
          次の発言を生成
        </Button>
      )}
    </VStack>
  );
};

export default PlayPage;