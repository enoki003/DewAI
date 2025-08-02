import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text } from '@chakra-ui/react';

function Start() {
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
            <Button 
                variant="ghost" 
                position="absolute" 
                top={4} 
                left={4}
                onClick={() => navigate('/')}
            >
                ← ホーム
            </Button>
            
            <VStack gap={4} textAlign="center">
                <Heading size="2xl">開始方法を選択</Heading>
                <Text color="fg.muted">新しい議論を始めるか、保存された議論を再開できます</Text>
            </VStack>
            
            <VStack gap={4} width="100%">
                <Button 
                    colorPalette="green" 
                    variant="solid"
                    size="lg" 
                    width="100%"
                    onClick={() => navigate('/config')}
                >
                    新しく始める
                </Button>
                <Button 
                    colorPalette="blue" 
                    variant="outline"
                    size="lg" 
                    width="100%"
                    onClick={() => navigate('/sessions')}
                >
                    続きから始める
                </Button>
            </VStack>
        </VStack>
    );
}

export default Start;
