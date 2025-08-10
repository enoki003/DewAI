import { Box, VStack, HStack, Text, Avatar } from '@chakra-ui/react';

interface DiscussionMessage {
  speaker: string;
  message: string;
  isUser: boolean;
  timestamp: Date | string;
}

interface ChatMessageProps {
  message: DiscussionMessage;
  index: number;
}

// 参加者名から安定したカラー名を生成（chakraの基本パレット名）
const baseColors = [
  'red', 'orange', 'yellow', 'green', 'teal',
  'blue', 'cyan', 'purple', 'pink', 'gray'
] as const;
const getAvatarBaseColor = (name: string): (typeof baseColors)[number] => {
  const sum = (name || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return baseColors[Math.abs(sum) % baseColors.length];
};

export function ChatMessage({ message, index }: ChatMessageProps) {
  const baseColor = getAvatarBaseColor(message?.speaker || '');

  // 表示崩れ防止のための基本的なサニタイゼーション
  const rawText = typeof message?.message === 'string' ? message.message : '';
  const sanitizedMessage = rawText
    .replace(/\t/g, '    ') // タブを4スペースに変換
    .slice(0, 10000); // 10,000文字制限

  // timestampの安全なフォーマット
  const ts = message?.timestamp instanceof Date ? message.timestamp : new Date(message?.timestamp as any);
  const timeText = isNaN(ts.getTime())
    ? ''
    : ts.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  
  return (
    <VStack align="stretch" gap={6} key={index}>
      {/* メッセージ本体 */}
      <HStack 
        align="flex-start" 
        gap={3}
        justify={message?.isUser ? "flex-end" : "flex-start"}
      >
        {/* AIメッセージの場合、左にアバター（Chakra v3 API） */}
        {!message?.isUser && (
          <VStack gap={1} align="center">
            <Avatar.Root size="sm" colorPalette={baseColor}>
              <Avatar.Fallback name={message?.speaker || ''} />
            </Avatar.Root>
            <Text fontSize="xs" color="gray.600" textAlign="center" maxW="60px" lineClamp={1}>
              {message?.speaker || 'AI'}
            </Text>
          </VStack>
        )}
        
        {/* メッセージバブル */}
        {message?.isUser ? (
          // ユーザーメッセージ（以前の配色に準拠）
          <Box maxW="85%">
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
            {/* タイムスタンプ */}
            <Text 
              fontSize="xs" 
              color="gray.400" 
              mt={1}
              textAlign="right"
              whiteSpace="nowrap"
            >
              {timeText}
            </Text>
          </Box>
        ) : (
          // AIメッセージ（以前の配色に準拠）
          <Box maxW="70%">
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
            {/* タイムスタンプ */}
            <Text 
              fontSize="xs" 
              color="gray.400" 
              mt={1}
              textAlign="left"
              whiteSpace="nowrap"
            >
              {timeText}
            </Text>
          </Box>
        )}
      </HStack>
    </VStack>
  );
}

export default ChatMessage;