import type { CSSProperties } from "react";

const PALETTE = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16",
  "#10b981", "#06b6d4", "#3b82f6", "#6366f1",
  "#8b5cf6", "#d946ef", "#ec4899", "#14b8a6",
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  name: string;
  size?: number;
  className?: string;
};

export default function Avatar({ name, size = 28, className = "" }: Props) {
  const color = PALETTE[hashString(name) % PALETTE.length];
  const style: CSSProperties = {
    width: size,
    height: size,
    backgroundColor: color,
    fontSize: Math.max(10, Math.round(size * 0.42)),
  };
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold select-none ${className}`}
      style={style}
      aria-label={name}
      title={name}
    >
      {initials(name)}
    </span>
  );
}
