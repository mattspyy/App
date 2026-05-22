import type { ReactNode } from "react";

type Tone = "neutral" | "ink" | "accent" | "sage" | "amber";

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: "var(--color-bg-soft)", fg: "var(--color-ink-2)", border: "var(--color-line)" },
  ink: { bg: "var(--color-ink)", fg: "var(--color-canvas)", border: "var(--color-ink)" },
  accent: { bg: "var(--color-accent-soft)", fg: "var(--color-accent-ink)", border: "color-mix(in oklch, var(--color-accent) 22%, var(--color-line))" },
  sage: { bg: "var(--color-sage-soft)", fg: "var(--color-sage-ink)", border: "color-mix(in oklch, var(--color-sage) 22%, var(--color-line))" },
  amber: { bg: "var(--color-amber-soft)", fg: "var(--color-amber-ink)", border: "color-mix(in oklch, var(--color-amber) 25%, var(--color-line))" },
};

export default function Badge({
  children,
  tone = "neutral",
  size = "md",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  size?: "sm" | "md";
  className?: string;
}) {
  const t = TONES[tone];
  const padding = size === "sm" ? "0.125rem 0.5rem" : "0.2rem 0.6rem";
  const fontSize = size === "sm" ? 11 : 12;
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        background: t.bg,
        color: t.fg,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding,
        fontSize,
        lineHeight: 1.2,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}
