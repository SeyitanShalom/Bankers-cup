import { randomUUID } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import { dirname, join } from "path";
import { getTimerPatch, type TimerAction, type TimerPatch } from "./match-timer";
import { getMatchOutcomeFromEvents } from "./match-outcome";
import {
  calculateMatchScoreFromEvents,
  getCleanSheetGoalkeeperId,
  getTeamGoalkeepers,
  isCleanSheetSide,
  isKnockoutStage,
  MATCH_DURATION_MINUTES,
  type MatchSide,
} from "./tournament";
import type {
  CompetitionData,
  Match,
  MatchEventType,
  MatchStage,
  PlayerPosition,
} from "./types";

type AddTeamMutation = {
  action: "addTeam";
  name: string;
  logoUrl?: string | null;
};

type AddPlayerMutation = {
  action: "addPlayer";
  name: string;
  teamId: string;
  position: PlayerPosition;
  jerseyNumber: number;
};

type AddMatchMutation = {
  action: "addMatch";
  stage: MatchStage;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string;
  venue: string;
};

type UpdateTimerMutation = {
  action: "updateTimer";
  matchId: string;
  timerAction: TimerAction;
};

type UpdatePenaltyScoreMutation = {
  action: "updatePenaltyScore";
  matchId: string;
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
};

type UpdateCleanSheetGoalkeeperMutation = {
  action: "updateCleanSheetGoalkeeper";
  matchId: string;
  side: MatchSide;
  goalkeeperId: string | null;
};

type AddEventMutation = {
  action: "addEvent";
  matchId: string;
  teamId: string;
  playerId: string;
  assistPlayerId: string | null;
  type: MatchEventType;
  half: 1 | 2;
  minute: number;
  addedTime: number;
  isDisallowed: boolean;
};

type AddNewsPostMutation = {
  action: "addNewsPost";
  title: string;
  body: string;
};

type UpdateEventDisallowedMutation = {
  action: "updateEventDisallowed";
  eventId: string;
  isDisallowed: boolean;
};

type DeleteMutation = {
  action:
    | "deleteTeam"
    | "deletePlayer"
    | "deleteMatch"
    | "deleteMatchEvent"
    | "deleteNewsPost";
  id: string;
};

export type LocalCompetitionMutation =
  | AddTeamMutation
  | AddPlayerMutation
  | AddMatchMutation
  | UpdateTimerMutation
  | UpdatePenaltyScoreMutation
  | UpdateCleanSheetGoalkeeperMutation
  | AddEventMutation
  | AddNewsPostMutation
  | UpdateEventDisallowedMutation
  | DeleteMutation;

const localDataFile = join(process.cwd(), "data", "competition.json");

export const emptyCompetitionData: CompetitionData = {
  teams: [],
  players: [],
  matches: [],
  events: [],
  penalties: [],
  newsPosts: [],
};

function nowIso() {
  return new Date().toISOString();
}

function sortCompetitionData(data: CompetitionData): CompetitionData {
  return {
    teams: [...data.teams].sort((a, b) => a.name.localeCompare(b.name)),
    players: [...data.players].sort((a, b) => a.jerseyNumber - b.jerseyNumber),
    matches: [...data.matches].sort(
      (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
    ),
    events: [...data.events],
    penalties: [...data.penalties].sort((a, b) => a.kickNumber - b.kickNumber),
    newsPosts: [...data.newsPosts].sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() ||
        a.title.localeCompare(b.title),
    ),
  };
}

function normalizeCompetitionData(value: unknown): CompetitionData {
  const data = value as Partial<CompetitionData> | null;

  return sortCompetitionData({
    teams: Array.isArray(data?.teams) ? data.teams : [],
    players: Array.isArray(data?.players) ? data.players : [],
    matches: Array.isArray(data?.matches) ? data.matches : [],
    events: Array.isArray(data?.events) ? data.events : [],
    penalties: Array.isArray(data?.penalties) ? data.penalties : [],
    newsPosts: Array.isArray(data?.newsPosts) ? data.newsPosts : [],
  });
}

export async function getLocalCompetitionData() {
  try {
    const file = await readFile(localDataFile, "utf8");
    return normalizeCompetitionData(JSON.parse(file));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return emptyCompetitionData;
    }

    throw error;
  }
}

async function saveLocalCompetitionData(data: CompetitionData) {
  const sortedData = sortCompetitionData(data);
  await mkdir(dirname(localDataFile), { recursive: true });
  await writeFile(localDataFile, `${JSON.stringify(sortedData, null, 2)}\n`, "utf8");
  return sortedData;
}

function assertString(value: unknown, message: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(message);
  }

  return value.trim();
}

function assertWholeNumber(value: unknown, message: string) {
  if (!Number.isInteger(value) || Number(value) < 0) {
    throw new Error(message);
  }

  return Number(value);
}

function assertOptionalWholeNumber(value: unknown, message: string) {
  if (value === null) {
    return null;
  }

  return assertWholeNumber(value, message);
}

function getMatchEvents(data: CompetitionData, matchId: string) {
  return data.events.filter((event) => event.matchId === matchId);
}

function getSanitizedCleanSheetPatch(
  match: Pick<
    Match,
    | "status"
    | "homeScore"
    | "awayScore"
    | "homeCleanSheetGoalkeeperId"
    | "awayCleanSheetGoalkeeperId"
  >,
) {
  return {
    homeCleanSheetGoalkeeperId: isCleanSheetSide(match, "home")
      ? match.homeCleanSheetGoalkeeperId ?? null
      : null,
    awayCleanSheetGoalkeeperId: isCleanSheetSide(match, "away")
      ? match.awayCleanSheetGoalkeeperId ?? null
      : null,
  };
}

function applyMatchPatch(data: CompetitionData, matchId: string, patch: Partial<Match>) {
  let found = false;

  const matches = data.matches.map((match) => {
    if (match.id !== matchId) {
      return match;
    }

    found = true;
    const nextMatch = { ...match, ...patch };
    return {
      ...nextMatch,
      ...getSanitizedCleanSheetPatch(nextMatch),
    };
  });

  if (!found) {
    throw new Error("Selected match was not found");
  }

  return { ...data, matches };
}

function applyTimerPatchToMatch(match: Match, patch: TimerPatch): Match {
  return {
    ...match,
    status: patch.status,
    timerPhase: patch.timerPhase,
    timerStartedAt: patch.timerStartedAt,
    timerElapsedSeconds: patch.timerElapsedSeconds,
  };
}

function updateMatchOutcome(data: CompetitionData, match: Match) {
  const outcome = getMatchOutcomeFromEvents(match, getMatchEvents(data, match.id));
  return applyMatchPatch(data, match.id, outcome);
}

function addTeam(data: CompetitionData, mutation: AddTeamMutation): CompetitionData {
  const name = assertString(mutation.name, "Team name is required");

  if (data.teams.some((team) => team.name.toLowerCase() === name.toLowerCase())) {
    throw new Error("That team already exists");
  }

  return {
    ...data,
    teams: [
      ...data.teams,
      {
        id: randomUUID(),
        name,
        logoUrl: mutation.logoUrl ?? null,
        createdAt: nowIso(),
      },
    ],
  };
}

function addPlayer(data: CompetitionData, mutation: AddPlayerMutation): CompetitionData {
  const name = assertString(mutation.name, "Player name is required");
  const teamId = assertString(mutation.teamId, "Choose a team");
  const jerseyNumber = assertWholeNumber(
    mutation.jerseyNumber,
    "Jersey number must be a whole number",
  );

  if (jerseyNumber < 1 || jerseyNumber > 99) {
    throw new Error("Jersey number must be between 1 and 99");
  }

  if (!data.teams.some((team) => team.id === teamId)) {
    throw new Error("Selected team was not found");
  }

  if (
    data.players.some(
      (player) => player.teamId === teamId && player.jerseyNumber === jerseyNumber,
    )
  ) {
    throw new Error("That jersey number is already taken for this team");
  }

  return {
    ...data,
    players: [
      ...data.players,
      {
        id: randomUUID(),
        teamId,
        name,
        position: mutation.position,
        jerseyNumber,
        createdAt: nowIso(),
      },
    ],
  };
}

function addMatch(data: CompetitionData, mutation: AddMatchMutation): CompetitionData {
  const homeTeamId = assertString(mutation.homeTeamId, "Choose a home team");
  const awayTeamId = assertString(mutation.awayTeamId, "Choose an away team");
  const kickoff = assertString(mutation.kickoff, "Kickoff time is required");
  const venue = assertString(mutation.venue, "Venue is required");

  if (homeTeamId === awayTeamId) {
    throw new Error("Choose two different teams");
  }

  if (
    !data.teams.some((team) => team.id === homeTeamId) ||
    !data.teams.some((team) => team.id === awayTeamId)
  ) {
    throw new Error("One of the selected teams was not found");
  }

  return {
    ...data,
    matches: [
      ...data.matches,
      {
        id: randomUUID(),
        stage: mutation.stage,
        homeTeamId,
        awayTeamId,
        kickoff,
        venue,
        status: "scheduled",
        homeScore: null,
        awayScore: null,
        homePenaltyScore: null,
        awayPenaltyScore: null,
        winnerTeamId: null,
        homeCleanSheetGoalkeeperId: null,
        awayCleanSheetGoalkeeperId: null,
        timerPhase: "not_started",
        timerStartedAt: null,
        timerElapsedSeconds: 0,
        createdAt: nowIso(),
      },
    ],
  };
}

function updateTimer(data: CompetitionData, mutation: UpdateTimerMutation): CompetitionData {
  const match = data.matches.find((item) => item.id === mutation.matchId);

  if (!match) {
    throw new Error("Select a match first");
  }

  const patch = getTimerPatch(match, mutation.timerAction);
  const matchAfterTimer = applyTimerPatchToMatch(match, patch);
  let matchPatch: Partial<Match> = { ...matchAfterTimer };

  if (mutation.timerAction === "start_first_half") {
    matchPatch = {
      ...matchPatch,
      homeScore: 0,
      awayScore: 0,
      homePenaltyScore: null,
      awayPenaltyScore: null,
      winnerTeamId: null,
    };
  }

  if (mutation.timerAction === "full_time" || mutation.timerAction === "penalties") {
    matchPatch = {
      ...matchPatch,
      ...getMatchOutcomeFromEvents(matchAfterTimer, getMatchEvents(data, match.id)),
    };
  }

  return applyMatchPatch(data, match.id, matchPatch);
}

function updatePenaltyScore(
  data: CompetitionData,
  mutation: UpdatePenaltyScoreMutation,
): CompetitionData {
  const match = data.matches.find((item) => item.id === mutation.matchId);

  if (!match) {
    throw new Error("Selected match was not found");
  }

  if (!isKnockoutStage(match.stage)) {
    throw new Error("Penalty scores only apply to knockout matches");
  }

  const homePenaltyScore = assertOptionalWholeNumber(
    mutation.homePenaltyScore,
    "Penalty scores must be whole numbers",
  );
  const awayPenaltyScore = assertOptionalWholeNumber(
    mutation.awayPenaltyScore,
    "Penalty scores must be whole numbers",
  );
  const hasHomePenaltyScore = homePenaltyScore !== null;
  const hasAwayPenaltyScore = awayPenaltyScore !== null;

  if (hasHomePenaltyScore !== hasAwayPenaltyScore) {
    throw new Error("Enter both penalty scores or leave both blank");
  }

  if (
    homePenaltyScore !== null &&
    awayPenaltyScore !== null &&
    homePenaltyScore === awayPenaltyScore
  ) {
    throw new Error("Penalty score needs a winner");
  }

  const matchEvents = getMatchEvents(data, match.id);
  const score = calculateMatchScoreFromEvents(match, matchEvents);

  if (homePenaltyScore !== null && awayPenaltyScore !== null && score.homeScore !== score.awayScore) {
    throw new Error("Penalty scores only apply when the knockout score is tied");
  }

  const outcome = getMatchOutcomeFromEvents(match, matchEvents, {
    penaltyScore: {
      homePenaltyScore,
      awayPenaltyScore,
    },
    resolveWinner: homePenaltyScore !== null && awayPenaltyScore !== null,
  });

  return applyMatchPatch(data, match.id, outcome);
}

function updateCleanSheetGoalkeeper(
  data: CompetitionData,
  mutation: UpdateCleanSheetGoalkeeperMutation,
): CompetitionData {
  const matchId = assertString(mutation.matchId, "Select a match");
  const side = mutation.side;
  const match = data.matches.find((item) => item.id === matchId);

  if (!match) {
    throw new Error("Selected match was not found");
  }

  if (side !== "home" && side !== "away") {
    throw new Error("Choose the clean sheet side");
  }

  if (!isCleanSheetSide(match, side)) {
    throw new Error("That team did not keep a clean sheet in this completed match");
  }

  const teamId = side === "home" ? match.homeTeamId : match.awayTeamId;
  const goalkeeperId = mutation.goalkeeperId
    ? assertString(mutation.goalkeeperId, "Choose a goalkeeper")
    : null;

  if (goalkeeperId) {
    const isValidGoalkeeper = getTeamGoalkeepers(data.players, teamId).some(
      (player) => player.id === goalkeeperId,
    );

    if (!isValidGoalkeeper) {
      throw new Error("Choose a goalkeeper from the team that kept the clean sheet");
    }
  }

  return applyMatchPatch(data, match.id, {
    homeCleanSheetGoalkeeperId:
      side === "home" ? goalkeeperId : getCleanSheetGoalkeeperId(match, "home"),
    awayCleanSheetGoalkeeperId:
      side === "away" ? goalkeeperId : getCleanSheetGoalkeeperId(match, "away"),
  });
}

function addEvent(data: CompetitionData, mutation: AddEventMutation): CompetitionData {
  const matchId = assertString(mutation.matchId, "Select a match");
  const teamId = assertString(mutation.teamId, "Choose a team");
  const playerId = assertString(mutation.playerId, "Choose a player");
  const minute = assertWholeNumber(mutation.minute, "Event minute must be a whole number");
  const addedTime = assertWholeNumber(mutation.addedTime, "Added time must be a whole number");
  const match = data.matches.find((item) => item.id === matchId);
  const player = data.players.find((item) => item.id === playerId);
  const assistPlayerId = mutation.type === "goal" ? mutation.assistPlayerId : null;
  const assistPlayer = assistPlayerId
    ? data.players.find((item) => item.id === assistPlayerId)
    : null;

  if (!match) {
    throw new Error("Selected match was not found");
  }

  if (!player) {
    throw new Error("Selected player was not found");
  }

  if (teamId !== match.homeTeamId && teamId !== match.awayTeamId) {
    throw new Error("Choose one of the teams playing this match");
  }

  if (player.teamId !== teamId) {
    throw new Error("Choose a player from the selected team");
  }

  if (assistPlayerId === playerId) {
    throw new Error("A player cannot assist their own goal");
  }

  if (assistPlayerId && !assistPlayer) {
    throw new Error("Selected assist player was not found");
  }

  if (assistPlayer && assistPlayer.teamId !== teamId) {
    throw new Error("Choose an assist from the selected team");
  }

  if (minute < 1 || minute > MATCH_DURATION_MINUTES) {
    throw new Error("Event minute must be between 1 and 60");
  }

  if (addedTime > 20) {
    throw new Error("Added time must be between 0 and 20");
  }

  const nextData = {
    ...data,
    events: [
      ...data.events,
      {
        id: randomUUID(),
        matchId,
        teamId,
        playerId,
        assistPlayerId,
        type: mutation.type,
        half: mutation.half,
        minute,
        addedTime,
        isDisallowed: mutation.isDisallowed,
        notes: null,
        createdAt: nowIso(),
      },
    ],
  };

  return mutation.type === "goal" || mutation.type === "own_goal"
    ? updateMatchOutcome(nextData, match)
    : nextData;
}

function addNewsPost(data: CompetitionData, mutation: AddNewsPostMutation): CompetitionData {
  const title = assertString(mutation.title, "News title is required");
  const body = assertString(mutation.body, "News body is required");
  const createdAt = nowIso();

  return {
    ...data,
    newsPosts: [
      ...data.newsPosts,
      {
        id: randomUUID(),
        title,
        body,
        publishedAt: createdAt,
        createdAt,
      },
    ],
  };
}

function updateEventDisallowed(
  data: CompetitionData,
  mutation: UpdateEventDisallowedMutation,
): CompetitionData {
  const matchEvent = data.events.find((event) => event.id === mutation.eventId);

  if (!matchEvent) {
    throw new Error("Match event was not found");
  }

  if (matchEvent.type !== "goal" && matchEvent.type !== "own_goal") {
    return data;
  }

  const events = data.events.map((event) =>
    event.id === mutation.eventId ? { ...event, isDisallowed: mutation.isDisallowed } : event,
  );
  const nextData = { ...data, events };
  const match = nextData.matches.find((item) => item.id === matchEvent.matchId);

  return match ? updateMatchOutcome(nextData, match) : nextData;
}

function deleteTeam(data: CompetitionData, id: string): CompetitionData {
  const team = data.teams.find((item) => item.id === id);

  if (!team) {
    throw new Error("Team was not found");
  }

  if (data.matches.some((match) => match.homeTeamId === id || match.awayTeamId === id)) {
    throw new Error("Delete this team's fixtures before deleting the team");
  }

  if (data.events.some((event) => event.teamId === id)) {
    throw new Error("Delete this team's match events before deleting the team");
  }

  return {
    ...data,
    teams: data.teams.filter((item) => item.id !== id),
    players: data.players.filter((player) => player.teamId !== id),
  };
}

function deletePlayer(data: CompetitionData, id: string): CompetitionData {
  const player = data.players.find((item) => item.id === id);

  if (!player) {
    throw new Error("Player was not found");
  }

  if (
    data.events.some((event) => event.playerId === id || event.assistPlayerId === id) ||
    data.penalties.some((event) => event.playerId === id)
  ) {
    throw new Error("Delete this player's events before deleting the player");
  }

  return {
    ...data,
    matches: data.matches.map((match) => ({
      ...match,
      homeCleanSheetGoalkeeperId:
        match.homeCleanSheetGoalkeeperId === id ? null : match.homeCleanSheetGoalkeeperId,
      awayCleanSheetGoalkeeperId:
        match.awayCleanSheetGoalkeeperId === id ? null : match.awayCleanSheetGoalkeeperId,
    })),
    players: data.players.filter((item) => item.id !== id),
  };
}

function deleteMatch(data: CompetitionData, id: string): CompetitionData {
  if (!data.matches.some((match) => match.id === id)) {
    throw new Error("Match was not found");
  }

  return {
    ...data,
    matches: data.matches.filter((match) => match.id !== id),
    events: data.events.filter((event) => event.matchId !== id),
    penalties: data.penalties.filter((event) => event.matchId !== id),
  };
}

function deleteMatchEvent(data: CompetitionData, id: string): CompetitionData {
  const matchEvent = data.events.find((event) => event.id === id);

  if (!matchEvent) {
    throw new Error("Match event was not found");
  }

  const nextData = {
    ...data,
    events: data.events.filter((event) => event.id !== id),
  };
  const match = nextData.matches.find((item) => item.id === matchEvent.matchId);

  return match && (matchEvent.type === "goal" || matchEvent.type === "own_goal")
    ? updateMatchOutcome(nextData, match)
    : nextData;
}

function deleteNewsPost(data: CompetitionData, id: string): CompetitionData {
  if (!data.newsPosts.some((post) => post.id === id)) {
    throw new Error("News post was not found");
  }

  return {
    ...data,
    newsPosts: data.newsPosts.filter((post) => post.id !== id),
  };
}

export async function applyLocalCompetitionMutation(mutation: LocalCompetitionMutation) {
  const data = await getLocalCompetitionData();
  let nextData: CompetitionData;

  switch (mutation.action) {
    case "addTeam":
      nextData = addTeam(data, mutation);
      break;
    case "addPlayer":
      nextData = addPlayer(data, mutation);
      break;
    case "addMatch":
      nextData = addMatch(data, mutation);
      break;
    case "updateTimer":
      nextData = updateTimer(data, mutation);
      break;
    case "updatePenaltyScore":
      nextData = updatePenaltyScore(data, mutation);
      break;
    case "updateCleanSheetGoalkeeper":
      nextData = updateCleanSheetGoalkeeper(data, mutation);
      break;
    case "addEvent":
      nextData = addEvent(data, mutation);
      break;
    case "addNewsPost":
      nextData = addNewsPost(data, mutation);
      break;
    case "updateEventDisallowed":
      nextData = updateEventDisallowed(data, mutation);
      break;
    case "deleteTeam":
      nextData = deleteTeam(data, mutation.id);
      break;
    case "deletePlayer":
      nextData = deletePlayer(data, mutation.id);
      break;
    case "deleteMatch":
      nextData = deleteMatch(data, mutation.id);
      break;
    case "deleteMatchEvent":
      nextData = deleteMatchEvent(data, mutation.id);
      break;
    case "deleteNewsPost":
      nextData = deleteNewsPost(data, mutation.id);
      break;
    default:
      throw new Error("Unsupported local data action");
  }

  return saveLocalCompetitionData(nextData);
}
