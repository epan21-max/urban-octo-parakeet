// src/config/telegram.config.ts
import { APP_CONFIG } from './api.config';

export type TelegramActivity = 
  | 'user_message'
  | 'ai_response'
  | 'like'
  | 'dislike'
  | 'pin'
  | 'unpin'
  | 'export'
  | 'regenerate'
  | 'edit_message'
  | 'new_conversation'
  | 'delete_conversation'
  | 'favorite'
  | 'unfavorite'
  | 'clear_chat'
  | 'voice_input'
  | 'tts_play'
  | 'copy_message'
  | 'app_opened';

const TELEGRAM_ENABLED = APP_CONFIG.telegram.enabled;
const TG_TOKEN = APP_CONFIG.telegram.token;
const TG_CHAT_ID = APP_CONFIG.telegram.chatId;

const activityLabels: Record<TelegramActivity, string> = {
  user_message: '💬 User Message',
  ai_response: '🤖 AI Response',
  like: '👍 Liked',
  dislike: '👎 Disliked',
  pin: '📌 Pinned',
  unpin: '📌 Unpinned',
  export: '📤 Exported',
  regenerate: '🔄 Regenerated',
  edit_message: '✏️ Edited',
  new_conversation: '➕ New Conversation',
  delete_conversation: '🗑️ Deleted',
  favorite: '⭐ Favorited',
  unfavorite: '⭐ Unfavorite',
  clear_chat: '🧹 Cleared Chat',
  voice_input: '🎤 Voice Input',
  tts_play: '🔊 TTS Play',
  copy_message: '📋 Copied',
  app_opened: '🚀 App Opened'
};

export async function sendToTelegram(
  activity: TelegramActivity, 
  details?: string
): Promise<void> {
  // Don't send if Telegram is disabled or config missing
  if (!TELEGRAM_ENABLED || !TG_TOKEN || !TG_CHAT_ID) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Telegram Disabled]', activity, details);
    }
    return;
  }

  try {
    const message = `${activityLabels[activity]}\n⏰ ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}`;
    const fullMessage = details 
      ? `${message}\n\n📝 Details:\n<pre>${details.substring(0, 500)}</pre>`
      : message;

    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TG_CHAT_ID,
        text: fullMessage,
        parse_mode: 'HTML'
      })
    });
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}