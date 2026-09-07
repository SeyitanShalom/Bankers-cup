"use client";

import { getMatchEvents } from "@/lib/tournament";
import type { Match, MatchEvent, Player, Team } from "@/lib/types";
import { MatchTimelineList } from "./match-timeline-list";
import { useLiveMatchEvents } from "./use-live-match";

type LiveMatchTimelineProps = {
  match: Match;
  teams: Team[];
  players: Player[];
  events: MatchEvent[];
};

export function LiveMatchTimeline({
  match,
  teams,
  players,
  events,
}: LiveMatchTimelineProps) {
  const liveEvents = useLiveMatchEvents(match.id, events);

  return (
    <MatchTimelineList
      events={getMatchEvents(liveEvents, match.id)}
      teams={teams}
      players={players}
    />
  );
}
