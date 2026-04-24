// useRateLimit.ts - tetap sama seperti sebelumnya

import { useState, useEffect, useCallback } from 'react';

const RATE_LIMIT_KEY = 'chatai_rate_limit';
const MAX_TOKENS_PER_HOUR = 2000;

interface RateLimitData {
  tokens: number;
  windowStart: number; // timestamp ms
}

interface RateLimitState {
  used: number;
  remaining: number;
  total: number;
  percent: number;
  isLimited: boolean;
  resetIn: number; // seconds until reset
}

function loadData(): RateLimitData {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (raw) {
      const data: RateLimitData = JSON.parse(raw);
      // If window has expired (1 hour), reset
      if (Date.now() - data.windowStart >= 60 * 60 * 1000) {
        return { tokens: 0, windowStart: Date.now() };
      }
      return data;
    }
  } catch { /* ignore */ }
  return { tokens: 0, windowStart: Date.now() };
}

function saveData(data: RateLimitData) {
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(data));
}

// Rough token estimator: ~4 chars per token
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function useRateLimit() {
  const [data, setData] = useState<RateLimitData>(loadData);
  const [, setTick] = useState(0);

  // Tick every second to update resetIn
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
      // Also check if window has expired
      setData(prev => {
        if (Date.now() - prev.windowStart >= 60 * 60 * 1000) {
          const reset = { tokens: 0, windowStart: Date.now() };
          saveData(reset);
          return reset;
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const state: RateLimitState = (() => {
    const used = data.tokens;
    const remaining = Math.max(0, MAX_TOKENS_PER_HOUR - used);
    const percent = Math.min(100, (used / MAX_TOKENS_PER_HOUR) * 100);
    const isLimited = used >= MAX_TOKENS_PER_HOUR;
    const elapsed = Date.now() - data.windowStart;
    const windowMs = 60 * 60 * 1000;
    const resetIn = Math.max(0, Math.ceil((windowMs - elapsed) / 1000));
    return { used, remaining, total: MAX_TOKENS_PER_HOUR, percent, isLimited, resetIn };
  })();

  const consumeTokens = useCallback((text: string): boolean => {
    const tokens = estimateTokens(text);
    setData(prev => {
      // Check if window expired
      let current = prev;
      if (Date.now() - prev.windowStart >= 60 * 60 * 1000) {
        current = { tokens: 0, windowStart: Date.now() };
      }
      const newData = { ...current, tokens: current.tokens + tokens };
      saveData(newData);
      return newData;
    });
    return data.tokens + tokens < MAX_TOKENS_PER_HOUR;
  }, [data.tokens]);

  const resetLimit = useCallback(() => {
    const reset = { tokens: 0, windowStart: Date.now() };
    saveData(reset);
    setData(reset);
  }, []);

  // Format resetIn as MM:SS
  const formatResetIn = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { state, consumeTokens, resetLimit, formatResetIn };
}
