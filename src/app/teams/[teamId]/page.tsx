import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { MatchCard } from "@/components/match-card";
import { TeamCrest } from "@/components/team-crest";
import { getCompetitionData } from "@/lib/data";
import { calculatePlayerStats, calculateStandings, getTeam, getTeamPlayers } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function TeamDetailPage({
  params,
}: {
  params: Promise<{ teamId: string }>;
}) {
  const { teamId } = await params;
  const data = await getCompetitionData();
  const team = getTeam(data.teams, teamId);

  if (!team) {
    notFound();
  }

  const standings = calculateStandings(data.teams, data.matches);
  const row = standings.find((standing) => standing.team.id === team.id);
  const squad = getTeamPlayers(data.players, team.id);
  const matches = data.matches
    .filter((match) => match.homeTeamId === team.id || match.awayTeamId === team.id)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const playerStats = calculatePlayerStats(data).filter((stat) => stat.team.id === team.id);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/teams"
        className="mb-6 inline-flex items-center gap-2 text-sm font-black text-emerald-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Teams
      </Link>

      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <TeamCrest team={team} size="lg" />
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                Team profile
              </p>
              <h1 className="text-4xl font-black text-zinc-950">{team.name}</h1>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md bg-zinc-50 px-4 py-3">
              <p className="text-2xl font-black text-zinc-950">{row?.rank ?? "-"}</p>
              <p className="text-xs font-bold text-zinc-500">Rank</p>
            </div>
            <div className="rounded-md bg-zinc-50 px-4 py-3">
              <p className="text-2xl font-black text-zinc-950">{row?.points ?? 0}</p>
              <p className="text-xs font-bold text-zinc-500">Points</p>
            </div>
            <div className="rounded-md bg-zinc-50 px-4 py-3">
              <p className="text-2xl font-black text-zinc-950">{squad.length}</p>
              <p className="text-xs font-bold text-zinc-500">Players</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-6">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Squad</h2>
            <div className="mt-4 divide-y divide-zinc-100">
              {squad.length > 0 ? (
                squad.map((player) => {
                  const stats = playerStats.find((stat) => stat.player.id === player.id);

                  return (
                    <div key={player.id} className="grid grid-cols-[1fr_auto] gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-extrabold text-zinc-950">{player.name}</p>
                      </div>
                      <div className="text-right text-xs font-bold text-zinc-500">
                        <p>{stats?.goals ?? 0} goals</p>
                        <p>{stats?.assists ?? 0} assists</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-zinc-500">No players added yet.</p>
              )}
            </div>
          </section>
        </div>

        <section>
          <h2 className="mb-4 text-2xl font-black text-zinc-950">Matches</h2>
          <div className="grid gap-4">
            {matches.length > 0 ? (
              matches.map((match) => <MatchCard key={match.id} match={match} teams={data.teams} />)
            ) : (
              <p className="rounded-lg border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm">
                No fixtures for this team yet.
              </p>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}
