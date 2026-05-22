"use client";
import { useEffect } from "react";
import { useLanguage } from "@/lib/i18n";

export default function LanguageSync() {
  const { language } = useLanguage();
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = language;
    }
  }, [language]);
  return null;
}
