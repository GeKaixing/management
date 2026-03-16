import { useEffect, useState } from "react";

const STORAGE_KEY = "rcs_lang";

export type Lang = "zh" | "en";

export function useLang(defaultLang: Lang = "zh") {
  const [lang, setLang] = useState<Lang>(defaultLang);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === "en" || saved === "zh") {
      setLang(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  return { lang, setLang };
}

export function t(lang: Lang, zhText: string, enText: string) {
  return lang === "en" ? enText : zhText;
}