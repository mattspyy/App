"use client";

type Props = {
  onClick: () => void;
  refreshing: boolean;
  className?: string;
};

export default function RefreshButton({ onClick, refreshing, className }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={refreshing}
      aria-label="Refresh"
      className={
        "inline-flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-900 disabled:opacity-50 px-2 py-1 rounded-md border border-zinc-200 bg-white " +
        (className ?? "")
      }
    >
      <span aria-hidden className={refreshing ? "animate-spin inline-block" : "inline-block"}>
        ↻
      </span>
      <span>{refreshing ? "Refreshing…" : "Refresh"}</span>
    </button>
  );
}
