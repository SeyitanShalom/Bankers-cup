import { getQualificationPairings } from "@/lib/tournament";
import type { StandingRow } from "@/lib/types";
import { TeamCrest } from "./team-crest";

export function QualificationBracket({ standings }: { standings: StandingRow[] }) {
  const pairings = getQualificationPairings(standings);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Projected knockout
          </p>
          <h2 className="text-lg font-black text-zinc-950">Quarter-final Pairings</h2>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
          Top 8 qualify
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {pairings.map(([home, away]) => (
          <div
            key={`${home.team.id}-${away.team.id}`}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <TeamCrest team={home.team} size="sm" />
                <p className="truncate text-sm font-extrabold text-zinc-950">
                  {home.rank}. {home.team.name}
                </p>
              </div>
              <span className="shrink-0 text-xs font-black text-zinc-400">VS</span>
              <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                <p className="truncate text-sm font-extrabold text-zinc-950">
                  {away.rank}. {away.team.name}
                </p>
                <TeamCrest team={away.team} size="sm" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
