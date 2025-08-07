import React, { useState, useEffect, useRef, ChangeEvent, KeyboardEvent } from 'react';
import { Box, Flex, Input, Button, Text, Spinner } from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';

interface Message {
  text: string;
  isUser: boolean;
  sender: string;
}

const MessageItem: React.FC<Message> = ({ text, isUser, sender }) => (
  <Flex justifyContent={isUser ? 'flex-end' : 'flex-start'} mb={4}>
    <Box
      bg={isUser ? 'blue.100' : 'gray.200'}
      color={'black'}
      borderRadius="lg"
      p={3}
      maxWidth="70%"
    >
      <Text fontSize="xs" color="gray.500" mb={1}>
        {sender}
      </Text>
      <Text whiteSpace="pre-wrap">{text}</Text>
    </Box>
  </Flex>
);

const EnhancedChatApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const chatWindowRef = useRef<HTMLDivElement>(null);

  const { isModelLoaded, generateText } = useAIModel();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      text: inputText,
      isUser: true,
      sender: 'あなた',
    };
    setMessages((prev) => [...prev, userMessage]);

    const prompt = inputText;
    setInputText('');
    setIsProcessing(true);

    try {
      const response = await generateText(prompt);
      const aiMessage: Message = {
        text: response,
        isUser: false,
        sender: 'AI',
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          text: 'RustのAI呼び出しに失敗しました。',
          isUser: false,
          sender: 'システム',
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Flex direction="column" height="100vh">
      {!isModelLoaded && (
        <Box p={4} bg="blue.100" color="blue.800" borderRadius="md" mb={4}>
          モデルをロード中です。しばらくお待ちください...
        </Box>
      )}

      <Box ref={chatWindowRef} flex="1" overflowY="auto" p={4}>
        {messages.map((msg, idx) => (
          <MessageItem key={idx} {...msg} />
        ))}
        {isProcessing && (
          <Flex justify="center" my={4}>
            <Spinner size="md" color="blue.500" />
            <Text ml={2}>AIが考え中...</Text>
          </Flex>
        )}
      </Box>

      <Flex p={4}>
        <Input
          value={inputText}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setInputText(e.target.value)}
          placeholder="メッセージを入力"
          mr={2}
          disabled={isProcessing || !isModelLoaded}
          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter' && !isProcessing) {
              handleSend();
            }
          }}
        />
        <Button
          onClick={handleSend}
          disabled={isProcessing || !isModelLoaded || !inputText.trim()}
          loading={isProcessing}
          loadingText="送信中"
        >
          送信
        </Button>
      </Flex>
    </Flex>
  );
};

export default EnhancedChatApp;
