/**
 * @packageDocumentation
 * 議論インターフェースコンポーネント。
 * 
 * リアルタイムな議論のためのUIコンポーネントを提供します。
 * - メッセージ履歴の表示（時系列順、ユーザー/AI区別）
 * - テキスト入力エリア
 * - 送信/自動生成ボタン
 * - 処理中状態の表示
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

/** 
 * 議論メッセージの最小構造。
 * UIでの表示とデータ管理に必要な情報を含みます。
 */
export interface DiscussionMessage {
  /** 発言者名（"ユーザー" または AI の名前） */
  speaker: string;
  /** メッセージ本文（最大1万文字程度を想定） */
  message: string;
  /** ユーザーの発言かどうか（UIスタイリングに使用） */
  isUser: boolean;
  /** 発言時刻（表示用） */
  timestamp: Date;
}

/** 
 * DiscussionInterface コンポーネントのプロパティ。
 * 議論インターフェースの動作を制御するための設定項目です。
 */
export interface DiscussionInterfaceProps {
  /** 表示するメッセージ一覧（時系列順） */
  messages: DiscussionMessage[];
  /** 現在入力中のテキスト */
  currentInput: string;
  /** 
   * 入力テキスト変更時のコールバック
   * @param value 新しい入力値
   */
  onInputChange: (value: string) => void;
  /** ユーザーが入力内容を送信する際のコールバック */
  onSendMessage: () => void;
  /** 次のAI発言を生成する際のコールバック */
  onGenerateNext: () => void;
  /** 議論が開始済みかどうかの状態 */
  discussionStarted: boolean;
  /** 処理中（AI生成中など）の状態。true時はボタンが無効化される */
  isProcessing: boolean;
}

/**
 * メッセージリストと入力欄を持つ議論インターフェースコンポーネント。
 * 
 * リアルタイムな議論のためのUIを提供します。特徴：
 * - メッセージ履歴の可視化（スクロール可能、ユーザー/AI区別）
 * - リアルタイム入力欄
 * - 送信/AI生成ボタン
 * - 処理中状態の適切な表示
 * 
 * @param props - コンポーネントのプロパティ
 * @returns 議論インターフェース要素
 * 
 * @example
 * ```tsx
 * const [messages, setMessages] = useState<DiscussionMessage[]>([]);
 * const [input, setInput] = useState('');
 * const [processing, setProcessing] = useState(false);
 * 
 * <DiscussionInterface
 *   messages={messages}
 *   currentInput={input}
 *   onInputChange={setInput}
 *   onSendMessage={() => handleSend(input)}
 *   onGenerateNext={() => handleAIGenerate()}
 *   discussionStarted={messages.length > 0}
 *   isProcessing={processing}
 * />
 * ```
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
