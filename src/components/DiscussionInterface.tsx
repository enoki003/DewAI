/**
 * シンプルな議論UIコンポーネント。
 * メッセージ履歴と入力欄、送信/自動生成ボタンを提供します。
 */
import React from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Button, 
  Text, 
  Textarea, 
  Spinner, 
  Badge 
} from '@chakra-ui/react';

/** メッセージの最小構造 */
export interface DiscussionMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

/** DiscussionInterface コンポーネントのプロパティ */
export interface DiscussionInterfaceProps {
  /** 表示するメッセージ一覧 */
  messages: DiscussionMessage[];
  /** 入力中テキスト */
  currentInput: string;
  /** 入力テキスト変更時に呼ばれる */
  onInputChange: (value: string) => void;
  /** 入力内容を送信 */
  onSendMessage: () => void;
  /** 次のAI発言を生成 */
  onGenerateNext: () => void;
  /** 議論が開始済みか */
  discussionStarted: boolean;
  /** 処理中スピナー表示制御 */
  isProcessing: boolean;
}

/**
 * メッセージリストと入力欄を持つ議論インターフェース。
 */
export const DiscussionInterface: React.FC<DiscussionInterfaceProps> = ({
  messages,
  currentInput,
  onInputChange,
  onSendMessage,
  onGenerateNext,
  discussionStarted,
  isProcessing
}) => {
  return (
    <VStack gap={4} align="stretch" flex={1}>
      {/* メッセージ履歴 */}
      <Box 
        border="1px solid" 
        borderColor="gray.200" 
        borderRadius="md" 
        p={4} 
        height="400px" 
        overflowY="auto"
        bg="gray.50"
      >
        {messages.length === 0 ? (
          <Text color="gray.500" textAlign="center">
            議論が始まると、ここにメッセージが表示されます
          </Text>
        ) : (
          <VStack gap={3} align="stretch">
            {messages.map((msg, index) => (
              <Box 
                key={index}
                p={3} 
                borderRadius="md" 
                bg={msg.isUser ? "blue.50" : "white"}
                borderLeft={msg.isUser ? "4px solid" : "4px solid"}
                borderLeftColor={msg.isUser ? "blue.400" : "green.400"}
              >
                <HStack justify="space-between" mb={2}>
                  <HStack>
                    <Badge colorPalette={msg.isUser ? "blue" : "green"}>
                      {msg.speaker}
                    </Badge>
                    <Text fontSize="xs" color="gray.500">
                      {msg.timestamp.toLocaleTimeString('ja-JP')}
                    </Text>
                  </HStack>
                </HStack>
                <Text>{msg.message}</Text>
              </Box>
            ))}
          </VStack>
        )}
      </Box>

      {/* 入力エリア */}
      <VStack gap={3}>
        <Textarea
          value={currentInput}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="あなたの意見を入力してください..."
          resize="vertical"
          minHeight="100px"
          disabled={isProcessing}
        />
        
        <HStack width="100%" justify="space-between">
          <Button 
            onClick={onSendMessage}
            colorPalette="blue"
            variant="solid"
            disabled={!currentInput.trim() || isProcessing}
          >
            {isProcessing ? <Spinner size="sm" /> : '発言する'}
          </Button>
          
          <Button 
            onClick={onGenerateNext}
            colorPalette="green"
            variant="outline"
            disabled={isProcessing}
          >
            {!discussionStarted ? '議論開始' :
             isProcessing ? '処理中...' : '次の発言を生成'}
          </Button>
        </HStack>
      </VStack>
    </VStack>
  );
};
