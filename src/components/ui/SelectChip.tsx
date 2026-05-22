"use client";
import type { SelectHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

type SelectChipProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> & {
  label?: string;
  icon?: ReactNode;
  children: ReactNode;
};

export default function SelectChip({
  label,
  icon,
  children,
  id,
  className,
  ...rest
}: SelectChipProps) {
  const reactId = useId();
  const selectId = id ?? `sc-${reactId}`;
  return (
    <label
      htmlFor={selectId}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        background: "var(--color-surface)",
        border: "1px solid var(--color-line)",
        borderRadius: 999,
        padding: "6px 12px 6px 14px",
        fontSize: 13,
        color: "var(--color-ink)",
        cursor: "pointer",
        position: "relative",
      }}
    >
      {icon && <span style={{ color: "var(--color-ink-3)" }}>{icon}</span>}
      {label && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: "var(--color-ink-3)",
          }}
        >
          {label}
        </span>
      )}
      <select
        {...rest}
        id={selectId}
        className={["fxt-focus", className].filter(Boolean).join(" ")}
        style={{
          appearance: "none",
          background: "transparent",
          border: 0,
          color: "var(--color-ink)",
          fontFamily: "var(--font-sans)",
          fontSize: 13,
          paddingRight: 18,
          cursor: "pointer",
          outline: "none",
        }}
      >
        {children}
      </select>
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden style={{ marginLeft: -14, pointerEvents: "none", color: "var(--color-ink-3)" }}>
        <path d="M2 3.5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </label>
  );
}
