import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Goal, Square } from "lucide-react";
import { StatusPill } from "@/components/status-pill";
import { TeamCrest } from "@/components/team-crest";
import { getCompetitionData } from "@/lib/data";
import {
  formatEventTime,
  formatKickoff,
  formatStage,
  getMatchEvents,
  getPlayer,
  getTeam,
} from "@/lib/tournament";
import type { MatchEvent } from "@/lib/types";

export const revalidate = 30;

function EventIcon({ event }: { event: MatchEvent }) {
  if (event.type === "goal" || event.type === "own_goal") {
    return <Goal className="h-4 w-4" aria-hidden="true" />;
  }

  return <Square className="h-4 w-4" aria-hidden="true" />;
}

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
            <StatusPill status={match.status} />
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

          <div className="grid place-items-center rounded-lg border border-zinc-200 bg-zinc-50 px-8 py-5">
            <p className="text-5xl font-black text-zinc-950">
              {match.homeScore ?? "-"} - {match.awayScore ?? "-"}
            </p>
            {match.homePenaltyScore !== null &&
              match.homePenaltyScore !== undefined &&
              match.awayPenaltyScore !== null &&
              match.awayPenaltyScore !== undefined && (
                <p className="mt-2 text-sm font-bold text-zinc-500">
                  Penalties {match.homePenaltyScore}-{match.awayPenaltyScore}
                </p>
              )}
          </div>

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
      </section>

      <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
        <h2 className="text-2xl font-black text-zinc-950">Match Timeline</h2>
        <div className="mt-5 space-y-3">
          {events.length > 0 ? (
            events.map((event) => {
              const team = getTeam(data.teams, event.teamId);
              const player = getPlayer(data.players, event.playerId);
              const assist = event.assistPlayerId
                ? getPlayer(data.players, event.assistPlayerId)
                : null;

              return (
                <div
                  key={event.id}
                  className="grid grid-cols-[auto_1fr] gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3"
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-md ${
                      event.type === "yellow_card"
                        ? "bg-amber-300 text-amber-950"
                        : event.type === "red_card"
                          ? "bg-red-600 text-white"
                          : "bg-emerald-700 text-white"
                    }`}
                  >
                    <EventIcon event={event} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-extrabold text-zinc-950">
                      {formatEventTime(event)}
                      &apos;{" "}
                      {event.type === "own_goal" ? "Own goal" : event.type.replace("_", " ")}
                    </p>
                    <p className="text-sm font-semibold text-zinc-600">
                      {player?.name ?? "Unknown player"}
                      {assist ? `, assist by ${assist.name}` : ""} -{" "}
                      {team?.name ?? "Unknown team"}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-zinc-500">No match events added yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
