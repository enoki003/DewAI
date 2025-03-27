import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text } from '@chakra-ui/react';

function Home() {
    const navigate = useNavigate();
    return (
        <VStack 
            gap={6} 
            align="center" 
            padding={8}
            height="100vh"
            justifyContent="center"
        >
            <Heading size="4xl">DewAIへようこそ</Heading>
            <Text fontSize="2xl">軽量で手軽な議論を開始しよう</Text>
            <Button colorScheme="blue" size="lg" onClick={() => navigate('/about')}>
            始める
            </Button>
        </VStack>
    );
}

export default Home;