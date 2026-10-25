import type { StandingRow } from "@/lib/types";
import { TeamCrest } from "./team-crest";

type StandingsTableProps = {
  rows: StandingRow[];
  compact?: boolean;
};

export function StandingsTable({ rows, compact = false }: StandingsTableProps) {
  const visibleRows = compact ? rows.slice(0, 8) : rows;
  const tableClassName = "w-full table-fixed border-collapse text-xs sm:text-sm";
  const teamHeaderClassName = compact ? "px-2 py-3 sm:px-4" : "px-2 py-3 sm:w-56 sm:px-4";
  const teamCellClassName = compact ? "px-2 py-3 sm:px-4" : "px-2 py-3 sm:w-56 sm:px-4";
  const resultHeaderClassName = "hidden w-12 px-3 py-3 text-center sm:table-cell";
  const resultCellClassName = "hidden px-3 py-3 text-center font-semibold text-zinc-700 sm:table-cell";
  const goalHeaderClassName = "hidden w-12 px-3 py-3 text-center md:table-cell";
  const goalCellClassName = "hidden px-3 py-3 text-center font-semibold text-zinc-700 md:table-cell";
  const cardHeaderClassName = "hidden w-12 px-3 py-3 text-center lg:table-cell";
  const cardCellClassName = "hidden px-3 py-3 text-center font-semibold text-zinc-700 lg:table-cell";

  return (
    <div className="animate-rise-in motion-card overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div>
        <table className={tableClassName}>
          <caption className="caption-bottom border-t border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-xs text-zinc-600 sm:px-4">
            {!compact && "Ranked by points, goal difference, goals scored, then fair play. "}
            Fair play (FP): each yellow or red card adds 1 penalty point; fewer is better.
            {!compact && " Includes player and coach cards from completed league matches only."}
          </caption>
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
                  <th className={goalHeaderClassName}>GF</th>
                  <th className={goalHeaderClassName}>GA</th>
                </>
              ) : null}
              <th className="w-10 px-1 py-3 text-center sm:w-12 sm:px-3">GD</th>
              {!compact ? (
                <>
                  <th className={cardHeaderClassName} title="Yellow cards">
                    YC
                  </th>
                  <th className={cardHeaderClassName} title="Red cards">
                    RC
                  </th>
                  <th className={cardHeaderClassName} title="Fair-play penalty points: lower is better">
                    FP
                  </th>
                </>
              ) : null}
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
                      <p
                        className={`${compact ? "" : "lg:hidden "}text-[10px] font-semibold text-zinc-600 sm:text-xs`}
                      >
                        <span className="whitespace-nowrap">YC {row.yellowCards}</span>{" · "}
                        <span className="whitespace-nowrap">RC {row.redCards}</span>{" · "}
                        <span className="whitespace-nowrap">FP {row.fairPlayPoints}</span>
                      </p>
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
                    <td className={goalCellClassName}>
                      {row.goalsFor}
                    </td>
                    <td className={goalCellClassName}>
                      {row.goalsAgainst}
                    </td>
                  </>
                ) : null}
                <td className="px-1 py-3 text-center font-semibold text-zinc-700 sm:px-3">
                  {row.goalDifference > 0 ? "+" : ""}
                  {row.goalDifference}
                </td>
                {!compact ? (
                  <>
                    <td className={cardCellClassName}>{row.yellowCards}</td>
                    <td className={cardCellClassName}>{row.redCards}</td>
                    <td className={cardCellClassName}>{row.fairPlayPoints}</td>
                  </>
                ) : null}
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
