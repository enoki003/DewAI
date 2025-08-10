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
import { showGenericError } from '../components/ui/notifications';

function Config() {
  const { selectedModel, changeModel, isModelLoaded, generateAIProfiles } = useAIModel();
  const [botCount, setBotCount] = React.useState(1);
  const [showFields, setShowFields] = React.useState(false);
  const [participate, setParticipate] = React.useState(true);
  const [discussionTopic, setDiscussionTopic] = React.useState('');

  const navigate = useNavigate();

  interface BotProfile {
    name: string;
    role: string;
    description: string;
  }

  const [bots, setBots] = React.useState<BotProfile[]>([]);
  const [autoLoading, setAutoLoading] = React.useState<boolean[]>([]);

  React.useEffect(() => {
    // bots長に合わせてロード配列を整える
    setAutoLoading(prev => Array.from({ length: bots.length }, (_, i) => prev[i] ?? false));
  }, [bots.length]);

  const handleSubmit = () => {
    const validCount = isNaN(botCount) || botCount === undefined ? 1 : botCount;
    const count = Math.min(Math.max(validCount, 1), 10);
    setBots(Array.from({ length: count }, () => ({ name: "", role: "", description: "" })));
    setShowFields(true);
  };

  // 単一カードを自動補完
  const autoFillCard = async (index: number) => {
    try {
      if (!discussionTopic.trim()) {
        alert('議論のテーマを先に入力してください');
        return;
      }
      if (!isModelLoaded) {
        alert('Ollamaが未接続です。起動後にお試しください。');
        return;
      }
      setAutoLoading(prev => prev.map((v, i) => (i === index ? true : v)));
      // 役職をヒントに入れて精度を上げる
      const hintBase = bots[index]?.role ? `この参加者の役割は「${bots[index].role}」。` : '';
      const list = await generateAIProfiles(discussionTopic.trim(), 1, `${hintBase}1名分のみ生成。名前は重複不可。`);
      if (list && list[0]) {
        const next = [...bots];
        next[index] = list[0];
        setBots(next);
      }
    } catch (e) {
      console.error('自動補完エラー:', e);
      showGenericError('自動補完に失敗しました', `${e}`);
    } finally {
      setAutoLoading(prev => prev.map((v, i) => (i === index ? false : v)));
    }
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
        
        {/* 接続状態 */}
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
              value={String(botCount)}
              onValueChange={(valueObj) => {
                const newValue = valueObj.value;
                setBotCount(newValue ? Number(newValue) : 1);
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
          {bots.map((bot, index) => (
            <CardRoot key={index} width="100%" variant="outline">
              <CardHeader>
                <HStack justify="space-between" align="center" width="100%">
                  <Heading size="md">AI {index + 1}</Heading>
                  <Button 
                    size="xs" 
                    variant="subtle"
                    onClick={() => autoFillCard(index)}
                    disabled={autoLoading[index]}
                  >
                    {autoLoading[index] ? '生成中...' : '自動補完'}
                  </Button>
                </HStack>
              </CardHeader>
              <CardBody>
                <VStack gap={4}>
                  <FieldRoot>
                    <FieldLabel>名前</FieldLabel>
                    <Input
                      value={bot.name}
                      onChange={(e) => {
                        const next = [...bots];
                        next[index].name = e.target.value;
                        setBots(next);
                      }}
                      placeholder="例: 田中太郎"
                    />
                  </FieldRoot>
                  <FieldRoot>
                    <FieldLabel>役職</FieldLabel>
                    <Input
                      value={bot.role}
                      onChange={(e) => {
                        const next = [...bots];
                        next[index].role = e.target.value;
                        setBots(next);
                      }}
                      placeholder="例: 環境政策専門家"
                    />
                  </FieldRoot>
                  <FieldRoot>
                    <FieldLabel>説明</FieldLabel>
                    <Textarea
                      value={bot.description}
                      onChange={(e) => {
                        const next = [...bots];
                        next[index].description = e.target.value;
                        setBots(next);
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
            
            const validBots = bots.filter(b => b.name && b.role && b.description);
            if (validBots.length === 0) {
              alert('最低1人のAIの設定を完了してください');
              return;
            }
            
            if (!discussionTopic.trim()) {
              alert('議論のテーマを入力してください');
              return;
            }
            
            localStorage.setItem('aiConfig', JSON.stringify({
              aiData: validBots, // 永続フォーマットは aiData を維持
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