import { MatchCard } from "@/components/match-card";
import { getCompetitionData } from "@/lib/data";
import { formatStage } from "@/lib/tournament";
import type { MatchStage } from "@/lib/types";

export const dynamic = "force-dynamic";

const stageOrder: MatchStage[] = ["group", "quarter_final", "semi_final", "final", "third_place"];

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

      <div className="mt-8 space-y-8">
        {stageOrder.map((stage) => {
          const matches = data.matches
            .filter((match) => match.stage === stage)
            .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

          if (matches.length === 0) return null;

          return (
            <section key={stage}>
              <h2 className="mb-4 text-2xl font-black text-zinc-950">{formatStage(stage)}</h2>
              <div className="grid gap-4 lg:grid-cols-2">
                {matches.map((match) => (
                  <MatchCard key={match.id} match={match} teams={data.teams} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
