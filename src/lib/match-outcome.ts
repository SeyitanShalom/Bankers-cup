import { getTimerPhase } from "./match-timer";
import { calculateMatchScoreFromEvents, isKnockoutStage } from "./tournament";
import type { Match, MatchEvent } from "./types";

export type MatchScore = ReturnType<typeof calculateMatchScoreFromEvents>;

export type PenaltyScore = {
  homePenaltyScore: number | null;
  awayPenaltyScore: number | null;
};

export type MatchOutcome = MatchScore &
  PenaltyScore & {
    winnerTeamId: string | null;
  };

export type MatchOutcomeOptions = {
  penaltyScore?: PenaltyScore;
  resolveWinner?: boolean;
};

function getNormalTimeWinnerId(match: Match, score: MatchScore) {
  if (score.homeScore > score.awayScore) {
    return match.homeTeamId;
  }

  if (score.awayScore > score.homeScore) {
    return match.awayTeamId;
  }

  return null;
}

function getPenaltyWinnerId(match: Match, penaltyScore: PenaltyScore) {
  if (
    penaltyScore.homePenaltyScore === null ||
    penaltyScore.awayPenaltyScore === null ||
    penaltyScore.homePenaltyScore === penaltyScore.awayPenaltyScore
  ) {
    return null;
  }

  return penaltyScore.homePenaltyScore > penaltyScore.awayPenaltyScore
    ? match.homeTeamId
    : match.awayTeamId;
}

export function getMatchOutcomeFromEvents(
  match: Match,
  events: MatchEvent[],
  options: MatchOutcomeOptions = {},
): MatchOutcome {
  const score = calculateMatchScoreFromEvents(match, events);
  const penaltyScore = options.penaltyScore ?? {
    homePenaltyScore: match.homePenaltyScore ?? null,
    awayPenaltyScore: match.awayPenaltyScore ?? null,
  };
  const tiedAfterNormalTime = score.homeScore === score.awayScore;
  const finalPenaltyScore =
    isKnockoutStage(match.stage) && tiedAfterNormalTime
      ? penaltyScore
      : { homePenaltyScore: null, awayPenaltyScore: null };
  const resolveWinner =
    options.resolveWinner ??
    (match.status === "completed" || getTimerPhase(match) === "full_time");

  return {
    ...score,
    ...finalPenaltyScore,
    winnerTeamId: resolveWinner
      ? getNormalTimeWinnerId(match, score) ?? getPenaltyWinnerId(match, finalPenaltyScore)
      : null,
  };
}
