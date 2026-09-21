import { LiveFixturesList } from "@/components/live-fixtures-list";
import { getCompetitionData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function FixturesPage() {
  const data = await getCompetitionData();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
          Schedule and results
        </p>
        <h1 className="text-4xl font-black text-zinc-950">Fixtures</h1>
      </div>

      <LiveFixturesList initialData={data} />
    </main>
  );
}
