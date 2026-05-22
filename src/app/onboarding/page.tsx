"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n";

export default function OnboardingRedirect() {
  const router = useRouter();
  const { t } = useLanguage();
  useEffect(() => {
    router.replace("/register");
  }, [router]);
  return <div className="text-sm text-zinc-500">{t("states.redirecting")}</div>;
}
