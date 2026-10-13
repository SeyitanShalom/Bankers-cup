"use client";

import type { Match } from "@/lib/types";
import { StatusPill } from "./status-pill";
import { useLiveMatch } from "./use-live-match";

export function LiveMatchStatus({
  match,
  enablePolling,
}: {
  match: Match;
  enablePolling?: boolean;
}) {
  const liveMatch = useLiveMatch(match, {
    enablePolling: enablePolling ?? match.status === "live",
  });

  return <StatusPill status={liveMatch.status} />;
}
