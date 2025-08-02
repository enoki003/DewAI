import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text, HStack } from '@chakra-ui/react';

function Start() {
    const navigate = useNavigate();
    
    return (
        <VStack 
            gap={8} 
            align="center" 
            padding={8}
            height="100vh"
            justifyContent="center"
        >
            <VStack gap={4}>
                <Heading size="2xl">議論を始めましょう</Heading>
                <Text fontSize="lg" color="gray.600" textAlign="center">
                    新しい議論を始めるか、保存した議論の続きから始めることができます
                </Text>
            </VStack>
            
            <VStack gap={6} width="100%" maxWidth="400px">
                <Button 
                    colorScheme="green" 
                    size="xl" 
                    onClick={() => navigate('/sessions')}
                    width="100%"
                    height="80px"
                    fontSize="lg"
                >
                    📂 続きから始める
                </Button>
                <Text fontSize="sm" color="gray.500" textAlign="center">
                    保存された議論セッションから選択
                </Text>
                
                <Button 
                    colorScheme="blue" 
                    variant="outline"
                    size="xl" 
                    onClick={() => navigate('/config')}
                    width="100%"
                    height="80px"
                    fontSize="lg"
                >
                    ✨ 新しく始める
                </Button>
                <Text fontSize="sm" color="gray.500" textAlign="center">
                    新しい議論テーマとAI参加者を設定
                </Text>
            </VStack>
            
            <HStack gap={4} mt={8}>
                <Button 
                    variant="ghost" 
                    size="md"
                    onClick={() => navigate('/')}
                >
                    🏠 ホームに戻る
                </Button>
            </HStack>
        </VStack>
    );
}

export default Start;
