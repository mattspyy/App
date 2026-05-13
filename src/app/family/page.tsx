"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FamilyRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/parties");
  }, [router]);
  return <div className="text-sm text-zinc-500">Redirecting…</div>;
}
