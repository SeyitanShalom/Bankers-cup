import {
  formatKickoff,
  getKnockoutSeedSlots,
  getTeam,
  isLeaguePhaseComplete,
  LEAGUE_PHASE_MATCHES_PER_TEAM,
  QUALIFICATION_PLACES,
  QUARTER_FINAL_SEED_PAIRS,
  type KnockoutSeedSlot,
} from "@/lib/tournament";
import type { CompetitionData, Match, MatchStage, StandingRow, Team } from "@/lib/types";
import { StatusPill } from "./status-pill";
import { TeamCrest } from "./team-crest";

type BracketTeam = {
  label: string;
  team: Team | null;
  note: string;
  state: "placeholder" | "clinched" | "confirmed" | "advanced";
};

type BracketMatch = {
  id: string;
  label: string;
  home: BracketTeam;
  away: BracketTeam;
  plannedDate: string;
  match?: Match;
};

type BracketRound = {
  title: string;
  matches: BracketMatch[];
};

function getSeedLabel(seed: number) {
  if (seed === 1) return "1st place team";
  if (seed === 2) return "2nd place team";
  if (seed === 3) return "3rd place team";

  return `${seed}th place team`;
}

function getStageMatches(matches: Match[], stage: MatchStage, limit: number) {
  return matches
    .filter((match) => match.stage === stage)
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, limit);
}

function getPlannedKnockoutDate(matchId: string) {
  const dates: Record<string, string> = {
    "qf-1": "31 Oct 2026",
    "qf-2": "1 Nov 2026",
    "qf-3": "31 Oct 2026",
    "qf-4": "1 Nov 2026",
    "sf-1": "7 Nov 2026",
    "sf-2": "7 Nov 2026",
    "third-place": "14 Nov 2026",
    final: "14 Nov 2026",
  };

  return dates[matchId];
}

function getSeedTeam(seedSlots: KnockoutSeedSlot[], seed: number): BracketTeam {
  const slot = seedSlots.find((item) => item.seed === seed);
  const seedLabel = getSeedLabel(seed);

  if (!slot?.row) {
    return {
      label: seedLabel,
      team: null,
      note: "Seed open",
      state: "placeholder",
    };
  }

  return {
    label: slot.row.team.name,
    team: slot.row.team,
    note: slot.status === "confirmed" ? `${seedLabel} confirmed` : `${seedLabel} clinched`,
    state: slot.status === "confirmed" ? "confirmed" : "clinched",
  };
}

function getMatchWinnerTeamId(match?: Match) {
  if (!match) return null;
  if (match.winnerTeamId) return match.winnerTeamId;
  if (match.status !== "completed" || match.homeScore === null || match.awayScore === null) {
    return null;
  }

  if (match.homeScore > match.awayScore) return match.homeTeamId;
  if (match.awayScore > match.homeScore) return match.awayTeamId;

  if (
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined &&
    match.homePenaltyScore !== match.awayPenaltyScore
  ) {
    return match.homePenaltyScore > match.awayPenaltyScore
      ? match.homeTeamId
      : match.awayTeamId;
  }

  return null;
}

function getMatchLoserTeamId(match?: Match) {
  const winnerTeamId = getMatchWinnerTeamId(match);

  if (!match || !winnerTeamId) {
    return null;
  }

  return winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;
}

function getFallbackTeam(
  teams: Team[],
  match: Match | undefined,
  side: "home" | "away",
) {
  if (!match) {
    return null;
  }

  return getTeam(teams, side === "home" ? match.homeTeamId : match.awayTeamId) ?? null;
}

function getAdvancedTeam(
  teams: Team[],
  teamId: string | null,
  fallbackLabel: string,
  fallbackTeam: Team | null = null,
): BracketTeam {
  const advancedTeam = teamId ? getTeam(teams, teamId) ?? null : null;

  if (advancedTeam) {
    return {
      label: advancedTeam.name,
      team: advancedTeam,
      note: "Advanced",
      state: "advanced",
    };
  }

  if (fallbackTeam) {
    return {
      label: fallbackTeam.name,
      team: fallbackTeam,
      note: "Fixture set",
      state: "confirmed",
    };
  }

  return {
    label: fallbackLabel,
    team: null,
    note: "Awaiting winner",
    state: "placeholder",
  };
}

function getPlacementTeam(
  teams: Team[],
  teamId: string | null,
  fallbackLabel: string,
  fallbackTeam: Team | null = null,
): BracketTeam {
  const placedTeam = teamId ? getTeam(teams, teamId) ?? null : null;

  if (placedTeam) {
    return {
      label: placedTeam.name,
      team: placedTeam,
      note: "Placed",
      state: "advanced",
    };
  }

  if (fallbackTeam) {
    return {
      label: fallbackTeam.name,
      team: fallbackTeam,
      note: "Fixture set",
      state: "confirmed",
    };
  }

  return {
    label: fallbackLabel,
    team: null,
    note: "Awaiting result",
    state: "placeholder",
  };
}

function getFixtureMeta(match?: Match) {
  if (!match) {
    return null;
  }

  const hasScore =
    match.status === "live" ||
    match.status === "completed" ||
    match.homeScore !== null ||
    match.awayScore !== null;
  const score = hasScore ? `${match.homeScore ?? 0}-${match.awayScore ?? 0}` : null;
  const penalties =
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
      ? `Pens ${match.homePenaltyScore}-${match.awayPenaltyScore}`
      : null;

  return [formatKickoff(match.kickoff), match.venue, score, penalties].filter(Boolean).join(" - ");
}

function getMatchMeta(match: BracketMatch) {
  return getFixtureMeta(match.match) ?? `Planned date: ${match.plannedDate}`;
}

function TeamLine({ slot, align = "left" }: { slot: BracketTeam; align?: "left" | "right" }) {
  const badgeClassName =
    slot.state === "placeholder"
      ? "bg-zinc-100 text-zinc-500"
      : slot.state === "clinched"
        ? "bg-amber-100 text-amber-800"
        : "bg-emerald-100 text-emerald-800";

  return (
    <div
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "justify-end text-right" : ""
      }`}
    >
      {align === "left" && slot.team ? <TeamCrest team={slot.team} size="sm" /> : null}
      <div className="min-w-0">
        <p className="truncate text-sm font-extrabold leading-5 text-zinc-950">{slot.label}</p>
        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[0.65rem] font-black ${badgeClassName}`}>
          {slot.note}
        </span>
      </div>
      {align === "right" && slot.team ? <TeamCrest team={slot.team} size="sm" /> : null}
    </div>
  );
}

function buildBracketRounds(data: CompetitionData, standings: StandingRow[]) {
  const seedSlots = getKnockoutSeedSlots(standings, data.matches);
  const quarterFinalMatches = getStageMatches(data.matches, "quarter_final", 4);
  const semiFinalMatches = getStageMatches(data.matches, "semi_final", 2);
  const thirdPlaceMatch = getStageMatches(data.matches, "third_place", 1)[0];
  const finalMatch = getStageMatches(data.matches, "final", 1)[0];

  const quarterFinals = QUARTER_FINAL_SEED_PAIRS.map(([homeSeed, awaySeed], index) => {
    const id = `qf-${index + 1}`;

    return {
      id,
      label: `QF ${index + 1}`,
      home: getSeedTeam(seedSlots, homeSeed),
      away: getSeedTeam(seedSlots, awaySeed),
      plannedDate: getPlannedKnockoutDate(id),
      match: quarterFinalMatches[index],
    };
  });

  const semiFinals: BracketMatch[] = [
    {
      id: "sf-1",
      label: "SF 1",
      home: getAdvancedTeam(
        data.teams,
        getMatchWinnerTeamId(quarterFinalMatches[0]),
        "Winner of QF 1",
        getFallbackTeam(data.teams, semiFinalMatches[0], "home"),
      ),
      away: getAdvancedTeam(
        data.teams,
        getMatchWinnerTeamId(quarterFinalMatches[1]),
        "Winner of QF 2",
        getFallbackTeam(data.teams, semiFinalMatches[0], "away"),
      ),
      plannedDate: getPlannedKnockoutDate("sf-1"),
      match: semiFinalMatches[0],
    },
    {
      id: "sf-2",
      label: "SF 2",
      home: getAdvancedTeam(
        data.teams,
        getMatchWinnerTeamId(quarterFinalMatches[2]),
        "Winner of QF 3",
        getFallbackTeam(data.teams, semiFinalMatches[1], "home"),
      ),
      away: getAdvancedTeam(
        data.teams,
        getMatchWinnerTeamId(quarterFinalMatches[3]),
        "Winner of QF 4",
        getFallbackTeam(data.teams, semiFinalMatches[1], "away"),
      ),
      plannedDate: getPlannedKnockoutDate("sf-2"),
      match: semiFinalMatches[1],
    },
  ];

  const thirdPlace: BracketMatch = {
    id: "third-place",
    label: "3rd place",
    home: getPlacementTeam(
      data.teams,
      getMatchLoserTeamId(semiFinalMatches[0]),
      "Loser of SF 1",
      getFallbackTeam(data.teams, thirdPlaceMatch, "home"),
    ),
    away: getPlacementTeam(
      data.teams,
      getMatchLoserTeamId(semiFinalMatches[1]),
      "Loser of SF 2",
      getFallbackTeam(data.teams, thirdPlaceMatch, "away"),
    ),
    plannedDate: getPlannedKnockoutDate("third-place"),
    match: thirdPlaceMatch,
  };

  const final: BracketMatch = {
    id: "final",
    label: "Final",
    home: getAdvancedTeam(
      data.teams,
      getMatchWinnerTeamId(semiFinalMatches[0]),
      "Winner of SF 1",
      getFallbackTeam(data.teams, finalMatch, "home"),
    ),
    away: getAdvancedTeam(
      data.teams,
      getMatchWinnerTeamId(semiFinalMatches[1]),
      "Winner of SF 2",
      getFallbackTeam(data.teams, finalMatch, "away"),
    ),
    plannedDate: getPlannedKnockoutDate("final"),
    match: finalMatch,
  };

  return [
    { title: "Quarter-finals", matches: quarterFinals },
    { title: "Semi-finals", matches: semiFinals },
    { title: "Third place", matches: [thirdPlace] },
    { title: "Final", matches: [final] },
  ] satisfies BracketRound[];
}

export function QualificationBracket({
  data,
  standings,
}: {
  data: CompetitionData;
  standings: StandingRow[];
}) {
  const rounds = buildBracketRounds(data, standings);
  const leaguePhaseComplete = isLeaguePhaseComplete(standings, data.matches);
  const seedSlots = getKnockoutSeedSlots(standings, data.matches);
  const lockedSeedCount = seedSlots.filter((slot) => slot.row).length;
  const description = leaguePhaseComplete
    ? "The league phase is complete, so the quarter-final places are filled from the final table. Knockout winners and losers move through the path as each result is completed."
    : `Teams appear here once their exact league phase position is mathematically locked. All teams' full ${LEAGUE_PHASE_MATCHES_PER_TEAM}-match league schedules must be in the system before any seed can clinch.`;

  return (
    <section className="animate-rise-in motion-card rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            Projected knockout
          </p>
          <h2 className="text-lg font-black text-zinc-950">Knockout Path</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-zinc-500">
            {description}
          </p>
        </div>
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold text-zinc-600">
          {lockedSeedCount}/{QUALIFICATION_PLACES} seeds locked
        </span>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {rounds.map((round) => (
          <div key={round.title} className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wide text-zinc-500">
              {round.title}
            </h3>
            <div className="mt-3 grid gap-3">
              {round.matches.map((match) => {
                const matchMeta = getMatchMeta(match);

                return (
                  <div
                    key={match.id}
                    className="motion-card rounded-md border border-zinc-200 bg-zinc-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[0.68rem] font-black uppercase tracking-wide text-emerald-700">
                        {match.label}
                      </p>
                      {match.match ? <StatusPill status={match.match.status} /> : null}
                    </div>
                    <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                      <TeamLine slot={match.home} />
                      <span className="shrink-0 text-xs font-black text-zinc-400">VS</span>
                      <TeamLine slot={match.away} align="right" />
                    </div>
                    {matchMeta ? (
                      <p className="mt-3 border-t border-zinc-200 pt-2 text-xs font-bold leading-5 text-zinc-500">
                        {matchMeta}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
