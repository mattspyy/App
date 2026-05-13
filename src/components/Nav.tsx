"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearSession, useSession } from "@/lib/session";

const TOP_NAV = [
  { href: "/parties", label: "Groups" },
  { href: "/scan", label: "Add" },
  { href: "/trips", label: "Trips" },
  { href: "/history", label: "History" },
  { href: "/settings", label: "Settings" },
];

const BOTTOM_NAV: { href: string; label: string; icon: string }[] = [
  { href: "/parties", label: "Groups", icon: "👥" },
  { href: "/trips", label: "Trips", icon: "✈️" },
  { href: "/history", label: "Expenses", icon: "📋" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

function isActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(href + "/");
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();

  function handleLogout() {
    clearSession();
    router.replace("/login");
  }

  const scanActive = isActive(pathname, "/scan");

  return (
    <>
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 flex items-center gap-4 h-14">
          <Link href={session ? "/parties" : "/login"} className="font-semibold text-zinc-900">FXT</Link>
          {session && (
            <>
              <ul className="hidden md:flex gap-1 text-sm">
                {TOP_NAV.map((n) => {
                  const active = isActive(pathname, n.href);
                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        className={
                          "px-3 py-1.5 rounded-full transition-colors " +
                          (active ? "bg-zinc-900 text-white" : "text-zinc-700 hover:bg-zinc-100")
                        }
                      >
                        {n.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              <button onClick={handleLogout} className="ml-auto text-sm text-zinc-600 hover:text-zinc-900">
                Log out
              </button>
            </>
          )}
        </div>
      </nav>

      {session && (
        <nav
          aria-label="Primary"
          className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-zinc-200 pb-[env(safe-area-inset-bottom)]"
        >
          <ul className="grid grid-cols-5 items-end h-16 text-xs">
            {BOTTOM_NAV.slice(0, 2).map((n) => (
              <BottomItem key={n.href} item={n} active={isActive(pathname, n.href)} />
            ))}
            <li className="flex items-start justify-center -mt-5">
              <Link
                href="/scan"
                aria-label="Scan"
                className={
                  "flex flex-col items-center justify-center w-14 h-14 rounded-full shadow-lg border-4 border-white transition-colors " +
                  (scanActive ? "bg-emerald-600 text-white" : "bg-zinc-900 text-white hover:bg-zinc-800")
                }
              >
                <span className="text-xl leading-none">📷</span>
                <span className="text-[10px] mt-0.5 font-medium">Scan</span>
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
        className={
          "flex flex-col items-center justify-center h-16 gap-0.5 transition-colors " +
          (active ? "text-zinc-900 font-medium" : "text-zinc-500 hover:text-zinc-900")
        }
      >
        <span className="text-lg leading-none">{item.icon}</span>
        <span className="text-[11px]">{item.label}</span>
      </Link>
    </li>
  );
}
