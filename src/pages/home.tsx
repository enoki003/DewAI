import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text } from '@chakra-ui/react';

function Home() {
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
                <Heading size="4xl" color="green.500">DewAI</Heading>
                <Text fontSize="xl" color="gray.600" textAlign="center">
                    AIと一緒に深い議論を楽しむ
                </Text>
                <Text fontSize="md" color="gray.500" textAlign="center">
                    複数のAI参加者と建設的な対話を通じて、<br/>
                    様々なテーマについて新しい視点を発見しましょう
                </Text>
            </VStack>
            
            <Button 
                colorScheme="green" 
                size="xl" 
                onClick={() => navigate('/start')}
                width="250px"
                height="70px"
                fontSize="xl"
                boxShadow="lg"
                _hover={{ 
                    transform: 'translateY(-2px)',
                    boxShadow: 'xl'
                }}
                transition="all 0.2s"
            >
                🚀 始める
            </Button>
            
            <Text fontSize="sm" color="gray.400" textAlign="center" mt={4}>
                軽量で手軽な議論プラットフォーム
            </Text>
        </VStack>
    );
}

export default Home;