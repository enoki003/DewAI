/**
 * @packageDocumentation
 * 参加者編集ドロワーコンポーネント。
 * 
 * 議論の参加者（AI・ユーザー）の設定を編集するためのドロワーUIを提供します。
 * - 複数AI参加者のプロフィール編集（名前・役職・説明）
 * - ユーザー参加の有無設定
 * - タブ形式でのAI切り替え
 * - 動的なAI追加/削除
 */
import React, { useState, useEffect } from 'react';
import { 
  Drawer,
  VStack,
  HStack,
  Box,
  Button,
  Text,
  Input,
  Textarea,
  Checkbox,
  Tabs,
  FieldRoot,
  FieldLabel
} from '@chakra-ui/react';
import { 
  showParticipantsUpdateError,
  showParticipantsUpdateSuccess,
  showGenericError
} from './ui/notifications';

/** 
 * AI参加者のプロフィール情報。
 * 議論における各AIの役割と性格を定義します。
 */
export interface BotProfile {
  /** AI参加者の表示名（例: "分析家ボット"） */
  name: string;
  /** 役割や肩書き（例: "批判的思考の専門家"） */
  role: string;
  /** ふるまい・口調・専門領域などの詳細説明 */
  description: string;
}

/** 
 * ParticipantEditorDrawer コンポーネントのプロパティ。
 * 参加者編集ドロワーの動作設定を定義します。
 */
export interface ParticipantEditorDrawerProps {
  /** ドロワーの開閉状態 */
  open: boolean;
  /** ドロワーを閉じる際のコールバック */
  onClose: () => void;
  /** 編集対象となる初期AI参加者配列 */
  initialBots: BotProfile[];
  /** ユーザーが議論に参加するかの初期値 */
  initialUserParticipates: boolean;
  /** 
   * 保存処理のコールバック。
   * 成功時は resolve、失敗時は reject してください。
   * @param bots 編集後のAI参加者配列
   * @param userParticipates ユーザー参加の可否
   */
  onSave: (bots: BotProfile[], userParticipates: boolean) => Promise<void> | void;
  /** 追加できるAI参加者の最大数（既定: 5） */
  maxBots?: number;
  /** ドロワーのヘッダータイトル（既定: "AI参加者の編集"） */
  title?: string;
}

/**
 * 参加者編集ドロワーコンポーネント。
 * 
 * 議論に参加するAI・ユーザーの設定を編集するためのドロワーUIです。
 * 機能：
 * - 複数AI参加者のプロフィール編集（名前・役職・説明文）
 * - タブ形式でのAI切り替え操作
 * - AI参加者の動的追加・削除
 * - ユーザー参加可否の設定
 * - 入力検証とエラーハンドリング
 * 
 * @param props - コンポーネントのプロパティ
 * @returns 参加者編集ドロワー要素
 * 
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * const [bots, setBots] = useState<BotProfile[]>([]);
 * 
 * <ParticipantEditorDrawer
 *   open={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   initialBots={bots}
 *   initialUserParticipates={true}
 *   onSave={async (newBots, userParticipates) => {
 *     // 保存処理
 *     setBots(newBots);
 *     setIsOpen(false);
 *   }}
 *   maxBots={4}
 *   title="議論参加者の設定"
 * />
 * ```
 */
export const ParticipantEditorDrawer: React.FC<ParticipantEditorDrawerProps> = ({
  open,
  onClose,
  initialBots,
  initialUserParticipates,
  onSave,
  maxBots = 5,
  title = 'AI参加者の編集'
}) => {
  const [editingBots, setEditingBots] = useState<BotProfile[]>([]);
  const [editUserParticipates, setEditUserParticipates] = useState(false);
  const [activeEditTab, setActiveEditTab] = useState<string>('ai-0');
  const [saving, setSaving] = useState(false);

  // 初期化 / open 変化時にリセット
  useEffect(() => {
    if (open) {
      setEditingBots(initialBots.map(b => ({ ...b })));
      setEditUserParticipates(initialUserParticipates);
      setActiveEditTab('ai-0');
    }
  }, [open, initialBots, initialUserParticipates]);

  /**
   * AI参加者の特定フィールドを更新します。
   * @param index 更新対象のAIインデックス
   * @param field 更新するフィールド名
   * @param value 新しい値
   */
  const updateBotField = (index: number, field: keyof BotProfile, value: string) => {
    setEditingBots(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as BotProfile;
      return next;
    });
  };

  /**
   * 新しいAI参加者を追加します。
   * 最大数に達している場合はエラーメッセージを表示します。
   */
  const addBot = () => {
    setEditingBots(prev => {
      if (prev.length >= maxBots) {
        showParticipantsUpdateError(`AI参加者は最大${maxBots}名までです`);
        return prev;
      }
      const next = [...prev, { name: '', role: '', description: '' }];
      setActiveEditTab(`ai-${next.length - 1}`);
      return next;
    });
  };

  /**
   * 指定されたインデックスのAI参加者を削除します。
   * 最低1名は残すように制限されています。
   * @param index 削除対象のAIインデックス
   */
  const removeBot = (index: number) => {
    setEditingBots(prev => {
      if (prev.length <= 1) return prev; // 最低1件は残す（従来仕様）
      const next = prev.filter((_, i) => i !== index);
      const newIndex = Math.max(0, Math.min(index, next.length - 1));
      setActiveEditTab(`ai-${newIndex}`);
      return next;
    });
  };

  /**
   * 入力検証を行い、参加者情報を保存します。
   * - AI名の必須チェック
   * - テキストのトリミング
   * - 成功/失敗時の通知表示
   */
  const handleSave = async () => {
    if (saving) return;
    // バリデーション
    if (editingBots.some(b => !b.name || !b.name.trim())) {
      showParticipantsUpdateError('AI名を入力してください');
      return;
    }
    setSaving(true);
    try {
      const normalized = editingBots.map(b => ({
        name: b.name.trim(),
        role: (b.role || '').trim(),
        description: (b.description || '').trim()
      }));
      await onSave(normalized, editUserParticipates);
      showParticipantsUpdateSuccess();
      onClose();
    } catch (e: any) {
      console.error('[participant-editor] 保存失敗', e);
      showGenericError('参加者情報の保存に失敗しました', `${e}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={(d) => { if (!d.open) onClose(); }} placement="end" size="md">
      <Drawer.Backdrop />
      <Drawer.Positioner>
        <Drawer.Content>
          <Drawer.Header>
            <HStack justify="space-between" w="full">
              <Drawer.Title>{title}</Drawer.Title>
              <Drawer.CloseTrigger />
            </HStack>
          </Drawer.Header>
          <Drawer.Body>
            <VStack align="stretch" gap={4}>
              <Box p={3} bg="green.subtle" borderRadius="md" border="1px solid" borderColor="green.muted">
                <Checkbox.Root
                  checked={editUserParticipates}
                  onCheckedChange={(details) => setEditUserParticipates(details.checked === true)}
                >
                  <Checkbox.Control>
                    <Checkbox.Indicator />
                  </Checkbox.Control>
                  <Checkbox.Label>あなた（ユーザー）も参加する</Checkbox.Label>
                </Checkbox.Root>
              </Box>

              <Tabs.Root value={activeEditTab} onValueChange={(details: any) => setActiveEditTab(details.value)} orientation="vertical">
                <HStack align="stretch" gap={4}>
                  <VStack minW={{ base: 'full', md: '180px' }} align="stretch" gap={2}>
                    <Tabs.List>
                      {editingBots.map((_, idx) => (
                        <Tabs.Trigger key={idx} value={`ai-${idx}`}>
                          AI {idx + 1}
                        </Tabs.Trigger>
                      ))}
                    </Tabs.List>
                    <Button size="xs" variant="outline" onClick={addBot} disabled={editingBots.length >= maxBots}>＋ AIを追加</Button>
                  </VStack>
                  <Box flex="1">
                    {editingBots.map((ai, idx) => (
                      <Tabs.Content key={idx} value={`ai-${idx}`}>
                        <Box p={3} borderRadius="md" border="1px solid" borderColor="border.muted">
                          <VStack align="stretch" gap={3}>
                            <HStack justify="space-between">
                              <Text fontWeight="bold" color="green.fg">AI {idx + 1}</Text>
                              <Button size="xs" variant="outline" colorPalette="red" onClick={() => removeBot(idx)} disabled={editingBots.length <= 1}>このAIを削除</Button>
                            </HStack>
                            <FieldRoot>
                              <FieldLabel>名前</FieldLabel>
                              <Input value={ai.name} onChange={(e) => updateBotField(idx, 'name', e.target.value)} placeholder="AI の名前" />
                            </FieldRoot>
                            <FieldRoot>
                              <FieldLabel>役職</FieldLabel>
                              <Input value={ai.role} onChange={(e) => updateBotField(idx, 'role', e.target.value)} placeholder="例：専門家、司会、反対派 など" />
                            </FieldRoot>
                            <FieldRoot>
                              <FieldLabel>説明</FieldLabel>
                              <Textarea rows={3} value={ai.description} onChange={(e) => updateBotField(idx, 'description', e.target.value)} placeholder="得意分野や性格、役割など" />
                            </FieldRoot>
                          </VStack>
                        </Box>
                      </Tabs.Content>
                    ))}
                  </Box>
                </HStack>
              </Tabs.Root>
            </VStack>
          </Drawer.Body>
          <Drawer.Footer>
            <HStack w="full" justify="flex-end">
              <Button variant="outline" onClick={onClose}>キャンセル</Button>
              <Button colorPalette="green" onClick={handleSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
            </HStack>
          </Drawer.Footer>
        </Drawer.Content>
      </Drawer.Positioner>
    </Drawer.Root>
  );
};
