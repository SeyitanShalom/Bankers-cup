import Link from "next/link";
import { BarChart3, CalendarDays, LockKeyhole, Shield, Table2, Trophy } from "lucide-react";

const navItems = [
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/fixtures", label: "Fixtures", icon: CalendarDays },
  { href: "/standings", label: "Standings", icon: Table2 },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/admin", label: "Admin", icon: LockKeyhole },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-zinc-950 text-white">
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

        <nav className="flex max-w-full gap-1 overflow-x-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-bold text-zinc-600 transition hover:bg-emerald-50 hover:text-emerald-800"
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
