"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";

export default function Root() {
  const router = useRouter();
  const session = useSession();
  useEffect(() => {
    router.replace(session ? "/parties" : "/login");
  }, [session, router]);
  return <div className="text-sm text-zinc-500">Loading…</div>;
}
