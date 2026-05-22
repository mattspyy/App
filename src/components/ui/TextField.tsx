"use client";
import type { InputHTMLAttributes, ReactNode } from "react";
import { useId } from "react";

type Base = Omit<InputHTMLAttributes<HTMLInputElement>, "size">;

type TextFieldProps = Base & {
  label: string;
  helper?: ReactNode;
  error?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
};

export default function TextField({
  label,
  helper,
  error,
  leading,
  trailing,
  containerClassName,
  id,
  className,
  ...rest
}: TextFieldProps) {
  const reactId = useId();
  const inputId = id ?? `tf-${reactId}`;
  const describedBy = error ? `${inputId}-err` : helper ? `${inputId}-helper` : undefined;
  return (
    <div className={containerClassName} style={{ display: "block" }}>
      <label
        htmlFor={inputId}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: "var(--color-ink-3)",
          display: "block",
          marginBottom: 6,
        }}
      >
        {label}
      </label>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "var(--color-surface)",
          border: `1px solid ${error ? "var(--color-accent)" : "var(--color-line)"}`,
          borderRadius: "var(--radius-md)",
          padding: "0 12px",
          transition: "border-color 120ms ease, box-shadow 120ms ease",
        }}
      >
        {leading && <span style={{ color: "var(--color-ink-3)", flexShrink: 0 }}>{leading}</span>}
        <input
          {...rest}
          id={inputId}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          className={["fxt-focus", className].filter(Boolean).join(" ")}
          style={{
            flex: 1,
            background: "transparent",
            border: 0,
            outline: "none",
            color: "var(--color-ink)",
            padding: "12px 0",
            fontSize: 15,
            fontFamily: "var(--font-sans)",
            minWidth: 0,
          }}
        />
        {trailing && <span style={{ color: "var(--color-ink-3)", flexShrink: 0 }}>{trailing}</span>}
      </div>
      {error ? (
        <div id={`${inputId}-err`} style={{ fontSize: 12, color: "var(--color-accent-ink)", marginTop: 6 }}>
          {error}
        </div>
      ) : helper ? (
        <div id={`${inputId}-helper`} style={{ fontSize: 12, color: "var(--color-ink-3)", marginTop: 6 }}>
          {helper}
        </div>
      ) : null}
    </div>
  );
}
