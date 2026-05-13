import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";
import PendingSyncNotice from "@/components/PendingSyncNotice";

export const metadata: Metadata = {
  title: "Group Expense Tracker",
  description: "Trip & group expense tracking with AI receipt scanning",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">
        <Nav />
        <main className="max-w-5xl mx-auto p-4 sm:p-6 pb-24 md:pb-6 space-y-4">
          <PendingSyncNotice />
          {children}
        </main>
      </body>
    </html>
  );
}
