import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatKickoff, formatStage, getTeam } from "@/lib/tournament";
import type { Match, Team } from "@/lib/types";
import { StatusPill } from "./status-pill";
import { TeamCrest } from "./team-crest";

type MatchCardProps = {
  match: Match;
  teams: Team[];
};

function Score({ match }: { match: Match }) {
  if (match.status === "completed" || match.status === "live") {
    return (
      <div className="grid min-w-20 place-items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-xl font-black text-zinc-950 shadow-sm">
        {match.homeScore ?? 0} - {match.awayScore ?? 0}
        {match.homePenaltyScore !== null &&
          match.homePenaltyScore !== undefined &&
          match.awayPenaltyScore !== null &&
          match.awayPenaltyScore !== undefined && (
            <span className="mt-1 text-xs font-semibold text-zinc-500">
              Pens {match.homePenaltyScore}-{match.awayPenaltyScore}
            </span>
          )}
      </div>
    );
  }

  return (
    <div className="grid min-w-20 place-items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-500">
      VS
    </div>
  );
}

export function MatchCard({ match, teams }: MatchCardProps) {
  const home = getTeam(teams, match.homeTeamId);
  const away = getTeam(teams, match.awayTeamId);

  if (!home || !away) return null;

  return (
    <article className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            {formatStage(match.stage)}
          </p>
          <p className="text-sm text-zinc-500">{formatKickoff(match.kickoff)}</p>
        </div>
        <StatusPill status={match.status} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamCrest team={home} size="sm" />
          <p className="min-w-0 truncate text-sm font-extrabold text-zinc-950">{home.name}</p>
        </div>
        <Score match={match} />
        <div className="flex min-w-0 items-center justify-end gap-3 text-right">
          <p className="min-w-0 truncate text-sm font-extrabold text-zinc-950">{away.name}</p>
          <TeamCrest team={away} size="sm" />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <p className="text-sm font-medium text-zinc-500">{match.venue}</p>
        <Link
          href={`/matches/${match.id}`}
          className="inline-flex items-center gap-1 text-sm font-black text-emerald-700 hover:text-emerald-900"
        >
          Details
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
