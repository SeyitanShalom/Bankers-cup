import { demoCompetition } from "./mock-data";
import { createServerSupabaseClient } from "./supabase";
import type {
  CompetitionData,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStage,
  MatchStatus,
  PenaltyOutcome,
  PenaltyShootoutEvent,
  Player,
  PlayerPosition,
  Team,
} from "./types";

type TeamRow = {
  id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
};

type PlayerRow = {
  id: string;
  team_id: string;
  name: string;
  position: PlayerPosition;
  jersey_number: number;
  created_at: string;
};

type MatchRow = {
  id: string;
  stage: MatchStage;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  venue: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  home_penalty_score: number | null;
  away_penalty_score: number | null;
  winner_team_id: string | null;
  created_at: string;
};

type MatchEventRow = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  assist_player_id: string | null;
  event_type: MatchEventType;
  half: 1 | 2;
  minute: number;
  added_time: number;
  notes: string | null;
};

type PenaltyShootoutEventRow = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  kick_number: number;
  outcome: PenaltyOutcome;
};

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    logoUrl: row.logo_url,
    createdAt: row.created_at,
  };
}

function mapPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    teamId: row.team_id,
    name: row.name,
    position: row.position,
    jerseyNumber: row.jersey_number,
    createdAt: row.created_at,
  };
}

function mapMatch(row: MatchRow): Match {
  return {
    id: row.id,
    stage: row.stage,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    kickoff: row.kickoff,
    venue: row.venue,
    status: row.status,
    homeScore: row.home_score,
    awayScore: row.away_score,
    homePenaltyScore: row.home_penalty_score,
    awayPenaltyScore: row.away_penalty_score,
    winnerTeamId: row.winner_team_id,
    createdAt: row.created_at,
  };
}

function mapEvent(row: MatchEventRow): MatchEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    playerId: row.player_id,
    assistPlayerId: row.assist_player_id,
    type: row.event_type,
    half: row.half,
    minute: row.minute,
    addedTime: row.added_time,
    notes: row.notes,
  };
}

function mapPenalty(row: PenaltyShootoutEventRow): PenaltyShootoutEvent {
  return {
    id: row.id,
    matchId: row.match_id,
    teamId: row.team_id,
    playerId: row.player_id,
    kickNumber: row.kick_number,
    outcome: row.outcome,
  };
}

export async function getCompetitionData(): Promise<CompetitionData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return demoCompetition;
  }

  const [teamsResult, playersResult, matchesResult, eventsResult, penaltiesResult] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("players").select("*").order("jersey_number"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("match_events").select("*"),
      supabase.from("penalty_shootout_events").select("*").order("kick_number"),
    ]);

  if (
    teamsResult.error ||
    playersResult.error ||
    matchesResult.error ||
    eventsResult.error ||
    penaltiesResult.error
  ) {
    console.error("Supabase data load failed. Falling back to demo data.", {
      teams: teamsResult.error?.message,
      players: playersResult.error?.message,
      matches: matchesResult.error?.message,
      events: eventsResult.error?.message,
      penalties: penaltiesResult.error?.message,
    });

    return demoCompetition;
  }

  return {
    teams: (teamsResult.data ?? []).map((row) => mapTeam(row as TeamRow)),
    players: (playersResult.data ?? []).map((row) => mapPlayer(row as PlayerRow)),
    matches: (matchesResult.data ?? []).map((row) => mapMatch(row as MatchRow)),
    events: (eventsResult.data ?? []).map((row) => mapEvent(row as MatchEventRow)),
    penalties: (penaltiesResult.data ?? []).map((row) =>
      mapPenalty(row as PenaltyShootoutEventRow),
    ),
    source: "supabase",
  };
}
