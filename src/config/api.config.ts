// src/config/api.config.ts

interface ApiKeyConfig {
  key: string;
  name: string;
  limit: number;
  expire: string;
  active: boolean;
}

interface AppConfig {
  apiKeys: ApiKeyConfig[];
  telegram: {
    token: string;
    chatId: string;
    enabled: boolean;
  };
  endpoints: {
    gpt: string;
    gptBackup: string;
  };
  app: {
    version: string;
    buildDate: string;
  };
  defaults: {
    theme: string;
    language: string;
  };
}

// Load configuration from environment variables
const loadConfig = (): AppConfig => {
  // Parse API Keys
  let apiKeys: ApiKeyConfig[] = [];
  try {
    const apiKeysRaw = import.meta.env.VITE_API_KEYS_CONFIG;
    if (apiKeysRaw) {
      apiKeys = JSON.parse(apiKeysRaw);
    }
  } catch (error) {
    console.error('Failed to parse API keys configuration:', error);
    apiKeys = [];
  }

  // Check if Telegram is enabled
  const telegramEnabled = import.meta.env.VITE_ENABLE_TELEGRAM === 'true';

  return {
    apiKeys,
    telegram: {
      token: import.meta.env.VITE_TG_TOKEN || '',
      chatId: import.meta.env.VITE_TG_CHAT_ID || '',
      enabled: telegramEnabled,
    },
    endpoints: {
      gpt: import.meta.env.VITE_GPT_API_URL || 'https://api.nexray.web.id/ai/gemini',
      gptBackup: import.meta.env.VITE_GPT_BACKUP_API_URL || 'https://api.nexray.web.id/ai/claude',
    },
    app: {
      version: import.meta.env.VITE_APP_VERSION || '10.0.0',
      buildDate: import.meta.env.VITE_BUILD_DATE || 'April 2026',
    },
    defaults: {
      theme: import.meta.env.VITE_DEFAULT_THEME || 'dark',
      language: import.meta.env.VITE_DEFAULT_LANGUAGE || 'id',
    },
  };
};

export const APP_CONFIG = loadConfig();

// Helper function to validate if a key is valid
export function isValidApiKey(key: string): boolean {
  const now = new Date();
  const apiKeyConfig = APP_CONFIG.apiKeys.find(k => k.key === key);
  
  if (!apiKeyConfig || !apiKeyConfig.active) return false;
  
  const expireDate = new Date(apiKeyConfig.expire);
  if (expireDate < now) return false;
  
  return true;
}

// Helper to get all active API keys
export function getActiveApiKeys(): ApiKeyConfig[] {
  const now = new Date();
  return APP_CONFIG.apiKeys.filter(key => 
    key.active && new Date(key.expire) >= now
  );
}

// Helper to check if any API key is available
export function hasAvailableApiKey(): boolean {
  return getActiveApiKeys().length > 0;
}