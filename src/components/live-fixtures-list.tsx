"use client";

import { useMemo } from "react";
import { MatchCard } from "@/components/match-card";
import type { CompetitionData, Match } from "@/lib/types";
import { useLiveCompetitionData } from "./use-live-match";

type LiveFixturesListProps = {
  initialData: CompetitionData;
};

type FixtureSection = {
  key: string;
  title: string;
  matches: Match[];
};

const byKickoffAsc = (a: Match, b: Match) =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();

const byKickoffDesc = (a: Match, b: Match) =>
  new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime();

function getFixtureSections(matches: Match[]): FixtureSection[] {
  const liveMatches = matches.filter((match) => match.status === "live").sort(byKickoffAsc);
  const upcomingMatches = matches
    .filter((match) => match.status === "scheduled")
    .sort(byKickoffAsc);
  const finishedMatches = matches
    .filter((match) => match.status === "completed")
    .sort(byKickoffDesc);
  const otherMatches = matches
    .filter(
      (match) =>
        match.status !== "live" &&
        match.status !== "scheduled" &&
        match.status !== "completed",
    )
    .sort(byKickoffAsc);

  return [
    { key: "live", title: "Live Matches", matches: liveMatches },
    { key: "upcoming", title: "Upcoming Matches", matches: upcomingMatches },
    { key: "finished", title: "Finished Matches", matches: finishedMatches },
    { key: "other", title: "Other Fixtures", matches: otherMatches },
  ].filter((section) => section.matches.length > 0);
}

export function LiveFixturesList({ initialData }: LiveFixturesListProps) {
  const data = useLiveCompetitionData(initialData);
  const sections = useMemo(() => getFixtureSections(data.matches), [data.matches]);

  if (sections.length === 0) {
    return <p className="mt-8 text-sm font-semibold text-zinc-500">No fixtures yet.</p>;
  }

  return (
    <div className="mt-8 space-y-8">
      {sections.map((section) => (
        <section key={section.key}>
          <h2 className="mb-4 text-xl font-black text-zinc-950 sm:text-2xl">{section.title}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {section.matches.map((match) => (
              <MatchCard key={match.id} match={match} teams={data.teams} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
