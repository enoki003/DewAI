/**
 * @packageDocumentation
 * 確認ダイアログコンポーネント。
 * 削除などの破壊的操作の前に、ユーザーに確認を求めるダイアログを表示します。
 */

import React, { useState } from 'react';
import {
  Button,
  Dialog,
  Portal,
  HStack,
  Text
} from '@chakra-ui/react';

/** ConfirmDialog のプロパティ */
export interface ConfirmDialogProps {
  /** ダイアログを開くためのトリガー要素 */
  trigger: React.ReactElement;
  /** タイトル */
  title: string;
  /** 本文。リッチ要素も可 */
  message: React.ReactNode;
  /** 確定ボタンの表示テキスト */
  confirmText?: string;
  /** キャンセルボタンの表示テキスト */
  cancelText?: string;
  /** 確定時に呼ばれる処理（Promise対応） */
  onConfirm: () => void | Promise<void>;
  /** キャンセル時に呼ばれる処理 */
  onCancel?: () => void;
  /** 破壊的操作かどうか（色の切替に使用） */
  variant?: 'destructive' | 'default';
}

/**
 * 汎用的な確認ダイアログコンポーネント。
 * トリガー要素をクリックするとダイアログが開き、
 * ユーザーの確認後に指定された処理を実行します。
 * 
 * @param props - ConfirmDialogProps
 * @returns 確認ダイアログコンポーネント
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  trigger,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  onConfirm,
  onCancel,
  variant = 'default',
}) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setLoading(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    onCancel?.();
    setOpen(false);
  };

  const confirmPalette = variant === 'destructive' ? 'red' : 'green';

  return (
    <Dialog.Root open={open} onOpenChange={(d) => setOpen(d.open)}>
      <Dialog.Trigger asChild>
        {trigger}
      </Dialog.Trigger>
      <Portal>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content>
            <Dialog.Header>
              <Dialog.Title>{title}</Dialog.Title>
            </Dialog.Header>
            <Dialog.Body>
              {typeof message === 'string' ? <Text>{message}</Text> : message}
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={3}>
                <Button variant="outline" onClick={handleCancel} disabled={loading}>
                  {cancelText}
                </Button>
                <Button colorPalette={confirmPalette} onClick={handleConfirm} loading={loading}>
                  {confirmText}
                </Button>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
