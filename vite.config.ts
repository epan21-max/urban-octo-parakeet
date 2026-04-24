// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {},
    'import.meta.env': {
      VITE_API_KEYS_CONFIG: process.env.VITE_API_KEYS_CONFIG,
      VITE_TG_TOKEN: process.env.VITE_TG_TOKEN,
      VITE_TG_CHAT_ID: process.env.VITE_TG_CHAT_ID,
      VITE_GPT_API_URL: process.env.VITE_GPT_API_URL,
      VITE_GPT_BACKUP_API_URL: process.env.VITE_GPT_BACKUP_API_URL,
      VITE_APP_VERSION: process.env.VITE_APP_VERSION,
      VITE_BUILD_DATE: process.env.VITE_BUILD_DATE,
      VITE_ENABLE_TELEGRAM: process.env.VITE_ENABLE_TELEGRAM,
      VITE_DEFAULT_THEME: process.env.VITE_DEFAULT_THEME,
      VITE_DEFAULT_LANGUAGE: process.env.VITE_DEFAULT_LANGUAGE,
    }
  },
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
      },
    },
  },
});