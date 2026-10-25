import { LiveStandingsDashboard } from "@/components/live-standings-dashboard";
import { getCompetitionData } from "@/lib/data";
import { QUALIFICATION_PLACES } from "@/lib/tournament";

export const dynamic = "force-dynamic";

export default async function StandingsPage() {
  const data = await getCompetitionData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
            One group table
          </p>
          <h1 className="text-3xl font-black text-zinc-950 sm:text-4xl">Standings</h1>
        </div>
        <p className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-800">
          Top {QUALIFICATION_PLACES} qualify
        </p>
      </div>

      <LiveStandingsDashboard initialData={data} />
    </main>
  );
}
