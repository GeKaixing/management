import { useEffect, useState } from "react";

const STORAGE_KEY = "rcs_lang";

export function useLang(defaultLang = "zh") {
  const [lang, setLang] = useState(defaultLang);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(STORAGE_KEY);
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

export function t(lang, zhText, enText) {
  return lang === "en" ? enText : zhText;
}