import React, { useState, useEffect } from 'react';
import { Box, VStack, HStack, Button, Text, Textarea, Spinner, Badge } from '@chakra-ui/react';
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
  const { generateAIResponse, summarizeDiscussion, analyzeDiscussionPoints } = useAIModel();
  
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
    if (!userInput.trim() || isProcessing) return;

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
    
    // AI応答を順番に処理
    await processAITurn();
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
    if (!config) return;
    
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
      
      for (let i = 0; i < config.aiData.length; i++) {
        const ai = config.aiData[i];
        setCurrentTurn(i + 1);
        
        // 効率的な会話履歴を構築（要約 + 直近の会話）
        const recentConversation = latestMessages.slice(-RECENT_TURNS_TO_KEEP)
          .map(msg => `${msg.speaker}: ${msg.message}`)
          .join('\n');
        
        // フェーズ情報を含む会話履歴
        const phaseInstruction = getPhaseInstruction(discussionPhase, totalTurns);
        const conversationHistory = summarizedHistory 
          ? `${summarizedHistory}\n\n【直近の会話】\n${recentConversation}\n\n【議論フェーズ】\n${phaseInstruction}`
          : `${recentConversation}\n\n【議論フェーズ】\n${phaseInstruction}`;

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
          timestamp: new Date()
        };

        // メッセージを追加し、最新状態を更新
        latestMessages = [...latestMessages, aiMessage];
        setMessages(latestMessages);
        setRecentMessages(prev => [...prev.slice(-RECENT_TURNS_TO_KEEP + 1), aiMessage]);
        setTotalTurns(prev => prev + 1);
        
        // 次のAIまで少し待機
        if (i < config.aiData.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      // 全AIの発言が終わったらユーザーのターンに戻る
      setCurrentTurn(config.participate ? 0 : 1);
    } catch (error) {
      console.error('AI応答エラー:', error);
    } finally {
      setIsProcessing(false);
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
      <HStack justify="space-between" width="100%">
        <VStack align="start" gap={1}>
          <Text fontSize="2xl" fontWeight="bold">議論セッション</Text>
          {config && (
            <Text fontSize="md" color="gray.600">
              テーマ: {config.discussionTopic}
            </Text>
          )}
        </VStack>
        <HStack gap={2}>
          {messages.length > 0 && (
            <Button 
              size="sm" 
              colorScheme="purple" 
              variant="outline"
              onClick={saveCurrentSession}
            >
              💾 セッション保存
            </Button>
          )}
          <Button onClick={() => navigate('/config')} size="sm">
            設定に戻る
          </Button>
        </HStack>
      </HStack>

      {/* 参加者表示 */}
      <HStack wrap="wrap" gap={2} justify="space-between" width="100%">
        <HStack wrap="wrap" gap={2}>
          {participants.map((participant, index) => (
            <Badge
              key={index}
              colorScheme={currentTurn === index ? "blue" : "gray"}
              variant={currentTurn === index ? "solid" : "outline"}
            >
              {participant.name} ({participant.role})
            </Badge>
          ))}
        </HStack>
        
        {/* 要約システム情報 */}
        <HStack gap={2}>
          <Badge colorScheme="green" variant="outline">
            ターン: {totalTurns}
          </Badge>
          <Badge 
            colorScheme={
              discussionPhase === 'exploration' ? 'blue' : 
              discussionPhase === 'deepening' ? 'orange' : 'purple'
            } 
            variant="outline"
          >
            {discussionPhase === 'exploration' ? '探索' : 
             discussionPhase === 'deepening' ? '深化' : '統合'}フェーズ
          </Badge>
          {summarizedHistory && (
            <Badge colorScheme="purple" variant="outline">
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
          bg={{ base: "yellow.50", _dark: "yellow.900" }} 
          borderRadius="md" 
          border="1px solid" 
          borderColor={{ base: "yellow.200", _dark: "yellow.600" }}
        >
          <Text fontSize="sm" fontWeight="bold" mb={2}>🎯 現在の議論の争点:</Text>
          <HStack wrap="wrap" gap={1}>
            {currentTopics.map((topic, index) => (
              <Badge key={index} colorScheme="yellow" variant="subtle" fontSize="xs">
                {topic}
              </Badge>
            ))}
          </HStack>
        </Box>
      )}

      {/* 議論分析パネル */}
      <VStack width="100%" gap={3}>
        <HStack width="100%" justify="center">
          <Button 
            size="sm" 
            colorScheme="purple" 
            variant={showAnalysis ? "solid" : "outline"}
            onClick={() => {
              console.log('🎯 分析パネル切り替え:', { 
                showAnalysis, 
                hasAnalysisData: !!discussionAnalysis,
                messageCount: messages.length 
              });
              setShowAnalysis(!showAnalysis);
              // 分析パネルを開く時のみ、データがない場合だけ自動実行
              if (!showAnalysis && !discussionAnalysis && messages.length > 2) {
                console.log('🔄 自動分析実行します');
                analyzeCurrentDiscussion();
              }
            }}
          >
            {showAnalysis ? '分析を隠す' : '議論分析を表示'}
          </Button>
        </HStack>

        {/* 分析結果エリア */}
        {showAnalysis && (
          <Box 
            width="100%" 
            p={4} 
            bg={{ base: "purple.50", _dark: "gray.800" }} 
            borderRadius="md" 
            border="1px solid" 
            borderColor={{ base: "purple.200", _dark: "gray.600" }}
          >
            <HStack justify="space-between" align="center" mb={3}>
              <Text fontSize="lg" fontWeight="bold" color={{ base: "purple.700", _dark: "purple.300" }}>📊 議論分析結果</Text>
              {messages.length > 2 && (
                <Button 
                  size="xs" 
                  colorScheme="blue" 
                  variant="outline"
                  onClick={() => {
                    console.log('🔄 手動分析実行');
                    analyzeCurrentDiscussion();
                  }}
                  disabled={isProcessing}
                >
                  {isProcessing ? '分析中...' : '最新分析を実行'}
                </Button>
              )}
            </HStack>

            {/* デバッグ情報 */}
            {import.meta.env.DEV && (
              <Box mb={3} p={2} bg="gray.100" borderRadius="md" fontSize="xs">
                <Text>Debug: hasAnalysisData={discussionAnalysis ? 'Yes' : 'No'}, messageCount={messages.length}</Text>
              </Box>
            )}

            {/* 分析データがない場合の表示 */}
            {!discussionAnalysis && (
              <Box textAlign="center" py={8}>
                <Text color="gray.500" mb={3}>まだ分析データがありません</Text>
                {messages.length > 2 ? (
                  <Button 
                    size="sm" 
                    colorScheme="purple" 
                    onClick={analyzeCurrentDiscussion}
                    disabled={isProcessing}
                  >
                    {isProcessing ? '分析中...' : '議論を分析する'}
                  </Button>
                ) : (
                  <Text fontSize="sm" color="gray.400">
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
                    <Text fontSize="md" fontWeight="bold" mb={2} color={{ base: "purple.600", _dark: "purple.400" }}>🎯 主要論点</Text>
                    {discussionAnalysis.mainPoints.map((point, index) => (
                      <Box 
                        key={index} 
                        mb={2} 
                        p={2} 
                        bg={{ base: "white", _dark: "gray.700" }} 
                        borderRadius="md" 
                        borderLeft="4px solid" 
                        borderColor={{ base: "purple.300", _dark: "purple.500" }}
                      >
                        <Text fontWeight="semibold" fontSize="sm">{point.point}</Text>
                        <Text fontSize="xs" color={{ base: "gray.600", _dark: "gray.400" }} mt={1}>{point.description}</Text>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 参加者の立場 */}
                {discussionAnalysis.participantStances && discussionAnalysis.participantStances.length > 0 && (
                  <Box mb={4}>
                    <Text fontSize="md" fontWeight="bold" mb={2} color={{ base: "purple.600", _dark: "purple.400" }}>👥 各参加者の立場</Text>
                    {discussionAnalysis.participantStances.map((stance, index) => (
                      <Box key={index} mb={3} p={3} bg={{ base: "white", _dark: "gray.700" }} borderRadius="md">
                        <Text fontWeight="bold" fontSize="sm" color={{ base: "blue.600", _dark: "blue.400" }}>
                          {stance.participant === 'ユーザー' ? 'あなた' : stance.participant}
                        </Text>
                        <Text fontSize="sm" mt={1}>{stance.stance}</Text>
                        {stance.keyArguments && stance.keyArguments.length > 0 && (
                          <Box mt={2}>
                            <Text fontSize="xs" color={{ base: "gray.500", _dark: "gray.400" }} mb={1}>主な論拠:</Text>
                            {stance.keyArguments.map((arg, argIndex) => (
                              <Text key={argIndex} fontSize="xs" color={{ base: "gray.600", _dark: "gray.300" }} ml={2}>
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
                    <Text fontSize="md" fontWeight="bold" mb={2} color={{ base: "purple.600", _dark: "purple.400" }}>⚔️ 主な対立点</Text>
                    {discussionAnalysis.conflicts.map((conflict, index) => (
                      <Box 
                        key={index} 
                        mb={2} 
                        p={2} 
                        bg={{ base: "red.50", _dark: "red.900" }} 
                        borderRadius="md" 
                        borderLeft="4px solid" 
                        borderColor={{ base: "red.300", _dark: "red.500" }}
                      >
                        <Text fontWeight="semibold" fontSize="sm">{conflict.issue}</Text>
                        <Text fontSize="xs" color={{ base: "gray.600", _dark: "gray.400" }} mt={1}>{conflict.description}</Text>
                        <HStack mt={1} gap={1}>
                          {conflict.sides && conflict.sides.map((side, sideIndex) => (
                            <Badge key={sideIndex} colorScheme="red" variant="subtle" fontSize="xs">
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
                    <Text fontSize="md" fontWeight="bold" mb={2} color={{ base: "purple.600", _dark: "purple.400" }}>🤝 共通認識</Text>
                    {discussionAnalysis.commonGround.map((common, index) => (
                      <Box 
                        key={index} 
                        mb={1} 
                        p={2} 
                        bg={{ base: "green.50", _dark: "green.900" }} 
                        borderRadius="md" 
                        borderLeft="4px solid" 
                        borderColor={{ base: "green.300", _dark: "green.500" }}
                      >
                        <Text fontSize="sm">{common}</Text>
                      </Box>
                    ))}
                  </Box>
                )}

                {/* 未探索領域 */}
                {discussionAnalysis.unexploredAreas && discussionAnalysis.unexploredAreas.length > 0 && (
                  <Box>
                    <Text fontSize="md" fontWeight="bold" mb={2} color={{ base: "purple.600", _dark: "purple.400" }}>🔍 未探索の論点</Text>
                    <HStack wrap="wrap" gap={1}>
                      {discussionAnalysis.unexploredAreas.map((area, index) => (
                        <Badge key={index} colorScheme="orange" variant="subtle" fontSize="xs">
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
      </VStack>      {/* 議論開始前 */}
      {!discussionStarted && (
        <VStack gap={4} flex={1} justify="center">
          <Text fontSize="lg">議論の準備ができました</Text>
          <Text>参加者: {participants.length}人</Text>
          <Button colorScheme="green" size="lg" onClick={startDiscussion}>
            議論開始
          </Button>
        </VStack>
      )}

      {/* 議論中 */}
      {discussionStarted && (
        <>
          {/* メッセージ履歴 */}
          <Box 
            flex={1} 
            width="100%" 
            overflowY="auto" 
            border="1px solid" 
            borderColor={{ base: "gray.200", _dark: "gray.600" }} 
            borderRadius="md" 
            p={4}
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
                  bg={msg.isUser ? "green.500" : { base: "gray.100", _dark: "gray.700" }}
                  color={msg.isUser ? "white" : { base: "gray.800", _dark: "gray.100" }}
                  p={3}
                  borderRadius="18px"
                  borderBottomRightRadius={msg.isUser ? "4px" : "18px"}
                  borderBottomLeftRadius={msg.isUser ? "18px" : "4px"}
                  boxShadow={{ base: "0 1px 2px rgba(0, 0, 0, 0.1)", _dark: "0 1px 2px rgba(0, 0, 0, 0.3)" }}
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
                <Spinner />
                <Text mt={2}>
                  {currentTurn > 0 && config.aiData[currentTurn - 1] 
                    ? `${config.aiData[currentTurn - 1].name}が考え中...` 
                    : 'AI応答を生成中...'}
                </Text>
              </Box>
            )}
          </Box>

          {/* ユーザー入力エリア */}
          {config.participate && currentTurn === 0 && !isProcessing && (
            <VStack width="100%" gap={2}>
              <Text fontWeight="bold">あなたのターンです</Text>
              <Text fontSize="sm" color="gray.600">
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
                colorScheme="blue" 
                onClick={handleUserSubmit}
                disabled={!userInput.trim()}
                width="full"
              >
                発言する
              </Button>
            </VStack>
          )}

          {/* AI自動議論モード */}
          {!config.participate && !isProcessing && (
            <Button colorScheme="blue" onClick={processAITurn}>
              次の発言を生成
            </Button>
          )}
        </>
      )}
    </VStack>
  );
};

export default PlayPage;