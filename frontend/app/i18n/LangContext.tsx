'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { translations, Locale, Translations } from './translations';

type LangContextType = {
  locale: Locale;
  t: Translations;
  setLocale: (l: Locale) => void;
};

const LangContext = createContext<LangContextType>({
  locale: 'th',
  t: translations.th,
  setLocale: () => {},
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('th');

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Locale | null;
    if (saved === 'en' || saved === 'th') setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem('lang', l);
  };

  return (
    <LangContext.Provider value={{ locale, t: translations[locale], setLocale }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
