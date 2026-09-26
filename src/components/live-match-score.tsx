"use client";

import type { Match } from "@/lib/types";
import { useLiveMatch } from "./use-live-match";

type LiveMatchScoreProps = {
  match: Match;
  variant?: "card" | "large";
};

function hasPenaltyScore(match: Match) {
  return (
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
  );
}

export function LiveMatchScore({ match, variant = "card" }: LiveMatchScoreProps) {
  const liveMatch = useLiveMatch(match);
  const showScore = liveMatch.status === "completed" || liveMatch.status === "live";

  if (variant === "large") {
    return (
      <div
        className={`grid min-w-24 max-w-full place-items-center rounded-md border border-zinc-200 bg-white px-4 py-3 text-zinc-950 shadow-sm sm:min-w-28 sm:px-5 sm:py-3.5 ${
          liveMatch.status === "live" ? "score-glow" : ""
        }`}
      >
        <p className="text-2xl font-black leading-tight sm:text-3xl">
          {showScore ? liveMatch.homeScore ?? 0 : "-"} -{" "}
          {showScore ? liveMatch.awayScore ?? 0 : "-"}
        </p>
        {hasPenaltyScore(liveMatch) && (
          <p className="mt-2 text-sm font-bold text-zinc-500">
            Penalties {liveMatch.homePenaltyScore}-{liveMatch.awayPenaltyScore}
          </p>
        )}
      </div>
    );
  }

  if (!showScore) {
    return (
      <div className="grid min-w-12 place-items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-2 py-1.5 text-xs font-bold text-zinc-500 sm:min-w-20 sm:px-3 sm:py-2 sm:text-sm">
        VS
      </div>
    );
  }

  return (
    <div
      className={`grid min-w-12 place-items-center rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-sm font-black leading-tight text-zinc-950 shadow-sm sm:min-w-20 sm:px-3 sm:py-2 sm:text-xl ${
        liveMatch.status === "live" ? "score-glow" : ""
      }`}
    >
      {liveMatch.homeScore ?? 0} - {liveMatch.awayScore ?? 0}
      {hasPenaltyScore(liveMatch) && (
        <span className="mt-0.5 text-[10px] font-semibold text-zinc-500 sm:mt-1 sm:text-xs">
          Pens {liveMatch.homePenaltyScore}-{liveMatch.awayPenaltyScore}
        </span>
      )}
    </div>
  );
}
