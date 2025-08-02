import React from "react";
import { useNavigate } from 'r  return (
    <VStack gap={6} align="center" padding={8} minH="100vh" justifyContent="flex-start">
      <VStack gap={4} width="100%" align="center">
        <Heading size="2xl">🛠️ 議論の設定</Heading>
        <Text fontSize="md" color="gray.600">議論のテーマとAI参加者を設定してください</Text>
      </VStack>t-router-dom';
import {
  VStack,
  Heading,
  Text,
  Button,
  Input,
  Textarea,
  Stack,
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
    <VStack gap={6} align="center" padding={8} minH="100vh" justifyContent="flex-start">
      <Heading size="4xl">議論の設定</Heading>
      <Text fontSize="2xl">シチュエーション、テーマ、役職を決定します</Text>

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
        <NumberInputRoot
          value={String(numAI)}
          onValueChange={(valueObj) => {
            const newValue = valueObj.value; // オブジェクトからvalueプロパティを取得
            setNumAI(newValue ? Number(newValue) : 1);
            console.log("ナンバー入力が変更されました:", newValue);
          }}
          min={1}
          max={5}
        >
          <NumberInputInput />
          <NumberInputControl>
            <NumberInputIncrementTrigger />
            <NumberInputDecrementTrigger/>
          </NumberInputControl>
        </NumberInputRoot>
      </FieldRoot>

      <Button colorScheme="blue" onClick={handleSubmit}>
        決定
      </Button>

      {showFields && (
        <VStack gap={6} width="100%">
          {aiData.map((ai, index) => (
            <CardRoot key={index} width="100%" maxW="600px" boxShadow="lg">
              <CardHeader fontWeight="bold" fontSize="xl">
                AI {index + 1}
              </CardHeader>
              <CardBody>
                <Stack direction="column" gap={4}>
                  <FieldRoot>
                    <FieldLabel>名前</FieldLabel>
                    <Input
                      value={ai.name}
                      onChange={(e) => {
                        const newAiData = [...aiData];
                        newAiData[index].name = e.target.value;
                        setAiData(newAiData);
                      }}
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
                    />
                  </FieldRoot>
                </Stack>
              </CardBody>
            </CardRoot>
          ))}
        </VStack>
      )}

      <FieldRoot width="100%" maxW="600px">
        <CheckboxRoot>
          <CheckboxHiddenInput
            checked={!participate}
            onChange={(e) => setParticipate(!e.target.checked)}
          />
          <CheckboxControl />
          <CheckboxLabel>私は参加しません</CheckboxLabel>
        </CheckboxRoot>
      </FieldRoot>

      <Button 
        colorScheme="blue" 
        size="lg" 
        onClick={() => {
          // AIデータを検証してからPlayページに遷移
          const validAiData = aiData.filter(ai => ai.name && ai.role && ai.description);
          if (validAiData.length === 0) {
            alert('最低1人のAIの設定を完了してください');
            return;
          }
          
          if (!discussionTopic.trim()) {
            alert('議論のテーマを入力してください');
            return;
          }
          
          // AIデータを localStorage に保存
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
  );
}

export default Config;