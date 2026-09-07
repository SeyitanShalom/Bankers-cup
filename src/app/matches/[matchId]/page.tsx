import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock } from "lucide-react";
import { LiveMatchScore } from "@/components/live-match-score";
import { LiveMatchStatus } from "@/components/live-match-status";
import { LiveMatchTimeline } from "@/components/live-match-timeline";
import { LiveMatchTimer } from "@/components/live-match-timer";
import { TeamCrest } from "@/components/team-crest";
import { getCompetitionData } from "@/lib/data";
import {
  formatKickoff,
  formatStage,
  getMatchEvents,
  getTeam,
  isKnockoutStage,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  const data = await getCompetitionData();
  const match = data.matches.find((item) => item.id === matchId);

  if (!match) {
    notFound();
  }

  const home = getTeam(data.teams, match.homeTeamId);
  const away = getTeam(data.teams, match.awayTeamId);

  if (!home || !away) {
    notFound();
  }

  const events = getMatchEvents(data.events, match.id);
  const knockout = isKnockoutStage(match.stage);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/fixtures"
        className="mb-6 inline-flex items-center gap-2 text-sm font-black text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Fixtures
      </Link>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 bg-zinc-950 px-5 py-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-amber-300">
                {formatStage(match.stage)}
              </p>
              <h1 className="text-2xl font-black">{home.name} vs {away.name}</h1>
            </div>
            <LiveMatchStatus match={match} />
          </div>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div className="flex items-center gap-4">
            <TeamCrest team={home} size="lg" />
            <div>
              <p className="text-sm font-bold text-zinc-500">Home</p>
              <h2 className="text-2xl font-black text-zinc-950">{home.name}</h2>
            </div>
          </div>

          <LiveMatchScore match={match} variant="large" />

          <div className="flex items-center justify-start gap-4 md:justify-end md:text-right">
            <div>
              <p className="text-sm font-bold text-zinc-500">Away</p>
              <h2 className="text-2xl font-black text-zinc-950">{away.name}</h2>
            </div>
            <TeamCrest team={away} size="lg" />
          </div>
        </div>

        <div className="grid gap-4 border-t border-zinc-100 p-5 sm:grid-cols-2">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600">
            <Clock className="h-4 w-4 text-emerald-700" aria-hidden="true" />
            {formatKickoff(match.kickoff)}
          </p>
          <p className="text-sm font-semibold text-zinc-600 sm:text-right">{match.venue}</p>
        </div>
        {knockout && (
          <div className="border-t border-zinc-100 bg-emerald-50 px-5 py-3 text-sm font-bold text-emerald-800">
            Tied after 60 minutes goes straight to penalties.
          </div>
        )}
      </section>

      <div className="mt-6">
        <LiveMatchTimer match={match} variant="large" />
      </div>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black text-zinc-950">Match Timeline</h2>
        <div className="mt-5">
          <LiveMatchTimeline
            match={match}
            teams={data.teams}
            players={data.players}
            events={events}
          />
        </div>
      </section>
    </main>
  );
}
