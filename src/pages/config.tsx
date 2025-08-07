import React from "react";
import { useNavigate } from 'react-router-dom';
import {
  VStack,
  HStack,
  Heading,
  Text,
  Button,
  Input,
  Textarea,
  FieldRoot,
  FieldLabel,
  NumberInputRoot,
  NumberInputInput,
  NumberInputControl,
  NumberInputIncrementTrigger,
  NumberInputDecrementTrigger,
  CardRoot,
  CardHeader,
  CardBody,
  CheckboxRoot,
  CheckboxControl,
  CheckboxLabel,
  CheckboxHiddenInput,
  Badge,
} from "@chakra-ui/react";
import { useAIModel } from '../hooks/useAIModel';

function Config() {
  const { selectedModel, changeModel, isModelLoaded } = useAIModel();
  const [numAI, setNumAI] = React.useState(1);
  const [showFields, setShowFields] = React.useState(false);
  const [participate, setParticipate] = React.useState(true);
  const [discussionTopic, setDiscussionTopic] = React.useState('');

  const navigate = useNavigate();

  interface AIData {
    name: string;
    role: string;
    description: string;
  }

  const [aiData, setAiData] = React.useState<AIData[]>([]);

  React.useEffect(() => {
    console.log("現在のaiData:", aiData);
  }, [aiData]);
  React.useEffect(() => {
    console.log("現在のnumAI:", numAI);
  }, [numAI]);

  const handleSubmit = () => {
    const validNumAI = isNaN(numAI) || numAI === undefined ? 1 : numAI; // defaults to 1
    const count = Math.min(Math.max(validNumAI, 1), 10);
    setAiData(Array.from({ length: count }, () => ({ name: "", role: "", description: "" })));
    setShowFields(true);
    console.log("handleSubmit called, count:", count, "aiData:", aiData);
    console.log("handleSubmit called", count, aiData, showFields);
  };

  return (
    <VStack gap={8} align="center" padding={8} minH="100vh">
      <Button 
        variant="ghost" 
        position="absolute" 
        top={4} 
        left={4}
        onClick={() => navigate('/start')}
      >
        ← 戻る
      </Button>
      
      <VStack gap={4} textAlign="center" maxW="2xl">
        <Heading size="2xl">議論の設定</Heading>
        <Text color="fg.muted">シチュエーション、テーマ、役職を決定します</Text>
        
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
            ⚠️ Ollamaが起動していません。設定を完了する前にOllamaを起動してください。
          </Text>
        )}
      </VStack>

      <VStack gap={6} width="100%" maxW="2xl">
        <FieldRoot>
          <FieldLabel>議論のテーマ</FieldLabel>
          <Input
            value={discussionTopic}
            onChange={(e) => setDiscussionTopic(e.target.value)}
            placeholder="例: 環境問題への対応策について"
          />
        </FieldRoot>

        <FieldRoot>
          <FieldLabel>使用するAIモデル</FieldLabel>
          <HStack gap={2} width="100%">
            <Button 
              size="sm"
              colorPalette={selectedModel === 'gemma3:1b' ? 'green' : 'gray'}
              variant={selectedModel === 'gemma3:1b' ? 'solid' : 'outline'}
              onClick={() => changeModel('gemma3:1b')}
              flex={1}
            >
              Gemma3 1B
            </Button>
            <Button 
              size="sm"
              colorPalette={selectedModel === 'gemma3:4b' ? 'green' : 'gray'}
              variant={selectedModel === 'gemma3:4b' ? 'solid' : 'outline'}
              onClick={() => changeModel('gemma3:4b')}
              flex={1}
            >
              Gemma3 4B
            </Button>
          </HStack>
          <Text fontSize="sm" color="fg.muted">
            現在選択中: {selectedModel}
          </Text>
        </FieldRoot>

        <FieldRoot>
          <FieldLabel>何人のAIと議論しますか？</FieldLabel>
          <HStack gap={4}>
            <NumberInputRoot
              value={String(numAI)}
              onValueChange={(valueObj) => {
                const newValue = valueObj.value;
                setNumAI(newValue ? Number(newValue) : 1);
              }}
              min={1}
              max={5}
              flex={1}
            >
              <NumberInputInput />
              <NumberInputControl>
                <NumberInputIncrementTrigger />
                <NumberInputDecrementTrigger/>
              </NumberInputControl>
            </NumberInputRoot>
            <Button 
              colorPalette="green" 
              variant="solid"
              onClick={handleSubmit}
            >
              決定
            </Button>
          </HStack>
        </FieldRoot>
      </VStack>

      {showFields && (
        <VStack gap={6} width="100%" maxW="2xl">
          {aiData.map((ai, index) => (
            <CardRoot key={index} width="100%" variant="outline">
              <CardHeader>
                <Heading size="md">AI {index + 1}</Heading>
              </CardHeader>
              <CardBody>
                <VStack gap={4}>
                  <FieldRoot>
                    <FieldLabel>名前</FieldLabel>
                    <Input
                      value={ai.name}
                      onChange={(e) => {
                        const newAiData = [...aiData];
                        newAiData[index].name = e.target.value;
                        setAiData(newAiData);
                      }}
                      placeholder="例: 田中太郎"
                    />
                  </FieldRoot>
                  <FieldRoot>
                    <FieldLabel>役職</FieldLabel>
                    <Input
                      value={ai.role}
                      onChange={(e) => {
                        const newAiData = [...aiData];
                        newAiData[index].role = e.target.value;
                        setAiData(newAiData);
                      }}
                      placeholder="例: 環境政策専門家"
                    />
                  </FieldRoot>
                  <FieldRoot>
                    <FieldLabel>説明</FieldLabel>
                    <Textarea
                      value={ai.description}
                      onChange={(e) => {
                        const newAiData = [...aiData];
                        newAiData[index].description = e.target.value;
                        setAiData(newAiData);
                      }}
                      rows={3}
                      placeholder="例: 20年以上環境問題に携わり、持続可能な開発に詳しい専門家。データに基づいた現実的な提案を重視する。"
                    />
                  </FieldRoot>
                </VStack>
              </CardBody>
            </CardRoot>
          ))}
        </VStack>
      )}

      <VStack gap={6} width="100%" maxW="2xl">
        <FieldRoot>
          <CheckboxRoot
            checked={!participate}
            onCheckedChange={(details) => setParticipate(!details.checked)}
          >
            <CheckboxHiddenInput />
            <CheckboxControl />
            <CheckboxLabel>私は参加しません</CheckboxLabel>
          </CheckboxRoot>
        </FieldRoot>

        <Button 
          colorPalette="green" 
          variant="solid"
          size="lg" 
          width="100%"
          disabled={!isModelLoaded}
          onClick={() => {
            if (!isModelLoaded) {
              alert('Ollamaが起動していません。まずOllamaを起動してください。');
              return;
            }
            
            const validAiData = aiData.filter(ai => ai.name && ai.role && ai.description);
            if (validAiData.length === 0) {
              alert('最低1人のAIの設定を完了してください');
              return;
            }
            
            if (!discussionTopic.trim()) {
              alert('議論のテーマを入力してください');
              return;
            }
            
            localStorage.setItem('aiConfig', JSON.stringify({
              aiData: validAiData,
              participate: participate,
              discussionTopic: discussionTopic.trim()
            }));
            
            navigate('/play');
          }}
        >
          {!isModelLoaded ? 'Ollamaが未接続' : '開始'}
        </Button>
      </VStack>
    </VStack>
  );
}

export default Config;