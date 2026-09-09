"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Shield, Timer, Trophy } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { QualificationBracket } from "@/components/qualification-bracket";
import { StandingsTable } from "@/components/standings-table";
import { CleanSheetLeaders, PlayerLeaderList } from "@/components/stat-leaders";
import { TeamCrest } from "@/components/team-crest";
import {
  calculateCleanSheets,
  calculatePlayerStats,
  calculateStandings,
  formatKickoff,
  formatStage,
  getRecentResults,
  getUpcomingMatches,
} from "@/lib/tournament";
import type { CompetitionData } from "@/lib/types";
import { useLiveCompetitionData } from "./use-live-match";

type LiveHomeDashboardProps = {
  initialData: CompetitionData;
};

function getMatchRenderKey(match: CompetitionData["matches"][number]) {
  return [
    match.id,
    match.status,
    match.homeScore ?? "none",
    match.awayScore ?? "none",
    match.homePenaltyScore ?? "none",
    match.awayPenaltyScore ?? "none",
    match.homeCleanSheetGoalkeeperId ?? "none",
    match.awayCleanSheetGoalkeeperId ?? "none",
    match.timerPhase ?? "none",
    match.timerStartedAt ?? "none",
    match.timerElapsedSeconds ?? 0,
  ].join("-");
}

export function LiveHomeDashboard({ initialData }: LiveHomeDashboardProps) {
  const data = useLiveCompetitionData(initialData);
  const standings = useMemo(() => calculateStandings(data.teams, data.matches), [data]);
  const playerStats = useMemo(() => calculatePlayerStats(data), [data]);
  const cleanSheets = useMemo(() => calculateCleanSheets(data), [data]);
  const upcomingMatches = useMemo(() => getUpcomingMatches(data.matches, 4), [data]);
  const recentResults = useMemo(() => getRecentResults(data.matches, 3), [data]);
  const completedMatches = data.matches.filter((match) => match.status === "completed").length;
  const liveMatch = data.matches.find((match) => match.status === "live");
  const featuredMatch = liveMatch ?? upcomingMatches[0] ?? recentResults[0];
  const featuredHome = featuredMatch
    ? data.teams.find((team) => team.id === featuredMatch.homeTeamId)
    : null;
  const featuredAway = featuredMatch
    ? data.teams.find((team) => team.id === featuredMatch.awayTeamId)
    : null;
  const featuredMatchLabel = !featuredMatch
    ? ""
    : featuredMatch.status === "live"
      ? "Live now"
      : featuredMatch.status === "completed"
        ? "Latest result"
        : "Next fixture";
  const featuredScore =
    featuredMatch &&
    (featuredMatch.status === "live" ||
      featuredMatch.status === "completed" ||
      featuredMatch.homeScore !== null ||
      featuredMatch.awayScore !== null)
      ? `${featuredMatch.homeScore ?? 0} - ${featuredMatch.awayScore ?? 0}`
      : "VS";
  const heroBadge = liveMatch ? "Live matchday" : "Tournament race";
  const topScorer = playerStats.find((row) => row.goals > 0);

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
        <Image
          src="/bankers-cup-matchday.png"
          alt=""
          fill
          priority
          className="object-cover object-[66%_center]"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(9,9,11,0.96)_0%,rgba(9,9,11,0.88)_38%,rgba(9,9,11,0.46)_72%,rgba(9,9,11,0.12)_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(0deg,#f4f4f2_0%,rgba(244,244,242,0)_100%)]" />

        <div className="relative mx-auto flex min-h-[72svh] max-w-7xl flex-col justify-end px-4 pb-14 pt-16 sm:px-6 sm:pb-16 lg:px-8">
          <div className="max-w-4xl">
            <p className="mb-4 inline-flex rounded-full border border-amber-300/35 bg-amber-300/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-200 backdrop-blur">
              {heroBadge}
            </p>
            <h1 className="max-w-3xl text-5xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
              Bankers Cup
            </h1>
            <p className="mt-5 max-w-2xl text-base font-semibold leading-7 text-zinc-100 sm:text-lg sm:leading-8">
              Fourteen banking teams chase one table, eight knockout places, and a final run under the lights.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/fixtures"
                className="inline-flex min-h-11 items-center gap-2 rounded-md bg-amber-300 px-4 text-sm font-black text-zinc-950 transition hover:bg-amber-200"
              >
                Fixtures
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/standings"
                className="inline-flex min-h-11 items-center gap-2 rounded-md border border-white/25 bg-white/10 px-4 text-sm font-black text-white backdrop-blur transition hover:border-emerald-300/70 hover:bg-emerald-500/20"
              >
                Full table
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <dl className="mt-8 grid max-w-3xl grid-cols-2 gap-x-5 gap-y-4 border-y border-white/15 py-4 sm:grid-cols-4">
              <div>
                <dt className="flex items-center gap-2 text-xs font-black uppercase text-zinc-300">
                  <Shield className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  Teams
                </dt>
                <dd className="mt-2 text-3xl font-black text-white">{data.teams.length}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-black uppercase text-zinc-300">
                  <Trophy className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  Qualify
                </dt>
                <dd className="mt-2 text-3xl font-black text-white">Top 8</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-black uppercase text-zinc-300">
                  <Timer className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  Match
                </dt>
                <dd className="mt-2 text-3xl font-black text-white">60m</dd>
              </div>
              <div>
                <dt className="flex items-center gap-2 text-xs font-black uppercase text-zinc-300">
                  <CalendarDays className="h-4 w-4 text-amber-300" aria-hidden="true" />
                  Results
                </dt>
                <dd className="mt-2 text-3xl font-black text-white">{completedMatches}</dd>
              </div>
            </dl>

            {featuredMatch && featuredHome && featuredAway ? (
              <div className="mt-5 flex max-w-3xl flex-wrap items-center gap-x-5 gap-y-3 rounded-md border border-white/15 bg-zinc-950/35 px-4 py-3 backdrop-blur">
                <div>
                  <p className="text-xs font-black uppercase text-emerald-300">
                    {featuredMatchLabel}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-zinc-300">
                    {formatStage(featuredMatch.stage)} - {formatKickoff(featuredMatch.kickoff)}
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <p className="truncate text-sm font-black text-white sm:text-base">
                    {featuredHome.name}
                  </p>
                  <p className="grid min-w-16 place-items-center rounded-md bg-white px-3 py-2 text-sm font-black text-zinc-950">
                    {featuredScore}
                  </p>
                  <p className="truncate text-right text-sm font-black text-white sm:text-base">
                    {featuredAway.name}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1.45fr_0.85fr] lg:px-8">
        <div className="space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                League phase
              </p>
              <h2 className="text-3xl font-black text-zinc-950">Current Standings</h2>
            </div>
            <Link
              href="/standings"
              className="inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-bold text-white transition hover:bg-emerald-800"
            >
              Full Table
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <StandingsTable rows={standings} compact />
          <QualificationBracket standings={standings} />
        </div>

        <aside className="space-y-6">
          {topScorer && (
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                Golden boot race
              </p>
              <div className="mt-4 flex items-center gap-4">
                <TeamCrest team={topScorer.team} size="lg" />
                <div>
                  <h2 className="text-2xl font-black text-zinc-950">{topScorer.player.name}</h2>
                  <p className="font-semibold text-zinc-500">{topScorer.team.name}</p>
                </div>
              </div>
              <p className="mt-4 text-4xl font-black text-emerald-700">{topScorer.goals}</p>
              <p className="text-sm font-bold text-zinc-500">Goals</p>
            </section>
          )}

          <PlayerLeaderList title="Top Scorers" rows={playerStats} valueKey="goals" />
          <CleanSheetLeaders rows={cleanSheets} />
        </aside>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-zinc-950">Upcoming Fixtures</h2>
              <Link href="/fixtures" className="text-sm font-black text-emerald-700">
                View all
              </Link>
            </div>
            <div className="grid gap-4">
              {upcomingMatches.map((match) => (
                <MatchCard key={getMatchRenderKey(match)} match={match} teams={data.teams} />
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black text-zinc-950">Latest Results</h2>
              <Link href="/fixtures" className="text-sm font-black text-emerald-700">
                Results
              </Link>
            </div>
            <div className="grid gap-4">
              {recentResults.map((match) => (
                <MatchCard key={getMatchRenderKey(match)} match={match} teams={data.teams} />
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
