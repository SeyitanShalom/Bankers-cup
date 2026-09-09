import type { MatchStatus } from "@/lib/types";

type StatusPillProps = {
  status: MatchStatus;
};

const statusStyles: Record<MatchStatus, string> = {
  scheduled: "border-sky-200 bg-sky-50 text-sky-800",
  live: "border-red-200 bg-red-50 text-red-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  postponed: "border-amber-200 bg-amber-50 text-amber-800",
  cancelled: "border-zinc-200 bg-zinc-100 text-zinc-600",
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold capitalize transition ${statusStyles[status]}`}
    >
      {status === "live" ? (
        <span className="live-pulse-dot h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />
      ) : null}
      {status}
    </span>
  );
}
