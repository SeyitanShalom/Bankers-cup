import { QUALIFICATION_PLACES } from "@/lib/tournament";

type KnockoutMatch = {
  id: string;
  label: string;
  home: string;
  away: string;
};

const rounds: Array<{
  title: string;
  matches: KnockoutMatch[];
}> = [
  {
    title: "Quarter-finals",
    matches: [
      { id: "qf-1", label: "QF 1", home: "1st place team", away: "8th place team" },
      { id: "qf-2", label: "QF 2", home: "4th place team", away: "5th place team" },
      { id: "qf-3", label: "QF 3", home: "2nd place team", away: "7th place team" },
      { id: "qf-4", label: "QF 4", home: "3rd place team", away: "6th place team" },
    ],
  },
  {
    title: "Semi-finals",
    matches: [
      { id: "sf-1", label: "SF 1", home: "Winner of QF 1", away: "Winner of QF 2" },
      { id: "sf-2", label: "SF 2", home: "Winner of QF 3", away: "Winner of QF 4" },
    ],
  },
  {
    title: "Third place",
    matches: [
      { id: "third-place", label: "3rd place", home: "Loser of SF 1", away: "Loser of SF 2" },
    ],
  },
  {
    title: "Final",
    matches: [{ id: "final", label: "Final", home: "Winner of SF 1", away: "Winner of SF 2" }],
  },
];

export function QualificationBracket() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Projected knockout
          </p>
          <h2 className="text-lg font-black text-zinc-950">Knockout Pairings</h2>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
          Top {QUALIFICATION_PLACES} qualify
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {rounds.map((round) => (
          <div key={round.title} className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wide text-zinc-500">
              {round.title}
            </h3>
            <div className="mt-3 grid gap-3">
              {round.matches.map((match) => (
                <div
                  key={match.id}
                  className="rounded-md border border-zinc-200 bg-zinc-50 p-3"
                >
                  <p className="text-[0.68rem] font-black uppercase tracking-wide text-emerald-700">
                    {match.label}
                  </p>
                  <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                    <p className="min-w-0 text-sm font-extrabold leading-5 text-zinc-950">
                      {match.home}
                    </p>
                    <span className="shrink-0 text-xs font-black text-zinc-400">VS</span>
                    <p className="min-w-0 text-right text-sm font-extrabold leading-5 text-zinc-950">
                      {match.away}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
