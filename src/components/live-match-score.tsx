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
      <div className="grid place-items-center rounded-lg border border-zinc-200 bg-zinc-50 px-8 py-5">
        <p className="text-5xl font-black text-zinc-950">
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
      <div className="grid min-w-20 place-items-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-bold text-zinc-500">
        VS
      </div>
    );
  }

  return (
    <div className="grid min-w-20 place-items-center rounded-md border border-zinc-200 bg-white px-3 py-2 text-xl font-black text-zinc-950 shadow-sm">
      {liveMatch.homeScore ?? 0} - {liveMatch.awayScore ?? 0}
      {hasPenaltyScore(liveMatch) && (
        <span className="mt-1 text-xs font-semibold text-zinc-500">
          Pens {liveMatch.homePenaltyScore}-{liveMatch.awayPenaltyScore}
        </span>
      )}
    </div>
  );
}
