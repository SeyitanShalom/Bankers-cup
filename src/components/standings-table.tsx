import type { StandingRow } from "@/lib/types";
import { TeamCrest } from "./team-crest";

type StandingsTableProps = {
  rows: StandingRow[];
  compact?: boolean;
};

export function StandingsTable({ rows, compact = false }: StandingsTableProps) {
  const visibleRows = compact ? rows.slice(0, 8) : rows;

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-zinc-950 text-left text-xs uppercase text-white">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-3 py-3 text-center">P</th>
              <th className="px-3 py-3 text-center">W</th>
              <th className="px-3 py-3 text-center">D</th>
              <th className="px-3 py-3 text-center">L</th>
              <th className="px-3 py-3 text-center">GD</th>
              <th className="px-4 py-3 text-center">Pts</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.team.id}
                className={`border-t border-zinc-100 ${
                  row.qualified ? "bg-emerald-50/55" : "bg-white"
                }`}
              >
                <td className="px-4 py-3 font-black text-zinc-500">{row.rank}</td>
                <td className="px-4 py-3">
                  <div className="flex min-w-48 items-center gap-3">
                    <TeamCrest team={row.team} size="sm" />
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-zinc-950">{row.team.name}</p>
                      {row.qualified && (
                        <p className="text-xs font-bold text-emerald-700">Top 8 zone</p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-center font-semibold text-zinc-700">
                  {row.played}
                </td>
                <td className="px-3 py-3 text-center font-semibold text-zinc-700">{row.won}</td>
                <td className="px-3 py-3 text-center font-semibold text-zinc-700">
                  {row.drawn}
                </td>
                <td className="px-3 py-3 text-center font-semibold text-zinc-700">{row.lost}</td>
                <td className="px-3 py-3 text-center font-semibold text-zinc-700">
                  {row.goalDifference > 0 ? "+" : ""}
                  {row.goalDifference}
                </td>
                <td className="px-4 py-3 text-center text-base font-black text-zinc-950">
                  {row.points}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
