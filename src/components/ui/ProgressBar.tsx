export default function ProgressBar({
  value,
  caption,
  ariaLabel,
}: {
  value: number;
  caption?: string;
  ariaLabel?: string;
}) {
  const pct = Math.max(0, Math.min(1.2, value));
  const widthPct = Math.min(100, pct * 100);
  const color =
    pct >= 1
      ? "var(--color-accent)"
      : pct >= 0.8
      ? "var(--color-amber)"
      : "var(--color-sage)";
  return (
    <div>
      <div
        role="progressbar"
        aria-valuenow={Math.round(pct * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || caption || "progress"}
        style={{
          height: 6,
          background: "var(--color-bg-soft)",
          border: "1px solid var(--color-line-soft)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${widthPct}%`,
            height: "100%",
            background: color,
            transition: "width 240ms ease",
          }}
        />
      </div>
      {caption && (
        <div
          style={{
            marginTop: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.06em",
            color: "var(--color-ink-3)",
            textTransform: "uppercase",
          }}
        >
          {caption}
        </div>
      )}
    </div>
  );
}
