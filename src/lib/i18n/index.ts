import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { config } from '@/lib/config';

import en from './locales/en.json';
import zhCN from './locales/zh-CN.json';

export const SUPPORTED_LANGUAGES = ['zh-CN', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'zh-CN';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value);
}

// The UI language is not sensitive, so localStorage is fine for it.
export function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(config.languageStorageKey);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function storeLanguage(language: Language): void {
  try {
    window.localStorage.setItem(config.languageStorageKey, language);
  } catch {
    // Storage can be unavailable (private mode). The in-memory choice still applies.
  }
}

export async function changeLanguage(language: Language): Promise<void> {
  storeLanguage(language);
  await i18n.changeLanguage(language);
  document.documentElement.lang = language;
}

export function setupI18n(initialLanguage: Language = readStoredLanguage()): typeof i18n {
  if (!i18n.isInitialized) {
    void i18n.use(initReactI18next).init({
      resources: {
        en: { translation: en },
        'zh-CN': { translation: zhCN },
      },
      lng: initialLanguage,
      fallbackLng: 'en',
      supportedLngs: [...SUPPORTED_LANGUAGES],
      interpolation: { escapeValue: false },
      returnNull: false,
    });
    document.documentElement.lang = initialLanguage;
  }
  return i18n;
}

export default i18n;
