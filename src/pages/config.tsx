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
} from "@chakra-ui/react";

function Config() {
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
            <CheckboxControl />
            <CheckboxLabel>私は参加しません</CheckboxLabel>
          </CheckboxRoot>
        </FieldRoot>

        <Button 
          colorPalette="green" 
          variant="solid"
          size="lg" 
          width="100%"
          onClick={() => {
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
          開始
        </Button>
      </VStack>
    </VStack>
  );
}

export default Config;