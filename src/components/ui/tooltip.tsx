import { Tooltip as ChakraTooltip, Portal } from "@chakra-ui/react"
import * as React from "react"

/** Tooltip のプロパティ */
export interface TooltipProps extends ChakraTooltip.RootProps {
  /** 矢印の有無 */
  showArrow?: boolean
  /** Portal を使うか */
  portalled?: boolean
  /** Portal の container */
  portalRef?: React.RefObject<HTMLElement>
  /** 本文 */
  content: React.ReactNode
  /** Content への追加Props */
  contentProps?: ChakraTooltip.ContentProps
  /** 無効化 */
  disabled?: boolean
}

/**
 * Chakra Tooltip の薄いラッパー。SSR/Portal事情を吸収します。
 */
export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, ref) {
    const {
      showArrow,
      children,
      disabled,
      portalled = true,
      content,
      contentProps,
      portalRef,
      ...rest
    } = props

    if (disabled) return children

    return (
      <ChakraTooltip.Root {...rest}>
        <ChakraTooltip.Trigger asChild>{children}</ChakraTooltip.Trigger>
        <Portal disabled={!portalled} container={portalRef}>
          <ChakraTooltip.Positioner>
            <ChakraTooltip.Content ref={ref} {...contentProps}>
              {showArrow && (
                <ChakraTooltip.Arrow>
                  <ChakraTooltip.ArrowTip />
                </ChakraTooltip.Arrow>
              )}
              {content}
            </ChakraTooltip.Content>
          </ChakraTooltip.Positioner>
        </Portal>
      </ChakraTooltip.Root>
    )
  },
)
