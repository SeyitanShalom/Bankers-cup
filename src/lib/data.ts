import { createServerSupabaseClient } from "./supabase";
import { getLocalCompetitionData } from "./local-data";
import { calculateMatchScoreFromEvents } from "./tournament";
import type {
  CompetitionData,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStage,
  MatchStatus,
  MatchTimerPhase,
  NewsPost,
  PenaltyOutcome,
  PenaltyShootoutEvent,
  Player,
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
  home_clean_sheet_goalkeeper_id?: string | null;
  away_clean_sheet_goalkeeper_id?: string | null;
  timer_phase?: MatchTimerPhase | null;
  timer_started_at?: string | null;
  timer_elapsed_seconds?: number | null;
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
  is_disallowed?: boolean | null;
  notes: string | null;
  created_at?: string;
};

type PenaltyShootoutEventRow = {
  id: string;
  match_id: string;
  team_id: string;
  player_id: string;
  kick_number: number;
  outcome: PenaltyOutcome;
};

type NewsPostRow = {
  id: string;
  title: string;
  body: string;
  published_at: string;
  created_at: string;
};

type SupabaseDataError = {
  code?: string;
  message?: string;
  details?: string;
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
    homeCleanSheetGoalkeeperId: row.home_clean_sheet_goalkeeper_id ?? null,
    awayCleanSheetGoalkeeperId: row.away_clean_sheet_goalkeeper_id ?? null,
    timerPhase: row.timer_phase ?? undefined,
    timerStartedAt: row.timer_started_at ?? null,
    timerElapsedSeconds: row.timer_elapsed_seconds ?? 0,
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
    isDisallowed: row.is_disallowed ?? false,
    notes: row.notes,
    createdAt: row.created_at,
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

function mapNewsPost(row: NewsPostRow): NewsPost {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

function isMissingTableError(error: SupabaseDataError | null, tableName: string) {
  if (!error) return false;

  const text = `${error.message ?? ""} ${error.details ?? ""}`.toLowerCase();

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    (text.includes(tableName) &&
      (text.includes("not found") ||
        text.includes("does not exist") ||
        text.includes("relation")))
  );
}

function applyEventScores(matches: Match[], events: MatchEvent[]) {
  const eventsByMatchId = new Map<string, MatchEvent[]>();

  events.forEach((event) => {
    if (event.type !== "goal" && event.type !== "own_goal") {
      return;
    }

    const matchEvents = eventsByMatchId.get(event.matchId) ?? [];
    matchEvents.push(event);
    eventsByMatchId.set(event.matchId, matchEvents);
  });

  return matches.map((match) => {
    const matchEvents = eventsByMatchId.get(match.id);

    if (!matchEvents) {
      return match;
    }

    return {
      ...match,
      ...calculateMatchScoreFromEvents(match, matchEvents),
    };
  });
}

export async function getCompetitionData(): Promise<CompetitionData> {
  const supabase = createServerSupabaseClient();

  if (!supabase) {
    return getLocalCompetitionData();
  }

  const [teamsResult, playersResult, matchesResult, eventsResult, penaltiesResult, newsResult] =
    await Promise.all([
      supabase.from("teams").select("*").order("name"),
      supabase.from("players").select("*").order("name"),
      supabase.from("matches").select("*").order("kickoff"),
      supabase.from("match_events").select("*"),
      supabase.from("penalty_shootout_events").select("*").order("kick_number"),
      supabase.from("news_posts").select("*").order("published_at", { ascending: false }),
    ]);

  const newsPostsUnavailable = isMissingTableError(newsResult.error, "news_posts");

  if (
    teamsResult.error ||
    playersResult.error ||
    matchesResult.error ||
    eventsResult.error ||
    penaltiesResult.error ||
    (newsResult.error && !newsPostsUnavailable)
  ) {
    const messages = [
      teamsResult.error?.message,
      playersResult.error?.message,
      matchesResult.error?.message,
      eventsResult.error?.message,
      penaltiesResult.error?.message,
      newsPostsUnavailable ? null : newsResult.error?.message,
    ].filter(Boolean);

    throw new Error(`Unable to load competition data from Supabase: ${messages.join("; ")}`);
  }

  const teams = (teamsResult.data ?? []).map((row) => mapTeam(row as TeamRow));
  const players = (playersResult.data ?? []).map((row) => mapPlayer(row as PlayerRow));
  const events = (eventsResult.data ?? []).map((row) => mapEvent(row as MatchEventRow));
  const matches = applyEventScores(
    (matchesResult.data ?? []).map((row) => mapMatch(row as MatchRow)),
    events,
  );

  return {
    teams,
    players,
    matches,
    events,
    penalties: (penaltiesResult.data ?? []).map((row) =>
      mapPenalty(row as PenaltyShootoutEventRow),
    ),
    newsPosts: newsPostsUnavailable
      ? []
      : (newsResult.data ?? []).map((row) => mapNewsPost(row as NewsPostRow)),
  };
}
