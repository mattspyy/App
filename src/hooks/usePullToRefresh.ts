"use client";
import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD = 70;
const MAX_PULL = 140;

export type PullToRefresh = {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
  trigger: () => Promise<void>;
};

export function usePullToRefresh(onRefresh: () => Promise<void> | void): PullToRefresh {
  const [pulling, setPulling] = useState(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  async function trigger(): Promise<void> {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await onRefreshRef.current();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }

  useEffect(() => {
    let startY: number | null = null;
    let currentDelta = 0;
    let isPulling = false;

    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 0) return;
      startY = e.touches[0].clientY;
      currentDelta = 0;
      isPulling = false;
    }
    function onTouchMove(e: TouchEvent) {
      if (startY == null) return;
      const dy = e.touches[0].clientY - startY;
      if (dy > 0) {
        isPulling = true;
        currentDelta = Math.min(dy, MAX_PULL);
        setPulling(true);
        setDistance(currentDelta);
      }
    }
    async function onTouchEnd() {
      const final = currentDelta;
      const wasPulling = isPulling;
      startY = null;
      currentDelta = 0;
      isPulling = false;
      setPulling(false);
      setDistance(0);
      if (wasPulling && final >= PULL_THRESHOLD && !refreshingRef.current) {
        refreshingRef.current = true;
        setRefreshing(true);
        try {
          await onRefreshRef.current();
        } finally {
          refreshingRef.current = false;
          setRefreshing(false);
        }
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  return { pulling, distance, refreshing, trigger };
}
