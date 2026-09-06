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

export const MATCH_DURATION_MINUTES = 60;
export const HALF_DURATION_MINUTES = 30;
export const QUALIFICATION_PLACES = 8;

export function formatStage(stage: MatchStage) {
  const labels: Record<MatchStage, string> = {
    group: "Group",
    quarter_final: "Quarter-final",
    semi_final: "Semi-final",
    final: "Final",
    third_place: "Third place",
  };

  return labels[stage];
}

export function formatEventTime(event: Pick<MatchEvent, "minute" | "addedTime">) {
  return event.addedTime > 0 ? `${event.minute}+${event.addedTime}` : `${event.minute}`;
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

    if (event.type === "goal" && playerStats) {
      playerStats.goals += 1;
    }

    if (event.assistPlayerId) {
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

export function calculateCleanSheets(teams: Team[], matches: Match[]): CleanSheetRow[] {
  const rows = new Map(teams.map((team) => [team.id, { team, cleanSheets: 0 }]));

  matches
    .filter(
      (match) =>
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

      if (match.awayScore === 0) home.cleanSheets += 1;
      if (match.homeScore === 0) away.cleanSheets += 1;
    });

  return Array.from(rows.values()).sort((a, b) => {
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    return a.team.name.localeCompare(b.team.name);
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
    .sort((a, b) => a.minute + a.addedTime / 100 - (b.minute + b.addedTime / 100));
}

export function getQualificationPairings(standings: StandingRow[]) {
  const qualifiers = standings.slice(0, QUALIFICATION_PLACES);

  return [
    [qualifiers[0], qualifiers[7]],
    [qualifiers[3], qualifiers[4]],
    [qualifiers[1], qualifiers[6]],
    [qualifiers[2], qualifiers[5]],
  ].filter((pair) => pair[0] && pair[1]);
}
