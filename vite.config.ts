import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // Build configuration for bundle optimization
  build: {
    chunkSizeWarningLimit: 1000, // 警告のしきい値を1MBに増加
    rollupOptions: {
      output: {
        manualChunks: {
          // Chakra UIを独立したチャンクに分離
          'chakra-ui': ['@chakra-ui/react', '@chakra-ui/theme'],
          // Reactライブラリを独立したチャンクに分離
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Tauri関連ライブラリを独立したチャンクに分離
          'tauri-vendor': ['@tauri-apps/api'],
          // その他の依存関係
          'vendor': ['react-icons']
        }
      }
    }
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
