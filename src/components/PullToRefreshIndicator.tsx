"use client";

type Props = {
  pulling: boolean;
  distance: number;
  refreshing: boolean;
};

export default function PullToRefreshIndicator({ pulling, distance, refreshing }: Props) {
  if (!pulling && !refreshing) return null;
  const visible = refreshing || distance > 0;
  if (!visible) return null;
  return (
    <div
      aria-hidden
      className="fixed top-0 left-0 right-0 z-20 flex justify-center pointer-events-none"
      style={{ transform: `translateY(${refreshing ? 12 : Math.min(distance, 80) - 4}px)` }}
    >
      <div className="inline-flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full px-3 py-1 text-xs text-zinc-600 shadow-sm">
        <span className={refreshing ? "animate-spin inline-block" : "inline-block"}>↻</span>
        <span>{refreshing ? "Refreshing…" : "Pull to refresh"}</span>
      </div>
    </div>
  );
}
