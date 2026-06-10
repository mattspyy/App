"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, useSession } from "@/lib/session";
import { useLanguage } from "@/lib/i18n";

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { t } = useLanguage();

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const scanActive = isActive(pathname, "/scan");

  const TOP_NAV = [
    { href: "/parties", label: t("nav.groups") },
    { href: "/trips", label: t("nav.trips") },
    { href: "/history", label: t("nav.expenses") },
    { href: "/settings", label: t("nav.settings") },
  ];

  const BOTTOM_NAV: { href: string; label: string; icon: string }[] = [
    { href: "/parties", label: t("nav.groups"), icon: "\u25C7" },
    { href: "/trips", label: t("nav.trips"), icon: "\u2708" },
    { href: "/history", label: t("nav.expenses"), icon: "\u2261" },
    { href: "/settings", label: t("nav.settings"), icon: "\u2699" },
  ];

  return (
    <>
      <nav
        style={{
          background: "color-mix(in oklch, var(--color-canvas) 88%, transparent)",
          backdropFilter: "saturate(140%) blur(10px)",
          WebkitBackdropFilter: "saturate(140%) blur(10px)",
          borderBottom: "1px solid var(--color-line-soft)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            maxWidth: 1120,
            margin: "0 auto",
            padding: "0 16px",
            height: 56,
            display: "flex",
            alignItems: "center",
            gap: 18,
          }}
        >
          <Link
            href={session ? "/" : "/login"}
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
              textDecoration: "none",
            }}
          >
            FXT
          </Link>
          {session && (
            <>
              <ul
                className="hidden md:flex"
                style={{ gap: 4, alignItems: "center", listStyle: "none", margin: 0, padding: 0 }}
              >
                {TOP_NAV.map((n) => {
                  const active = isActive(pathname, n.href);
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        style={{
                          display: "inline-block",
                          padding: "8px 14px",
                          borderRadius: 999,
                          fontSize: 13,
                          color: active ? "var(--color-ink)" : "var(--color-ink-2)",
                          background: active ? "var(--color-bg-soft)" : "transparent",
                          textDecoration: "none",
                          fontWeight: active ? 600 : 500,
                          transition: "background 120ms ease, color 120ms ease",
                        }}
                      >
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
                <li style={{ marginLeft: 4 }}>
                  <Link
                    href="/scan"
                    aria-label={t("nav.addExpenseAria")}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 14px",
                      borderRadius: 999,
                      fontSize: 13,
                      fontWeight: 600,
                      color: scanActive ? "white" : "white",
                      background: "var(--color-accent)",
                      textDecoration: "none",
                    }}
                  >
                    <span aria-hidden>+</span>
                    <span>{t("nav.add")}</span>
                  </Link>
                </li>
              </ul>
              <button
                onClick={handleLogout}
                style={{
                  marginLeft: "auto",
                  fontSize: 13,
                  color: "var(--color-ink-3)",
                  background: "transparent",
                  border: 0,
                  cursor: "pointer",
                  padding: 6,
                }}
              >
                {t("nav.logout")}
              </button>
            </>
          )}
        </div>
      </nav>

      {session && (
        <nav
          aria-label="Primary"
          className="md:hidden"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            background: "color-mix(in oklch, var(--color-canvas) 94%, transparent)",
            backdropFilter: "saturate(140%) blur(14px)",
            WebkitBackdropFilter: "saturate(140%) blur(14px)",
            borderTop: "1px solid var(--color-line)",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
          <ul
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              alignItems: "end",
              height: 64,
              fontSize: 11,
              listStyle: "none",
              margin: 0,
              padding: 0,
            }}
          >
            {BOTTOM_NAV.slice(0, 2).map((n) => (
              <BottomItem key={n.href} item={n} active={isActive(pathname, n.href)} />
            ))}
            <li style={{ display: "flex", alignItems: "flex-start", justifyContent: "center", marginTop: -20 }}>
              <Link
                href="/scan"
                aria-label={t("nav.addExpenseAria")}
                style={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 56,
                  height: 56,
                  borderRadius: 999,
                  background: scanActive ? "var(--color-accent-ink)" : "var(--color-accent)",
                  color: "white",
                  border: "4px solid var(--color-canvas)",
                  boxShadow: "0 8px 20px -8px color-mix(in oklch, var(--color-accent) 60%, transparent)",
                  textDecoration: "none",
                }}
              >
                <span style={{ fontSize: 20, lineHeight: 1, fontWeight: 300 }} aria-hidden>\uFF0B</span>
                <span style={{ fontSize: 10, marginTop: 2, fontWeight: 600, letterSpacing: "0.04em" }}>{t("nav.add")}</span>
              </Link>
            </li>
            {BOTTOM_NAV.slice(2).map((n) => (
              <BottomItem key={n.href} item={n} active={isActive(pathname, n.href)} />
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}

function BottomItem({
  item,
  active,
}: {
  item: { href: string; label: string; icon: string };
  active: boolean;
}) {
  return (
    <li>
      <Link
        href={item.href}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: 64,
          gap: 2,
          color: active ? "var(--color-ink)" : "var(--color-ink-3)",
          textDecoration: "none",
          fontWeight: active ? 600 : 500,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
        <span style={{ fontSize: 11 }}>{item.label}</span>
      </Link>
    </li>
  );
}
