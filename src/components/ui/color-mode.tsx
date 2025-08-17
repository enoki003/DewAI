/**
 * @packageDocumentation
 * カラーモード（ライト/ダーク）の管理とUIコンポーネント。
 * next-themes ライブラリをラップして、カラーモードの切り替えと状態管理を提供します。
 */

"use client"

import type { IconButtonProps, SpanProps } from "@chakra-ui/react"
import { ClientOnly, IconButton, Skeleton, Span } from "@chakra-ui/react"
import { ThemeProvider, useTheme } from "next-themes"
import type { ThemeProviderProps } from "next-themes"
import * as React from "react"
import { LuMoon, LuSun } from "react-icons/lu"

/** ColorModeProvider のプロパティ */
export interface ColorModeProviderProps extends ThemeProviderProps {}

/**
 * next-themes を用いたカラーモード（light/dark）プロバイダ。
 */
export function ColorModeProvider(props: ColorModeProviderProps) {
  return (
    <ThemeProvider attribute="class" disableTransitionOnChange {...props} />
  )
}

/** カラーモードの種別 */
export type ColorMode = "light" | "dark"

/** useColorMode() の返却型 */
export interface UseColorModeReturn {
  colorMode: ColorMode
  setColorMode: (colorMode: ColorMode) => void
  toggleColorMode: () => void
}

/**
 * 現在のカラーモードと切替関数を提供するフック。
 */
export function useColorMode(): UseColorModeReturn {
  const { resolvedTheme, setTheme } = useTheme()
  const toggleColorMode = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }
  return {
    colorMode: resolvedTheme as ColorMode,
    setColorMode: setTheme,
    toggleColorMode,
  }
}

/**
 * カラーモードに応じて値を切り替えるユーティリティ。
 */
export function useColorModeValue<T>(light: T, dark: T) {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? dark : light
}

/** 現在のモードに応じたアイコン（太陽/月） */
export function ColorModeIcon() {
  const { colorMode } = useColorMode()
  return colorMode === "dark" ? <LuMoon /> : <LuSun />
}

/** ColorModeButton のプロパティ */
export interface ColorModeButtonProps extends Omit<IconButtonProps, "aria-label"> {}

/**
 * カラーモード切替ボタンコンポーネント。
 * クリックでライト/ダークモードを切り替えます。
 */
export const ColorModeButton = React.forwardRef<
  HTMLButtonElement,
  ColorModeButtonProps
>(function ColorModeButton(props, ref) {
  const { toggleColorMode } = useColorMode()
  return (
    <ClientOnly fallback={<Skeleton boxSize="8" />}>
      <IconButton
        onClick={toggleColorMode}
        variant="ghost"
        aria-label="Toggle color mode"
        size="sm"
        ref={ref}
        {...props}
        css={{
          _icon: {
            width: "5",
            height: "5",
          },
        }}
      >
        <ColorModeIcon />
      </IconButton>
    </ClientOnly>
  )
})

/** 明示的にライトモードとしてレンダリングするラッパー */
export const LightMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function LightMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme light"
        colorPalette="gray"
        colorScheme="light"
        ref={ref}
        {...props}
      />
    )
  },
)

/** 明示的にダークモードとしてレンダリングするラッパー */
export const DarkMode = React.forwardRef<HTMLSpanElement, SpanProps>(
  function DarkMode(props, ref) {
    return (
      <Span
        color="fg"
        display="contents"
        className="chakra-theme dark"
        colorPalette="gray"
        colorScheme="dark"
        ref={ref}
        {...props}
      />
    )
  },
)
