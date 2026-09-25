import {
  CleanSheetLeaders,
  DisciplineLeaderList,
  PlayerLeaderList,
} from "@/components/stat-leaders";
import { getCompetitionData } from "@/lib/data";
import {
  calculateCleanSheets,
  calculateDisciplineStats,
  calculatePlayerStats,
} from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const data = await getCompetitionData();
  const playerStats = calculatePlayerStats(data);
  const disciplineStats = calculateDisciplineStats(data);
  const cleanSheets = calculateCleanSheets(data);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
          Player records
        </p>
        <h1 className="text-3xl font-black text-zinc-950 sm:text-4xl">Stats</h1>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        <PlayerLeaderList title="Top Scorers" rows={playerStats} valueKey="goals" limit={null} />
        <PlayerLeaderList title="Assists" rows={playerStats} valueKey="assists" limit={null} />
        <CleanSheetLeaders rows={cleanSheets} limit={null} />
        <DisciplineLeaderList
          title="Yellow Cards"
          rows={disciplineStats}
          valueKey="yellowCards"
          limit={null}
        />
        <DisciplineLeaderList
          title="Red Cards"
          rows={disciplineStats}
          valueKey="redCards"
          limit={null}
        />
      </div>
    </main>
  );
}
