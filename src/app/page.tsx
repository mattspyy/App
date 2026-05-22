"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";

export default function Root() {
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();
  useEffect(() => {
    router.replace(session ? "/parties" : "/login");
  }, [session, router]);
  return <div className="text-sm text-zinc-500">{t("states.loading")}</div>;
}
