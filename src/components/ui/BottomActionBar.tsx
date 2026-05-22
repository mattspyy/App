import type { ReactNode } from "react";

export default function BottomActionBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={className}
      style={{
        position: "sticky",
        bottom: "calc(4.25rem + env(safe-area-inset-bottom))",
        zIndex: 5,
        marginLeft: "calc(-1 * var(--page-pad, 16px))",
        marginRight: "calc(-1 * var(--page-pad, 16px))",
        background: "color-mix(in oklch, var(--color-canvas) 92%, transparent)",
        backdropFilter: "saturate(140%) blur(8px)",
        WebkitBackdropFilter: "saturate(140%) blur(8px)",
        borderTop: "1px solid var(--color-line)",
        padding: "12px 16px",
        display: "flex",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}
