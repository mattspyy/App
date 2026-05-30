import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PendingSyncNotice from "@/components/PendingSyncNotice";
import AppShell from "@/components/ui/AppShell";
import LanguageSync from "@/components/LanguageSync";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "FXT — Group & Trip Expenses",
  description: "A calm, warm travel companion for everyday expenses",
};

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Source+Serif+4:opsz,wght@8..60,400;8..60,500;8..60,600;8..60,700&family=JetBrains+Mono:wght@400;500;600&display=swap";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-HK" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_HREF} />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
      </head>
      <body style={{ minHeight: "100%", background: "var(--color-canvas)", color: "var(--color-ink)" }}>
        <LanguageSync />
        <ServiceWorkerRegister />
        <Nav />
        <AppShell>
          <PendingSyncNotice />
          {children}
        </AppShell>
      </body>
    </html>
  );
}
