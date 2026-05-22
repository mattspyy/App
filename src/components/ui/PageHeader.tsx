import type { ReactNode } from "react";

export default function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "space-between",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 4,
      }}
    >
      <div style={{ minWidth: 0, flex: "1 1 280px" }}>
        {eyebrow && (
          <div className="fxt-eyebrow" style={{ marginBottom: 8 }}>
            {eyebrow}
          </div>
        )}
        <h1
          className="fxt-display"
          style={{ fontSize: "clamp(28px, 4.6vw, 44px)", margin: 0, lineHeight: 1.1, letterSpacing: "-0.015em" }}
        >
          {title}
        </h1>
        {description && (
          <p style={{ marginTop: 8, color: "var(--color-ink-2)", fontSize: 14, maxWidth: 56 + "ch" }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>{actions}</div>}
    </header>
  );
}
