import type { ReactNode } from "react";

export default function SectionHeader({
  title,
  meta,
  action,
}: {
  title: ReactNode;
  meta?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, minWidth: 0 }}>
        <h2
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 600,
            fontSize: 17,
            color: "var(--color-ink)",
            margin: 0,
            lineHeight: 1.3,
          }}
        >
          {title}
        </h2>
        {meta && (
          <span
            className="fxt-mono"
            style={{ fontSize: 11, letterSpacing: "0.06em", color: "var(--color-ink-3)" }}
          >
            {meta}
          </span>
        )}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
