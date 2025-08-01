import React, { useState, useEffect } from 'react';
import { Box, VStack, HStack, Button, Text, Textarea, Spinner, Badge } from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';
import { useNavigate } from 'react-router-dom';

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

const PlayPage: React.FC = () => {
  const navigate = useNavigate();
  const { generateAIResponse, startDiscussion: generateDiscussionStart } = useAIModel();
  
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [messages, setMessages] = useState<DiscussionMessage[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0); // 0: ユーザー, 1+: AI順番
  const [userInput, setUserInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [discussionStarted, setDiscussionStarted] = useState(false);

  useEffect(() => {
    // 設定データを読み込み
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
    ...(config.participate ? [{ name: 'あなた', role: 'ユーザー', description: '議論の参加者' }] : []),
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
      speaker: 'あなた',
      message: userInput,
      isUser: true,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setUserInput('');
    setCurrentTurn(1); // 次はAIのターン
    
    // AI応答を順番に処理
    await processAITurn();
  };

  const processAITurn = async () => {
    if (!config) return;
    
    setIsProcessing(true);
    
    try {
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
        
        // 最新の会話履歴を生成（前のAIの発言も含む）
        const conversationHistory = latestMessages
          .map(msg => `${msg.speaker}: ${msg.message}`)
          .join('\n');

        const response = await generateAIResponse(
          ai.name,
          ai.role,
          ai.description,
          conversationHistory,
          config.discussionTopic // テーマを直接渡す
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
        <Button onClick={() => navigate('/config')} size="sm">
          設定に戻る
        </Button>
      </HStack>

      {/* 参加者表示 */}
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

      {/* 議論開始前 */}
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
            borderColor="gray.200" 
            borderRadius="md" 
            p={4}
          >
            {messages.map((msg, index) => (
              <Box key={index} mb={4} p={3} bg={msg.isUser ? "blue.50" : "gray.50"} borderRadius="md">
                <Text fontWeight="bold" color={msg.isUser ? "blue.600" : "gray.600"}>
                  {msg.speaker}
                </Text>
                <Text mt={1} color="black">{msg.message}</Text>
                <Text fontSize="xs" color="gray.400" mt={1}>
                  {msg.timestamp.toLocaleTimeString()}
                </Text>
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
              <Textarea
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="あなたの意見を入力してください..."
                resize="none"
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