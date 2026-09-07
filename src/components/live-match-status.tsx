"use client";

import type { Match } from "@/lib/types";
import { StatusPill } from "./status-pill";
import { useLiveMatch } from "./use-live-match";

export function LiveMatchStatus({ match }: { match: Match }) {
  const liveMatch = useLiveMatch(match);

  return <StatusPill status={liveMatch.status} />;
}
