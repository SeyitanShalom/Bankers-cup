import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Trophy } from "lucide-react";
import { formatKickoff, formatStage, getTeam } from "@/lib/tournament";
import type { Match, MatchStatus, Team } from "@/lib/types";
import { LiveMatchScore } from "./live-match-score";
import { LiveMatchStatus } from "./live-match-status";
import { LiveMatchTimer } from "./live-match-timer";
import { TeamCrest } from "./team-crest";

type MatchCardProps = {
  match: Match;
  teams: Team[];
};

const statusTone: Record<
  MatchStatus,
  {
    card: string;
    rail: string;
    icon: string;
    meta: string;
  }
> = {
  scheduled: {
    card: "border-sky-200 bg-white shadow-sky-950/5",
    rail: "bg-sky-500",
    icon: "border-sky-100 bg-sky-50 text-sky-700",
    meta: "text-sky-700",
  },
  live: {
    card: "sheen border-amber-300 bg-amber-50/70 shadow-amber-950/10",
    rail: "bg-amber-400",
    icon: "border-amber-200 bg-amber-300 text-zinc-950",
    meta: "text-amber-700",
  },
  completed: {
    card: "border-emerald-200 bg-white shadow-emerald-950/5",
    rail: "bg-emerald-600",
    icon: "border-emerald-100 bg-emerald-50 text-emerald-700",
    meta: "text-emerald-700",
  },
  postponed: {
    card: "border-amber-200 bg-white shadow-amber-950/5",
    rail: "bg-amber-500",
    icon: "border-amber-100 bg-amber-50 text-amber-700",
    meta: "text-amber-700",
  },
  cancelled: {
    card: "border-zinc-200 bg-zinc-50 shadow-zinc-950/5",
    rail: "bg-zinc-400",
    icon: "border-zinc-200 bg-white text-zinc-600",
    meta: "text-zinc-600",
  },
};

export function MatchCard({ match, teams }: MatchCardProps) {
  const home = getTeam(teams, match.homeTeamId);
  const away = getTeam(teams, match.awayTeamId);
  const tone = statusTone[match.status];

  if (!home || !away) return null;

  return (
    <article
      className={`animate-rise-in motion-card relative overflow-hidden rounded-lg border p-3 shadow-sm sm:p-5 ${tone.card}`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 ${tone.rail}`} />

      <div className="flex flex-wrap items-start justify-between gap-2 pt-1 sm:gap-3">
        <div className="flex min-w-0 items-start gap-2 sm:gap-3">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border sm:h-10 sm:w-10 ${tone.icon}`}
            aria-hidden="true"
          >
            <Trophy className="h-4 w-4 sm:h-5 sm:w-5" />
          </span>
          <div className="min-w-0">
            <p className={`text-[11px] font-black uppercase tracking-wide sm:text-xs ${tone.meta}`}>
              {formatStage(match.stage)}
            </p>
            <p className="mt-1 inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-zinc-500 sm:gap-1.5 sm:text-sm">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4" aria-hidden="true" />
              <span className="truncate">{formatKickoff(match.kickoff)}</span>
            </p>
          </div>
        </div>
        <LiveMatchStatus match={match} />
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-y border-zinc-100 py-3 sm:mt-5 sm:gap-4 sm:py-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <TeamCrest team={home} size="responsiveMd" />
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Home</p>
            <p className="min-w-0 truncate text-xs font-black text-zinc-950 sm:text-base">{home.name}</p>
          </div>
        </div>
        <div className="justify-self-center">
          <LiveMatchScore match={match} />
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2 text-right sm:gap-3">
          <div className="order-2 shrink-0">
            <TeamCrest team={away} size="responsiveMd" />
          </div>
          <div className="order-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">Away</p>
            <p className="min-w-0 truncate text-xs font-black text-zinc-950 sm:text-base">{away.name}</p>
          </div>
        </div>
      </div>

      <LiveMatchTimer match={match} />

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 sm:mt-4 sm:gap-3">
        <p className="inline-flex min-w-0 items-center gap-1 text-xs font-semibold text-zinc-500 sm:gap-1.5 sm:text-sm">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-zinc-400 sm:h-4 sm:w-4" aria-hidden="true" />
          <span className="truncate">{match.venue}</span>
        </p>
        <Link
          href={`/matches/${match.id}`}
          className="group inline-flex min-h-9 items-center gap-1.5 rounded-md bg-zinc-950 px-2.5 text-xs font-black text-white transition hover:-translate-y-0.5 hover:bg-emerald-800 sm:min-h-10 sm:gap-2 sm:px-3 sm:text-sm"
        >
          Details
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 sm:h-4 sm:w-4" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
