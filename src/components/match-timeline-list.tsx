import type { ReactNode } from "react";
import { Goal, Square } from "lucide-react";
import {
  formatEventTime,
  getPlayer,
  getTeam,
} from "@/lib/tournament";
import type { MatchEvent, Player, Team } from "@/lib/types";

type MatchTimelineListProps = {
  events: MatchEvent[];
  teams: Team[];
  players: Player[];
  emptyLabel?: string;
  renderActions?: (event: MatchEvent) => ReactNode;
};

function isScoreEventType(type: MatchEvent["type"]) {
  return type === "goal" || type === "own_goal";
}

function EventIcon({ event }: { event: MatchEvent }) {
  if (isScoreEventType(event.type)) {
    return <Goal className="h-4 w-4" aria-hidden="true" />;
  }

  return <Square className="h-4 w-4" aria-hidden="true" />;
}

function getEventLabel(event: MatchEvent) {
  const label = event.type === "own_goal" ? "Own goal" : event.type.replace("_", " ");

  if (isScoreEventType(event.type) && event.isDisallowed) {
    return `${label} disallowed`;
  }

  return label;
}

function getIconClassName(event: MatchEvent) {
  if (isScoreEventType(event.type) && event.isDisallowed) {
    return "bg-zinc-500 text-white";
  }

  if (event.type === "yellow_card") {
    return "bg-amber-300 text-amber-950";
  }

  if (event.type === "red_card") {
    return "bg-red-600 text-white";
  }

  return "bg-emerald-700 text-white";
}

export function MatchTimelineList({
  events,
  teams,
  players,
  emptyLabel = "No match events added yet.",
  renderActions,
}: MatchTimelineListProps) {
  if (events.length === 0) {
    return <p className="text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const team = getTeam(teams, event.teamId);
        const player = getPlayer(players, event.playerId);
        const assist = event.assistPlayerId ? getPlayer(players, event.assistPlayerId) : null;
        const actions = renderActions?.(event);

        return (
          <div
            key={event.id}
            className={`grid grid-cols-[auto_1fr] gap-3 rounded-md border p-3 ${
              isScoreEventType(event.type) && event.isDisallowed
                ? "border-zinc-300 bg-zinc-50"
                : "border-zinc-200 bg-zinc-50"
            }`}
          >
            <span
              className={`grid h-9 w-9 place-items-center rounded-md ${getIconClassName(event)}`}
            >
              <EventIcon event={event} />
            </span>
            <div className="min-w-0">
              <p className="font-extrabold capitalize text-zinc-950">
                {formatEventTime(event)}&apos; {getEventLabel(event)}
              </p>
              <p className="text-sm font-semibold text-zinc-600">
                {player?.name ?? "Unknown player"}
                {assist ? `, assist by ${assist.name}` : ""} -{" "}
                {team?.name ?? "Unknown team"}
              </p>
              {actions ? <div className="mt-3">{actions}</div> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
