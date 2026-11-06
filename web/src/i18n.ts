import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import ms from './locales/ms.json';

export const LOCALES = ['en', 'ms'] as const;
export type Locale = (typeof LOCALES)[number];

// English is always the default. Malay is used only when AIN chooses it.
const stored = (() => { try { return localStorage.getItem('candy.interfaceLocale'); } catch { return null; } })();

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ms: { translation: ms } },
  lng: stored === 'ms' ? 'ms' : 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Applies the signed-in user's saved interface language (server is the source of truth). */
export function applyInterfaceLocale(l: Locale) {
  if (i18n.language !== l) void i18n.changeLanguage(l);
  document.documentElement.lang = l;
  try { localStorage.setItem('candy.interfaceLocale', l); } catch { /* storage unavailable */ }
}

export default i18n;
