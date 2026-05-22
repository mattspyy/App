import type { CSSProperties, ReactNode } from "react";

type CardProps = {
  children: ReactNode;
  padding?: number | string;
  tone?: "surface" | "soft" | "accent" | "sage" | "amber";
  className?: string;
  style?: CSSProperties;
  as?: "div" | "section" | "article" | "li";
};

const TONES: Record<NonNullable<CardProps["tone"]>, { bg: string; border: string }> = {
  surface: { bg: "var(--color-surface)", border: "var(--color-line)" },
  soft: { bg: "var(--color-bg-soft)", border: "var(--color-line-soft)" },
  accent: { bg: "var(--color-accent-soft)", border: "color-mix(in oklch, var(--color-accent) 22%, var(--color-line))" },
  sage: { bg: "var(--color-sage-soft)", border: "color-mix(in oklch, var(--color-sage) 22%, var(--color-line))" },
  amber: { bg: "var(--color-amber-soft)", border: "color-mix(in oklch, var(--color-amber) 25%, var(--color-line))" },
};

export default function Card({
  children,
  padding = 18,
  tone = "surface",
  className,
  style,
  as: Tag = "div",
}: CardProps) {
  const t = TONES[tone];
  return (
    <Tag
      className={className}
      style={{
        background: t.bg,
        border: `1px solid ${t.border}`,
        borderRadius: "var(--radius-xl)",
        padding,
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
