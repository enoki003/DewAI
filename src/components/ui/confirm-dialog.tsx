import React, { useState } from 'react';
import {
  Button,
  Dialog,
  Portal,
  HStack,
  Text
} from '@chakra-ui/react';

interface ConfirmDialogProps {
  trigger: React.ReactElement;
  title: string;
  message: React.ReactNode; // テキスト以外も許容
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  variant?: 'destructive' | 'default';
}

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
