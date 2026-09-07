import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { getCompetitionData } from "@/lib/data";
import { calculateStandings, getTeamPlayers } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function TeamsPage() {
  const data = await getCompetitionData();
  const standings = calculateStandings(data.teams, data.matches);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
            Competition roster
          </p>
          <h1 className="text-4xl font-black text-zinc-950">Teams</h1>
        </div>
        <p className="rounded-full bg-white px-4 py-2 text-sm font-bold text-zinc-600 shadow-sm">
          {data.teams.length} registered teams
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.teams.map((team) => {
          const row = standings.find((standing) => standing.team.id === team.id);
          const squad = getTeamPlayers(data.players, team.id);

          return (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="group rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-4">
                <TeamCrest team={team} size="lg" />
                <ArrowRight
                  className="h-5 w-5 text-zinc-300 transition group-hover:text-emerald-700"
                  aria-hidden="true"
                />
              </div>
              <h2 className="mt-5 text-xl font-black text-zinc-950">{team.name}</h2>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-md bg-zinc-50 p-2">
                  <p className="text-lg font-black text-zinc-950">{row?.rank ?? "-"}</p>
                  <p className="text-xs font-bold text-zinc-500">Rank</p>
                </div>
                <div className="rounded-md bg-zinc-50 p-2">
                  <p className="text-lg font-black text-zinc-950">{row?.points ?? 0}</p>
                  <p className="text-xs font-bold text-zinc-500">Pts</p>
                </div>
                <div className="rounded-md bg-zinc-50 p-2">
                  <p className="text-lg font-black text-zinc-950">{squad.length}</p>
                  <p className="text-xs font-bold text-zinc-500">Players</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
