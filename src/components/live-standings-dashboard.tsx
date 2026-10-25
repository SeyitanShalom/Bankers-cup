"use client";

import { useMemo } from "react";
import { QualificationBracket } from "@/components/qualification-bracket";
import { StandingsTable } from "@/components/standings-table";
import { calculateStandings } from "@/lib/tournament";
import type { CompetitionData } from "@/lib/types";
import { useLiveCompetitionData } from "./use-live-match";

export function LiveStandingsDashboard({ initialData }: { initialData: CompetitionData }) {
  const data = useLiveCompetitionData(initialData);
  const standings = useMemo(
    () => calculateStandings(data.teams, data.matches, data.events),
    [data],
  );

  return (
    <div className="mt-8 space-y-6">
      <StandingsTable rows={standings} />
      <QualificationBracket data={data} standings={standings} />
    </div>
  );
}
