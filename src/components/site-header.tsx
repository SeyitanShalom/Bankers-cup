"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  CalendarDays,
  Home,
  Newspaper,
  Shield,
  Table2,
  Trophy,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: Home },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/standings", label: "Standings", icon: Table2 },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/news", label: "News", icon: Newspaper },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  if (href === "/fixtures" && pathname.startsWith("/matches/")) {
    return true;
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="animate-drop-in sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="group flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-zinc-950 text-white transition duration-200 group-hover:rotate-3 group-hover:bg-emerald-800">
            <Trophy className="h-5 w-5" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-base font-black leading-tight text-zinc-950">
              Bankers Cup
            </span>
            <span className="block text-xs font-bold text-emerald-700">
              Football Competition
            </span>
          </span>
        </Link>

        <nav
          className="flex w-full max-w-full flex-nowrap justify-start gap-1 overflow-x-auto sm:w-auto sm:justify-end"
          aria-label="Main navigation"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isActivePath(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-bold transition duration-200 hover:-translate-y-0.5 active:translate-y-0 ${
                  isActive
                    ? "bg-amber-300 text-zinc-950 shadow-sm hover:bg-amber-200"
                    : "text-zinc-600 hover:bg-emerald-50 hover:text-emerald-800"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
