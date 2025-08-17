/**
 * @packageDocumentation
 * ホームページ。アプリのエントリポイントとして、DewAI の概要と開始導線（Startページ）を提供します。
 */

import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text } from '@chakra-ui/react';

/**
 * アプリのトップ画面。
 * 「始める」ボタンで設定/開始フローへ誘導します。
 */
function Home() {
    const navigate = useNavigate();
    
    return (
        <VStack 
            gap={8} 
            align="center" 
            padding={8}
            height="100vh"
            justifyContent="center"
            maxW="md"
            mx="auto"
        >
            <VStack gap={4} textAlign="center">
                <Heading size="3xl">DewAIへようこそ</Heading>
                <Text color="fg.muted">手軽な議論を開始しよう</Text>
            </VStack>
            
            <Button 
                colorPalette="green" 
                variant="solid"
                size="lg" 
                onClick={() => navigate('/start')}
            >
                始める
            </Button>
        </VStack>
    );
}

export default Home;