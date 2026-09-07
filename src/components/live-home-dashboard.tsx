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
    match.timerPhase ?? "none",
    match.timerStartedAt ?? "none",
    match.timerElapsedSeconds ?? 0,
  ].join("-");
}

export function LiveHomeDashboard({ initialData }: LiveHomeDashboardProps) {
  const data = useLiveCompetitionData(initialData);
  const standings = useMemo(() => calculateStandings(data.teams, data.matches), [data]);
  const playerStats = useMemo(() => calculatePlayerStats(data), [data]);
  const cleanSheets = useMemo(
    () => calculateCleanSheets(data.teams, data.matches),
    [data],
  );
  const upcomingMatches = useMemo(() => getUpcomingMatches(data.matches, 4), [data]);
  const recentResults = useMemo(() => getRecentResults(data.matches, 3), [data]);
  const completedMatches = data.matches.filter((match) => match.status === "completed").length;
  const topScorer = playerStats.find((row) => row.goals > 0);

  return (
    <main>
      <section className="relative isolate overflow-hidden bg-zinc-950 text-white">
        <Image
          src="/bankers-cup-matchday.png"
          alt=""
          fill
          priority
          className="object-cover opacity-70"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/82 to-zinc-950/15" />

        <div className="relative mx-auto grid min-h-[68vh] max-w-7xl content-center gap-8 px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-amber-200 backdrop-blur">
              Group + Knockout Format
            </p>
            <h1 className="text-5xl font-black leading-none text-white sm:text-6xl lg:text-7xl">
              Bankers Cup
            </h1>
            <p className="mt-5 max-w-2xl text-lg font-medium leading-8 text-zinc-100">
              One group of 14 banking teams, a top 8 qualification race, 60-minute matches,
              and a knockout finish decided straight by penalties when needed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/15 bg-white/12 p-4 backdrop-blur">
              <Shield className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <p className="mt-3 text-3xl font-black">{data.teams.length}</p>
              <p className="text-sm font-semibold text-zinc-200">Teams</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/12 p-4 backdrop-blur">
              <Trophy className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <p className="mt-3 text-3xl font-black">Top 8</p>
              <p className="text-sm font-semibold text-zinc-200">Qualify</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/12 p-4 backdrop-blur">
              <Timer className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <p className="mt-3 text-3xl font-black">60</p>
              <p className="text-sm font-semibold text-zinc-200">Minutes</p>
            </div>
            <div className="rounded-lg border border-white/15 bg-white/12 p-4 backdrop-blur">
              <CalendarDays className="h-5 w-5 text-amber-300" aria-hidden="true" />
              <p className="mt-3 text-3xl font-black">{completedMatches}</p>
              <p className="text-sm font-semibold text-zinc-200">Results</p>
            </div>
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
