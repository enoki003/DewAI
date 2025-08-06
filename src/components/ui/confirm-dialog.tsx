import React from 'react';
import {
  Button,
  Dialog,
  Portal,
  HStack
} from '@chakra-ui/react';

interface ConfirmDialogProps {
  trigger: React.ReactElement;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  variant?: 'destructive' | 'default';
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  trigger,
  title,
  message,
  confirmText = '確認',
  cancelText = 'キャンセル',
  onConfirm,
  variant = 'default'
}) => {
  return (
    <Dialog.Root>
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
              {message}
            </Dialog.Body>
            <Dialog.Footer>
              <HStack gap={3}>
                <Dialog.ActionTrigger asChild>
                  <Button variant="outline">
                    {cancelText}
                  </Button>
                </Dialog.ActionTrigger>
                <Dialog.ActionTrigger asChild>
                  <Button
                    colorPalette={variant === 'destructive' ? 'red' : 'green'}
                    onClick={onConfirm}
                  >
                    {confirmText}
                  </Button>
                </Dialog.ActionTrigger>
              </HStack>
            </Dialog.Footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
};
