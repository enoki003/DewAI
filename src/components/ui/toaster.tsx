/**
 * @packageDocumentation
 * トースト通知コンポーネント。
 * Chakra UI のToasterを使用して、画面右下にトースト通知を表示します。
 */

"use client"

import {
  Toaster as ChakraToaster,
  Portal,
  Spinner,
  Stack,
  Toast,
  createToaster,
} from "@chakra-ui/react"

/**
 * グローバルに使うトースト通知インスタンス。
 */
export const toaster = createToaster({
  placement: "bottom-end",
  pauseOnPageIdle: true,
})

/**
 * 画面右下にトーストを描画するコンポーネント。
 * アプリのルートプロバイダーに配置して使用します。
 * @returns トースト表示用のコンポーネント
 */
export const Toaster = () => {
  return (
    <Portal>
      <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }}>
        {(toast) => (
          <Toast.Root width={{ md: "sm" }}>
            {toast.type === "loading" ? (
              <Spinner size="sm" color="blue.solid" />
            ) : (
              <Toast.Indicator />
            )}
            <Stack gap="1" flex="1" maxWidth="100%">
              {toast.title && <Toast.Title>{toast.title}</Toast.Title>}
              {toast.description && (
                <Toast.Description>{toast.description}</Toast.Description>
              )}
            </Stack>
            {toast.action && (
              <Toast.ActionTrigger>{toast.action.label}</Toast.ActionTrigger>
            )}
            {toast.meta?.closable && <Toast.CloseTrigger />}
          </Toast.Root>
        )}
      </ChakraToaster>
    </Portal>
  )
}
