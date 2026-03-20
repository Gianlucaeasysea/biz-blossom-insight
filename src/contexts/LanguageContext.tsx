import { createContext, useContext, useState, ReactNode } from 'react';
import { Language, translations, resolve } from '@/lib/i18n';

const STORAGE_KEY = 'app-language';

interface LanguageContextType {
  lang: Language;
  setLang: (l: Language) => void;
  t: (key: string, vars?: Record<string, string>) => string;
  months: string[]; // 12 short month names for current language
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'it',
  setLang: () => {},
  t: (key) => key,
  months: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    return saved && ['it','en','de'].includes(saved) ? saved : 'it';
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
  };

  const dict = translations[lang];

  const t = (key: string, vars?: Record<string, string>): string =>
    resolve(dict, key, vars) !== key
      ? resolve(dict, key, vars)
      : resolve(translations.it, key, vars); // fallback to Italian

  const months = Array.from({ length: 12 }, (_, i) => t(`month.${i}`));

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, months }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
