import type {
  CleanSheetRow,
  CompetitionData,
  Match,
  MatchEvent,
  MatchStage,
  Player,
  PlayerStatRow,
  StandingRow,
  Team,
} from "./types";

export type MatchSide = "home" | "away";

export const MATCH_DURATION_MINUTES = 60;
export const HALF_DURATION_MINUTES = 30;
export const LEAGUE_PHASE_MATCHES_PER_TEAM = 4;
export const QUALIFICATION_PLACES = 8;
export const QUARTER_FINAL_SEED_PAIRS = [
  [1, 8],
  [4, 5],
  [2, 7],
  [3, 6],
] as const;

export type KnockoutSeedSlot = {
  seed: number;
  row: StandingRow | null;
  status: "confirmed" | "clinched" | "pending";
};

export function formatStage(stage: MatchStage) {
  const labels: Record<MatchStage, string> = {
    group: "League phase",
    quarter_final: "Quarter-final",
    semi_final: "Semi-final",
    final: "Final",
    third_place: "Third place",
  };

  return labels[stage];
}

export function isKnockoutStage(stage: MatchStage) {
  return stage !== "group";
}

export function formatEventTime(event: Pick<MatchEvent, "minute" | "addedTime">) {
  return event.addedTime > 0 ? `${event.minute}+${event.addedTime}` : `${event.minute}`;
}

export function isScoreEvent(event: Pick<MatchEvent, "type" | "isDisallowed">) {
  return (event.type === "goal" || event.type === "own_goal") && !event.isDisallowed;
}

export function calculateMatchScoreFromEvents(
  match: Pick<Match, "homeTeamId" | "awayTeamId">,
  events: MatchEvent[],
) {
  return events.reduce(
    (score, event) => {
      if (!isScoreEvent(event)) {
        return score;
      }

      if (event.type === "goal") {
        if (event.teamId === match.homeTeamId) score.homeScore += 1;
        if (event.teamId === match.awayTeamId) score.awayScore += 1;
        return score;
      }

      if (event.teamId === match.homeTeamId) score.awayScore += 1;
      if (event.teamId === match.awayTeamId) score.homeScore += 1;

      return score;
    },
    { homeScore: 0, awayScore: 0 },
  );
}

export function formatKickoff(kickoff: string) {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(kickoff));
}

export function getTeam(teams: Team[], teamId: string) {
  return teams.find((team) => team.id === teamId);
}

export function getPlayer(players: Player[], playerId: string) {
  return players.find((player) => player.id === playerId);
}

export function getTeamPlayers(players: Player[], teamId: string) {
  return players
    .filter((player) => player.teamId === teamId)
    .sort((a, b) => a.jerseyNumber - b.jerseyNumber);
}

export function getTeamGoalkeepers(players: Player[], teamId: string) {
  return getTeamPlayers(players, teamId).filter((player) => player.position === "Goalkeeper");
}

export function isCleanSheetSide(
  match: Pick<Match, "status" | "homeScore" | "awayScore">,
  side: MatchSide,
) {
  if (match.status !== "completed" || match.homeScore === null || match.awayScore === null) {
    return false;
  }

  return side === "home" ? match.awayScore === 0 : match.homeScore === 0;
}

export function getCleanSheetGoalkeeperId(
  match: Pick<Match, "homeCleanSheetGoalkeeperId" | "awayCleanSheetGoalkeeperId">,
  side: MatchSide,
) {
  return side === "home"
    ? match.homeCleanSheetGoalkeeperId ?? null
    : match.awayCleanSheetGoalkeeperId ?? null;
}

export function calculateStandings(teams: Team[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, Omit<StandingRow, "rank" | "qualified">>();

  teams.forEach((team) => {
    rows.set(team.id, {
      team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
    });
  });

  matches
    .filter(
      (match) =>
        match.stage === "group" &&
        match.status === "completed" &&
        match.homeScore !== null &&
        match.awayScore !== null,
    )
    .forEach((match) => {
      const home = rows.get(match.homeTeamId);
      const away = rows.get(match.awayTeamId);

      if (!home || !away || match.homeScore === null || match.awayScore === null) {
        return;
      }

      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;

      if (match.homeScore > match.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
      } else if (match.homeScore < match.awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
      }
    });

  return Array.from(rows.values())
    .map((row) => ({
      ...row,
      goalDifference: row.goalsFor - row.goalsAgainst,
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return a.team.name.localeCompare(b.team.name);
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
      qualified: index < QUALIFICATION_PLACES,
    }));
}

function getLeaguePhaseMatches(matches: Match[]) {
  return matches.filter((match) => match.stage === "group");
}

function getRemainingLeagueMatches(matches: Match[]) {
  return matches.filter(
    (match) =>
      match.stage === "group" &&
      (match.status !== "completed" || match.homeScore === null || match.awayScore === null),
  );
}

function getRemainingLeagueMatchCounts(matches: Match[]) {
  const counts = new Map<string, number>();

  getRemainingLeagueMatches(matches).forEach((match) => {
    counts.set(match.homeTeamId, (counts.get(match.homeTeamId) ?? 0) + 1);
    counts.set(match.awayTeamId, (counts.get(match.awayTeamId) ?? 0) + 1);
  });

  return counts;
}

function getLeagueScheduleMatchCounts(matches: Match[]) {
  const counts = new Map<string, number>();

  getLeaguePhaseMatches(matches).forEach((match) => {
    counts.set(match.homeTeamId, (counts.get(match.homeTeamId) ?? 0) + 1);
    counts.set(match.awayTeamId, (counts.get(match.awayTeamId) ?? 0) + 1);
  });

  return counts;
}

function hasFullLeagueSchedule(
  row: StandingRow,
  leagueScheduleMatchCounts: Map<string, number>,
) {
  return (leagueScheduleMatchCounts.get(row.team.id) ?? 0) === LEAGUE_PHASE_MATCHES_PER_TEAM;
}

function isLeagueScheduleReady(
  standings: StandingRow[],
  leagueScheduleMatchCounts: Map<string, number>,
) {
  return (
    standings.length > 0 &&
    standings.every((row) => hasFullLeagueSchedule(row, leagueScheduleMatchCounts))
  );
}

export function isLeaguePhaseComplete(standings: StandingRow[], matches: Match[]) {
  const leagueScheduleMatchCounts = getLeagueScheduleMatchCounts(matches);

  if (!isLeagueScheduleReady(standings, leagueScheduleMatchCounts)) {
    return false;
  }

  return standings.every((row) => row.played === LEAGUE_PHASE_MATCHES_PER_TEAM);
}

function isSeedClinched(
  row: StandingRow,
  standings: StandingRow[],
  remainingMatchCounts: Map<string, number>,
  leagueScheduleMatchCounts: Map<string, number>,
) {
  const currentIndex = standings.findIndex((standing) => standing.team.id === row.team.id);

  if (currentIndex === -1 || !hasFullLeagueSchedule(row, leagueScheduleMatchCounts)) {
    return false;
  }

  const teamRemainingMatches = remainingMatchCounts.get(row.team.id) ?? 0;
  const maximumPoints = row.points + teamRemainingMatches * 3;
  const teamsAbove = standings.slice(0, currentIndex);
  const teamsBelow = standings.slice(currentIndex + 1);
  const cannotMoveUp = teamsAbove.every((other) => {
    const otherRemainingMatches = remainingMatchCounts.get(other.team.id) ?? 0;

    if (other.points > maximumPoints) {
      return true;
    }

    return (
      teamRemainingMatches === 0 &&
      otherRemainingMatches === 0 &&
      other.points === row.points
    );
  });
  const cannotMoveDown = teamsBelow.every((other) => {
    const otherRemainingMatches = remainingMatchCounts.get(other.team.id) ?? 0;
    const otherMaximumPoints = other.points + otherRemainingMatches * 3;

    if (otherMaximumPoints < row.points) {
      return true;
    }

    return (
      teamRemainingMatches === 0 &&
      otherRemainingMatches === 0 &&
      other.points === row.points
    );
  });

  return cannotMoveUp && cannotMoveDown;
}

export function getKnockoutSeedSlots(
  standings: StandingRow[],
  matches: Match[],
): KnockoutSeedSlot[] {
  const leaguePhaseComplete = isLeaguePhaseComplete(standings, matches);
  const remainingMatchCounts = getRemainingLeagueMatchCounts(matches);
  const leagueScheduleMatchCounts = getLeagueScheduleMatchCounts(matches);
  const leagueScheduleReady = isLeagueScheduleReady(standings, leagueScheduleMatchCounts);

  return Array.from({ length: QUALIFICATION_PLACES }, (_, index) => {
    const seed = index + 1;
    const row = standings[index] ?? null;

    if (!row) {
      return { seed, row: null, status: "pending" };
    }

    if (leaguePhaseComplete) {
      return { seed, row, status: "confirmed" };
    }

    if (
      leagueScheduleReady &&
      isSeedClinched(row, standings, remainingMatchCounts, leagueScheduleMatchCounts)
    ) {
      return { seed, row, status: "clinched" };
    }

    return { seed, row: null, status: "pending" };
  });
}

export function calculatePlayerStats(data: CompetitionData): PlayerStatRow[] {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  const stats = new Map<string, PlayerStatRow>();

  data.players.forEach((player) => {
    const team = teamById.get(player.teamId);

    if (!team) return;

    stats.set(player.id, {
      player,
      team,
      goals: 0,
      assists: 0,
      yellowCards: 0,
      redCards: 0,
    });
  });

  data.events.forEach((event) => {
    const playerStats = stats.get(event.playerId);

    if (event.type === "goal" && !event.isDisallowed && playerStats) {
      playerStats.goals += 1;
    }

    if (event.type === "goal" && !event.isDisallowed && event.assistPlayerId) {
      const assistStats = stats.get(event.assistPlayerId);
      if (assistStats) assistStats.assists += 1;
    }

    if (event.type === "yellow_card" && playerStats) {
      playerStats.yellowCards += 1;
    }

    if (event.type === "red_card" && playerStats) {
      playerStats.redCards += 1;
    }
  });

  return Array.from(stats.values()).sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return a.player.name.localeCompare(b.player.name);
  });
}

export function calculateCleanSheets(data: CompetitionData): CleanSheetRow[] {
  const teamById = new Map(data.teams.map((team) => [team.id, team]));
  const rows = new Map<string, CleanSheetRow>();

  data.players.forEach((player) => {
    const team = teamById.get(player.teamId);

    if (!team || player.position !== "Goalkeeper") return;

    rows.set(player.id, {
      player,
      team,
      cleanSheets: 0,
    });
  });

  data.matches
    .filter(
      (match) =>
        match.status === "completed" &&
        match.homeScore !== null &&
        match.awayScore !== null,
    )
    .forEach((match) => {
      if (isCleanSheetSide(match, "home") && match.homeCleanSheetGoalkeeperId) {
        const homeGoalkeeper = rows.get(match.homeCleanSheetGoalkeeperId);
        if (homeGoalkeeper?.player.teamId === match.homeTeamId) {
          homeGoalkeeper.cleanSheets += 1;
        }
      }

      if (isCleanSheetSide(match, "away") && match.awayCleanSheetGoalkeeperId) {
        const awayGoalkeeper = rows.get(match.awayCleanSheetGoalkeeperId);
        if (awayGoalkeeper?.player.teamId === match.awayTeamId) {
          awayGoalkeeper.cleanSheets += 1;
        }
      }
    });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    return a.player.name.localeCompare(b.player.name);
  });
}

export function getUpcomingMatches(matches: Match[], limit = 5) {
  return matches
    .filter((match) => match.status === "scheduled" || match.status === "live")
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
    .slice(0, limit);
}

export function getRecentResults(matches: Match[], limit = 5) {
  return matches
    .filter((match) => match.status === "completed")
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime())
    .slice(0, limit);
}

export function getMatchEvents(events: MatchEvent[], matchId: string) {
  return events
    .filter((event) => event.matchId === matchId)
    .sort((a, b) => {
      const timeDifference = a.minute + a.addedTime / 100 - (b.minute + b.addedTime / 100);

      if (timeDifference !== 0) {
        return timeDifference;
      }

      return (a.createdAt ?? a.id).localeCompare(b.createdAt ?? b.id);
    });
}
