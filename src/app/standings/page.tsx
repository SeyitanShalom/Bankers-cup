import { QualificationBracket } from "@/components/qualification-bracket";
import { StandingsTable } from "@/components/standings-table";
import { getCompetitionData } from "@/lib/data";
import { calculateStandings, QUALIFICATION_PLACES } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const data = await getCompetitionData();
  const standings = calculateStandings(data.teams, data.matches);

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
            One group table
          </p>
          <h1 className="text-4xl font-black text-zinc-950">Standings</h1>
        </div>
        <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">
          Top {QUALIFICATION_PLACES} qualify
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <StandingsTable rows={standings} />
        <QualificationBracket />
      </div>
    </main>
  );
}
