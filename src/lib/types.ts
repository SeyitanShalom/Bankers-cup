export type MatchStage =
  | "group"
  | "quarter_final"
  | "semi_final"
  | "final"
  | "third_place";

export type MatchStatus =
  | "scheduled"
  | "live"
  | "completed"
  | "postponed"
  | "cancelled";

export type PlayerPosition =
  | "Goalkeeper"
  | "Defender"
  | "Midfielder"
  | "Forward";

export type MatchEventType = "goal" | "own_goal" | "yellow_card" | "red_card";

export type PenaltyOutcome = "scored" | "missed" | "saved";

export type Team = {
  id: string;
  name: string;
  logoUrl: string | null;
  createdAt?: string;
};

export type Player = {
  id: string;
  teamId: string;
  name: string;
  position: PlayerPosition;
  jerseyNumber: number;
  createdAt?: string;
};

export type Match = {
  id: string;
  stage: MatchStage;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string;
  venue: string;
  status: MatchStatus;
  homeScore: number | null;
  awayScore: number | null;
  homePenaltyScore?: number | null;
  awayPenaltyScore?: number | null;
  winnerTeamId?: string | null;
  createdAt?: string;
};

export type MatchEvent = {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string;
  assistPlayerId?: string | null;
  type: MatchEventType;
  half: 1 | 2;
  minute: number;
  addedTime: number;
  notes?: string | null;
};

export type PenaltyShootoutEvent = {
  id: string;
  matchId: string;
  teamId: string;
  playerId: string;
  kickNumber: number;
  outcome: PenaltyOutcome;
};

export type CompetitionData = {
  teams: Team[];
  players: Player[];
  matches: Match[];
  events: MatchEvent[];
  penalties: PenaltyShootoutEvent[];
  source: "demo" | "supabase";
};

export type StandingRow = {
  rank: number;
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  qualified: boolean;
};

export type PlayerStatRow = {
  player: Player;
  team: Team;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
};

export type CleanSheetRow = {
  team: Team;
  cleanSheets: number;
};
