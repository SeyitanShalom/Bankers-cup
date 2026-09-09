import type { StandingRow } from "@/lib/types";
import { TeamCrest } from "./team-crest";

type StandingsTableProps = {
  rows: StandingRow[];
  compact?: boolean;
};

export function StandingsTable({ rows, compact = false }: StandingsTableProps) {
  const visibleRows = compact ? rows.slice(0, 8) : rows;
  const tableClassName = compact
    ? "w-full table-fixed border-collapse text-xs sm:text-sm"
    : "min-w-[620px] w-full table-fixed border-collapse text-xs sm:text-sm";
  const teamHeaderClassName = compact ? "px-2 py-3 sm:px-4" : "w-48 px-2 py-3 sm:w-56 sm:px-4";
  const teamCellClassName = compact ? "px-2 py-3 sm:px-4" : "w-48 px-2 py-3 sm:w-56 sm:px-4";
  const resultHeaderClassName = compact
    ? "hidden w-12 px-3 py-3 text-center sm:table-cell"
    : "w-12 px-3 py-3 text-center";
  const resultCellClassName = compact
    ? "hidden px-3 py-3 text-center font-semibold text-zinc-700 sm:table-cell"
    : "px-3 py-3 text-center font-semibold text-zinc-700";

  return (
    <div className="animate-rise-in motion-card overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className={compact ? "" : "overflow-x-auto"}>
        <table className={tableClassName}>
          <thead className="bg-zinc-950 text-left text-xs uppercase text-white">
            <tr>
              <th className="w-9 px-2 py-3 sm:w-12 sm:px-4">#</th>
              <th className={teamHeaderClassName}>Team</th>
              <th className="w-9 px-1 py-3 text-center sm:w-12 sm:px-3">P</th>
              <th className={resultHeaderClassName}>W</th>
              <th className={resultHeaderClassName}>D</th>
              <th className={resultHeaderClassName}>L</th>
              {!compact ? (
                <>
                  <th className="w-12 px-3 py-3 text-center">GF</th>
                  <th className="w-12 px-3 py-3 text-center">GA</th>
                </>
              ) : null}
              <th className="w-10 px-1 py-3 text-center sm:w-12 sm:px-3">GD</th>
              <th className="w-11 px-2 py-3 text-center sm:w-16 sm:px-4">Pts</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr
                key={row.team.id}
                className={`border-t border-zinc-100 transition duration-200 hover:bg-amber-50/70 ${
                  row.qualified ? "bg-emerald-50/55" : "bg-white"
                }`}
              >
                <td className="px-2 py-3 font-black text-zinc-500 sm:px-4">{row.rank}</td>
                <td className={teamCellClassName}>
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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
                <td className={resultCellClassName}>{row.won}</td>
                <td className={resultCellClassName}>{row.drawn}</td>
                <td className={resultCellClassName}>{row.lost}</td>
                {!compact ? (
                  <>
                    <td className="px-3 py-3 text-center font-semibold text-zinc-700">
                      {row.goalsFor}
                    </td>
                    <td className="px-3 py-3 text-center font-semibold text-zinc-700">
                      {row.goalsAgainst}
                    </td>
                  </>
                ) : null}
                <td className="px-1 py-3 text-center font-semibold text-zinc-700 sm:px-3">
                  {row.goalDifference > 0 ? "+" : ""}
                  {row.goalDifference}
                </td>
                <td className="px-2 py-3 text-center text-sm font-black text-zinc-950 sm:px-4 sm:text-base">
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
