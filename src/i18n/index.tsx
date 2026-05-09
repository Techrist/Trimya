import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fr, TranslationKey } from './fr';
import { en } from './en';

export type Locale = 'fr' | 'en';
export const SUPPORTED_LOCALES: { code: Locale; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
];

const dictionaries: Record<Locale, typeof fr> = { fr, en };
const STORAGE_KEY = '@trimya/locale';

let currentLocale: Locale = 'fr';
export function getCurrentLocale(): Locale {
  return currentLocale;
}

function detectInitialLocale(): Locale {
  const sys = (Localization.getLocales()[0]?.languageCode || 'fr').toLowerCase();
  return sys.startsWith('en') ? 'en' : 'fr';
}

export function localeToBcp47(locale: Locale): string {
  return locale === 'en' ? 'en-US' : 'fr-FR';
}

interface I18nContextValue {
  locale: Locale;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  setLocale: (locale: Locale) => Promise<void>;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      const initial: Locale =
        saved === 'fr' || saved === 'en' ? saved : detectInitialLocale();
      currentLocale = initial;
      setLocaleState(initial);
      setReady(true);
    })();
  }, []);

  const setLocale = async (l: Locale) => {
    currentLocale = l;
    setLocaleState(l);
    await AsyncStorage.setItem(STORAGE_KEY, l);
  };

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      ready,
      setLocale,
      t: (key, params) => {
        let str: string =
          dictionaries[locale][key] ?? dictionaries.fr[key] ?? String(key);
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), String(v));
          });
        }
        return str;
      },
    }),
    [locale, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useT must be used within I18nProvider');
  return ctx;
}
