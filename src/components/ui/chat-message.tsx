import React from 'react';
import { 
  Box, 
  VStack, 
  HStack, 
  Text, 
  Avatar
} from '@chakra-ui/react';

interface DiscussionMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatMessageProps {
  message: DiscussionMessage;
  index: number;
}

// 参加者名からランダムな色を生成
const getAvatarColor = (name: string): string => {
  const colors = [
    'red', 'orange', 'yellow', 'green', 'teal', 
    'blue', 'cyan', 'purple', 'pink', 'gray'
  ];
  
  // 名前の文字コードの合計で色を決定（安定した色）
  const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return colors[sum % colors.length];
};

export const ChatMessage: React.FC<ChatMessageProps> = ({ message, index }) => {
  const avatarColor = getAvatarColor(message.speaker);
  
  // 表示崩れ防止のための基本的なサニタイゼーション
  const sanitizedMessage = message.message
    .replace(/\t/g, '    ') // タブを4スペースに変換
    .slice(0, 10000); // 10,000文字制限
  
  return (
    <VStack align="stretch" gap={5} key={index}>
      {/* メッセージ本体 */}
      <HStack 
        align="flex-start" 
        gap={3}
        justify={message.isUser ? "flex-end" : "flex-start"}
      >
        {/* AIメッセージの場合、左にアバター */}
        {!message.isUser && (
          <VStack gap={1} align="center">
            <Avatar.Root
              size="sm"
              colorPalette={avatarColor}
            >
              <Avatar.Fallback name={message.speaker} />
            </Avatar.Root>
            <Text fontSize="xs" color="gray.600" textAlign="center" maxW="60px" lineClamp={1}>
              {message.speaker}
            </Text>
          </VStack>
        )}
        
        {/* メッセージバブル */}
        {message.isUser ? (
          /* ユーザーメッセージ - 前のデザイン */
          <Box position="relative" maxW="85%">
            <Box
              bg="green.solid"
              color="green.contrast"
              p={3}
              borderRadius="18px"
              borderBottomRightRadius="4px"
              borderBottomLeftRadius="18px"
              boxShadow="sm"
              border="none"
              position="relative"
            >
              <Text fontSize="sm" lineHeight="1.4">{sanitizedMessage}</Text>
            </Box>
            {/* タイムスタンプをメッセージボックスの外の下に配置 */}
            <Text 
              fontSize="xs" 
              color="gray.400" 
              position="absolute"
              bottom="-20px"
              left="0"
              whiteSpace="nowrap"
            >
              {message.timestamp.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </Box>
        ) : (
          /* AIメッセージ - テーマに準拠したデザイン */
          <Box position="relative" maxW="70%">
            <Box
              p={3}
              borderRadius="lg"
              bg="bg.subtle"
              color="fg"
              border="1px solid"
              borderColor="border.muted"
              boxShadow="sm"
              position="relative"
              _before={{
                content: '""',
                position: "absolute", 
                top: "12px",
                left: "-8px",
                width: 0,
                height: 0,
                borderRight: "8px solid",
                borderRightColor: "bg.subtle",
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent"
              }}
            >
              <Text lineHeight="1.5">{sanitizedMessage}</Text>
            </Box>
            {/* タイムスタンプをメッセージボックスの外の下に配置 */}
            <Text 
              fontSize="xs" 
              color="gray.400" 
              position="absolute"
              bottom="-20px"
              right="0"
              whiteSpace="nowrap"
            >
              {message.timestamp.toLocaleTimeString('ja-JP', { 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </Text>
          </Box>
        )}
      </HStack>
    </VStack>
  );
};
