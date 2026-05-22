import type { ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "sage" | "danger";
type Size = "sm" | "md" | "lg";

type CommonProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  full?: boolean;
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>;

type LinkProps = CommonProps & {
  href: string;
  prefetch?: boolean;
  "aria-label"?: string;
};

function classes(variant: Variant, size: Size, full: boolean): string {
  const base =
    "fxt-focus inline-flex items-center justify-center gap-2 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-center select-none";
  const sizeC =
    size === "sm"
      ? "text-xs px-3 py-1.5 rounded-[8px]"
      : size === "lg"
      ? "text-base px-5 py-3 rounded-[12px]"
      : "text-sm px-4 py-2.5 rounded-[10px]";
  let variantC = "";
  switch (variant) {
    case "primary":
      variantC = "bg-[var(--color-ink)] text-[var(--color-canvas)] hover:bg-[color-mix(in_oklch,var(--color-ink)_88%,var(--color-canvas))]";
      break;
    case "accent":
      variantC = "bg-[var(--color-accent)] text-white hover:bg-[color-mix(in_oklch,var(--color-accent)_88%,black)]";
      break;
    case "secondary":
      variantC = "bg-[var(--color-surface)] text-[var(--color-ink)] border border-[var(--color-line)] hover:bg-[var(--color-bg-soft)]";
      break;
    case "ghost":
      variantC = "bg-transparent text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-soft)]";
      break;
    case "sage":
      variantC = "bg-[var(--color-sage)] text-white hover:bg-[color-mix(in_oklch,var(--color-sage)_88%,black)]";
      break;
    case "danger":
      variantC = "bg-[var(--color-surface)] text-[var(--color-accent-ink)] border border-[color-mix(in_oklch,var(--color-accent)_30%,var(--color-line))] hover:bg-[var(--color-accent-soft)]";
      break;
  }
  return [base, sizeC, variantC, full ? "w-full" : ""].filter(Boolean).join(" ");
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      className={[classes(variant, size, full), className].filter(Boolean).join(" ")}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  variant = "primary",
  size = "md",
  full = false,
  className,
  href,
  prefetch,
  ...rest
}: LinkProps) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      {...rest}
      className={[classes(variant, size, full), className].filter(Boolean).join(" ")}
    >
      {children}
    </Link>
  );
}

export default Button;
