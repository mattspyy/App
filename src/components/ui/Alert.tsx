import type { ReactNode } from "react";

type Tone = "accent" | "sage" | "amber" | "neutral";

const TONES: Record<Tone, { bg: string; border: string; fg: string }> = {
  accent: { bg: "var(--color-accent-soft)", border: "color-mix(in oklch, var(--color-accent) 30%, var(--color-line))", fg: "var(--color-accent-ink)" },
  sage: { bg: "var(--color-sage-soft)", border: "color-mix(in oklch, var(--color-sage) 28%, var(--color-line))", fg: "var(--color-sage-ink)" },
  amber: { bg: "var(--color-amber-soft)", border: "color-mix(in oklch, var(--color-amber) 32%, var(--color-line))", fg: "var(--color-amber-ink)" },
  neutral: { bg: "var(--color-bg-soft)", border: "var(--color-line)", fg: "var(--color-ink-2)" },
};

export default function Alert({
  tone = "neutral",
  title,
  children,
  icon,
  className,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      role="alert"
      className={className}
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-lg)",
        padding: "12px 14px",
        color: t.fg,
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
      }}
    >
      {icon && <span style={{ flexShrink: 0, marginTop: 1 }}>{icon}</span>}
      <div style={{ minWidth: 0, flex: 1 }}>
        {title && (
          <div style={{ fontFamily: "var(--font-serif)", fontWeight: 600, fontSize: 14, lineHeight: 1.35 }}>
            {title}
          </div>
        )}
        {children && (
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: title ? 4 : 0 }}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
