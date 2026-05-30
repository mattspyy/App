"use client";
import { useCallback, useEffect, useState } from "react";
import type { CustomCategory } from "./types";

// Fetches a user's custom categories and exposes a reload trigger.
export function useCustomCategories(userId: string | undefined): {
  categories: CustomCategory[];
  reload: () => Promise<void>;
} {
  const [categories, setCategories] = useState<CustomCategory[]>([]);
  const reload = useCallback(async () => {
    if (!userId) {
      setCategories([]);
      return;
    }
    try {
      const res = await fetch(`/api/custom-categories?userId=${encodeURIComponent(userId)}`);
      const data = await res.json();
      if (res.ok) setCategories((data.categories as CustomCategory[]) || []);
    } catch {
      // Non-fatal: fall back to defaults only.
    }
  }, [userId]);
  useEffect(() => {
    reload();
  }, [reload]);
  return { categories, reload };
}
