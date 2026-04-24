// src/types/env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_KEYS_CONFIG: string;
  readonly VITE_TG_TOKEN: string;
  readonly VITE_TG_CHAT_ID: string;
  readonly VITE_GPT_API_URL: string;
  readonly VITE_GPT_BACKUP_API_URL: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_BUILD_DATE: string;
  readonly VITE_ENABLE_TELEGRAM: string;
  readonly VITE_DEFAULT_THEME: string;
  readonly VITE_DEFAULT_LANGUAGE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}