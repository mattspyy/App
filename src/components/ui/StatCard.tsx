import type { ReactNode } from "react";
import ProgressBar from "./ProgressBar";

export default function StatCard({
  label,
  value,
  hint,
  progress,
  tone = "surface",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  progress?: number;
  tone?: "surface" | "soft" | "accent" | "sage" | "amber";
}) {
  const bg =
    tone === "accent" ? "var(--color-accent-soft)"
    : tone === "sage" ? "var(--color-sage-soft)"
    : tone === "amber" ? "var(--color-amber-soft)"
    : tone === "soft" ? "var(--color-bg-soft)"
    : "var(--color-surface)";
  return (
    <div
      style={{
        background: bg,
        border: "1px solid var(--color-line)",
        borderRadius: "var(--radius-xl)",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 26,
          lineHeight: 1.1,
          color: "var(--color-ink)",
          letterSpacing: "-0.01em",
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
      {typeof progress === "number" && <ProgressBar value={progress} />}
      {hint && (
        <div style={{ fontSize: 12, color: "var(--color-ink-2)", lineHeight: 1.35 }}>{hint}</div>
      )}
    </div>
  );
}
