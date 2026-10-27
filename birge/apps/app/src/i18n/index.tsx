import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@birge/shared';
import { prefs } from '@/lib/storage';
import { en } from './en';
import { kk } from './kk';

type Dict = typeof kk;
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Paths<Dict>;
export type TParams = Record<string, string | number>;
export type Translate = (key: TKey, params?: TParams) => string;

const DICTS: Record<Locale, Dict> = { kk, en };
const LOCALE_KEY = 'birge.locale';

function lookup(dict: Dict, key: string): string {
  let node: unknown = dict;
  for (const part of key.split('.')) node = (node as Record<string, unknown> | undefined)?.[part];
  return typeof node === 'string' ? node : key;
}

export function translate(locale: Locale, key: TKey, params?: TParams): string {
  const text = lookup(DICTS[locale], key);
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Құрылғы тілі ағылшынша болса — English, қалған жағдайда — қазақша. */
export function deviceLocale(): Locale {
  const code = getLocales()[0]?.languageCode ?? '';
  return isLocale(code) ? code : DEFAULT_LOCALE;
}

interface I18nValue {
  locale: Locale;
  ready: boolean;
  setLocale(locale: Locale): void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(deviceLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    prefs.get(LOCALE_KEY).then((stored) => {
      if (isLocale(stored)) setLocaleState(stored);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    void prefs.set(LOCALE_KEY, next);
  }, []);

  const t = useCallback<Translate>((key, params) => translate(locale, key, params), [locale]);
  const value = useMemo(() => ({ locale, ready, setLocale, t }), [locale, ready, setLocale, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}
