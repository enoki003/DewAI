/**
 * @packageDocumentation
 * 開始ページ（Start）。Ollama接続状態の表示と、
 * - 新規議論の開始（Configへ遷移）
 * - 保存済み議論の再開（Sessionsへ遷移）
 * の導線を提供します。
 */

import { useNavigate } from 'react-router-dom';
import { Button, VStack, Heading, Text, Badge, HStack } from '@chakra-ui/react';
import { useAIModel } from '../hooks/useAIModel';

/**
 * 開始方法の選択画面。
 * 接続状態に応じてボタンの活性を切り替えます。
 */
function Start() {
    const navigate = useNavigate();
    const { isModelLoaded } = useAIModel();
    
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
                <Text color="fg.muted">新しい議論を始めるか保存された議論を再開できます</Text>
                
                {/* Ollama接続状態表示 */}
                <HStack justify="center" align="center" gap={2}>
                    <Text fontSize="sm" color="fg.muted">Ollama状態:</Text>
                    <Badge 
                        colorPalette={isModelLoaded ? "green" : "red"} 
                        variant="subtle"
                        size="sm"
                    >
                        {isModelLoaded ? "接続中" : "未接続"}
                    </Badge>
                </HStack>
                
                {!isModelLoaded && (
                    <Text fontSize="xs" color="orange.fg" textAlign="center">
                        ⚠️ Ollamaが起動していません。議論を開始する前にOllamaを起動してください。
                    </Text>
                )}
            </VStack>
            
            <VStack gap={4} width="100%">
                <Button 
                    colorPalette="green" 
                    variant="solid"
                    size="lg" 
                    width="100%"
                    onClick={() => navigate('/config')}
                    disabled={!isModelLoaded}
                >
                    {!isModelLoaded ? 'Ollamaが未接続' : '新しく始める'}
                </Button>
                <Button 
                    colorPalette="green" 
                    variant="outline"
                    size="lg" 
                    width="100%"
                    onClick={() => navigate('/sessions')}
                    disabled={!isModelLoaded}
                >
                    {!isModelLoaded ? 'Ollamaが未接続' : '続きから始める'}
                </Button>
            </VStack>
        </VStack>
    );
}

export default Start;
