import type { ReactNode } from "react";

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        maxWidth: 1120,
        margin: "0 auto",
        padding: "20px 16px calc(96px + env(safe-area-inset-bottom)) 16px",
        // CSS var consumed by BottomActionBar to bleed against page padding.
      }}
      className="fxt-main"
    >
      {children}
    </main>
  );
}
