import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { formatKickoff, formatStage, getTeam } from "@/lib/tournament";
import type { Match, Team } from "@/lib/types";
import { LiveMatchScore } from "./live-match-score";
import { LiveMatchStatus } from "./live-match-status";
import { LiveMatchTimer } from "./live-match-timer";
import { TeamCrest } from "./team-crest";

type MatchCardProps = {
  match: Match;
  teams: Team[];
};

export function MatchCard({ match, teams }: MatchCardProps) {
  const home = getTeam(teams, match.homeTeamId);
  const away = getTeam(teams, match.awayTeamId);

  if (!home || !away) return null;

  return (
    <article
      className={`animate-rise-in motion-card rounded-lg border bg-white p-4 shadow-sm ${
        match.status === "live" ? "sheen border-amber-300" : "border-zinc-200"
      }`}
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            {formatStage(match.stage)}
          </p>
          <p className="text-sm text-zinc-500">{formatKickoff(match.kickoff)}</p>
        </div>
        <LiveMatchStatus match={match} />
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <TeamCrest team={home} size="sm" />
          <p className="min-w-0 truncate text-sm font-extrabold text-zinc-950">{home.name}</p>
        </div>
        <LiveMatchScore match={match} />
        <div className="flex min-w-0 items-center justify-end gap-3 text-right">
          <p className="min-w-0 truncate text-sm font-extrabold text-zinc-950">{away.name}</p>
          <TeamCrest team={away} size="sm" />
        </div>
      </div>

      <LiveMatchTimer match={match} />

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-100 pt-3">
        <p className="text-sm font-medium text-zinc-500">{match.venue}</p>
        <Link
          href={`/matches/${match.id}`}
          className="group inline-flex items-center gap-1 text-sm font-black text-emerald-700 transition hover:text-emerald-900"
        >
          Details
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
