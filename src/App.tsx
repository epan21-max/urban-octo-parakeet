import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { APP_CONFIG, isValidApiKey } from './config/api.config';
import { sendToTelegram } from './config/telegram.config';
import { useRateLimit } from './useRateLimit';
import Login from './Login';
import {
  Send, Sparkles, Plus, Trash2, MessageSquare, ArrowDown,
  Zap, Brain, Lightbulb, Code, Sun, Moon, Settings, X,
  Copy, Check, RefreshCw, ThumbsUp, ThumbsDown,
  Download, ChevronRight, Image, Palette, RotateCcw,
  Menu, Search, Pin, PinOff, Mic, MicOff,
  Type, BookMarked, Edit3, Lock, Unlock,
  Clock, FileText, ChevronDown, ChevronUp, Trash,
  GripHorizontal, Smartphone,
  Star, Volume2, VolumeX, Eraser, Upload, Eye, EyeOff,
  Globe, MessageCircle, Smile, ChevronLeft,
  Archive, ArchiveRestore, Bold, Italic, Code2, Hash, Timer,
  StickyNote, Bell, Brain as BrainIcon, BookOpen, Bookmark,
  Key, Shield, AlertTriangle, LogOut
} from 'lucide-react';

/* ─── Speech Types ─── */
interface SpeechRecognitionResult { readonly isFinal: boolean; readonly [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }
interface SpeechRecognitionEvent extends Event { readonly results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognition extends EventTarget {
  lang: string; interimResults: boolean; continuous: boolean;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null; onerror: ((event: Event) => void) | null;
  start: () => void; stop: () => void;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

/* ─── Types ─── */
interface Reaction { emoji: string; count: number; userReacted: boolean; }
interface Message {
  id: string; role: 'user' | 'assistant'; content: string; timestamp: Date;
  liked?: boolean | null; pinned?: boolean; responseTime?: number;
  reactions?: Record<string, Reaction>; model?: 'gpt' | 'gpt-backup';
  bookmarked?: boolean;
}
interface Conversation {
  id: string; title: string; messages: Message[]; createdAt: Date;
  isFavorite?: boolean; isArchived?: boolean; isLocked?: boolean; lockPin?: string;
}
interface MemoryFact {
  id: string; key: string; value: string; source: 'auto' | 'manual' | 'default'; timestamp: Date;
}
interface StickyNote {
  id: string; content: string; color: string; createdAt: Date;
}
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
interface ColorTheme {
  id: string; name: string; emoji: string; desc: string; accent: string; bubble: string;
  dark: { bgPrimary: string; bgSurface: string; bgSurface2: string; bgSurface3: string; textPrimary: string; textSecondary: string; textMuted: string; border: string; gridSmall: string; gridLarge: string; };
  light: { bgPrimary: string; bgSurface: string; bgSurface2: string; bgSurface3: string; textPrimary: string; textSecondary: string; textMuted: string; border: string; gridSmall: string; gridLarge: string; };
}
interface AppSettings {
  theme: 'dark' | 'light'; colorThemeId: string; bgUrl: string;
  userBubbleColor: string; accentColor: string; fontSize: 'sm' | 'md' | 'lg';
  bubbleStyle: 'classic' | 'modern' | 'minimal';
  useCustomAccent: boolean; useCustomBubble: boolean;
  customAccentColor: string; customBubbleColor: string;
  customBubbleBorderRadius: string; customBubbleShadow: boolean; customBubbleBorder: boolean;
  focusMode: boolean; ttsEnabled: boolean; autoSaveDrafts: boolean;
  language: 'id' | 'en'; autoDeleteDays: number; showQuickActions: boolean;
  notifSound: boolean; showStickyNotes: boolean;
  showMemory: boolean; showBookmarks: boolean;
  apiKey: string; apiKeyValidated: boolean;
  systemPrompt: string;
  useDefaultMemory: boolean;
}

// Default Memory Facts (bawaan)
const DEFAULT_MEMORY_FACTS: MemoryFact[] = [
  { id: 'default-language', key: 'language_preference', value: 'Indonesia', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-response-style', key: 'response_style', value: 'ramah dan informatif', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-topic-interest', key: 'topics_interest', value: 'teknologi, AI, edukasi', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-ai-role', key: 'ai_role', value: 'asisten pribadi yang membantu', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-name', key: 'name_ai', value: 'Blue', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-api', key: 'api_ai', value: 'BlueGPT', source: 'default', timestamp: new Date('2024-01-01') },
  { id: 'default-ai-role', key: 'ai_role', value: 'asisten pribadi yang membantu', source: 'default', timestamp: new Date('2024-01-01') },
];

const API_KEYS_CONFIG = APP_CONFIG.apiKeys;
const TG_TOKEN = APP_CONFIG.telegram.token;
const TG_CHAT_ID = APP_CONFIG.telegram.chatId;

// System prompt for AI
const SYSTEM_PROMPT = "You are BlueGPT, a helpful, harmless, and honest AI assistant. You provide accurate, thoughtful, and well-reasoned responses. You are knowledgeable about a wide range of topics and can help with analysis, creative writing, coding, problem-solving, and general conversation. You communicate clearly and adapt your tone to be friendly yet professional. When you don't know something, you admit it honestly. You prioritize being helpful while maintaining safety and ethical guidelines.";

// Function to validate API key
function isValidApiKey(key: string): boolean {
  const now = new Date();
  const apiKeyConfig = API_KEYS_CONFIG.find(k => k.key === key);
  if (!apiKeyConfig || !apiKeyConfig.active) return false;
  const expireDate = new Date(apiKeyConfig.expire);
  if (expireDate < now) return false;
  return true;
}

const TRANSLATIONS = {
  en: {
    newChat: 'New Chat', settings: 'Settings', search: 'Search', savedPrompts: 'Saved Prompts',
    tabGeneral: 'General', tabAppearance: 'Appearance', tabMore: 'More',
    pinned: 'Pinned', clearChat: 'Clear Chat', export: 'Export', import: 'Import',
    focusMode: 'Focus Mode', themeToggle: 'Toggle Theme', sendMessage: 'Send',
    messagePlaceholder: 'Message BlueGPT…', thinking: 'Thinking…', connecting: 'Connecting...',
    typing: 'Typing...', noConversations: 'No conversations yet', today: 'Today',
    yesterday: 'Yesterday', copyMessage: 'Copy', pinMessage: 'Pin', unpinMessage: 'Unpin',
    editMessage: 'Edit', speakMessage: 'Read aloud', like: 'Like', dislike: 'Dislike',
    regenerate: 'Regenerate', saveRegenerate: 'Save & Regenerate', cancel: 'Cancel',
    clearConfirmTitle: 'Clear Chat', clearConfirmDesc: 'Are you sure you want to delete all messages?',
    clearAll: 'Clear All', addReaction: 'Add reaction',
    helloTitle: 'Hello.', helloSubtitle: 'How can I help you today?',
    words: 'words', chars: 'chars', listening: 'Listening…', disclaimer: 'BlueGPT can make mistakes.',
    language: 'Language', autoDelete: 'Auto-delete old chats', never: 'Never',
    days: 'days', chatsDeleted: 'old chat(s) deleted', importSuccess: 'conversation(s) imported',
    importFail: 'Failed to import file', copied: 'Copied!', exported: 'Conversation exported',
    msgExported: 'Message exported', chatCleared: 'Chat cleared', allExported: 'All conversations exported',
    voiceNotSupported: 'Voice not supported', noMessages: 'No pinned messages yet.',
    editMessageTitle: 'Edit Message', editMessageSubtitle: 'Edit and regenerate AI response',
    resetDefaults: 'Reset to Defaults', installApp: 'Install App', exportAll: 'Export All Conversations',
    quickActions: 'Quick Actions Menu', quickActionsDesc: 'Show floating action button (FAB)',
    features: 'Features', about: 'About', tts: 'Text-to-Speech', ttsDesc: 'Read AI responses aloud',
    autoSave: 'Auto-save Drafts', autoSaveDesc: 'Save unsent messages', colorTheme: 'Color Theme',
    customAccent: 'Custom Accent Color', customBubble: 'Custom User Bubble', background: 'Background',
    bubbleStyleTemplates: 'Bubble Style Templates', fontSize: 'Font Size', useCustomAccentLabel: 'Use Custom Accent',
    useCustomBubbleLabel: 'Use Custom Bubble', presets: 'Presets', customColor: 'Custom Color', preview: 'Preview',
    bubbleColor: 'Bubble Color', borderRadius: 'Border Radius', shadow: 'Shadow', border: 'Border',
    templates: 'Templates', customUrl: 'Custom URL', quickStyles: 'Quick styles (overrides custom bubble settings)',
    changesAllColors: 'Changes all website colors: sidebar, navbar, buttons, icons, etc.',
    defaultIsGrid: 'Default is grid. Select image or paste URL.',
    apiInfo: 'API: BlueGPT', stackInfo: 'Stack: React + Vite + Tailwind',
    dateToday: 'Today', dateYesterday: 'Yesterday',
    reactionAdded: 'Reaction added', swipeHint: 'Swipe messages for quick actions',
    favorites: 'Favorites', all: 'All', searchPlaceholder: 'Search messages…',
    noResults: 'No results found.',
    archive: 'Archive', unarchive: 'Unarchive', archived: 'Archived Chats',
    archiveEmpty: 'No archived chats', archiveChat: 'Archive Chat', restoreChat: 'Restore Chat',
    chatArchived: 'Chat archived', chatRestored: 'Chat restored',
    readTime: 'min read', likedMsg: '👍 Liked!', dislikedMsg: '👎 Disliked',
    goodMorning: 'Good morning.', goodAfternoon: 'Good afternoon.',
    goodEvening: 'Good evening.', goodNight: 'Good night.',
    memory: 'Memory', memoryEmpty: 'No memory yet', addMemory: 'Add Memory', resetMemory: 'Reset Memory',
    memoryReset: 'Memory cleared', memoryAdded: 'Memory added', memoryKey: 'Key (e.g. name)',
    memoryValue: 'Value (e.g. John)', autoDetected: 'Auto-detected', defaultMemory: 'Default',
    useDefaultMemory: 'Use Default Memory', useDefaultMemoryDesc: 'Include default memory facts',
    bookmarks: 'Bookmarks', bookmarkMsg: 'Bookmark', unbookmarkMsg: 'Remove Bookmark',
    bookmarked: 'Bookmarked!', bookmarkRemoved: 'Bookmark removed', bookmarksEmpty: 'No bookmarks yet',
    stickyNotes: 'Sticky Notes', newNote: 'New Note', notePlaceholder: 'Write a note…', noteAdded: 'Note added',
    noteDeleted: 'Note deleted', notifSound: 'Notification Sound', notifSoundDesc: 'Play sound on AI response',
    lockChat: 'Lock Chat', unlockChat: 'Unlock Chat', setPIN: 'Set PIN (4 digits)', wrongPIN: 'Wrong PIN!',
    chatLocked: 'Chat locked', enterPIN: 'Enter PIN to unlock', unlocked: 'Chat unlocked',
    printChat: 'Print Chat', swipeLeft: 'Swipe left: edit/copy', swipeRight: 'Swipe right: pin',
    topWords: 'Top Words', noStats: 'Send some messages first',
    stickyNotesToggle: 'Sticky Notes', stickyNotesDesc: 'Show floating sticky notes',
    memoryToggle: 'AI Memory', memoryDesc: 'Remember info about you',
    bookmarksToggle: 'Bookmarks', bookmarksDesc: 'Bookmark important messages',
    apiKeySettings: 'API Key', apiKeyDesc: 'Enter your API key', apiKeyPlaceholder: 'Enter API Key',
    apiKeyInvalid: 'Invalid API Key!', apiKeyValid: 'API Key Validated', apiKeyRequired: 'API Key required',
    validateKey: 'Validate Key', keyValidated: 'Key Validated', logout: 'Logout',
    resetToDefaultMemory: 'Reset to Default Memory',
  },
  id: {
    newChat: 'Obrolan Baru', settings: 'Pengaturan', search: 'Cari', savedPrompts: 'Prompt Tersimpan',
    tabGeneral: 'Umum', tabAppearance: 'Tampilan', tabMore: 'Lainnya',
    pinned: 'Disematkan', clearChat: 'Hapus Chat', export: 'Ekspor', import: 'Impor',
    focusMode: 'Mode Fokus', themeToggle: 'Ganti Tema', sendMessage: 'Kirim',
    messagePlaceholder: 'Pesan ke BlueGPT…', thinking: 'Berpikir…', connecting: 'Menghubungkan...',
    typing: 'Mengetik...', noConversations: 'Belum ada percakapan', today: 'Hari ini',
    yesterday: 'Kemarin', copyMessage: 'Salin', pinMessage: 'Sematkan', unpinMessage: 'Lepas Sematan',
    editMessage: 'Edit', speakMessage: 'Bacakan', like: 'Suka', dislike: 'Tidak Suka',
    regenerate: 'Buat Ulang', saveRegenerate: 'Simpan & Buat Ulang', cancel: 'Batal',
    clearConfirmTitle: 'Hapus Chat', clearConfirmDesc: 'Yakin ingin menghapus semua pesan?',
    clearAll: 'Hapus Semua', addReaction: 'Tambah reaksi',
    helloTitle: 'Halo.', helloSubtitle: 'Ada yang bisa saya bantu hari ini?',
    words: 'kata', chars: 'karakter', listening: 'Mendengarkan…', disclaimer: 'BlueGPT bisa membuat kesalahan.',
    language: 'Bahasa', autoDelete: 'Hapus otomatis obrolan lama', never: 'Tidak pernah',
    days: 'hari', chatsDeleted: 'obrolan lama dihapus', importSuccess: 'percakapan berhasil diimpor',
    importFail: 'Gagal mengimpor file', copied: 'Disalin!', exported: 'Percakapan diekspor',
    msgExported: 'Pesan diekspor', chatCleared: 'Chat dihapus', allExported: 'Semua percakapan diekspor',
    voiceNotSupported: 'Suara tidak didukung', noMessages: 'Belum ada pesan yang disematkan.',
    editMessageTitle: 'Edit Pesan', editMessageSubtitle: 'Edit dan buat ulang respons AI',
    resetDefaults: 'Reset ke Default', installApp: 'Pasang Aplikasi', exportAll: 'Ekspor Semua Percakapan',
    quickActions: 'Menu Aksi Cepat', quickActionsDesc: 'Tampilkan tombol aksi mengambang (FAB)',
    features: 'Fitur', about: 'Tentang', tts: 'Teks ke Suara', ttsDesc: 'Bacakan respons AI',
    autoSave: 'Simpan Draf Otomatis', autoSaveDesc: 'Simpan pesan yang belum dikirim',
    colorTheme: 'Tema Warna', customAccent: 'Warna Aksen Kustom', customBubble: 'Balon Pengguna Kustom',
    background: 'Latar Belakang', bubbleStyleTemplates: 'Template Gaya Balon', fontSize: 'Ukuran Font',
    useCustomAccentLabel: 'Gunakan Aksen Kustom', useCustomBubbleLabel: 'Gunakan Balon Kustom',
    presets: 'Prasetel', customColor: 'Warna Kustom', preview: 'Pratinjau', bubbleColor: 'Warna Balon',
    borderRadius: 'Radius Sudut', shadow: 'Bayangan', border: 'Bingkai', templates: 'Template',
    customUrl: 'URL Kustom', quickStyles: 'Gaya cepat (mengganti pengaturan balon kustom)',
    changesAllColors: 'Mengubah semua warna: sidebar, navbar, tombol, ikon, dll.',
    defaultIsGrid: 'Default adalah grid. Pilih gambar atau masukkan URL.',
    apiInfo: 'API: BlueGPT', stackInfo: 'Stack: React + Vite + Tailwind',
    dateToday: 'Hari ini', dateYesterday: 'Kemarin',
    reactionAdded: 'Reaksi ditambahkan', swipeHint: 'Geser pesan untuk aksi cepat',
    favorites: 'Favorit', all: 'Semua', searchPlaceholder: 'Cari pesan…',
    noResults: 'Tidak ada hasil.',
    archive: 'Arsip', unarchive: 'Pulihkan', archived: 'Chat Diarsipkan',
    archiveEmpty: 'Tidak ada chat diarsipkan', archiveChat: 'Arsipkan Chat', restoreChat: 'Pulihkan Chat',
    chatArchived: 'Chat diarsipkan', chatRestored: 'Chat dipulihkan',
    readTime: 'mnt baca', likedMsg: '👍 Disukai!', dislikedMsg: '👎 Tidak Disukai',
    goodMorning: 'Selamat pagi.', goodAfternoon: 'Selamat siang.',
    goodEvening: 'Selamat sore.', goodNight: 'Selamat malam.',
    memory: 'Memori', memoryEmpty: 'Belum ada memori', addMemory: 'Tambah Memori', resetMemory: 'Hapus Semua Memori',
    memoryReset: 'Memori dihapus', memoryAdded: 'Memori ditambahkan', memoryKey: 'Kunci (mis. nama)',
    memoryValue: 'Nilai (mis. Budi)', autoDetected: 'Terdeteksi otomatis', defaultMemory: 'Default',
    useDefaultMemory: 'Gunakan Memori Default', useDefaultMemoryDesc: 'Sertakan memori bawaan',
    bookmarks: 'Penanda', bookmarkMsg: 'Tandai', unbookmarkMsg: 'Hapus Tanda',
    bookmarked: 'Ditandai!', bookmarkRemoved: 'Tanda dihapus', bookmarksEmpty: 'Belum ada penanda',
    stickyNotes: 'Catatan Tempel', newNote: 'Catatan Baru', notePlaceholder: 'Tulis catatan…', noteAdded: 'Catatan ditambahkan',
    noteDeleted: 'Catatan dihapus', notifSound: 'Suara Notifikasi', notifSoundDesc: 'Mainkan suara saat AI merespons',
    lockChat: 'Kunci Chat', unlockChat: 'Buka Kunci Chat', setPIN: 'Atur PIN (4 digit)', wrongPIN: 'PIN salah!',
    chatLocked: 'Chat dikunci', enterPIN: 'Masukkan PIN untuk membuka', unlocked: 'Chat dibuka',
    printChat: 'Cetak Chat', swipeLeft: 'Geser kiri: edit/salin', swipeRight: 'Geser kanan: sematkan',
    topWords: 'Kata Teratas', noStats: 'Kirim beberapa pesan terlebih dahulu',
    stickyNotesToggle: 'Catatan Tempel', stickyNotesDesc: 'Tampilkan catatan tempel mengambang',
    memoryToggle: 'Memori AI', memoryDesc: 'Ingat info tentang kamu',
    bookmarksToggle: 'Penanda', bookmarksDesc: 'Tandai pesan penting',
    apiKeySettings: 'Kunci API', apiKeyDesc: 'Masukkan kunci API', apiKeyPlaceholder: 'Masukkan Kunci API',
    apiKeyInvalid: 'Kunci API Tidak Valid!', apiKeyValid: 'Kunci API Tervalidasi', apiKeyRequired: 'Kunci API diperlukan',
    validateKey: 'Validasi Kunci', keyValidated: 'Kunci Tervalidasi', logout: 'Keluar',
    resetToDefaultMemory: 'Reset ke Memori Default',
  },
};

const MIDNIGHT = '#191970';
const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥', '💯'];
const APP_VERSION = APP_CONFIG.app.version;
const BUILD_DATE = APP_CONFIG.app.buildDate;
const LS_DRAFT_KEY = 'chatai_draft';
const LS_KEYS = {
  conversations: 'chatai_conversations', settings: 'chatai_settings',
  savedPrompts: 'chatai_saved_prompts', activeConv: 'chatai_active_conv',
  memory: 'chatai_memory', stickyNotes: 'chatai_sticky_notes',
};

/* ─── Color Themes ─── */
const COLOR_THEMES: ColorTheme[] = [
  { id:'midnight',name:'Midnight',emoji:'🌙',desc:'Deep blue night',accent:'#191970',bubble:'#191970',dark:{bgPrimary:'#02020f',bgSurface:'#0d0d1a',bgSurface2:'#131328',bgSurface3:'#1a1a38',textPrimary:'#f0f0ff',textSecondary:'#a0a0cc',textMuted:'#6666aa',border:'rgba(25,25,112,0.25)',gridSmall:'rgba(60,60,200,0.18)',gridLarge:'rgba(80,80,230,0.32)'},light:{bgPrimary:'#f4f4ff',bgSurface:'#ffffff',bgSurface2:'#eeeeff',bgSurface3:'#ddddf5',textPrimary:'#0a0a2e',textSecondary:'#2a2a6e',textMuted:'#5555a0',border:'rgba(25,25,112,0.14)',gridSmall:'rgba(25,25,112,0.13)',gridLarge:'rgba(25,25,112,0.24)'}},
  { id:'ocean',name:'Ocean',emoji:'🌊',desc:'Calm sea blue',accent:'#0077b6',bubble:'#023e8a',dark:{bgPrimary:'#020a10',bgSurface:'#071620',bgSurface2:'#0a2030',bgSurface3:'#0f3050',textPrimary:'#e8f4ff',textSecondary:'#8ec5e8',textMuted:'#5599cc',border:'rgba(0,119,182,0.25)',gridSmall:'rgba(0,119,182,0.15)',gridLarge:'rgba(0,150,220,0.28)'},light:{bgPrimary:'#f0f8ff',bgSurface:'#ffffff',bgSurface2:'#e6f3ff',bgSurface3:'#cce5ff',textPrimary:'#023047',textSecondary:'#0077b6',textMuted:'#0096c7',border:'rgba(0,119,182,0.15)',gridSmall:'rgba(0,119,182,0.10)',gridLarge:'rgba(0,119,182,0.20)'}},
  { id:'forest',name:'Forest',emoji:'🌲',desc:'Nature green',accent:'#2d6a4f',bubble:'#1b4332',dark:{bgPrimary:'#020a06',bgSurface:'#081810',bgSurface2:'#0f2518',bgSurface3:'#1a3d28',textPrimary:'#e8fff0',textSecondary:'#88cc99',textMuted:'#55aa77',border:'rgba(45,106,79,0.28)',gridSmall:'rgba(45,106,79,0.15)',gridLarge:'rgba(64,145,108,0.28)'},light:{bgPrimary:'#f0fff4',bgSurface:'#ffffff',bgSurface2:'#e6ffec',bgSurface3:'#c6f6d5',textPrimary:'#1b4332',textSecondary:'#2d6a4f',textMuted:'#40916c',border:'rgba(45,106,79,0.15)',gridSmall:'rgba(45,106,79,0.10)',gridLarge:'rgba(45,106,79,0.20)'}},
  { id:'sunset',name:'Sunset',emoji:'🌅',desc:'Warm orange',accent:'#e85d04',bubble:'#c1121f',dark:{bgPrimary:'#0a0502',bgSurface:'#1a0f08',bgSurface2:'#2a1810',bgSurface3:'#3d2218',textPrimary:'#fff5e8',textSecondary:'#ffaa77',textMuted:'#cc7744',border:'rgba(232,93,4,0.28)',gridSmall:'rgba(232,93,4,0.15)',gridLarge:'rgba(255,120,50,0.28)'},light:{bgPrimary:'#fffaf5',bgSurface:'#ffffff',bgSurface2:'#fff0e6',bgSurface3:'#ffdcc8',textPrimary:'#5c1a00',textSecondary:'#c1121f',textMuted:'#e85d04',border:'rgba(232,93,4,0.15)',gridSmall:'rgba(232,93,4,0.10)',gridLarge:'rgba(232,93,4,0.20)'}},
  { id:'violet',name:'Violet',emoji:'💜',desc:'Royal purple',accent:'#7b2cbf',bubble:'#5a189a',dark:{bgPrimary:'#08020f',bgSurface:'#12081a',bgSurface2:'#1c1028',bgSurface3:'#2d1a40',textPrimary:'#f8e8ff',textSecondary:'#c88aee',textMuted:'#9955cc',border:'rgba(123,44,191,0.28)',gridSmall:'rgba(123,44,191,0.18)',gridLarge:'rgba(150,80,220,0.30)'},light:{bgPrimary:'#faf5ff',bgSurface:'#ffffff',bgSurface2:'#f3e8ff',bgSurface3:'#e9d5ff',textPrimary:'#3b0764',textSecondary:'#7c3aed',textMuted:'#a855f7',border:'rgba(123,44,191,0.15)',gridSmall:'rgba(123,44,191,0.10)',gridLarge:'rgba(123,44,191,0.20)'}},
  { id:'rose',name:'Rose',emoji:'🌸',desc:'Elegant pink',accent:'#db2777',bubble:'#9d174d',dark:{bgPrimary:'#0a0205',bgSurface:'#1a080e',bgSurface2:'#2a1018',bgSurface3:'#3d1825',textPrimary:'#fff0f5',textSecondary:'#f9a8d4',textMuted:'#ec4899',border:'rgba(219,39,119,0.28)',gridSmall:'rgba(219,39,119,0.15)',gridLarge:'rgba(244,114,182,0.28)'},light:{bgPrimary:'#fff5f7',bgSurface:'#ffffff',bgSurface2:'#ffe4ec',bgSurface3:'#fecdd3',textPrimary:'#831843',textSecondary:'#be185d',textMuted:'#db2777',border:'rgba(219,39,119,0.15)',gridSmall:'rgba(219,39,119,0.10)',gridLarge:'rgba(219,39,119,0.20)'}},
];

const BG_TEMPLATES = [
  { id:'minecraff',name:'Mainecraft',preview:'https://i.pinimg.com/1200x/d4/bc/87/d4bc871167c620931fda1b214d340a29.jpg',url:'https://i.pinimg.com/1200x/d4/bc/87/d4bc871167c620931fda1b214d340a29.jpg' },
];

interface BubbleStyle { id: string; name: string; borderRadius: string; shadow: string; border?: string; padding: string; desc: string; emoji: string; }
const BUBBLE_STYLES: BubbleStyle[] = [
  { id:'classic',name:'Classic',borderRadius:'1rem 1rem 0.25rem 1rem',shadow:'0 2px 16px',padding:'0.75rem 1rem',desc:'Standard chat bubble',emoji:'💬' },
  { id:'modern',name:'Modern',borderRadius:'1.5rem',shadow:'0 4px 24px',padding:'0.875rem 1.25rem',desc:'Rounded & bold shadow',emoji:'✨' },
  { id:'minimal',name:'Minimal',borderRadius:'0.5rem',shadow:'0 1px 4px',border:'1px solid rgba(255,255,255,0.15)',padding:'0.625rem 0.875rem',desc:'Clean & subtle',emoji:'🔹' },
];

const FONT_SIZES = { sm:{ label:'Small',css:'0.8125rem' }, md:{ label:'Medium',css:'0.9375rem' }, lg:{ label:'Large',css:'1.0625rem' } };

const NOTE_COLORS = ['#1a1a3a','#0a2030','#0f2a1a','#2a0a10','#1a0a2a','#2a1a0a'];

const DEFAULT_SETTINGS: AppSettings = {
  theme: APP_CONFIG.defaults.theme as 'dark' | 'light',
  colorThemeId: 'midnight',
  bgUrl: '',
  userBubbleColor: MIDNIGHT,
  accentColor: MIDNIGHT,
  fontSize: 'md',
  bubbleStyle: 'classic',
  useCustomAccent: false,
  useCustomBubble: false,
  customAccentColor: '#6366f1',
  customBubbleColor: '#3b82f6',
  customBubbleBorderRadius: '1rem',
  customBubbleShadow: true,
  customBubbleBorder: false,
  focusMode: false,
  ttsEnabled: true,
  autoSaveDrafts: true,
  language: APP_CONFIG.defaults.language as 'id' | 'en',
  autoDeleteDays: 0,
  showQuickActions: true,
  notifSound: false,
  showStickyNotes: true,
  showMemory: true,
  showBookmarks: true,
  apiKey: '',
  apiKeyValidated: false,
  systemPrompt: "You are BlueGPT, a helpful, harmless, and honest AI assistant...",
  useDefaultMemory: true,
};
/* ─── Telegram Config (internal) ─── */
type TelegramActivity = 'user_message'|'ai_response'|'like'|'dislike'|'pin'|'unpin'|'export'|'regenerate'|'edit_message'|'new_conversation'|'delete_conversation'|'favorite'|'unfavorite'|'clear_chat'|'voice_input'|'tts_play'|'copy_message'|'app_opened';
async function sendToTelegram(activity: TelegramActivity, details?: string): Promise<void> {
  if (!TG_TOKEN || !TG_CHAT_ID || TG_TOKEN === 'ISI_BOT_TOKEN_DISINI') return;
  const labels: Record<TelegramActivity,string> = { user_message:'💬 User Message',ai_response:'🤖 AI Response',like:'👍 Liked',dislike:'👎 Disliked',pin:'📌 Pinned',unpin:'📌 Unpinned',export:'📤 Exported',regenerate:'🔄 Regenerated',edit_message:'✏️ Edited',new_conversation:'➕ New Conversation',delete_conversation:'🗑️ Deleted',favorite:'⭐ Favorited',unfavorite:'⭐ Unfavorite',clear_chat:'🧹 Cleared Chat',voice_input:'🎤 Voice Input',tts_play:'🔊 TTS Play',copy_message:'📋 Copied',app_opened:'🚀 App Opened' };
  let msg = `${labels[activity]}\n⏰ ${new Date().toLocaleString('id-ID',{timeZone:'Asia/Jakarta'})}`;
  if (details) msg += `\n\n📝 Details:\n<pre>${details.substring(0,500)}</pre>`;
  try { await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:TG_CHAT_ID,text:msg,parse_mode:'HTML'})}); } catch {}
}

/* ─── Helpers ─── */
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substring(2); }
function hexToRgb(hex: string) { try { return `${parseInt(hex.slice(1,3),16)}, ${parseInt(hex.slice(3,5),16)}, ${parseInt(hex.slice(5,7),16)}`; } catch { return '25, 25, 112'; } }
function formatDuration(ms: number) { return ms < 1000 ? `${ms}ms` : `${(ms/1000).toFixed(1)}s`; }
function adjustColor(hex: string, amount: number): string { try { const r=Math.min(255,parseInt(hex.slice(1,3),16)+amount); const g=Math.min(255,parseInt(hex.slice(3,5),16)+amount); const b=Math.min(255,parseInt(hex.slice(5,7),16)+amount); return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`; } catch { return hex; } }
function saveToLS(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }
function loadFromLS<T>(key: string, fallback: T): T { try { const raw=localStorage.getItem(key); if (!raw) return fallback; return JSON.parse(raw) as T; } catch { return fallback; } }
function hydrateConversations(convs: Conversation[]): Conversation[] { return convs.map(c=>({...c,createdAt:new Date(c.createdAt),messages:c.messages.map(m=>({...m,timestamp:new Date(m.timestamp)}))})); }
function hydrateMemory(facts: MemoryFact[]): MemoryFact[] { return facts.map(f=>({...f,timestamp:new Date(f.timestamp)})); }
function getReadingTime(text: string): number { return Math.max(1, Math.ceil(text.trim().split(/\s+/).length / 200)); }
function getGreeting(lang: 'id'|'en'): string {
  const h = new Date().getHours();
  if (lang === 'id') {
    if (h>=5&&h<12) return 'Selamat pagi.';
    if (h>=12&&h<15) return 'Selamat siang.';
    if (h>=15&&h<19) return 'Selamat sore.';
    return 'Selamat malam.';
  }
  if (h>=5&&h<12) return 'Good morning.';
  if (h>=12&&h<17) return 'Good afternoon.';
  if (h>=17&&h<21) return 'Good evening.';
  return 'Good night.';
}
function getDateLabel(date: Date, lang: 'id'|'en'): string {
  const today=new Date(); const yesterday=new Date(today); yesterday.setDate(today.getDate()-1);
  if (date.toDateString()===today.toDateString()) return lang==='id'?'Hari ini':'Today';
  if (date.toDateString()===yesterday.toDateString()) return lang==='id'?'Kemarin':'Yesterday';
  return date.toLocaleDateString(lang==='id'?'id-ID':'en-US',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
}

function playNotifSound(accentColor: string) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const rgb = hexToRgb(accentColor);
    const r = parseInt(rgb.split(',')[0]);
    const freq = 400 + (r / 255) * 400;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.4);
  } catch {}
}
function applyThemeVariables(theme: ColorTheme, mode: 'dark'|'light') {
  const root=document.documentElement; const c=mode==='dark'?theme.dark:theme.light;
  root.style.setProperty('--bg-primary',c.bgPrimary); root.style.setProperty('--bg-surface',c.bgSurface);
  root.style.setProperty('--bg-surface2',c.bgSurface2); root.style.setProperty('--bg-surface3',c.bgSurface3);
  root.style.setProperty('--text-primary',c.textPrimary); root.style.setProperty('--text-secondary',c.textSecondary);
  root.style.setProperty('--text-muted',c.textMuted); root.style.setProperty('--border-color',c.border);
  root.style.setProperty('--grid-small',c.gridSmall); root.style.setProperty('--grid-large',c.gridLarge);
  const ar=hexToRgb(theme.accent); const bsp=c.bgSurface; const bpr=c.bgPrimary;
  const toRgba=(h:string,a:number)=>{try{return `rgba(${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)},${a})`;}catch{return 'rgba(0,0,0,0)';}};
  root.style.setProperty('--glass-bg',toRgba(bsp,mode==='dark'?0.85:0.88));
  root.style.setProperty('--glass-sidebar',mode==='dark'?toRgba(bpr,0.92):'rgba(255,255,255,0.94)');
  root.style.setProperty('--input-bg',mode==='dark'?toRgba(c.bgSurface2,0.95):'rgba(255,255,255,0.97)');
  root.style.setProperty('--scrollbar-thumb',`rgba(${ar},0.35)`); root.style.setProperty('--scrollbar-thumb-hover',`rgba(${ar},0.6)`);
  root.style.setProperty('--suggestion-bg',mode==='dark'?`rgba(${ar},0.07)`:'rgba(255,255,255,0.8)');
  root.style.setProperty('--suggestion-border',`rgba(${ar},${mode==='dark'?'0.18':'0.1'})`);
  root.style.setProperty('--suggestion-hover',mode==='dark'?`rgba(${ar},0.14)`:'rgba(255,255,255,1)');
  root.style.setProperty('--suggestion-border-hover',`rgba(${ar},${mode==='dark'?'0.32':'0.22'})`);
  root.style.setProperty('--code-bg',mode==='dark'?'rgba(0,0,10,0.6)':`rgba(${ar},0.04)`);
  root.style.setProperty('--code-border',`rgba(${ar},0.2)`);
  root.style.setProperty('--inline-code-bg',`rgba(${ar},${mode==='dark'?'0.18':'0.08'})`);
  root.style.setProperty('--inline-code-color',theme.accent);
  root.style.setProperty('--toast-bg',c.bgSurface); root.style.setProperty('--toast-border',`rgba(${ar},0.3)`);
  root.style.setProperty('--action-btn-bg',`rgba(${ar},${mode==='dark'?'0.1':'0.05'})`);
  root.style.setProperty('--action-btn-text',c.textMuted);
  root.style.setProperty('--copy-btn-bg',`rgba(${ar},${mode==='dark'?'0.14':'0.07'})`);
  root.style.setProperty('--ai-response-color',c.textPrimary);
  root.style.setProperty('--blockquote-color',c.textMuted);
  root.style.setProperty('--heading-color',c.textPrimary);
  root.style.setProperty('--strong-color',c.textPrimary);
  root.style.setProperty('--pre-text',c.textPrimary);
}

/* ─── Hooks ─── */
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(()=>{ const check=()=>setIsMobile(window.innerWidth<768); check(); window.addEventListener('resize',check); return ()=>window.removeEventListener('resize',check); },[]);
  return isMobile;
}
function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent|null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  useEffect(()=>{
    if (window.matchMedia('(display-mode: standalone)').matches) { setIsInstalled(true); return; }
    const h=(e:Event)=>{ e.preventDefault(); setInstallPrompt(e as BeforeInstallPromptEvent); };
    const hi=()=>{ setIsInstalled(true); setInstallPrompt(null); };
    window.addEventListener('beforeinstallprompt',h); window.addEventListener('appinstalled',hi);
    return ()=>{ window.removeEventListener('beforeinstallprompt',h); window.removeEventListener('appinstalled',hi); };
  },[]);
  const install=async()=>{ if(!installPrompt) return false; await installPrompt.prompt(); const {outcome}=await installPrompt.userChoice; if(outcome==='accepted'){setIsInstalled(true);setInstallPrompt(null);} return outcome==='accepted'; };
  return { canInstall:!!installPrompt&&!isInstalled, isInstalled, install };
}

/* ─── AI Icon ─── */
function AIIcon({ size=6, accent }: { size?: number; accent: string }) {
  const px=size*4;
  return <div className="rounded-xl flex items-center justify-center shrink-0" style={{background:`linear-gradient(135deg, ${accent}, ${adjustColor(accent,40)}, ${adjustColor(accent,80)})`,boxShadow:`0 2px 12px rgba(${hexToRgb(accent)},0.45)`,width:px,height:px}}><Sparkles style={{width:px*0.48,height:px*0.48}} className="text-white"/></div>;
}

/* ─── Toast ─── */
function Toast({ msg, onDone }: { msg: string; onDone: ()=>void }) {
  const [leaving, setLeaving] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setLeaving(true),1800); return ()=>clearTimeout(t); },[]);
  useEffect(()=>{ if(leaving){const t=setTimeout(onDone,250); return ()=>clearTimeout(t);} },[leaving,onDone]);
  return <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[200] px-4 py-2.5 rounded-2xl text-sm font-medium shadow-2xl flex items-center gap-2 ${leaving?'animate-toast-out':'animate-toast-in'}`} style={{background:'var(--toast-bg)',color:'var(--text-primary)',border:'1px solid var(--toast-border)'}}><Check className="w-3.5 h-3.5" style={{color:'var(--inline-code-color)'}}/>{msg}</div>;
}

/* ─── Code Block ─── */
function CodeBlock({ language, code, accentColor }: { language: string; code: string; accentColor: string }) {
  const [copied, setCopied] = useState(false);
  const copy=()=>{ navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),2000); };
  return <div className="code-block-wrapper rounded-xl overflow-hidden my-3" style={{border:'1px solid var(--code-border)'}}><div className="code-block-header"><span>{language||'code'}</span><button onClick={copy} className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors" style={{background:copied?`rgba(${hexToRgb(accentColor)},0.18)`:'var(--copy-btn-bg)',color:copied?accentColor:'var(--text-muted)'}}>{copied?<Check className="w-3 h-3"/>:<Copy className="w-3 h-3"/>}{copied?'Copied!':'Copy'}</button></div><pre style={{margin:0,borderRadius:0}}><code>{code}</code></pre></div>;
}

/* ─── Message Actions ─── */
function MessageActions({ msg, onCopy, onRegenerate, onLike, onExport, onPin, onEdit, onSpeak, onReact, onBookmark, accentColor, isLast, isSpeaking, ttsEnabled, isMobile, showBookmarks, t }: {
  msg: Message; onCopy:()=>void; onRegenerate?:()=>void; onLike:(v:boolean|null)=>void; onExport:()=>void;
  onPin:()=>void; onEdit?:()=>void; onSpeak?:()=>void; onReact?:(emoji:string)=>void; onBookmark?:()=>void;
  accentColor:string; isLast?:boolean; isSpeaking?:boolean; ttsEnabled?:boolean; isMobile?:boolean;
  showBookmarks?:boolean; t:(k:string)=>string;
}) {
  const [showReactions, setShowReactions] = useState(false);
  const s={color:'var(--action-btn-text)',background:'var(--action-btn-bg)'};
  const as={color:accentColor,background:`rgba(${hexToRgb(accentColor)},0.12)`};
  return (
    <div className="relative">
      <div className={`flex items-center gap-1 mt-1.5 flex-wrap transition-opacity ${isMobile?'opacity-100':'opacity-0 group-hover:opacity-100'}`}>
        <button onClick={onCopy} title={t('copyMessage')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={s}><Copy className="w-3 h-3"/></button>
        <button onClick={onPin} title={msg.pinned?t('unpinMessage'):t('pinMessage')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={msg.pinned?as:s}>{msg.pinned?<PinOff className="w-3 h-3"/>:<Pin className="w-3 h-3"/>}</button>
        {showBookmarks && onBookmark && <button onClick={onBookmark} title={msg.bookmarked?t('unbookmarkMsg'):t('bookmarkMsg')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={msg.bookmarked?as:s}>{msg.bookmarked?<Bookmark className="w-3 h-3"/>:<BookOpen className="w-3 h-3"/>}</button>}
        {onEdit && msg.role==='user' && <button onClick={onEdit} title={t('editMessage')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={s}><Edit3 className="w-3 h-3"/></button>}
        {onSpeak && msg.role==='assistant' && ttsEnabled && <button onClick={onSpeak} title={isSpeaking?'Stop':'Read'} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={isSpeaking?as:s}>{isSpeaking?<VolumeX className="w-3 h-3"/>:<Volume2 className="w-3 h-3"/>}</button>}
        <button onClick={()=>onLike(msg.liked===true?null:true)} title={t('like')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={msg.liked===true?as:s}><ThumbsUp className="w-3 h-3"/></button>
        <button onClick={()=>onLike(msg.liked===false?null:false)} title={t('dislike')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={msg.liked===false?as:s}><ThumbsDown className="w-3 h-3"/></button>
        {onReact && <button onClick={()=>setShowReactions(v=>!v)} title={t('addReaction')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={showReactions?as:s}><Smile className="w-3 h-3"/></button>}
        <button onClick={onExport} title={t('export')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={s}><FileText className="w-3 h-3"/></button>
        {onRegenerate && isLast && <button onClick={onRegenerate} title={t('regenerate')} className="p-1.5 rounded-lg transition-colors hover:opacity-80" style={s}><RefreshCw className="w-3 h-3"/></button>}
      </div>
      {showReactions && onReact && (
        <div className="absolute bottom-8 left-0 z-50 flex gap-1 p-2 rounded-2xl shadow-2xl animate-fade-in" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}}>
          {REACTION_EMOJIS.map(e=>(
            <button key={e} onClick={()=>{onReact(e);setShowReactions(false);}} className="text-lg hover:scale-125 transition-transform p-1 rounded-lg" style={{background:msg.reactions?.[e]?.userReacted?`rgba(${hexToRgb(accentColor)},0.15)`:'transparent'}}>{e}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Search Modal ─── */
function SearchModal({ conversations, onSelect, onClose, accentColor, t }: { conversations:Conversation[]; onSelect:(convId:string,msgId:string)=>void; onClose:()=>void; accentColor:string; t:(k:string)=>string }) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(()=>{ inputRef.current?.focus(); },[]);
  const results=query.trim()?conversations.flatMap(conv=>conv.messages.filter(m=>m.content.toLowerCase().includes(query.toLowerCase())).map(m=>({conv,msg:m}))):[];
  const highlight=(text:string,q:string)=>{ const idx=text.toLowerCase().indexOf(q.toLowerCase()); if(idx===-1) return text.slice(0,120); const start=Math.max(0,idx-30); const end=Math.min(text.length,idx+q.length+60); return (start>0?'…':'')+text.slice(start,end)+(end<text.length?'…':''); };
  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center pt-20 p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}/>
      <div className="relative z-10 rounded-3xl w-full max-w-xl shadow-2xl animate-fade-in-up overflow-hidden" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b" style={{borderColor:'var(--border-color)'}}>
          <Search className="w-4 h-4 shrink-0" style={{color:accentColor}}/>
          <input ref={inputRef} type="text" value={query} onChange={e=>setQuery(e.target.value)} placeholder={t('searchPlaceholder')} className="flex-1 bg-transparent text-sm outline-none" style={{color:'var(--text-primary)'}}/>
          {query && <button onClick={()=>setQuery('')} style={{color:'var(--text-muted)'}}><X className="w-3.5 h-3.5"/></button>}
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{background:'var(--bg-surface2)',color:'var(--text-muted)'}}>ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {results.length===0&&query&&<div className="px-4 py-8 text-center text-sm" style={{color:'var(--text-muted)'}}>{t('noResults')}</div>}
          {results.slice(0,20).map(({conv,msg})=>(
            <button key={msg.id} onClick={()=>{onSelect(conv.id,msg.id);onClose();}} className="w-full text-left px-4 py-3 transition-colors" style={{background:'transparent',borderBottom:'1px solid var(--border-color)'}} onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--bg-surface2)';}} onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';}}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{background:msg.role==='user'?`rgba(${hexToRgb(accentColor)},0.15)`:'var(--bg-surface3)',color:msg.role==='user'?accentColor:'var(--text-muted)'}}>{msg.role==='user'?'You':'AI'}</span>
                <span className="text-[11px]" style={{color:'var(--text-muted)'}}>{conv.title}</span>
              </div>
              <p className="text-sm truncate" style={{color:'var(--text-secondary)'}}>{highlight(msg.content,query)}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Pinned Panel ─── */
function PinnedPanel({ messages, onClose, onUnpin, accentColor, t }: { messages:Message[]; onClose:()=>void; onUnpin:(id:string)=>void; accentColor:string; t:(k:string)=>string }) {
  const pinned=messages.filter(m=>m.pinned);
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}/>
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-slide-in mt-16" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Pin className="w-4 h-4" style={{color:accentColor}}/><span className="font-semibold" style={{color:'var(--text-primary)'}}>{t('pinned')}</span><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${hexToRgb(accentColor)},0.12)`,color:accentColor}}>{pinned.length}</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {pinned.length===0?<p className="text-sm py-6 text-center" style={{color:'var(--text-muted)'}}>{t('noMessages')}</p>:pinned.map(m=>(
            <div key={m.id} className="p-3 rounded-xl text-sm" style={{background:'var(--bg-surface2)',color:'var(--text-secondary)'}}>
              <p className="line-clamp-3">{m.content}</p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px]" style={{color:'var(--text-muted)'}}>{m.role==='user'?'You':'AI'}</span>
                <button onClick={()=>onUnpin(m.id)} className="text-[10px] flex items-center gap-1 hover:opacity-70" style={{color:accentColor}}><PinOff className="w-2.5 h-2.5"/>{t('unpinMessage')}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Bookmarks Panel ─── */
function BookmarksPanel({ conversations, onClose, onNavigate, onUnbookmark, accentColor, t }: { conversations:Conversation[]; onClose:()=>void; onNavigate:(convId:string,msgId:string)=>void; onUnbookmark:(convId:string,msgId:string)=>void; accentColor:string; t:(k:string)=>string }) {
  const bookmarks = conversations.flatMap(c=>c.messages.filter(m=>m.bookmarked).map(m=>({conv:c,msg:m})));
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}/>
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-slide-in mt-16" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Bookmark className="w-4 h-4" style={{color:accentColor}}/><span className="font-semibold" style={{color:'var(--text-primary)'}}>{t('bookmarks')}</span><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${hexToRgb(accentColor)},0.12)`,color:accentColor}}>{bookmarks.length}</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          {bookmarks.length===0?<p className="text-sm py-8 text-center" style={{color:'var(--text-muted)'}}>{t('bookmarksEmpty')}</p>:bookmarks.map(({conv,msg})=>(
            <div key={msg.id} className="p-3 rounded-xl" style={{background:'var(--bg-surface2)'}}>
              <div className="flex items-start gap-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0 mt-0.5" style={{background:`rgba(${hexToRgb(accentColor)},0.12)`,color:accentColor}}>{msg.role==='user'?'You':'AI'}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate mb-0.5" style={{color:'var(--text-muted)'}}>{conv.title}</p>
                  <p className="text-sm line-clamp-2" style={{color:'var(--text-secondary)'}}>{msg.content}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>{onNavigate(conv.id,msg.id);onClose();}} className="flex-1 text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1" style={{background:`rgba(${hexToRgb(accentColor)},0.15)`,color:accentColor}}><ChevronRight className="w-3 h-3"/>Go to</button>
                <button onClick={()=>onUnbookmark(conv.id,msg.id)} className="p-1.5 rounded-lg" style={{color:'#ef4444'}}><Trash className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Actions Menu (FAB) ─── */
function QuickActionsFAB({ onNewChat, onSearch, onExport, onScrollTop, accentColor, t }: { onNewChat:()=>void; onSearch:()=>void; onExport:()=>void; onScrollTop:()=>void; accentColor:string; t:(k:string)=>string }) {
  const [open, setOpen] = useState(false);
  const actions = [
    { icon:Plus, label:t('newChat'), action:onNewChat },
    { icon:Search, label:t('search'), action:onSearch },
    { icon:Download, label:t('export'), action:onExport },
    { icon:ChevronLeft, label:'Top', action:onScrollTop },
  ];
  return (
    <div className="fixed bottom-24 right-4 z-50 flex flex-col items-end gap-2">
      {open && actions.map((a,i)=>(
        <div key={i} className="flex items-center gap-2 animate-fab-item" style={{animationDelay:`${i*50}ms`}}>
          <span className="text-xs font-medium px-2.5 py-1.5 rounded-xl shadow-lg" style={{background:'var(--bg-surface)',color:'var(--text-primary)',border:'1px solid var(--border-color)'}}>{a.label}</span>
          <button onClick={()=>{a.action();setOpen(false);}} className="w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all hover:scale-110" style={{background:`rgba(${hexToRgb(accentColor)},0.15)`,color:accentColor,border:`1px solid rgba(${hexToRgb(accentColor)},0.3)`}}><a.icon className="w-4 h-4"/></button>
        </div>
      ))}
      <button onClick={()=>setOpen(v=>!v)} className="w-12 h-12 rounded-full flex items-center justify-center shadow-2xl transition-all hover:scale-110 animate-fab-bounce" style={{background:`linear-gradient(135deg, ${accentColor}, ${adjustColor(accentColor,50)})`,boxShadow:`0 4px 20px rgba(${hexToRgb(accentColor)},0.5)`}}>
        {open?<X className="w-5 h-5 text-white"/>:<Zap className="w-5 h-5 text-white"/>}
      </button>
    </div>
  );
}

/* ─── Date Separator ─── */
function DateSeparator({ label, accentColor }: { label: string; accentColor: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1 h-px" style={{background:'var(--border-color)'}}/>
      <span className="text-[10px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap" style={{background:`rgba(${hexToRgb(accentColor)},0.1)`,color:'var(--text-muted)',border:`1px solid rgba(${hexToRgb(accentColor)},0.15)`}}>{label}</span>
      <div className="flex-1 h-px" style={{background:'var(--border-color)'}}/>
    </div>
  );
}

/* ─── Archive Panel ─── */
function ArchivePanel({ conversations, onClose, onRestore, onDelete, accentColor, t }: { conversations:Conversation[]; onClose:()=>void; onRestore:(id:string)=>void; onDelete:(id:string)=>void; accentColor:string; t:(k:string)=>string }) {
  const archived=conversations.filter(c=>c.isArchived);
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}/>
      <div className="relative z-10 w-full max-w-sm rounded-3xl p-5 shadow-2xl animate-slide-in mt-16" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2"><Archive className="w-4 h-4" style={{color:accentColor}}/><span className="font-semibold" style={{color:'var(--text-primary)'}}>{t('archived')}</span><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${hexToRgb(accentColor)},0.12)`,color:accentColor}}>{archived.length}</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>
        </div>
        <div className="space-y-2 max-h-[65vh] overflow-y-auto">
          {archived.length===0?<p className="text-sm py-8 text-center" style={{color:'var(--text-muted)'}}>{t('archiveEmpty')}</p>:archived.map(c=>(
            <div key={c.id} className="p-3 rounded-xl" style={{background:'var(--bg-surface2)'}}>
              <div className="flex items-start gap-2"><MessageSquare className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{color:'var(--text-muted)'}}/><div className="flex-1 min-w-0"><p className="text-sm font-medium truncate" style={{color:'var(--text-primary)'}}>{c.title}</p><p className="text-[10px] mt-0.5" style={{color:'var(--text-muted)'}}>{c.messages.length} messages · {new Date(c.createdAt).toLocaleDateString()}</p></div></div>
              <div className="flex gap-2 mt-2">
                <button onClick={()=>onRestore(c.id)} className="flex-1 text-xs py-1.5 rounded-lg font-medium flex items-center justify-center gap-1" style={{background:`rgba(${hexToRgb(accentColor)},0.15)`,color:accentColor}}><ArchiveRestore className="w-3 h-3"/>{t('restoreChat')}</button>
                <button onClick={()=>onDelete(c.id)} className="p-1.5 rounded-lg hover:opacity-70" style={{color:'#ef4444'}}><Trash2 className="w-3.5 h-3.5"/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Chat Lock Modal ─── */
function ChatLockModal({ conv, onClose, onLock, onUnlock, accentColor, t }: { conv:Conversation; onClose:()=>void; onLock:(pin:string)=>void; onUnlock:(pin:string)=>boolean; accentColor:string; t:(k:string)=>string }) {
  const [pin, setPin] = useState(''); const [error, setError] = useState('');
  const isLocked = conv.isLocked;
  const handleSubmit=()=>{
    if (isLocked) { const ok=onUnlock(pin); if(!ok){setError(t('wrongPIN'));setPin('');} else onClose(); }
    else { if(pin.length!==4||!/^\d{4}$/.test(pin)){setError(t('setPIN'));return;} onLock(pin); onClose(); }
  };
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}/>
      <div className="relative z-10 p-6 rounded-3xl max-w-xs w-full animate-fade-in-up" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{background:`rgba(${hexToRgb(accentColor)},0.12)`}}>{isLocked?<Unlock className="w-5 h-5" style={{color:accentColor}}/>:<Lock className="w-5 h-5" style={{color:accentColor}}/>}</div>
          <div><h3 className="font-semibold" style={{color:'var(--text-primary)'}}>{isLocked?t('unlockChat'):t('lockChat')}</h3><p className="text-xs" style={{color:'var(--text-muted)'}}>{conv.title}</p></div>
        </div>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="••••" maxLength={4} className="w-full text-center text-2xl tracking-[0.5em] p-3 rounded-xl outline-none mb-2" style={{background:'var(--bg-surface2)',color:'var(--text-primary)',border:`1.5px solid ${error?'#ef4444':'var(--border-color)'}`}} onKeyDown={e=>e.key==='Enter'&&handleSubmit()}/>
        {error&&<p className="text-xs text-center mb-3" style={{color:'#ef4444'}}>{error}</p>}
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl font-medium text-sm" style={{background:'var(--bg-surface2)',color:'var(--text-secondary)'}}>{t('cancel')}</button>
          <button onClick={handleSubmit} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white" style={{background:accentColor}}>{isLocked?t('unlockChat'):t('lockChat')}</button>
        </div>
      </div>
    </div>
  );
}

/* ─── Settings Panel ─── */
function SettingsPanel({ settings, onUpdate, onClose, canInstallPWA, onInstallPWA, onExportAll, memoryFacts, onAddMemory, onDeleteMemory, onResetMemory, stickyNotes, onAddNote, onDeleteNote, onUpdateNote, t, onToast, onLogout, onResetToDefaultMemory }: {
  settings:AppSettings; onUpdate:(s:Partial<AppSettings>)=>void; onClose:()=>void; canInstallPWA:boolean; onInstallPWA:()=>void; onExportAll:()=>void;
  memoryFacts:MemoryFact[]; onAddMemory:(k:string,v:string)=>void; onDeleteMemory:(id:string)=>void; onResetMemory:()=>void;
  stickyNotes:StickyNote[]; onAddNote:()=>void; onDeleteNote:(id:string)=>void; onUpdateNote:(id:string,c:string)=>void;
  t:(k:string)=>string; onToast:(msg:string)=>void; onLogout:()=>void; onResetToDefaultMemory:()=>void;
}) {
  const [bgInput, setBgInput] = useState(settings.bgUrl);
  const [activeTab, setActiveTab] = useState<'general'|'appearance'|'more'>('general');
  const [expandedSections, setExpandedSections] = useState<Record<string,boolean>>({ colorThemes:true,customAccent:false,customBubble:false,background:true,bubbleStyle:false,fontSize:false,features:true,about:false,memory:true,stickyNotes:true });
  const [memKey, setMemKey] = useState(''); const [memVal, setMemVal] = useState(''); const [showMemAdd, setShowMemAdd] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState(settings.apiKey);
  const [apiKeyError, setApiKeyError] = useState('');
  const accentRgb=hexToRgb(settings.accentColor);
  const currentTheme=COLOR_THEMES.find(th=>th.id===settings.colorThemeId)||COLOR_THEMES[0];
  const toggleSection=(key:string)=>setExpandedSections(p=>({...p,[key]:!p[key]}));
  const applyColorTheme=(themeId:string)=>{ const theme=COLOR_THEMES.find(th=>th.id===themeId); if(theme) onUpdate({colorThemeId:themeId,accentColor:theme.accent,userBubbleColor:theme.bubble,useCustomAccent:false,useCustomBubble:false}); };
  const resetAll=()=>{ onUpdate(DEFAULT_SETTINGS); setBgInput(''); };
  const PRESET_COLORS=['#191970','#0077b6','#2d6a4f','#e85d04','#7b2cbf','#db2777','#6366f1','#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
  const BORDER_RADIUS_OPTIONS=[{value:'0.25rem',label:'Sharp'},{value:'0.5rem',label:'Rounded'},{value:'1rem',label:'More Rounded'},{value:'1.5rem',label:'Pill'},{value:'1rem 1rem 0.25rem 1rem',label:'Chat Style'}];
  const AUTO_DELETE_OPTIONS=[{value:0,label:t('never')},{value:7,label:`7 ${t('days')}`},{value:30,label:`30 ${t('days')}`},{value:90,label:`90 ${t('days')}`}];
  const TABS = [
    { id:'general' as const, label: t('tabGeneral'), icon: Settings },
    { id:'appearance' as const, label: t('tabAppearance'), icon: Palette },
    { id:'more' as const, label: t('tabMore'), icon: Zap },
  ];

  const validateApiKey = () => {
    if (isValidApiKey(apiKeyInput)) {
      onUpdate({ apiKey: apiKeyInput, apiKeyValidated: true });
      setApiKeyError('');
      onToast(t('apiKeyValid'));
    } else {
      setApiKeyError(t('apiKeyInvalid'));
      onUpdate({ apiKeyValidated: false });
    }
  };

  // Get memory facts to display (including default if enabled)
  const displayedMemoryFacts = settings.useDefaultMemory 
    ? [...DEFAULT_MEMORY_FACTS, ...memoryFacts.filter(f => f.source !== 'default')]
    : memoryFacts;
  const defaultMemoryCount = DEFAULT_MEMORY_FACTS.length;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-end" onClick={onClose}>
      <div className="absolute inset-0" style={{background:'rgba(0,0,0,0.4)',backdropFilter:'blur(4px)'}}/>
      <div className="settings-panel relative z-10 w-full max-w-sm h-full flex flex-col shadow-2xl" style={{background:'var(--bg-surface)',borderLeft:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between p-4 border-b glass-effect" style={{borderColor:'var(--border-color)'}}>
          <div className="flex items-center gap-2"><Settings className="w-4 h-4" style={{color:settings.accentColor}}/><span className="font-semibold" style={{color:'var(--text-primary)'}}>{t('settings')}</span></div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:opacity-70" style={{color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b" style={{borderColor:'var(--border-color)'}}>
          {TABS.map(tab=>(
            <button key={tab.id} onClick={()=>setActiveTab(tab.id)} className="flex-1 flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors" style={{color:activeTab===tab.id?settings.accentColor:'var(--text-muted)',borderBottom:activeTab===tab.id?`2px solid ${settings.accentColor}`:'2px solid transparent',background:'transparent'}}>
              <tab.icon className="w-4 h-4"/>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* ── API Key Section (always visible) ── */}
          <div className="rounded-xl p-3" style={{background:settings.apiKeyValidated ? `rgba(${hexToRgb(settings.accentColor)},0.1)` : 'var(--bg-surface2)', border: apiKeyError ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border-color)'}}>
            <div className="flex items-center gap-2 mb-2">
              <Key className="w-4 h-4" style={{color:settings.accentColor}}/>
              <span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('apiKeySettings')}</span>
              {settings.apiKeyValidated && <Check className="w-3.5 h-3.5" style={{color:'#10b981'}}/>}
            </div>
            <p className="text-[11px] mb-2" style={{color:'var(--text-muted)'}}>{t('apiKeyDesc')}</p>
            <div className="flex gap-2">
              <input 
                type="password" 
                value={apiKeyInput} 
                onChange={e=>{setApiKeyInput(e.target.value); setApiKeyError('');}}
                placeholder={t('apiKeyPlaceholder')}
                className="flex-1 text-xs px-3 py-2 rounded-lg outline-none"
                style={{background:'var(--bg-surface3)',color:'var(--text-primary)',border: apiKeyError ? '1px solid #ef4444' : '1px solid var(--border-color)'}}
              />
              <button 
                onClick={validateApiKey}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white transition-colors"
                style={{background:settings.accentColor}}
              >
                {t('validateKey')}
              </button>
            </div>
            {apiKeyError && <p className="text-[10px] mt-1 flex items-center gap-1" style={{color:'#ef4444'}}><AlertTriangle className="w-3 h-3"/>{apiKeyError}</p>}
            {settings.apiKeyValidated && <p className="text-[10px] mt-1 flex items-center gap-1" style={{color:'#10b981'}}><Shield className="w-3 h-3"/>{t('keyValidated')}</p>}
          </div>

          {/* ── TAB: GENERAL ── */}
          {activeTab==='general' && <>
            {/* Theme Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--bg-surface2)'}}>
              <div className="flex items-center gap-2">{settings.theme==='dark'?<Moon className="w-4 h-4" style={{color:settings.accentColor}}/>:<Sun className="w-4 h-4" style={{color:settings.accentColor}}/>}<span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{settings.theme==='dark'?'Dark Mode':'Light Mode'}</span></div>
              <button onClick={()=>onUpdate({theme:settings.theme==='dark'?'light':'dark'})} className="w-11 h-6 rounded-full p-0.5 transition-colors" style={{background:settings.theme==='dark'?settings.accentColor:'var(--bg-surface3)'}}><div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{transform:settings.theme==='dark'?'translateX(20px)':'translateX(0)'}}/></button>
            </div>

            {/* Language */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--bg-surface2)'}}>
              <div className="flex items-center gap-2"><Globe className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('language')}</span></div>
              <div className="flex gap-1">
                {(['id','en'] as const).map(lang=>(
                  <button key={lang} onClick={()=>onUpdate({language:lang})} className="px-3 py-1 rounded-lg text-xs font-medium transition-colors" style={{background:settings.language===lang?settings.accentColor:'var(--bg-surface3)',color:settings.language===lang?'white':'var(--text-secondary)'}}>
                    {lang==='id'?'🇮🇩 ID':'🇬🇧 EN'}
                  </button>
                ))}
              </div>
            </div>

            {/* Font Size */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('fontSize')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Type className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('fontSize')}</span></div>
                {expandedSections.fontSize?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.fontSize&&<div className="px-3 pb-3"><div className="flex gap-2">{(Object.keys(FONT_SIZES) as Array<keyof typeof FONT_SIZES>).map(key=>(
                <button key={key} onClick={()=>onUpdate({fontSize:key})} className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors" style={{background:settings.fontSize===key?settings.accentColor:'var(--bg-surface3)',color:settings.fontSize===key?'white':'var(--text-secondary)'}}>{FONT_SIZES[key].label}</button>
              ))}</div></div>}
            </div>

            {/* Default Memory Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl" style={{background:'var(--bg-surface2)'}}>
              <div>
                <div className="flex items-center gap-2">
                  <BrainIcon className="w-4 h-4" style={{color:settings.accentColor}}/>
                  <span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('useDefaultMemory')}</span>
                </div>
                <p className="text-[10px] mt-0.5" style={{color:'var(--text-muted)'}}>{t('useDefaultMemoryDesc')} ({defaultMemoryCount} facts)</p>
              </div>
              <button onClick={()=>onUpdate({useDefaultMemory:!settings.useDefaultMemory})} className="w-11 h-6 rounded-full p-0.5 transition-colors" style={{background:settings.useDefaultMemory?settings.accentColor:'var(--bg-surface3)'}}>
                <div className="w-5 h-5 rounded-full bg-white shadow transition-transform" style={{transform:settings.useDefaultMemory?'translateX(20px)':'translateX(0)'}}/>
              </button>
            </div>

            {/* Features Toggles */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('features')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Zap className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('features')}</span></div>
                {expandedSections.features?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.features&&<div className="px-3 pb-3 space-y-2.5">
                {[
                  {key:'ttsEnabled',icon:Volume2,label:t('tts'),desc:t('ttsDesc')},
                  {key:'autoSaveDrafts',icon:FileText,label:t('autoSave'),desc:t('autoSaveDesc')},
                  {key:'showQuickActions',icon:Zap,label:t('quickActions'),desc:t('quickActionsDesc')},
                  {key:'notifSound',icon:Bell,label:t('notifSound'),desc:t('notifSoundDesc')},
                  {key:'showBookmarks',icon:Bookmark,label:t('bookmarksToggle'),desc:t('bookmarksDesc')},
                ].map(({key,icon:Icon,label,desc})=>(
                  <div key={key} className="flex items-center justify-between p-2.5 rounded-xl" style={{background:'var(--bg-surface3)'}}><div className="flex items-center gap-2"><Icon className="w-4 h-4" style={{color:settings.accentColor}}/><div><p className="text-xs font-medium" style={{color:'var(--text-primary)'}}>{label}</p><p className="text-[10px]" style={{color:'var(--text-muted)'}}>{desc}</p></div></div><button onClick={()=>onUpdate({[key]:!settings[key as keyof AppSettings]})} className="w-10 h-5 rounded-full p-0.5 transition-colors" style={{background:settings[key as keyof AppSettings]?settings.accentColor:'var(--bg-surface2)'}}><div className="w-4 h-4 rounded-full bg-white shadow transition-transform" style={{transform:settings[key as keyof AppSettings]?'translateX(20px)':'translateX(0)'}}/></button></div>
                ))}
                {/* Auto Delete */}
                <div className="p-2.5 rounded-xl" style={{background:'var(--bg-surface3)'}}>
                  <p className="text-xs font-medium mb-2" style={{color:'var(--text-primary)'}}>{t('autoDelete')}</p>
                  <div className="grid grid-cols-2 gap-1">{AUTO_DELETE_OPTIONS.map(opt=><button key={opt.value} onClick={()=>onUpdate({autoDeleteDays:opt.value})} className="py-1.5 rounded-lg text-[10px] font-medium transition-colors" style={{background:settings.autoDeleteDays===opt.value?settings.accentColor:'var(--bg-surface2)',color:settings.autoDeleteDays===opt.value?'white':'var(--text-secondary)'}}>{opt.label}</button>)}</div>
                </div>
              </div>}
            </div>

            {/* Export All + PWA Install */}
            <button onClick={onExportAll} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium transition-colors" style={{background:`rgba(${accentRgb},0.12)`,color:settings.accentColor}}><Download className="w-4 h-4"/>{t('exportAll')}</button>
            {canInstallPWA && <button onClick={onInstallPWA} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium text-white transition-colors" style={{background:`linear-gradient(135deg, ${settings.accentColor}, ${adjustColor(settings.accentColor,40)})`}}><Smartphone className="w-4 h-4"/>{t('installApp')}</button>}
            <button onClick={resetAll} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium transition-colors" style={{background:'var(--bg-surface2)',color:'var(--text-muted)'}}><RotateCcw className="w-4 h-4"/>{t('resetDefaults')}</button>
            
            {/* Logout Button */}
            <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl text-sm font-medium transition-colors" style={{background:'rgba(239,68,68,0.1)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.2)'}}>
              <LogOut className="w-4 h-4"/>{t('logout')}
            </button>
          </>}

          {/* ── TAB: APPEARANCE ── */}
          {activeTab==='appearance' && <>
            {/* Color Themes */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('colorThemes')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Palette className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('colorTheme')}</span><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${accentRgb},0.12)`,color:settings.accentColor}}>{settings.useCustomAccent?'🎨 Custom':`${currentTheme.emoji} ${currentTheme.name}`}</span></div>
                {expandedSections.colorThemes?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.colorThemes&&<div className="px-3 pb-3 space-y-2"><p className="text-[11px] mb-2" style={{color:'var(--text-muted)'}}>{t('changesAllColors')}</p><div className="grid grid-cols-2 gap-2">{COLOR_THEMES.map(theme=>(
                <button key={theme.id} onClick={()=>applyColorTheme(theme.id)} className="relative p-3 rounded-xl text-left transition-all" style={{background:settings.colorThemeId===theme.id&&!settings.useCustomAccent?`rgba(${hexToRgb(theme.accent)},0.15)`:'var(--bg-surface3)',border:settings.colorThemeId===theme.id&&!settings.useCustomAccent?`2px solid ${theme.accent}`:'2px solid transparent'}}>
                  <div className="flex items-center gap-2 mb-1"><span className="text-lg">{theme.emoji}</span><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{theme.name}</span></div>
                  <div className="flex gap-1"><span className="w-4 h-4 rounded-full" style={{background:theme.accent}}/><span className="w-4 h-4 rounded-full" style={{background:theme.bubble}}/><span className="w-4 h-4 rounded-full" style={{background:theme.dark.bgSurface}}/></div>
                  {settings.colorThemeId===theme.id&&!settings.useCustomAccent&&<div className="absolute top-2 right-2"><Check className="w-3.5 h-3.5" style={{color:theme.accent}}/></div>}
                </button>
              ))}</div></div>}
            </div>

            {/* Custom Accent */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('customAccent')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Palette className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('customAccent')}</span>{settings.useCustomAccent&&<span className="w-4 h-4 rounded-full" style={{background:settings.customAccentColor,border:'2px solid white'}}/>}</div>
                {expandedSections.customAccent?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.customAccent&&<div className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between"><span className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>{t('useCustomAccentLabel')}</span><button onClick={()=>onUpdate({useCustomAccent:!settings.useCustomAccent,accentColor:!settings.useCustomAccent?settings.customAccentColor:currentTheme.accent})} className="w-10 h-5 rounded-full p-0.5 transition-colors" style={{background:settings.useCustomAccent?settings.accentColor:'var(--bg-surface3)'}}><div className="w-4 h-4 rounded-full bg-white shadow transition-transform" style={{transform:settings.useCustomAccent?'translateX(20px)':'translateX(0)'}}/></button></div>
                <div className="flex flex-wrap gap-2">{PRESET_COLORS.map(color=><button key={color} onClick={()=>onUpdate({customAccentColor:color,accentColor:color,useCustomAccent:true})} className="w-7 h-7 rounded-lg transition-all hover:scale-110" style={{background:color,border:settings.customAccentColor===color&&settings.useCustomAccent?'3px solid white':'2px solid transparent',boxShadow:settings.customAccentColor===color&&settings.useCustomAccent?`0 0 10px ${color}`:'none'}}/>)}</div>
                <div className="flex gap-2 items-center"><input type="color" value={settings.customAccentColor} onChange={e=>onUpdate({customAccentColor:e.target.value,accentColor:e.target.value,useCustomAccent:true})} className="w-12 h-10 rounded-lg cursor-pointer border-0" style={{background:'transparent'}}/><input type="text" value={settings.customAccentColor} onChange={e=>{ if(/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onUpdate({customAccentColor:e.target.value,accentColor:e.target.value,useCustomAccent:true}); }} className="flex-1 text-xs px-3 py-2 rounded-lg outline-none font-mono uppercase" style={{background:'var(--bg-surface3)',color:'var(--text-primary)',border:'1px solid var(--border-color)'}}/></div>
                <div className="p-3 rounded-xl" style={{background:'var(--bg-surface3)'}}><p className="text-xs mb-2" style={{color:'var(--text-muted)'}}>{t('preview')}</p><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{background:`linear-gradient(135deg, ${settings.accentColor}, ${adjustColor(settings.accentColor,40)})`}}><Sparkles className="w-4 h-4 text-white"/></div><button className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{background:settings.accentColor}}>Button</button><span className="text-xs font-medium" style={{color:settings.accentColor}}>Link</span></div></div>
              </div>}
            </div>

            {/* Custom Bubble */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('customBubble')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('customBubble')}</span>{settings.useCustomBubble&&<span className="w-4 h-4 rounded" style={{background:settings.customBubbleColor,border:'2px solid white'}}/>}</div>
                {expandedSections.customBubble?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.customBubble&&<div className="px-3 pb-3 space-y-3">
                <div className="flex items-center justify-between"><span className="text-xs font-medium" style={{color:'var(--text-secondary)'}}>{t('useCustomBubbleLabel')}</span><button onClick={()=>onUpdate({useCustomBubble:!settings.useCustomBubble,userBubbleColor:!settings.useCustomBubble?settings.customBubbleColor:currentTheme.bubble})} className="w-10 h-5 rounded-full p-0.5 transition-colors" style={{background:settings.useCustomBubble?settings.accentColor:'var(--bg-surface3)'}}><div className="w-4 h-4 rounded-full bg-white shadow transition-transform" style={{transform:settings.useCustomBubble?'translateX(20px)':'translateX(0)'}}/></button></div>
                <div><p className="text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>{t('bubbleColor')}</p><div className="flex flex-wrap gap-2">{PRESET_COLORS.map(color=><button key={color} onClick={()=>onUpdate({customBubbleColor:color,userBubbleColor:color,useCustomBubble:true})} className="w-7 h-7 rounded-lg transition-all hover:scale-110" style={{background:color,border:settings.customBubbleColor===color&&settings.useCustomBubble?'3px solid white':'2px solid transparent'}}/>)}</div><div className="flex gap-2 items-center mt-2"><input type="color" value={settings.customBubbleColor} onChange={e=>onUpdate({customBubbleColor:e.target.value,userBubbleColor:e.target.value,useCustomBubble:true})} className="w-12 h-10 rounded-lg cursor-pointer border-0" style={{background:'transparent'}}/><input type="text" value={settings.customBubbleColor} onChange={e=>{ if(/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) onUpdate({customBubbleColor:e.target.value,userBubbleColor:e.target.value,useCustomBubble:true}); }} className="flex-1 text-xs px-3 py-2 rounded-lg outline-none font-mono uppercase" style={{background:'var(--bg-surface3)',color:'var(--text-primary)',border:'1px solid var(--border-color)'}}/></div></div>
                <div><p className="text-xs font-medium mb-2" style={{color:'var(--text-secondary)'}}>{t('borderRadius')}</p><div className="grid grid-cols-3 gap-2">{BORDER_RADIUS_OPTIONS.map(opt=><button key={opt.value} onClick={()=>onUpdate({customBubbleBorderRadius:opt.value,useCustomBubble:true})} className="py-1.5 px-2 rounded-lg text-[10px] font-medium transition-all" style={{background:settings.customBubbleBorderRadius===opt.value?settings.accentColor:'var(--bg-surface3)',color:settings.customBubbleBorderRadius===opt.value?'white':'var(--text-secondary)'}}>{opt.label}</button>)}</div></div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('shadow')}</span><button onClick={()=>onUpdate({customBubbleShadow:!settings.customBubbleShadow,useCustomBubble:true})} className="w-10 h-5 rounded-full p-0.5 transition-colors" style={{background:settings.customBubbleShadow?settings.accentColor:'var(--bg-surface3)'}}><div className="w-4 h-4 rounded-full bg-white shadow transition-transform" style={{transform:settings.customBubbleShadow?'translateX(20px)':'translateX(0)'}}/></button></div>
                  <div className="flex items-center justify-between"><span className="text-xs" style={{color:'var(--text-secondary)'}}>{t('border')}</span><button onClick={()=>onUpdate({customBubbleBorder:!settings.customBubbleBorder,useCustomBubble:true})} className="w-10 h-5 rounded-full p-0.5 transition-colors" style={{background:settings.customBubbleBorder?settings.accentColor:'var(--bg-surface3)'}}><div className="w-4 h-4 rounded-full bg-white shadow transition-transform" style={{transform:settings.customBubbleBorder?'translateX(20px)':'translateX(0)'}}/></button></div>
                </div>
                <div className="p-3 rounded-xl" style={{background:'var(--bg-surface3)'}}><p className="text-xs mb-2" style={{color:'var(--text-muted)'}}>{t('preview')}</p><div className="flex justify-end"><div className="text-white text-xs px-3 py-2" style={{background:settings.useCustomBubble?settings.customBubbleColor:settings.userBubbleColor,borderRadius:settings.useCustomBubble?settings.customBubbleBorderRadius:'1rem',boxShadow:settings.customBubbleShadow?`0 4px 20px rgba(${hexToRgb(settings.useCustomBubble?settings.customBubbleColor:settings.userBubbleColor)},0.35)`:'none',border:settings.customBubbleBorder?'1px solid rgba(255,255,255,0.2)':'none'}}>Hello! Preview.</div></div></div>
              </div>}
            </div>

            {/* Background */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('background')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Image className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('background')}</span></div>
                {expandedSections.background?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.background&&<div className="px-3 pb-3 space-y-3">
                <p className="text-[11px]" style={{color:'var(--text-muted)'}}>{t('defaultIsGrid')}</p>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={()=>{onUpdate({bgUrl:''});setBgInput('');}} className="relative aspect-video rounded-lg overflow-hidden transition-all" style={{background:'var(--bg-surface3)',border:!settings.bgUrl?`2px solid ${settings.accentColor}`:'2px solid transparent',backgroundImage:'linear-gradient(var(--grid-large) 1px, transparent 1px), linear-gradient(90deg, var(--grid-large) 1px, transparent 1px)',backgroundSize:'10px 10px'}}>
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-medium" style={{color:'var(--text-muted)'}}>Grid</span>
                    {!settings.bgUrl&&<Check className="absolute top-0.5 right-0.5 w-2.5 h-2.5" style={{color:settings.accentColor}}/>}
                  </button>
                  {BG_TEMPLATES.map(bg=>(
                    <button key={bg.id} onClick={()=>{onUpdate({bgUrl:bg.url});setBgInput(bg.url);}} className="relative aspect-video rounded-lg overflow-hidden transition-all" style={{border:settings.bgUrl===bg.url?`2px solid ${settings.accentColor}`:'2px solid transparent'}}>
                      <img src={bg.preview} alt={bg.name} className="w-full h-full object-cover"/>
                      <span className="absolute bottom-0 inset-x-0 text-[8px] font-medium text-white bg-black/50 py-0.5 text-center">{bg.name}</span>
                      {settings.bgUrl===bg.url&&<Check className="absolute top-0.5 right-0.5 w-2.5 h-2.5" style={{color:settings.accentColor}}/>}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2"><input type="text" value={bgInput} onChange={e=>setBgInput(e.target.value)} placeholder="https://..." className="flex-1 text-xs px-3 py-2 rounded-lg outline-none" style={{background:'var(--bg-surface3)',color:'var(--text-primary)',border:'1px solid var(--border-color)'}}/><button onClick={()=>onUpdate({bgUrl:bgInput})} className="px-3 py-2 rounded-lg text-xs font-medium text-white" style={{background:settings.accentColor}}>Apply</button></div>
              </div>}
            </div>

            {/* Bubble Style Templates */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('bubbleStyle')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('bubbleStyleTemplates')}</span><span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${accentRgb},0.12)`,color:settings.accentColor}}>{BUBBLE_STYLES.find(b=>b.id===settings.bubbleStyle)?.name}</span></div>
                {expandedSections.bubbleStyle?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.bubbleStyle&&<div className="px-3 pb-3 space-y-2"><p className="text-[11px] mb-1" style={{color:'var(--text-muted)'}}>{t('quickStyles')}</p>{BUBBLE_STYLES.map(style=>(
                <button key={style.id} onClick={()=>onUpdate({bubbleStyle:style.id as 'classic'|'modern'|'minimal',useCustomBubble:false})} className="w-full flex items-center gap-3 p-3 rounded-xl transition-all" style={{background:settings.bubbleStyle===style.id&&!settings.useCustomBubble?`rgba(${accentRgb},0.12)`:'var(--bg-surface3)',border:settings.bubbleStyle===style.id&&!settings.useCustomBubble?`2px solid ${settings.accentColor}`:'2px solid transparent'}}>
                  <div className="text-white text-[11px] px-3 py-1.5" style={{background:settings.userBubbleColor,borderRadius:style.borderRadius,boxShadow:`${style.shadow} rgba(${hexToRgb(settings.userBubbleColor)},0.3)`,border:style.border||'none'}}>Preview</div>
                  <div className="text-left"><p className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{style.emoji} {style.name}</p><p className="text-[11px]" style={{color:'var(--text-muted)'}}>{style.desc}</p></div>
                  {settings.bubbleStyle===style.id&&!settings.useCustomBubble&&<Check className="ml-auto w-4 h-4" style={{color:settings.accentColor}}/>}
                </button>
              ))}</div>}
            </div>
          </>}

          {/* ── TAB: MORE ── */}
          {activeTab==='more' && <>
 
            {/* Sticky Notes */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('stickyNotes')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4 h-4" style={{color:settings.accentColor}}/>
                  <span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('stickyNotes')}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full" style={{background:`rgba(${accentRgb},0.12)`,color:settings.accentColor}}>{stickyNotes.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e=>{e.stopPropagation();onAddNote();}} className="p-1 rounded-lg" style={{color:settings.accentColor,background:`rgba(${accentRgb},0.1)`}}><Plus className="w-3.5 h-3.5"/></button>
                  {expandedSections.stickyNotes?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
                </div>
              </button>
              {expandedSections.stickyNotes&&<div className="px-3 pb-3 space-y-2">
                {stickyNotes.length===0?<p className="text-xs py-4 text-center" style={{color:'var(--text-muted)'}}>{t('newNote')}</p>:stickyNotes.map(note=>(
                  <div key={note.id} className="relative rounded-xl p-2.5" style={{background:note.color}}>
                    <textarea value={note.content} onChange={e=>onUpdateNote(note.id,e.target.value)} placeholder={t('notePlaceholder')} className="w-full bg-transparent text-xs outline-none resize-none" style={{color:'var(--text-primary)',minHeight:56}}/>
                    <button onClick={()=>onDeleteNote(note.id)} className="absolute top-1.5 right-1.5 p-1 rounded opacity-60 hover:opacity-100" style={{color:'var(--text-muted)'}}><X className="w-3 h-3"/></button>
                  </div>
                ))}
              </div>}
            </div>

            {/* About */}
            <div className="rounded-xl overflow-hidden" style={{background:'var(--bg-surface2)'}}>
              <button onClick={()=>toggleSection('about')} className="w-full flex items-center justify-between p-3 text-left">
                <div className="flex items-center gap-2"><Sparkles className="w-4 h-4" style={{color:settings.accentColor}}/><span className="text-sm font-medium" style={{color:'var(--text-primary)'}}>{t('about')}</span></div>
                {expandedSections.about?<ChevronUp className="w-4 h-4" style={{color:'var(--text-muted)'}}/>:<ChevronDown className="w-4 h-4" style={{color:'var(--text-muted)'}}/>}
              </button>
              {expandedSections.about&&<div className="px-3 pb-3 space-y-3">
                <div className="flex items-center gap-3"><div className="w-12 h-12 rounded-2xl flex items-center justify-center"><div className="rounded-3xl flex items-center justify-center animate-spin-slow" style={{animation: 'spin 3s linear infinite'}}><img src="https://files.catbox.moe/pr9eng.png" alt="icon" className="w-10 h-10 object-contain" /></div></div><div><p className="font-bold text-lg" style={{color:'var(--text-primary)'}}>BlueGPT</p><p className="text-xs" style={{color:'var(--text-muted)'}}>v{APP_VERSION} · {BUILD_DATE}</p></div></div>
                <div className="text-xs space-y-1.5" style={{color:'var(--text-secondary)'}}>
                  <p>{t('apiInfo')}</p><p className="leading-relaxed"><strong>Founder:</strong> EpanDLabs</p>
                </div>
              </div>}
            </div>
          </>}

        </div>
      </div>
    </div>
  );
}

// Helper toast function
let setToastGlobal: ((msg: string | null) => void) | null = null;

/* ─── Main App ─── */
export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>(()=>hydrateConversations(loadFromLS(LS_KEYS.conversations,[])));
  const [activeConvId, setActiveConvId] = useState<string>(()=>loadFromLS(LS_KEYS.activeConv,''));
  const [settings, setSettings] = useState<AppSettings>(()=>({...DEFAULT_SETTINGS,...loadFromLS(LS_KEYS.settings,{})}));
  const [memoryFacts, setMemoryFacts] = useState<MemoryFact[]>(()=>{
    const loaded = hydrateMemory(loadFromLS(LS_KEYS.memory,[]));
    // Filter out default facts from saved if useDefaultMemory is false
    return loaded;
  });
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>(()=>loadFromLS(LS_KEYS.stickyNotes,[]));
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [toast, setToast] = useState<string|null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [editingConvId, setEditingConvId] = useState<string|null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [typingText, setTypingText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [editingMsgId, setEditingMsgId] = useState<string|null>(null);
  const [editingMsgContent, setEditingMsgContent] = useState('');
  const [speakingMsgId, setSpeakingMsgId] = useState<string|null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [swipeState, setSwipeState] = useState<{id:string;offset:number}|null>(null);
  const [currentModel, setCurrentModel] = useState<'gpt'|'gpt-backup'>('gpt');
  const [lockingConv, setLockingConv] = useState<Conversation|null>(null);
  const [lockedConvAttempt, setLockedConvAttempt] = useState<string|null>(null);
  
  // Login state
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    const sessionAuth = sessionStorage.getItem('bluegpt_authenticated');
    return sessionAuth === 'true';
  });
  const [lockScreenEnabled, setLockScreenEnabled] = useState(() => {
    const saved = localStorage.getItem('bluegpt_lock_screen_enabled');
    return saved !== null ? saved === 'true' : true;
  });

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognition|null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchStartRef = useRef<{x:number;y:number}|null>(null);

  const isMobile = useIsMobile();
  const { canInstall, install } = usePWAInstall();
  const { state: rateLimit, consumeTokens, formatResetIn } = useRateLimit();

  // Helper to get active memory facts (including default if enabled)
  const getActiveMemoryFacts = useCallback((): MemoryFact[] => {
    const userFacts = memoryFacts.filter(f => f.source !== 'default');
    if (settings.useDefaultMemory) {
      return [...DEFAULT_MEMORY_FACTS, ...userFacts];
    }
    return userFacts;
  }, [memoryFacts, settings.useDefaultMemory]);

  // Save lock screen preference
  useEffect(() => {
    localStorage.setItem('bluegpt_lock_screen_enabled', String(lockScreenEnabled));
  }, [lockScreenEnabled]);

  // Set global toast
  useEffect(() => { setToastGlobal = setToast; return () => { setToastGlobal = null; }; }, []);

  // Reset to default memory
  const resetToDefaultMemory = () => {
    const userFacts = memoryFacts.filter(f => f.source !== 'default');
    setMemoryFacts(userFacts);
    setSettings(prev => ({ ...prev, useDefaultMemory: true }));
    setToast(t('memoryReset'));
  };

  const t = useCallback((key: string): string => {
    const lang: 'id'|'en' = settings.language==='en'?'en':'id';
    const dict = TRANSLATIONS[lang] as Record<string,string>;
    return dict[key] ?? (TRANSLATIONS.en[key as keyof typeof TRANSLATIONS.en] ?? key);
  }, [settings.language]);

  const activeConv = conversations.find(c=>c.id===activeConvId);
  const messages = activeConv?.messages || [];
  const accentRgb = hexToRgb(settings.accentColor);
  const pinnedCount = messages.filter(m=>m.pinned).length;
  const bookmarkCount = conversations.reduce((s,c)=>s+c.messages.filter(m=>m.bookmarked).length,0);
  const speechSupported = typeof window!=='undefined'&&('SpeechRecognition' in window||'webkitSpeechRecognition' in window);

  // Check if API key is validated
  const isApiValid = settings.apiKeyValidated;

  // Login handlers
  const handleLogin = (password: string) => {
    setIsAuthenticated(true);
    sessionStorage.setItem('bluegpt_authenticated', 'true');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('bluegpt_authenticated');
    setSettingsOpen(false);
  };

  // Apply theme
  useEffect(()=>{
    const theme=COLOR_THEMES.find(t=>t.id===settings.colorThemeId)||COLOR_THEMES[0];
    applyThemeVariables(theme,settings.theme);
    document.documentElement.setAttribute('data-theme',settings.theme);
    document.documentElement.style.setProperty('--chat-font-size',FONT_SIZES[settings.fontSize].css);
  },[settings.colorThemeId,settings.theme,settings.fontSize]);

  // Save to LS - filter out default facts when saving
  useEffect(()=>{
    const toSave = memoryFacts.filter(f => f.source !== 'default');
    saveToLS(LS_KEYS.memory,toSave);
  },[memoryFacts]);
  useEffect(()=>saveToLS(LS_KEYS.conversations,conversations),[conversations]);
  useEffect(()=>saveToLS(LS_KEYS.settings,settings),[settings]);
  useEffect(()=>saveToLS(LS_KEYS.activeConv,activeConvId),[activeConvId]);
  useEffect(()=>saveToLS(LS_KEYS.stickyNotes,stickyNotes),[stickyNotes]);

  // Auto-delete old chats
  useEffect(()=>{
    if (!settings.autoDeleteDays) return;
    const cutoff=new Date(); cutoff.setDate(cutoff.getDate()-settings.autoDeleteDays);
    const toDelete=conversations.filter(c=>new Date(c.createdAt)<cutoff);
    if (toDelete.length>0) { setConversations(prev=>prev.filter(c=>new Date(c.createdAt)>=cutoff)); setToast(`${toDelete.length} ${t('chatsDeleted')}`); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Keyboard shortcuts
  useEffect(()=>{
    const handleKey=(e:KeyboardEvent)=>{
      if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();setShowSearch(true);}
      if((e.metaKey||e.ctrlKey)&&e.key==='e'&&activeConv){e.preventDefault();exportConversation();}
      if((e.metaKey||e.ctrlKey)&&e.key==='n'){e.preventDefault();createNewConversation();}
      if(e.key==='Escape'){setShowSearch(false);setSettingsOpen(false);setShowPinned(false);setShowPrompts(false);setShowBookmarks(false);}
    };
    window.addEventListener('keydown',handleKey); return ()=>window.removeEventListener('keydown',handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[activeConv]);

  // Scroll handling
  useEffect(()=>{
    const container=messagesContainerRef.current; if(!container) return;
    const handleScroll=()=>{ const {scrollTop,scrollHeight,clientHeight}=container; setShowScrollBtn(scrollHeight-scrollTop-clientHeight>100); };
    container.addEventListener('scroll',handleScroll); return ()=>container.removeEventListener('scroll',handleScroll);
  },[]);

  // Mobile sidebar
  useEffect(()=>{ if(isMobile) setSidebarOpen(false); else setSidebarOpen(true); },[isMobile]);

  const scrollToBottom=useCallback((smooth=true)=>{ messagesEndRef.current?.scrollIntoView({behavior:smooth?'smooth':'auto'}); },[]);
  useEffect(()=>{ scrollToBottom(); },[messages.length,typingText,scrollToBottom]);

  const updateSettings=(updates: Partial<AppSettings>)=>setSettings(prev=>({...prev,...updates}));

  const createNewConversation=()=>{
    const newConv:Conversation={id:generateId(),title:'New Chat',messages:[],createdAt:new Date()};
    setConversations(prev=>{
      const updated = [newConv, ...prev];
      return updated.slice(0, 5);
    }); 
    setActiveConvId(newConv.id); setInput('');
    if(isMobile) setSidebarOpen(false); sendToTelegram('new_conversation','New conversation created');
  };

  const deleteConversation=(id:string)=>{ const conv=conversations.find(c=>c.id===id); setConversations(prev=>prev.filter(c=>c.id!==id)); if(activeConvId===id) setActiveConvId(conversations[0]?.id||''); sendToTelegram('delete_conversation',conv?.title||''); };

  const selectConversation=(id:string)=>{
    const conv=conversations.find(c=>c.id===id);
    if(conv?.isLocked) { setLockedConvAttempt(id); return; }
    setActiveConvId(id); if(isMobile) setSidebarOpen(false);
  };

  // Auto-extract memory from AI response
  const autoExtractMemory=(content:string)=>{
    const nameMatch=content.match(/(?:your name is|you are|nama kamu adalah|kamu adalah)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i);
    if(nameMatch) {
      const exists=memoryFacts.some(f=>f.key.toLowerCase()==='name');
      if(!exists) setMemoryFacts(prev=>[...prev,{id:generateId(),key:'name',value:nameMatch[1],source:'auto',timestamp:new Date()}]);
    }
  };

  const sendMessage=async(content?: string, isRegenerate=false)=>{
    const text=content||input.trim(); if(!text||isLoading) return;
    
    if(!isApiValid) {
      setToast(t('apiKeyRequired'));
      setSettingsOpen(true);
      return;
    }
    
    if(rateLimit.isLimited) {
      setToast(settings.language==='id'
        ? `⛔ Batas token tercapai! Reset dalam ${formatResetIn(rateLimit.resetIn)}`
        : `⛔ Token limit reached! Resets in ${formatResetIn(rateLimit.resetIn)}`);
      return;
    }
    let convId=activeConvId; let currentConv=activeConv;
    if(!currentConv) {
      const newConv:Conversation={id:generateId(),title:text.slice(0,30)+(text.length>30?'…':''),messages:[],createdAt:new Date()};
      setConversations(prev=>{
        const updated = [newConv, ...prev];
        return updated.slice(0, 5);
      }); 
      setActiveConvId(newConv.id); convId=newConv.id; currentConv=newConv;
    }
    if(!isRegenerate) {
      const userMsg:Message={id:generateId(),role:'user',content:text,timestamp:new Date()};
      setConversations(prev=>prev.map(c=>c.id===convId?{...c,messages:[...c.messages,userMsg],title:c.messages.length===0?text.slice(0,30)+(text.length>30?'…':''):c.title}:c));
      sendToTelegram('user_message',text);
    } else { sendToTelegram('regenerate',`Regenerating: ${text}`); }
    setInput(''); setIsLoading(true); setTypingText(''); setIsTyping(false); setCurrentModel('gpt');

    const activeMemory = getActiveMemoryFacts();
    const memCtx = activeMemory.length>0 ? `[Context about user: ${activeMemory.map(f=>`${f.key}: ${f.value}`).join('\,')}]\n\n` : '';
    const sysPrompt = settings.systemPrompt || SYSTEM_PROMPT;
    const fullQuery = `${sysPrompt}\n\n${memCtx}${text}`;

    const startTime=Date.now();
    let aiContent=''; let usedModel:'gpt'|'gpt-backup'='gpt'; let success=false;
    try {
      try {
        const res=await fetch(`https://api.nexray.web.id/ai/gemini?text=${encodeURIComponent(fullQuery)}`);
        if(!res.ok) throw new Error('GPT error');
        const data=await res.json();
        const c=data.result||data.response||data.message||'';
        if(!c) throw new Error('Empty GPT');
        aiContent=c; usedModel='gpt'; success=true; setCurrentModel('gpt');
      } catch {
        try {
          const res2=await fetch(`https://api.nexray.web.id/ai/claude?text=${encodeURIComponent(fullQuery)}`);
          if(!res2.ok) throw new Error('GPT error');
          const data2=await res2.json();
          const c2=data2.result||data2.response||data2.message||'';
          if(!c2) throw new Error('Empty GPT Backup');
          aiContent=c2; usedModel='gpt-backup'; success=true; setCurrentModel('gpt-backup');
          setToast(settings.language==='id'?'Menggunakan GPT backup':'Switched to GPT backup');
        } catch { success=false; }
      }
      if(!success||!aiContent) throw new Error('All APIs failed');
      const responseTime=Date.now()-startTime;
      setIsTyping(true); let i=0;
      const typeInterval=setInterval(()=>{
        if(i<aiContent.length){ setTypingText(aiContent.slice(0,i+10)); i+=10; }
        else {
          clearInterval(typeInterval); setIsTyping(false); setTypingText('');
          const aiMsg:Message={id:generateId(),role:'assistant',content:aiContent,timestamp:new Date(),responseTime,model:usedModel};
          setConversations(prev=>prev.map(c=>c.id===convId?{...c,messages:[...c.messages,aiMsg]}:c));
          sendToTelegram('ai_response',`[${usedModel.toUpperCase()}] ${aiContent}`);
          autoExtractMemory(aiContent);
          consumeTokens(text + aiContent);
          if(settings.notifSound) playNotifSound(settings.accentColor);
        }
      },8);
    } catch {
      setIsTyping(false); setTypingText('');
      const errMsg:Message={id:generateId(),role:'assistant',content:settings.language==='id'?'Maaf, terjadi kesalahan. GPT dan GPT Backup tidak tersedia.':'Sorry, both GPT and GPT Backup are unavailable. Please try again.',timestamp:new Date(),model:'gpt'};
      setConversations(prev=>prev.map(c=>c.id===convId?{...c,messages:[...c.messages,errMsg]}:c));
    } finally { setIsLoading(false); }
  };

  const regenerateLastMessage=()=>{ if(!activeConv||activeConv.messages.length<2) return; const lastUser=[...activeConv.messages].reverse().find(m=>m.role==='user'); if(!lastUser) return; setConversations(prev=>prev.map(c=>c.id===activeConvId?{...c,messages:c.messages.slice(0,-1)}:c)); setTimeout(()=>sendMessage(lastUser.content,true),100); };
  const copyMessage=(content:string)=>{ navigator.clipboard.writeText(content); setToast(t('copied')); sendToTelegram('copy_message',content.slice(0,100)); };
  const likeMessage=(msgId:string,value:boolean|null)=>{ const msg=messages.find(m=>m.id===msgId); setConversations(prev=>prev.map(c=>c.id===activeConvId?{...c,messages:c.messages.map(m=>m.id===msgId?{...m,liked:value}:m)}:c)); if(value===true){setToast(t('likedMsg'));sendToTelegram('like',msg?.content?.slice(0,100)||'');}else if(value===false){setToast(t('dislikedMsg'));sendToTelegram('dislike',msg?.content?.slice(0,100)||'');} };
  const pinMessage=(msgId:string)=>{ const msg=messages.find(m=>m.id===msgId); const isPinned=msg?.pinned; setConversations(prev=>prev.map(c=>c.id===activeConvId?{...c,messages:c.messages.map(m=>m.id===msgId?{...m,pinned:!m.pinned}:m)}:c)); sendToTelegram(isPinned?'unpin':'pin',msg?.content?.slice(0,100)||''); };
  const bookmarkMessage=(convId:string,msgId:string)=>{ const conv=conversations.find(c=>c.id===convId); const msg=conv?.messages.find(m=>m.id===msgId); const isBookmarked=msg?.bookmarked; setConversations(prev=>prev.map(c=>c.id===convId?{...c,messages:c.messages.map(m=>m.id===msgId?{...m,bookmarked:!m.bookmarked}:m)}:c)); setToast(isBookmarked?t('bookmarkRemoved'):t('bookmarked')); };
  const addReaction=(msgId:string,emoji:string)=>{ setConversations(prev=>prev.map(c=>c.id===activeConvId?{...c,messages:c.messages.map(m=>{ if(m.id!==msgId) return m; const reactions:Record<string,Reaction>=m.reactions?{...m.reactions}:{}; if(reactions[emoji]?.userReacted){const count=(reactions[emoji].count||1)-1;if(count<=0){delete reactions[emoji];}else{reactions[emoji]={...reactions[emoji],count,userReacted:false};}}else{reactions[emoji]={emoji,count:(reactions[emoji]?.count||0)+1,userReacted:true};} return {...m,reactions}; })}:c)); };
  const exportMessage=(content:string)=>{ const blob=new Blob([content],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`message-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); setToast(t('msgExported')); sendToTelegram('export',content.slice(0,100)); };
  const exportConversation=()=>{ if(!activeConv) return; const text=activeConv.messages.map(m=>`[${m.role.toUpperCase()}] ${m.timestamp.toLocaleString()}\n${m.content}`).join('\n\n---\n\n'); const blob=new Blob([text],{type:'text/plain'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`${activeConv.title}-${Date.now()}.txt`; a.click(); URL.revokeObjectURL(url); setToast(t('exported')); sendToTelegram('export',`Conversation: ${activeConv.title}`); };
  const exportAllConversations=()=>{ const blob=new Blob([JSON.stringify(conversations,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=`chatai-backup-${Date.now()}.json`; a.click(); URL.revokeObjectURL(url); setToast(t('allExported')); };
  const handleKeyDown=(e:React.KeyboardEvent)=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage();} };
  const autoResize=(el:HTMLTextAreaElement)=>{ el.style.height='auto'; el.style.height=Math.min(el.scrollHeight,160)+'px'; };
  const handleSearchSelect=(convId:string,msgId:string)=>{ setActiveConvId(convId); setShowSearch(false); setTimeout(()=>{ const el=document.getElementById(`msg-${msgId}`); if(el){el.scrollIntoView({behavior:'smooth',block:'center'});el.classList.add('msg-highlight');setTimeout(()=>el.classList.remove('msg-highlight'),2000);} },100); };
  const startEditConv=(id:string,title:string)=>{ setEditingConvId(id); setEditingTitle(title); };
  const saveEditConv=()=>{ if(editingConvId&&editingTitle.trim()) setConversations(prev=>prev.map(c=>c.id===editingConvId?{...c,title:editingTitle.trim()}:c)); setEditingConvId(null); };
  const toggleVoice=()=>{
    if(!speechSupported) return;
    if(isListening){ recognitionRef.current?.stop(); setIsListening(false); return; }
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition; const r=new SR(); r.lang='id-ID'; r.interimResults=true; r.continuous=false;
    r.onresult=(e:SpeechRecognitionEvent)=>{ let tr=''; for(let i=0;i<e.results.length;i++) tr+=e.results[i][0].transcript; setInput(tr); sendToTelegram('voice_input',tr); };
    r.onend=()=>setIsListening(false); r.onerror=()=>setIsListening(false); r.start(); recognitionRef.current=r; setIsListening(true);
  };
  const speakMessage=(msgId:string,content:string)=>{ if(!('speechSynthesis' in window)) return; if(speakingMsgId===msgId){window.speechSynthesis.cancel();setSpeakingMsgId(null);return;} window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(content); u.lang='id-ID'; u.rate=1; u.pitch=1; u.onend=()=>setSpeakingMsgId(null); u.onerror=()=>setSpeakingMsgId(null); setSpeakingMsgId(msgId); window.speechSynthesis.speak(u); sendToTelegram('tts_play',content.slice(0,100)); };
  const startEditMessage=(msgId:string,content:string)=>{ setEditingMsgId(msgId); setEditingMsgContent(content); };
  const saveEditMessage=()=>{ if(!editingMsgId||!editingMsgContent.trim()||!activeConv) return; const idx=activeConv.messages.findIndex(m=>m.id===editingMsgId); if(idx===-1) return; setConversations(prev=>prev.map(c=>{ if(c.id!==activeConvId) return c; const nm=c.messages.slice(0,idx+1); nm[idx]={...nm[idx],content:editingMsgContent.trim()}; return {...c,messages:nm}; })); sendToTelegram('edit_message',editingMsgContent.trim()); setEditingMsgId(null); setEditingMsgContent(''); setTimeout(()=>sendMessage(editingMsgContent.trim(),true),100); };
  const cancelEditMessage=()=>{ setEditingMsgId(null); setEditingMsgContent(''); };
  const toggleFavorite=(convId:string)=>{ const conv=conversations.find(c=>c.id===convId); const isFav=conv?.isFavorite; setConversations(prev=>prev.map(c=>c.id===convId?{...c,isFavorite:!c.isFavorite}:c)); sendToTelegram(isFav?'unfavorite':'favorite',conv?.title||''); };
  const archiveConversation=(convId:string)=>{ setConversations(prev=>prev.map(c=>c.id===convId?{...c,isArchived:true,isFavorite:false}:c)); if(activeConvId===convId) setActiveConvId(conversations.find(c=>c.id!==convId&&!c.isArchived)?.id||''); setToast(t('chatArchived')); };
  const restoreConversation=(convId:string)=>{ setConversations(prev=>prev.map(c=>c.id===convId?{...c,isArchived:false}:c)); setToast(t('chatRestored')); };
  const clearChat=()=>{ if(!activeConvId) return; const conv=conversations.find(c=>c.id===activeConvId); setConversations(prev=>prev.map(c=>c.id===activeConvId?{...c,messages:[]}:c)); setShowClearConfirm(false); setToast(t('chatCleared')); sendToTelegram('clear_chat',conv?.title||''); };
  const handleImport=(e:React.ChangeEvent<HTMLInputElement>)=>{ const file=e.target.files?.[0]; if(!file) return; const reader=new FileReader(); reader.onload=(ev)=>{ try { const data=JSON.parse(ev.target?.result as string); if(Array.isArray(data)){const imported=hydrateConversations(data);setConversations(prev=>[...imported,...prev]);setToast(`${imported.length} ${t('importSuccess')}`);} } catch { setToast(t('importFail')); } }; reader.readAsText(file); e.target.value=''; };
  const printChat=()=>{ if(!activeConv) return; const html=`<html><head><title>${activeConv.title}</title><style>body{font-family:sans-serif;max-width:700px;margin:0 auto;padding:20px;}.user{text-align:right;margin:10px 0;}.ai{text-align:left;margin:10px 0;}.bubble{display:inline-block;padding:10px 16px;border-radius:12px;max-width:80%;}.user .bubble{background:#191970;color:white;}.ai .bubble{background:#f0f0f0;color:#111;}.meta{font-size:11px;color:#888;margin:2px 6px;}</style></head><body><h2>${activeConv.title}</h2>${activeConv.messages.map(m=>`<div class="${m.role==='user'?'user':'ai'}"><div class="meta">${m.role==='user'?'You':'AI'} · ${new Date(m.timestamp).toLocaleString()}</div><div class="bubble">${m.content.replace(/</g,'&lt;')}</div></div>`).join('')}</body></html>`; const w=window.open('','_blank'); if(w){w.document.write(html);w.document.close();w.print();} };

  // Swipe handlers
  const handleTouchStart=(e:React.TouchEvent,msgId:string)=>{ touchStartRef.current={x:e.touches[0].clientX,y:e.touches[0].clientY}; setSwipeState({id:msgId,offset:0}); };
  const handleTouchMove=(e:React.TouchEvent,msgId:string)=>{ if(!touchStartRef.current) return; const dx=e.touches[0].clientX-touchStartRef.current.x; const dy=Math.abs(e.touches[0].clientY-touchStartRef.current.y); if(dy>Math.abs(dx)) return; setSwipeState({id:msgId,offset:Math.max(-100,Math.min(100,dx))}); };
  const handleTouchEnd=(msgId:string,role:'user'|'assistant')=>{ if(!swipeState||swipeState.id!==msgId){setSwipeState(null);touchStartRef.current=null;return;} const offset=swipeState.offset; if(offset<-60){if(role==='user'){const msg=messages.find(m=>m.id===msgId);if(msg)startEditMessage(msgId,msg.content);}else{const msg=messages.find(m=>m.id===msgId);if(msg)copyMessage(msg.content);}}else if(offset>60){pinMessage(msgId);} setSwipeState(null); touchStartRef.current=null; };

  // Memory management
  const addMemoryFact=(key:string,value:string)=>{ setMemoryFacts(prev=>[...prev,{id:generateId(),key,value,source:'manual',timestamp:new Date()}]); setToast(t('memoryAdded')); };
  const deleteMemoryFact=(id:string)=>setMemoryFacts(prev=>prev.filter(f=>f.id!==id));
  const resetMemory=()=>{ setMemoryFacts(prev=>prev.filter(f=>f.source === 'default')); setSettings(prev => ({ ...prev, useDefaultMemory: true })); setToast(t('memoryReset')); };

  // Sticky notes
  const addStickyNote=()=>{ const color=NOTE_COLORS[stickyNotes.length%NOTE_COLORS.length]; setStickyNotes(prev=>[...prev,{id:generateId(),content:'',color,createdAt:new Date()}]); };
  const deleteStickyNote=(id:string)=>setStickyNotes(prev=>prev.filter(n=>n.id!==id));
  const updateStickyNote=(id:string,content:string)=>setStickyNotes(prev=>prev.map(n=>n.id===id?{...n,content}:n));

  // Chat lock
  const lockConversation=(convId:string,pin:string)=>{ setConversations(prev=>prev.map(c=>c.id===convId?{...c,isLocked:true,lockPin:pin}:c)); setToast(t('chatLocked')); };
  const unlockConversation=(convId:string,pin:string):boolean=>{ const conv=conversations.find(c=>c.id===convId); if(conv?.lockPin!==pin) return false; setConversations(prev=>prev.map(c=>c.id===convId?{...c,isLocked:false}:c)); setActiveConvId(convId); setLockedConvAttempt(null); setToast(t('unlocked')); return true; };

  // Auto-save draft
  useEffect(()=>{ if(settings.autoSaveDrafts&&input.trim()) saveToLS(LS_DRAFT_KEY,input); },[input,settings.autoSaveDrafts]);
  useEffect(()=>{ if(settings.autoSaveDrafts){const draft=loadFromLS<string>(LS_DRAFT_KEY,'');if(draft&&!input)setInput(draft);} },[]);

  const sortedConversations=[...conversations].filter(c=>!c.isArchived).sort((a,b)=>{if(a.isFavorite&&!b.isFavorite)return -1;if(!a.isFavorite&&b.isFavorite)return 1;return new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();});
  const archivedCount=conversations.filter(c=>c.isArchived).length;
  
  // Build messages with date separators
  const renderMessages=()=>{
    if(!messages.length) return null;
    const items:React.ReactNode[]=[];
    let lastDate='';
    messages.forEach((msg,idx)=>{
      const dateLabel=getDateLabel(msg.timestamp,settings.language);
      if(dateLabel!==lastDate){lastDate=dateLabel;items.push(<DateSeparator key={`sep-${msg.id}`} label={dateLabel} accentColor={settings.accentColor}/>);}
      const isLast=idx===messages.length-1;
      const swipeOffset=swipeState?.id===msg.id?swipeState.offset:0;
      const swipeBg=swipeOffset<-60?'rgba(239,68,68,0.15)':swipeOffset>60?`rgba(${hexToRgb(settings.accentColor)},0.15)`:'transparent';
      const bubbleStyle=BUBBLE_STYLES.find(s=>s.id===settings.bubbleStyle)||BUBBLE_STYLES[0];
      items.push(
        <div key={msg.id} id={`msg-${msg.id}`} className="animate-fade-in-up group relative overflow-hidden rounded-2xl transition-colors" style={{animationDelay:`${Math.min(idx*0.04,0.25)}s`,background:swipeBg}}>
          {isMobile&&swipeOffset!==0&&(
            <div className="absolute inset-y-0 flex items-center px-4 z-0" style={{left:swipeOffset<0?'auto':'0',right:swipeOffset<0?'0':'auto'}}>
              {swipeOffset<-60?<Copy className="w-5 h-5" style={{color:'#ef4444'}}/>:<Pin className="w-5 h-5" style={{color:settings.accentColor}}/>}
            </div>
          )}
          <div style={{transform:`translateX(${swipeOffset}px)`,transition:swipeOffset===0?'transform 0.2s ease':'none',position:'relative',zIndex:1}}
            onTouchStart={isMobile?e=>handleTouchStart(e,msg.id):undefined}
            onTouchMove={isMobile?e=>handleTouchMove(e,msg.id):undefined}
            onTouchEnd={isMobile?()=>handleTouchEnd(msg.id,msg.role):undefined}>
            {msg.role==='user'?(
              <div className="flex justify-end py-1">
                <div className="max-w-[85%] sm:max-w-[75%]">
                  {msg.pinned&&<div className="flex justify-end mb-1"><span className="text-[10px] flex items-center gap-1" style={{color:settings.accentColor}}><Pin className="w-2.5 h-2.5"/> Pinned</span></div>}
                  {msg.bookmarked&&<div className="flex justify-end mb-1"><span className="text-[10px] flex items-center gap-1" style={{color:'#f59e0b'}}><Bookmark className="w-2.5 h-2.5"/> Bookmarked</span></div>}
                  <div className="text-white" style={{background:settings.userBubbleColor,borderRadius:settings.useCustomBubble?settings.customBubbleBorderRadius:bubbleStyle.borderRadius,boxShadow:settings.useCustomBubble?(settings.customBubbleShadow?`0 4px 20px rgba(${hexToRgb(settings.userBubbleColor)},0.35)`:'none'):`${bubbleStyle.shadow} rgba(${hexToRgb(settings.userBubbleColor)},0.35)`,padding:settings.useCustomBubble?'0.75rem 1rem':bubbleStyle.padding,border:settings.useCustomBubble?(settings.customBubbleBorder?'1px solid rgba(255,255,255,0.2)':'none'):(bubbleStyle.border||'none')}}>
                    <p style={{fontSize:'var(--chat-font-size, 0.9375rem)',lineHeight:'1.6',whiteSpace:'pre-wrap'}}>{msg.content}</p>
                  </div>
                  {msg.reactions&&Object.keys(msg.reactions).length>0&&<div className="flex gap-1 mt-1 justify-end flex-wrap">{Object.values(msg.reactions).map(r=><button key={r.emoji} onClick={()=>addReaction(msg.id,r.emoji)} className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full transition-all" style={{background:r.userReacted?`rgba(${hexToRgb(settings.accentColor)},0.2)`:'var(--bg-surface2)',color:r.userReacted?settings.accentColor:'var(--text-secondary)',border:`1px solid ${r.userReacted?`rgba(${hexToRgb(settings.accentColor)},0.4)`:'var(--border-color)'}`}}><span>{r.emoji}</span>{r.count>1&&<span>{r.count}</span>}</button>)}</div>}
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <MessageActions msg={msg} onCopy={()=>copyMessage(msg.content)} onLike={v=>likeMessage(msg.id,v)} onExport={()=>exportMessage(msg.content)} onPin={()=>pinMessage(msg.id)} onEdit={()=>startEditMessage(msg.id,msg.content)} onReact={emoji=>addReaction(msg.id,emoji)} onBookmark={()=>bookmarkMessage(activeConvId,msg.id)} accentColor={settings.accentColor} ttsEnabled={settings.ttsEnabled} isMobile={isMobile} showBookmarks={settings.showBookmarks} t={t}/>
                    <p className="text-[11px]" style={{color:'var(--text-muted)'}}>{msg.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                </div>
              </div>
            ):(
              <div className="flex flex-col py-1">
                <div className="flex items-center gap-2 mb-2">
                  <img 
                    src="https://files.catbox.moe/pr9eng.png" 
                    alt="icon"
                    className="w-6 h-6 object-contain"
                      />
                  <span className="text-xs font-semibold" style={{color:settings.accentColor}}>Chat AI</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{background:msg.model==='gpt-backup'?'rgba(26,115,232,0.15)':`rgba(${accentRgb},0.1)`,color:msg.model==='gemini'?'#4a9eff':'var(--text-muted)',border:msg.model==='gemini'?'1px solid rgba(26,115,232,0.3)':`1px solid rgba(${accentRgb},0.15)`}}>{msg.model==='gemini'?'Gemini 3':'GPT'}</span>
                  <span className="text-[11px]" style={{color:'var(--text-muted)'}}>{msg.timestamp.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
                  {msg.responseTime&&<span className="text-[10px] flex items-center gap-0.5" style={{color:'var(--text-muted)'}}><Clock className="w-2.5 h-2.5"/>{formatDuration(msg.responseTime)}</span>}
                  <span className="text-[10px] flex items-center gap-0.5" style={{color:'var(--text-muted)'}}><Timer className="w-2.5 h-2.5"/>{getReadingTime(msg.content)} {t('readTime')}</span>
                  {msg.pinned&&<span className="text-[10px] flex items-center gap-1 ml-auto" style={{color:settings.accentColor}}><Pin className="w-2.5 h-2.5"/>Pinned</span>}
                  {msg.bookmarked&&<span className="text-[10px] flex items-center gap-1" style={{color:'#f59e0b'}}><Bookmark className="w-2.5 h-2.5"/></span>}
                </div>
                <div className="pl-8">
                  <div className="markdown-body" style={{fontSize:'var(--chat-font-size, 0.9375rem)'}}>
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{
                      code({className,children,...props}){const match=/language-(\w+)/.exec(className||'');const isInline=!match;const code=String(children).replace(/\n$/,'');if(isInline) return <code className={className} {...props}>{children}</code>;return <CodeBlock language={match?match[1]:''} code={code} accentColor={settings.accentColor}/>;},
                      pre({children}){return <>{children}</>;}
                    }}>{msg.content}</ReactMarkdown>
                  </div>
                  {msg.reactions&&Object.keys(msg.reactions).length>0&&<div className="flex gap-1 mt-1 flex-wrap">{Object.values(msg.reactions).map(r=><button key={r.emoji} onClick={()=>addReaction(msg.id,r.emoji)} className="flex items-center gap-0.5 text-xs px-2 py-0.5 rounded-full transition-all" style={{background:r.userReacted?`rgba(${hexToRgb(settings.accentColor)},0.2)`:'var(--bg-surface2)',color:r.userReacted?settings.accentColor:'var(--text-secondary)',border:`1px solid ${r.userReacted?`rgba(${hexToRgb(settings.accentColor)},0.4)`:'var(--border-color)'}`}}><span>{r.emoji}</span>{r.count>1&&<span>{r.count}</span>}</button>)}</div>}
                  <MessageActions msg={msg} onCopy={()=>copyMessage(msg.content)} onRegenerate={isLast?regenerateLastMessage:undefined} onLike={v=>likeMessage(msg.id,v)} onExport={()=>exportMessage(msg.content)} onPin={()=>pinMessage(msg.id)} onSpeak={()=>speakMessage(msg.id,msg.content)} onReact={emoji=>addReaction(msg.id,emoji)} onBookmark={()=>bookmarkMessage(activeConvId,msg.id)} isSpeaking={speakingMsgId===msg.id} accentColor={settings.accentColor} isLast={isLast} ttsEnabled={settings.ttsEnabled} isMobile={isMobile} showBookmarks={settings.showBookmarks} t={t}/>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    });
    return items;
  };

  // If lock screen is enabled and not authenticated, show login screen
  if (lockScreenEnabled && !isAuthenticated) {
    return <Login onLogin={handleLogin} isLockScreenEnabled={lockScreenEnabled} onToggleLockScreen={setLockScreenEnabled} />;
  }

  // Main app
  return (
    <div className={`app-wrapper ${settings.bgUrl?'custom-bg':'grid-bg'}`} style={{display:'flex',height:'100vh',width:'100vw',overflow:'hidden',background:settings.bgUrl?`url(${settings.bgUrl}) center/cover no-repeat`:'var(--bg-primary)'}}>

      {/* Mobile sidebar overlay */}
      {isMobile&&sidebarOpen&&<div className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm" onClick={()=>setSidebarOpen(false)}/>}

      {/* Sidebar */}
      <aside style={{position:'fixed',left:0,top:0,height:'100vh',width:260,zIndex:40,display:'flex',flexDirection:'column',background:'var(--glass-sidebar)',backdropFilter:'blur(20px)',borderRight:'1px solid var(--border-color)',transform:sidebarOpen?'translateX(0)':'translateX(-260px)',transition:'transform 0.3s cubic-bezier(0.4,0,0.2,1)'}}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 shrink-0" style={{borderBottom:'1px solid var(--border-color)'}}>
          <div className="flex items-center gap-2">
            <img 
              src="https://files.catbox.moe/pr9eng.png" 
              alt="icon"
              className="w-8 h-8 object-contain"
             />
            <div><p className="font-bold text-sm" style={{color:'var(--text-primary)'}}>BlueGPT</p><p className="text-[10px]" style={{color:'var(--text-muted)'}}>v{APP_VERSION}</p></div>
          </div>
          {isMobile&&<button onClick={()=>setSidebarOpen(false)} className="p-1.5 rounded-lg" style={{color:'var(--text-muted)'}}><X className="w-4 h-4"/></button>}
        </div>
        {/* New chat */}
        <div className="px-3 py-2 shrink-0">
          <button onClick={createNewConversation} className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80" style={{background:`linear-gradient(135deg, ${settings.accentColor}, ${adjustColor(settings.accentColor,40)})`,color:'white',boxShadow:`0 4px 12px rgba(${accentRgb},0.35)`}}>
            <Plus className="w-4 h-4"/>{t('newChat')}
          </button>
        </div>
        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
          {sortedConversations.length===0&&<p className="text-xs text-center py-8" style={{color:'var(--text-muted)'}}>{t('noConversations')}</p>}
          {sortedConversations.map(conv=>(
            <div key={conv.id} onClick={()=>selectConversation(conv.id)} className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${activeConvId===conv.id?'':'hover:opacity-80'}`} style={{background:activeConvId===conv.id?`rgba(${accentRgb},0.15)`:'transparent',border:activeConvId===conv.id?`1px solid rgba(${accentRgb},0.25)`:'1px solid transparent'}}>
              <MessageSquare className="w-3.5 h-3.5 shrink-0" style={{color:activeConvId===conv.id?settings.accentColor:'var(--text-muted)'}}/>
              {editingConvId===conv.id?(
                <input value={editingTitle} onChange={e=>setEditingTitle(e.target.value)} onBlur={saveEditConv} onKeyDown={e=>{if(e.key==='Enter')saveEditConv();if(e.key==='Escape')setEditingConvId(null);}} className="flex-1 bg-transparent text-sm outline-none" style={{color:'var(--text-primary)'}} autoFocus onClick={e=>e.stopPropagation()}/>
              ):(
                <span className="flex-1 text-sm truncate" style={{color:activeConvId===conv.id?'var(--text-primary)':'var(--text-secondary)'}}>{conv.title}</span>
              )}
              {conv.isLocked&&<Lock className="w-3 h-3 shrink-0" style={{color:'var(--text-muted)'}}/>}
              <div className={`flex gap-1 transition-opacity ${isMobile?'opacity-100':'opacity-0 group-hover:opacity-100'}`}>
                <button onClick={e=>{e.stopPropagation();toggleFavorite(conv.id);}} className="p-1 rounded-lg hover:opacity-70" style={{color:conv.isFavorite?'#fbbf24':'var(--text-muted)'}}><Star className={`w-3 h-3 ${conv.isFavorite?'fill-current':''}`}/></button>
                <button onClick={e=>{e.stopPropagation();setLockingConv(conv);}} className="p-1 rounded-lg hover:opacity-70" style={{color:'var(--text-muted)'}}>{conv.isLocked?<Unlock className="w-3 h-3"/>:<Lock className="w-3 h-3"/>}</button>
                <button onClick={e=>{e.stopPropagation();archiveConversation(conv.id);}} className="p-1 rounded-lg hover:opacity-70" style={{color:'var(--text-muted)'}}><Archive className="w-3 h-3"/></button>
                <button onClick={e=>{e.stopPropagation();startEditConv(conv.id,conv.title);}} className="p-1 rounded-lg hover:opacity-70" style={{color:'var(--text-muted)'}}><Edit3 className="w-3 h-3"/></button>
                <button onClick={e=>{e.stopPropagation();deleteConversation(conv.id);}} className="p-1 rounded-lg hover:opacity-70" style={{color:'#ef4444'}}><Trash2 className="w-3 h-3"/></button>
              </div>
            </div>
          ))}
        </div>
        {/* Footer */}
        <div className="px-3 py-3 shrink-0" style={{borderTop:'1px solid var(--border-color)'}}>
          <button onClick={()=>setShowArchive(true)} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition-colors hover:opacity-80" style={{background:`rgba(${accentRgb},0.08)`,color:'var(--text-muted)'}}>
            <Archive className="w-3.5 h-3.5"/>
            <span>{t('archived')}</span>
            {archivedCount>0&&<span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{background:'var(--text-muted)',color:'var(--bg-primary)'}}>{archivedCount}</span>}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{flex:1,display:'flex',flexDirection:'column',marginLeft:isMobile?0:(sidebarOpen?260:0),transition:'margin-left 0.3s cubic-bezier(0.4,0,0.2,1)',minWidth:0}}>
        {/* Header */}
        <header className="relative z-10 shrink-0 flex items-center justify-between px-4 py-3 border-b glass-effect" style={{borderColor:'var(--border-color)'}}>
          <div className="flex items-center gap-3">
            <button onClick={()=>setSidebarOpen(!sidebarOpen)} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}}><Menu className="w-5 h-5"/></button>
            <div className="flex items-center gap-2"><img src="https://files.catbox.moe/pr9eng.png" alt="icon" className="w-8 h-8 object-contain" /><div><h2 className="font-semibold text-sm" style={{color:'var(--text-primary)'}}>BlueGPT</h2><p className="text-[10px] font-medium" style={{color:currentModel==='gemini'?'#4a9eff':'var(--text-muted)'}}>{currentModel==='gemini'?'Gemini 3':'GPT'}</p></div></div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={()=>setShowSearch(true)} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}} title="Search (Ctrl+K)"><Search className="w-4 h-4"/></button>
            {messages.length>0&&<button onClick={()=>setShowPinned(v=>!v)} className="p-2 rounded-xl transition-colors hover:opacity-70 relative" style={{color:showPinned?settings.accentColor:'var(--text-muted)',background:showPinned?`rgba(${accentRgb},0.12)`:'transparent'}}><Pin className="w-4 h-4"/>{pinnedCount>0&&<span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{background:settings.accentColor}}>{pinnedCount}</span>}</button>}
            {messages.length>0&&!isMobile&&<><button onClick={()=>setShowBookmarks(v=>!v)} className="p-2 rounded-xl transition-colors hover:opacity-70 relative" style={{color:showBookmarks?settings.accentColor:'var(--text-muted)',background:showBookmarks?`rgba(${accentRgb},0.12)`:'transparent'}}><Bookmark className="w-4 h-4"/>{bookmarkCount>0&&<span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center text-white" style={{background:settings.accentColor}}>{bookmarkCount}</span>}</button><button onClick={()=>setShowClearConfirm(true)} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}}><Eraser className="w-4 h-4"/></button><button onClick={exportConversation} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}}><Download className="w-4 h-4"/></button><button onClick={printChat} className="p-2 rounded-xl transition-colors hover:opacity-70" title={t('printChat')} style={{color:'var(--text-muted)'}}><FileText className="w-4 h-4"/></button></>}
            {!isMobile&&<><input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden"/><button onClick={()=>fileInputRef.current?.click()} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}}><Upload className="w-4 h-4"/></button></>}
            <button onClick={()=>updateSettings({focusMode:!settings.focusMode})} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:settings.focusMode?settings.accentColor:'var(--text-muted)',background:settings.focusMode?`rgba(${accentRgb},0.12)`:'transparent'}}>{settings.focusMode?<EyeOff className="w-4 h-4"/>:<Eye className="w-4 h-4"/>}</button>
            <button onClick={()=>updateSettings({theme:settings.theme==='dark'?'light':'dark'})} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:'var(--text-muted)'}}>{settings.theme==='dark'?<Sun className="w-4 h-4"/>:<Moon className="w-4 h-4"/>}</button>
            <button onClick={()=>setSettingsOpen(v=>!v)} className="p-2 rounded-xl transition-colors hover:opacity-70" style={{color:settingsOpen?settings.accentColor:'var(--text-muted)',background:settingsOpen?`rgba(${accentRgb},0.12)`:'transparent'}}><Settings className="w-4 h-4"/></button>
          </div>
        </header>

        {/* Messages */}
        <div ref={messagesContainerRef} className="relative z-10 overflow-y-auto" style={{flex:1,minHeight:0}}>
          {messages.length===0?(
            <div className="h-full flex flex-col items-center justify-center px-4 py-8">
              <div className="max-w-2xl w-full space-y-10">
                <div className="text-center space-y-5 animate-fade-in-up">
                  <div className="relative inline-flex">
                    <div 
                      className="rounded-3xl flex items-center justify-center animate-spin-slow"
                      style={{
                        animation: 'spin 3s linear infinite'
                      }}
                    >
                      <img 
                        src="https://files.catbox.moe/pr9eng.png" 
                        alt="icon"
                        className="w-22 h-22 object-contain"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h2 className="text-4xl sm:text-5xl font-bold tracking-tight">
                      <span className="gradient-text">{getGreeting(settings.language)}</span>
                    </h2>
                  </div>
                </div>
              </div>
            </div>
          ):(
            <div className="max-w-3xl mx-auto px-4 py-6 space-y-2">
              {renderMessages()}
              {/* Loading */}
              {isLoading&&!isTyping&&(
                <div className="flex flex-col animate-fade-in-up py-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="rounded-3xl flex items-center justify-center animate-spin-slow"
                      style={{
                        animation: 'spin 3s linear infinite'
                      }}
                    >
                      <img 
                        src="https://files.catbox.moe/pr9eng.png" 
                        alt="icon"
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <span className="text-xs font-semibold" style={{color:settings.accentColor}}>BlueGPT</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{background:currentModel==='gpt-backup'?'rgba(26,115,232,0.15)':`rgba(${accentRgb},0.1)`,color:currentModel==='gpt-backup'?'#4a9eff':'var(--text-muted)',border:currentModel==='gpt-backup'?'1px solid rgba(26,115,232,0.3)':`1px solid rgba(${accentRgb},0.15)`}}>{currentModel==='gpt-backup'?'GPT Backup':'GPT'}</span>
                    <span className="loading-pulse text-[10px] px-2 py-0.5 rounded-full" style={{background:`rgba(${accentRgb},0.15)`,color:settings.accentColor}}>{t('connecting')}</span>
                  </div>
                  <div className="pl-8 flex items-center gap-3"><div className="flex gap-1.5">{[0,150,300].map(d=><span key={d} className="w-2 h-2 rounded-full animate-bounce" style={{background:settings.accentColor,opacity:0.75,animationDelay:`${d}ms`}}/>)}</div><span className="text-xs" style={{color:'var(--text-muted)'}}>{t('thinking')}</span></div>
                </div>
              )}
              {/* Typing animation */}
              {isTyping&&typingText&&(
                <div className="flex flex-col animate-fade-in-up py-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div 
                      className="rounded-3xl flex items-center justify-center animate-spin-slow"
                      style={{
                        animation: 'spin 3s linear infinite'
                      }}
                    >
                      <img 
                        src="https://files.catbox.moe/pr9eng.png" 
                        alt="icon"
                        className="w-6 h-6 object-contain"
                      />
                    </div>
                    <span className="text-xs font-semibold" style={{color:settings.accentColor}}>BlueGPT</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{background:currentModel==='gpt-backup'?'rgba(26,115,232,0.15)':`rgba(${accentRgb},0.1)`,color:currentModel==='gpt-backup'?'#4a9eff':'var(--text-muted)',border:currentModel==='gpt-backup'?'1px solid rgba(26,115,232,0.3)':`1px solid rgba(${accentRgb},0.15)`}}>{currentModel==='gpt-backup'?'GPT Backup':'GPT'}</span>
                    <span className="typing-indicator text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1.5" style={{background:`rgba(${accentRgb},0.15)`,color:settings.accentColor}}><span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{background:settings.accentColor}}/>{t('typing')}</span>
                  </div>
                  <div className="pl-8"><div className="markdown-body typing-content" style={{fontSize:'var(--chat-font-size, 0.9375rem)'}}><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={{code({className,children,...props}){const match=/language-(\w+)/.exec(className||'');const isInline=!match;const code=String(children).replace(/\n$/,'');if(isInline) return <code className={className} {...props}>{children}</code>;return <CodeBlock language={match?match[1]:''} code={code} accentColor={settings.accentColor}/>;},pre({children}){return <>{children}</>;} }}>{typingText}</ReactMarkdown><span className="typing-cursor">|</span></div></div>
                </div>
              )}
              <div ref={messagesEndRef}/>
            </div>
          )}
          {showScrollBtn&&<button onClick={()=>scrollToBottom()} className="fixed bottom-32 right-6 z-20 w-10 h-10 rounded-full glass-effect border flex items-center justify-center shadow-xl animate-fade-in hover:opacity-80 transition-opacity" style={{borderColor:'var(--border-color)',color:'var(--text-secondary)'}}><ArrowDown className="w-4 h-4"/></button>}
        </div>

        {/* Input Area */}
        <div className="relative z-10 shrink-0 border-t px-4 py-3 glass-effect" style={{borderColor:'var(--border-color)'}}>
          <div className="max-w-3xl mx-auto">
            {/* Rate Limit Banner */}
            {rateLimit.isLimited&&(
              <div className="mb-2 p-3 rounded-2xl flex items-center gap-3 animate-fade-in-up" style={{background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.3)'}}>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{background:'rgba(239,68,68,0.15)'}}><Lock className="w-4 h-4 text-red-400"/></div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-red-400">{settings.language==='id'?'⛔ Batas penggunaan tercapai':'⛔ Usage limit reached'}</p>
                  <p className="text-[11px]" style={{color:'var(--text-muted)'}}>{settings.language==='id'?`Reset dalam ${formatResetIn(rateLimit.resetIn)}`:`Resets in ${formatResetIn(rateLimit.resetIn)}`}</p>
                </div>
                <span className="text-[11px] font-mono font-bold text-red-400">{rateLimit.used.toLocaleString()} / {rateLimit.total.toLocaleString()}</span>
              </div>
            )}
            <div className="relative flex items-end gap-2 rounded-2xl transition-all duration-200 p-1.5 pl-4" style={{background:'var(--input-bg)',border:`1.5px solid ${!isApiValid?'rgba(239,68,68,0.5)':rateLimit.isLimited?'rgba(239,68,68,0.5)':'var(--border-color)'}`}}>
              {speechSupported&&<button onClick={toggleVoice} disabled={rateLimit.isLimited || !isApiValid} className="shrink-0 self-end mb-0.5 p-2 rounded-xl transition-all" style={{color:isListening?'#ef4444':'var(--text-muted)',background:isListening?'rgba(239,68,68,0.12)':'transparent',opacity:(rateLimit.isLimited || !isApiValid)?0.4:1}}>{isListening?<MicOff className="w-4 h-4"/>:<Mic className="w-4 h-4"/>}</button>}
              <textarea ref={inputRef} value={input} onChange={e=>{if(rateLimit.isLimited || !isApiValid) return; setInput(e.target.value);autoResize(e.target);}} onKeyDown={handleKeyDown} placeholder={!isApiValid?t('apiKeyRequired'):(rateLimit.isLimited?(settings.language==='id'?'Batas token tercapai...':'Token limit reached...'):t('messagePlaceholder'))} rows={1} disabled={rateLimit.isLimited || !isApiValid} className="flex-1 bg-transparent resize-none outline-none py-2.5 max-h-40 leading-relaxed" style={{color:(rateLimit.isLimited || !isApiValid)?'var(--text-muted)':'var(--text-primary)',fontSize:'var(--chat-font-size, 0.9375rem)',cursor:(rateLimit.isLimited || !isApiValid)?'not-allowed':'text'}}/>
              <button onClick={()=>sendMessage()} disabled={!input.trim()||isLoading||rateLimit.isLimited||!isApiValid} className="shrink-0 self-end mb-0.5 w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200" style={{background:input.trim()&&!isLoading&&!rateLimit.isLimited&&isApiValid?`linear-gradient(135deg, ${settings.accentColor}, ${adjustColor(settings.accentColor,40)})`:'var(--bg-surface3)',color:input.trim()&&!isLoading&&!rateLimit.isLimited&&isApiValid?'white':'var(--text-muted)',boxShadow:input.trim()&&!isLoading&&!rateLimit.isLimited&&isApiValid?`0 4px 14px rgba(${accentRgb},0.45)`:'none'}}><Send className="w-4 h-4"/></button>
            </div>
            {/* Rate Limit Progress Bar */}
            {!rateLimit.isLimited&&rateLimit.used>0&&(
              <div className="mt-1.5 px-1">
                <div className="w-full h-1 rounded-full overflow-hidden" style={{background:'var(--bg-surface2)'}}>
                  <div className="h-full rounded-full transition-all duration-500" style={{
                    width:`${rateLimit.percent}%`,
                    background: rateLimit.percent>80 ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : rateLimit.percent>50 ? 'linear-gradient(90deg,#191970,#f59e0b)' : `linear-gradient(90deg,${settings.accentColor},${adjustColor(settings.accentColor,40)})`,
                  }}/>
                </div>
                {rateLimit.percent>50&&<p className="text-[10px] mt-0.5 text-right" style={{color:rateLimit.percent>80?'#f59e0b':'var(--text-muted)'}}>{rateLimit.used.toLocaleString()} / {rateLimit.total.toLocaleString()} tokens {rateLimit.percent>80?`· Reset ${formatResetIn(rateLimit.resetIn)}`:''}</p>}
              </div>
            )}
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="flex items-center gap-3">
                {isListening&&<span className="text-[11px] flex items-center gap-1 text-red-400 animate-pulse"><span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block"/>{t('listening')}</span>}
                {!isApiValid && <span className="text-[11px] flex items-center gap-1" style={{color:'#f59e0b'}}><AlertTriangle className="w-3 h-3"/>{t('apiKeyRequired')}</span>}
              </div>
              <p className="text-[11px]" style={{color:'var(--text-muted)'}}>{t('disclaimer')}</p>
            </div>
          </div>
        </div>
      </main>

      {/* FAB */}
      {!settings.focusMode&&settings.showQuickActions&&<QuickActionsFAB onNewChat={createNewConversation} onSearch={()=>setShowSearch(true)} onExport={exportConversation} onScrollTop={()=>messagesContainerRef.current?.scrollTo({top:0,behavior:'smooth'})} accentColor={settings.accentColor} t={t}/>}

      {/* Overlays */}
      {settingsOpen&&<SettingsPanel settings={settings} onUpdate={updateSettings} onClose={()=>setSettingsOpen(false)} canInstallPWA={canInstall} onInstallPWA={install} onExportAll={exportAllConversations} memoryFacts={memoryFacts} onAddMemory={addMemoryFact} onDeleteMemory={deleteMemoryFact} onResetMemory={resetMemory} stickyNotes={stickyNotes} onAddNote={addStickyNote} onDeleteNote={deleteStickyNote} onUpdateNote={updateStickyNote} t={t} onToast={setToast} onLogout={handleLogout} onResetToDefaultMemory={resetToDefaultMemory}/>}
      {showPinned&&<PinnedPanel messages={messages} onClose={()=>setShowPinned(false)} onUnpin={pinMessage} accentColor={settings.accentColor} t={t}/>}
      {showBookmarks&&<BookmarksPanel conversations={conversations} onClose={()=>setShowBookmarks(false)} onNavigate={handleSearchSelect} onUnbookmark={bookmarkMessage} accentColor={settings.accentColor} t={t}/>}
      {showSearch&&<SearchModal conversations={conversations} onSelect={handleSearchSelect} onClose={()=>setShowSearch(false)} accentColor={settings.accentColor} t={t}/>}
      {showArchive&&<ArchivePanel conversations={conversations} onClose={()=>setShowArchive(false)} onRestore={restoreConversation} onDelete={deleteConversation} accentColor={settings.accentColor} t={t}/>}

      {/* Chat Lock */}
      {lockingConv&&<ChatLockModal conv={lockingConv} onClose={()=>setLockingConv(null)} onLock={(pin)=>lockConversation(lockingConv.id,pin)} onUnlock={(pin)=>unlockConversation(lockingConv.id,pin)} accentColor={settings.accentColor} t={t}/>}
      {lockedConvAttempt&&(()=>{ const c=conversations.find(cv=>cv.id===lockedConvAttempt); return c?<ChatLockModal conv={c} onClose={()=>setLockedConvAttempt(null)} onLock={(pin)=>lockConversation(c.id,pin)} onUnlock={(pin)=>unlockConversation(c.id,pin)} accentColor={settings.accentColor} t={t}/>:null; })()}

      {/* Clear Confirm */}
      {showClearConfirm&&<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={()=>setShowClearConfirm(false)}><div className="absolute inset-0" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}/><div className="relative z-10 p-6 rounded-3xl max-w-sm w-full animate-fade-in-up" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}><div className="flex items-center gap-3 mb-4"><div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{background:'rgba(239,68,68,0.12)'}}><Eraser className="w-6 h-6 text-red-500"/></div><div><h3 className="font-semibold text-lg" style={{color:'var(--text-primary)'}}>{t('clearConfirmTitle')}</h3><p className="text-sm" style={{color:'var(--text-muted)'}}>This action cannot be undone</p></div></div><p className="text-sm mb-6" style={{color:'var(--text-secondary)'}}>{t('clearConfirmDesc')}</p><div className="flex gap-3"><button onClick={()=>setShowClearConfirm(false)} className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors" style={{background:'var(--bg-surface2)',color:'var(--text-secondary)'}}>{t('cancel')}</button><button onClick={clearChat} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-colors" style={{background:'#ef4444'}}>{t('clearAll')}</button></div></div></div>}

      {/* Edit Message */}
      {editingMsgId&&<div className="fixed inset-0 z-[200] flex items-center justify-center p-4" onClick={cancelEditMessage}><div className="absolute inset-0" style={{background:'rgba(0,0,0,0.6)',backdropFilter:'blur(8px)'}}/><div className="relative z-10 p-6 rounded-3xl max-w-lg w-full animate-fade-in-up" style={{background:'var(--bg-surface)',border:'1px solid var(--border-color)'}} onClick={e=>e.stopPropagation()}><div className="flex items-center justify-between mb-4"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{background:`rgba(${hexToRgb(settings.accentColor)},0.12)`}}><Edit3 className="w-5 h-5" style={{color:settings.accentColor}}/></div><div><h3 className="font-semibold" style={{color:'var(--text-primary)'}}>{t('editMessageTitle')}</h3><p className="text-xs" style={{color:'var(--text-muted)'}}>{t('editMessageSubtitle')}</p></div></div><button onClick={cancelEditMessage} className="p-2 rounded-lg" style={{color:'var(--text-muted)'}}><X className="w-5 h-5"/></button></div><textarea value={editingMsgContent} onChange={e=>setEditingMsgContent(e.target.value)} className="w-full p-4 rounded-xl text-sm resize-none outline-none" style={{background:'var(--bg-surface2)',color:'var(--text-primary)',border:'1px solid var(--border-color)',minHeight:120}} placeholder="Edit your message..."/><div className="flex gap-3 mt-4"><button onClick={cancelEditMessage} className="flex-1 py-2.5 rounded-xl font-medium text-sm transition-colors" style={{background:'var(--bg-surface2)',color:'var(--text-secondary)'}}>{t('cancel')}</button><button onClick={saveEditMessage} disabled={!editingMsgContent.trim()} className="flex-1 py-2.5 rounded-xl font-medium text-sm text-white transition-colors flex items-center justify-center gap-2" style={{background:editingMsgContent.trim()?settings.accentColor:'var(--bg-surface3)',color:editingMsgContent.trim()?'white':'var(--text-muted)'}}><RefreshCw className="w-4 h-4"/>{t('saveRegenerate')}</button></div></div></div>}

      {toast&&<Toast msg={toast} onDone={()=>setToast(null)}/>}
    </div>
  );
}