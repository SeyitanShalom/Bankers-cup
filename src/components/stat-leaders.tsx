import type { CleanSheetRow, DisciplineStatRow, PlayerStatRow } from "@/lib/types";
import { TeamCrest } from "./team-crest";

type PlayerLeaderListProps = {
  title: string;
  rows: PlayerStatRow[];
  valueKey: "goals" | "assists" | "yellowCards" | "redCards";
  emptyLabel?: string;
  limit?: number | null;
};

export function PlayerLeaderList({
  title,
  rows,
  valueKey,
  emptyLabel = "No records yet",
  limit = 5,
}: PlayerLeaderListProps) {
  const rankedRows = [...rows]
    .filter((row) => row[valueKey] > 0)
    .sort((a, b) => {
      if (b[valueKey] !== a[valueKey]) return b[valueKey] - a[valueKey];
      return a.player.name.localeCompare(b.player.name);
    });
  const leaders = limit === null ? rankedRows : rankedRows.slice(0, limit);

  return (
    <section className="animate-rise-in motion-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {leaders.length > 0 ? (
          leaders.map((row, index) => (
            <div
              key={row.player.id}
              className="flex items-center justify-between gap-4 rounded-md transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-black text-zinc-500">
                  {index + 1}
                </span>
                <TeamCrest team={row.team} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-zinc-950">{row.player.name}</p>
                  <p className="truncate text-xs font-semibold text-zinc-500">{row.team.name}</p>
                </div>
              </div>
              <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-black text-emerald-800">
                {row[valueKey]}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

export function CleanSheetLeaders({
  rows,
  limit = 5,
}: {
  rows: CleanSheetRow[];
  limit?: number | null;
}) {
  const rankedRows = rows.filter((row) => row.cleanSheets > 0);
  const leaders = limit === null ? rankedRows : rankedRows.slice(0, limit);

  return (
    <section className="animate-rise-in motion-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-zinc-950">Clean Sheets</h2>
      <div className="mt-4 space-y-3">
        {leaders.length > 0 ? (
          leaders.map((row, index) => (
            <div
              key={row.player.id}
              className="flex items-center justify-between gap-4 rounded-md transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-black text-zinc-500">
                  {index + 1}
                </span>
                <TeamCrest team={row.team} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-zinc-950">{row.player.name}</p>
                  <p className="truncate text-xs font-semibold text-zinc-500">{row.team.name}</p>
                </div>
              </div>
              <span className="rounded-md bg-sky-100 px-3 py-1 text-sm font-black text-sky-800">
                {row.cleanSheets}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">No clean sheets yet</p>
        )}
      </div>
    </section>
  );
}

export function DisciplineLeaderList({
  title,
  rows,
  valueKey,
  emptyLabel = "No records yet",
  limit = 5,
}: {
  title: string;
  rows: DisciplineStatRow[];
  valueKey: "yellowCards" | "redCards";
  emptyLabel?: string;
  limit?: number | null;
}) {
  const rankedRows = [...rows]
    .filter((row) => row[valueKey] > 0)
    .sort((a, b) => {
      if (b[valueKey] !== a[valueKey]) return b[valueKey] - a[valueKey];
      return a.participant.name.localeCompare(b.participant.name);
    });
  const leaders = limit === null ? rankedRows : rankedRows.slice(0, limit);

  return (
    <section className="animate-rise-in motion-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-black text-zinc-950">{title}</h2>
      <div className="mt-4 space-y-3">
        {leaders.length > 0 ? (
          leaders.map((row, index) => (
            <div
              key={`${row.participantType}-${row.participant.id}`}
              className="flex items-center justify-between gap-4 rounded-md transition duration-200 hover:-translate-y-0.5 hover:bg-zinc-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-black text-zinc-500">
                  {index + 1}
                </span>
                <TeamCrest team={row.team} size="sm" />
                <div className="min-w-0">
                  <p className="truncate font-extrabold text-zinc-950">
                    {row.participant.name}
                  </p>
                  <p className="truncate text-xs font-semibold text-zinc-500">
                    {row.team.name} - {row.participantType}
                  </p>
                </div>
              </div>
              <span className="rounded-md bg-amber-100 px-3 py-1 text-sm font-black text-amber-800">
                {row[valueKey]}
              </span>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}
