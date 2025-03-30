import React, { useState, useEffect, useRef } from 'react';
import { Box, Flex, Input, Button, Avatar, Text } from '@chakra-ui/react';

interface Message {
  text: string;
  isUser: boolean;
  avatarUrl?: string;
}

interface MessageProps {
  text: string;
  isUser: boolean;
  avatarUrl?: string;
}

const Message: React.FC<MessageProps> = ({ text, isUser, avatarUrl }) => {
  return (
    <Flex justifyContent={isUser ? 'flex-end' : 'flex-start'} mb={4}>
      <Flex direction={isUser ? 'row-reverse' : 'row'} alignItems="center">
        <Avatar.Root ml={isUser ? 2 : 0} mr={isUser ? 0 : 2}>    
          <Avatar.Fallback name={isUser ? 'User' : 'Other'} />
          <Avatar.Image src={avatarUrl} />
        </Avatar.Root>
        <Box bg={'gray.200'} color={'black'} borderRadius="lg" p={3} maxWidth="70%"> 
          <Text>{text}</Text>
        </Box>
      </Flex>
    </Flex>
  );
};

const ChatApp: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const chatWindowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (inputText.trim()) {
      setMessages(prev => [...prev, { text: inputText, isUser: true, avatarUrl: 'user-avatar-url' }]);
      setInputText('');
      // Simulate other party's response after 1 second
      setTimeout(() => {
        setMessages(prev => [...prev, { text: 'Okay, got it.', isUser: false, avatarUrl: 'other-avatar-url' }]);
      }, 1000);
    }
  };

  return (
    <Flex direction="column" height="100vh">
      <Box ref={chatWindowRef} flex="1" overflowY="auto" p={4}>
        {messages.map((msg, index) => (
          <Message key={index} {...msg} />
        ))}
      </Box>
      <Flex p={4}>
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Type a message"
          mr={2}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend}>Send</Button>
      </Flex>
    </Flex>
  );
};

export default ChatApp;