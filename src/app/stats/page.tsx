import { CleanSheetLeaders, PlayerLeaderList } from "@/components/stat-leaders";
import { getCompetitionData } from "@/lib/data";
import { calculateCleanSheets, calculatePlayerStats } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const data = await getCompetitionData();
  const playerStats = calculatePlayerStats(data);
  const cleanSheets = calculateCleanSheets(data.teams, data.matches);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
          Player and team records
        </p>
        <h1 className="text-4xl font-black text-zinc-950">Stats</h1>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <PlayerLeaderList title="Top Scorers" rows={playerStats} valueKey="goals" />
        <PlayerLeaderList title="Assists" rows={playerStats} valueKey="assists" />
        <CleanSheetLeaders rows={cleanSheets} />
        <PlayerLeaderList title="Yellow Cards" rows={playerStats} valueKey="yellowCards" />
        <PlayerLeaderList title="Red Cards" rows={playerStats} valueKey="redCards" />
      </div>
    </main>
  );
}
