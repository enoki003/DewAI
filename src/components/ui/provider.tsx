'use client'

import { 
  ChakraProvider, 
  createSystem,
  defaultConfig 
} from '@chakra-ui/react'
import type { PropsWithChildren } from 'react'
import { ColorModeProvider } from './color-mode'
import { Toaster } from './toaster'

const system = createSystem(defaultConfig, {
  globalCss: {
    body: {
      colorPalette: 'green',
    },
  },
  theme: {
    semanticTokens: {
      colors: {
        brand: {
          solid: { value: '{colors.green.500}' },
          subtle: { value: '{colors.green.50}' },
          muted: { value: '{colors.green.100}' },
          emphasized: { value: '{colors.green.600}' },
        },
      },
      radii: {
        l1: { value: '0.25rem' },
        l2: { value: '0.375rem' },
        l3: { value: '0.5rem' },
      },
    },
  },
})

export const Provider = (props: PropsWithChildren) => (
  <ChakraProvider value={system}>
    <ColorModeProvider>
      {props.children}
      <Toaster />
    </ColorModeProvider>
  </ChakraProvider>
)
