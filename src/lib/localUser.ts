"use client";
import { useMemo, useSyncExternalStore } from "react";
import { v4 as uuidv4 } from "uuid";
import type { LocalUser } from "./types";

export function newId(): string {
  return uuidv4();
}

const KEY = "fxt.localUser";
const CHANGE_EVENT = "fxt.localUser.change";

export function getLocalUser(): LocalUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalUser) : null;
  } catch {
    return null;
  }
}

export function setLocalUser(u: LocalUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(u));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearLocalUser(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

function getSnapshot(): string | null {
  return typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
}

function getServerSnapshot(): string | null {
  return null;
}

export function useLocalUser(): LocalUser | null {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LocalUser;
    } catch {
      return null;
    }
  }, [raw]);
}
