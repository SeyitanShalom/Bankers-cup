import {
  HALF_DURATION_MINUTES,
  isKnockoutStage,
  MATCH_DURATION_MINUTES,
} from "./tournament";
import type { Match, MatchTimerPhase, MatchStatus } from "./types";

export type TimerAction =
  | "start_first_half"
  | "half_time"
  | "start_second_half"
  | "full_time"
  | "penalties"
  | "reset";

export type TimerPatch = {
  status: MatchStatus;
  timerPhase: MatchTimerPhase;
  timerStartedAt: string | null;
  timerElapsedSeconds: number;
};

export type TimerSnapshot = {
  phase: MatchTimerPhase;
  label: string;
  phaseLabel: string;
  elapsedSeconds: number;
  running: boolean;
  progress: number;
};

const FIRST_HALF_SECONDS = HALF_DURATION_MINUTES * 60;
const FULL_TIME_SECONDS = MATCH_DURATION_MINUTES * 60;

export function getTimerPhase(match: Match): MatchTimerPhase {
  if (match.timerPhase) {
    return match.timerPhase;
  }

  if (match.status === "completed") {
    return "full_time";
  }

  return "not_started";
}

export function getTimerElapsedSeconds(match: Match, now = Date.now()) {
  const phase = getTimerPhase(match);
  const savedElapsed = match.timerElapsedSeconds ?? 0;

  if (
    (phase === "first_half" || phase === "second_half") &&
    match.timerStartedAt
  ) {
    const startedAt = new Date(match.timerStartedAt).getTime();
    const delta = Math.max(0, Math.floor((now - startedAt) / 1000));

    return savedElapsed + delta;
  }

  if (phase === "half_time") {
    return FIRST_HALF_SECONDS;
  }

  if (phase === "full_time" || phase === "penalties") {
    return FULL_TIME_SECONDS;
  }

  return savedElapsed;
}

function formatRunningMinute(phase: MatchTimerPhase, elapsedSeconds: number) {
  if (phase === "first_half") {
    if (elapsedSeconds < FIRST_HALF_SECONDS) {
      return `${Math.floor(elapsedSeconds / 60) + 1}'`;
    }

    return `${HALF_DURATION_MINUTES}+${Math.floor(
      (elapsedSeconds - FIRST_HALF_SECONDS) / 60,
    ) + 1}'`;
  }

  if (phase === "second_half") {
    if (elapsedSeconds < FULL_TIME_SECONDS) {
      return `${Math.max(
        HALF_DURATION_MINUTES + 1,
        Math.floor(elapsedSeconds / 60) + 1,
      )}'`;
    }

    return `${MATCH_DURATION_MINUTES}+${Math.floor(
      (elapsedSeconds - FULL_TIME_SECONDS) / 60,
    ) + 1}'`;
  }

  return "";
}

export function getTimerSnapshot(match: Match, now?: number): TimerSnapshot {
  const phase = getTimerPhase(match);
  const elapsedSeconds =
    typeof now === "number"
      ? getTimerElapsedSeconds(match, now)
      : match.timerElapsedSeconds ?? 0;
  const running = phase === "first_half" || phase === "second_half";
  const progress = Math.min(100, (elapsedSeconds / FULL_TIME_SECONDS) * 100);

  if (phase === "first_half" || phase === "second_half") {
    return {
      phase,
      elapsedSeconds,
      running,
      progress,
      label: formatRunningMinute(phase, elapsedSeconds),
      phaseLabel: phase === "first_half" ? "1st half" : "2nd half",
    };
  }

  const labels: Record<MatchTimerPhase, Pick<TimerSnapshot, "label" | "phaseLabel">> = {
    not_started: { label: "Kickoff", phaseLabel: "Not started" },
    first_half: { label: "1'", phaseLabel: "1st half" },
    half_time: { label: "HT", phaseLabel: "Half-time" },
    second_half: { label: "31'", phaseLabel: "2nd half" },
    full_time: { label: "FT", phaseLabel: "Full-time" },
    penalties: { label: "PEN", phaseLabel: "Penalties" },
  };

  return {
    phase,
    elapsedSeconds,
    running,
    progress,
    ...labels[phase],
  };
}

export function getTimerPatch(match: Match, action: TimerAction, now = new Date()): TimerPatch {
  if (action === "penalties" && !isKnockoutStage(match.stage)) {
    throw new Error("Penalties only apply to knockout matches");
  }

  const startedAt = now.toISOString();

  const patches: Record<TimerAction, TimerPatch> = {
    start_first_half: {
      status: "live",
      timerPhase: "first_half",
      timerStartedAt: startedAt,
      timerElapsedSeconds: 0,
    },
    half_time: {
      status: "live",
      timerPhase: "half_time",
      timerStartedAt: null,
      timerElapsedSeconds: FIRST_HALF_SECONDS,
    },
    start_second_half: {
      status: "live",
      timerPhase: "second_half",
      timerStartedAt: startedAt,
      timerElapsedSeconds: FIRST_HALF_SECONDS,
    },
    full_time: {
      status: "completed",
      timerPhase: "full_time",
      timerStartedAt: null,
      timerElapsedSeconds: FULL_TIME_SECONDS,
    },
    penalties: {
      status: "live",
      timerPhase: "penalties",
      timerStartedAt: null,
      timerElapsedSeconds: FULL_TIME_SECONDS,
    },
    reset: {
      status: "scheduled",
      timerPhase: "not_started",
      timerStartedAt: null,
      timerElapsedSeconds: 0,
    },
  };

  return patches[action];
}

export function shouldAutoStartTimer(match: Match, nextStatus: MatchStatus) {
  const phase = getTimerPhase(match);

  return (
    nextStatus === "live" &&
    match.status !== "live" &&
    (phase === "not_started" || phase === "full_time")
  );
}
