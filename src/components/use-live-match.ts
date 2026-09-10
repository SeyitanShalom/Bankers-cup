"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import type {
  CompetitionData,
  Match,
  MatchEvent,
  MatchEventType,
  MatchTimerPhase,
} from "@/lib/types";

type SupabaseMatchPayload = {
  status?: Match["status"];
  timer_phase?: MatchTimerPhase | null;
  timer_started_at?: string | null;
  timer_elapsed_seconds?: number | null;
  home_score?: number | null;
  away_score?: number | null;
  home_penalty_score?: number | null;
  away_penalty_score?: number | null;
  winner_team_id?: string | null;
  home_clean_sheet_goalkeeper_id?: string | null;
  away_clean_sheet_goalkeeper_id?: string | null;
};

type SupabaseMatchEventPayload = {
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
  notes?: string | null;
  created_at?: string;
};

const emptyMatchEvents: MatchEvent[] = [];

type MatchListener = (match: Match) => void;

type MatchStore = {
  match: Match;
  configured: boolean;
  listeners: Set<MatchListener>;
  subscriberCount: number;
  cleanup: (() => void) | null;
};

const matchStores = new Map<string, MatchStore>();

function mergePayloadMatch(match: Match, payload: SupabaseMatchPayload): Match {
  return {
    ...match,
    status: payload.status ?? match.status,
    homeScore: payload.home_score === undefined ? match.homeScore : payload.home_score,
    awayScore: payload.away_score === undefined ? match.awayScore : payload.away_score,
    homePenaltyScore:
      payload.home_penalty_score === undefined
        ? match.homePenaltyScore
        : payload.home_penalty_score,
    awayPenaltyScore:
      payload.away_penalty_score === undefined
        ? match.awayPenaltyScore
        : payload.away_penalty_score,
    winnerTeamId:
      payload.winner_team_id === undefined ? match.winnerTeamId : payload.winner_team_id,
    homeCleanSheetGoalkeeperId:
      payload.home_clean_sheet_goalkeeper_id === undefined
        ? match.homeCleanSheetGoalkeeperId
        : payload.home_clean_sheet_goalkeeper_id,
    awayCleanSheetGoalkeeperId:
      payload.away_clean_sheet_goalkeeper_id === undefined
        ? match.awayCleanSheetGoalkeeperId
        : payload.away_clean_sheet_goalkeeper_id,
    timerPhase: payload.timer_phase ?? match.timerPhase,
    timerStartedAt:
      payload.timer_started_at === undefined ? match.timerStartedAt : payload.timer_started_at,
    timerElapsedSeconds:
      payload.timer_elapsed_seconds === undefined
        ? match.timerElapsedSeconds
        : payload.timer_elapsed_seconds ?? 0,
  };
}

function mapPayloadEvent(payload: SupabaseMatchEventPayload): MatchEvent {
  return {
    id: payload.id,
    matchId: payload.match_id,
    teamId: payload.team_id,
    playerId: payload.player_id,
    assistPlayerId: payload.assist_player_id,
    type: payload.event_type,
    half: payload.half,
    minute: payload.minute,
    addedTime: payload.added_time,
    isDisallowed: payload.is_disallowed ?? false,
    notes: payload.notes ?? null,
    createdAt: payload.created_at,
  };
}

async function fetchCompetitionData() {
  const response = await fetch("/api/competition", { cache: "no-store" });

  if (!response.ok) return null;

  return (await response.json()) as CompetitionData;
}

async function fetchLiveMatch(matchId: string) {
  const data = await fetchCompetitionData();
  return data?.matches.find((item) => item.id === matchId) ?? null;
}

async function fetchLiveMatchEvents(matchId: string) {
  const data = await fetchCompetitionData();
  return data?.events.filter((item) => item.matchId === matchId) ?? null;
}

function upsertEvent(events: MatchEvent[], nextEvent: MatchEvent) {
  const exists = events.some((event) => event.id === nextEvent.id);

  if (!exists) {
    return [...events, nextEvent];
  }

  return events.map((event) => (event.id === nextEvent.id ? nextEvent : event));
}

function setMatchStoreValue(store: MatchStore, match: Match) {
  store.match = match;
  store.listeners.forEach((listener) => listener(match));
}

function createMatchStore(match: Match, configured: boolean): MatchStore {
  const store: MatchStore = {
    match,
    configured,
    listeners: new Set(),
    subscriberCount: 0,
    cleanup: null,
  };

  matchStores.set(match.id, store);
  return store;
}

function getMatchStore(match: Match, configured: boolean) {
  const existingStore = matchStores.get(match.id);

  if (!existingStore) {
    return createMatchStore(match, configured);
  }

  if (existingStore.configured !== configured) {
    existingStore.cleanup?.();
    matchStores.delete(match.id);
    return createMatchStore(match, configured);
  }

  return existingStore;
}

function startMatchStore(store: MatchStore) {
  let active = true;

  const refreshLiveMatch = async () => {
    try {
      const nextMatch = await fetchLiveMatch(store.match.id);
      if (active && nextMatch) setMatchStoreValue(store, nextMatch);
    } catch {
      // Keep the latest rendered snapshot if a background refresh misses.
    }
  };

  const timeout = window.setTimeout(refreshLiveMatch, 0);
  const interval = window.setInterval(refreshLiveMatch, 15000);
  const supabase = store.configured ? createBrowserSupabaseClient() : null;
  const channelName = `match-row-${store.match.id}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;
  const channel = supabase
    ?.channel(channelName)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "matches",
        filter: `id=eq.${store.match.id}`,
      },
      (payload) => {
        setMatchStoreValue(
          store,
          mergePayloadMatch(store.match, payload.new as SupabaseMatchPayload),
        );
      },
    )
    .subscribe();

  store.cleanup = () => {
    active = false;
    window.clearTimeout(timeout);
    window.clearInterval(interval);
    if (channel) {
      void supabase?.removeChannel(channel);
    }
    store.cleanup = null;
  };
}

function subscribeToMatchStore(
  match: Match,
  configured: boolean,
  listener: MatchListener,
) {
  const store = getMatchStore(match, configured);

  store.listeners.add(listener);
  store.subscriberCount += 1;
  listener(store.match);

  if (store.subscriberCount === 1) {
    startMatchStore(store);
  }

  return () => {
    store.listeners.delete(listener);
    store.subscriberCount -= 1;

    if (store.subscriberCount <= 0) {
      store.cleanup?.();
      matchStores.delete(match.id);
    }
  };
}

export function useLiveMatch(match: Match) {
  const [liveMatch, setLiveMatch] = useState(match);
  const configured = hasSupabaseConfig();

  useEffect(() => {
    return subscribeToMatchStore(match, configured, setLiveMatch);
  }, [configured, match]);

  return liveMatch;
}

export function useLiveMatchEvents(
  matchId: string,
  initialEvents: MatchEvent[] = emptyMatchEvents,
) {
  const [liveEvents, setLiveEvents] = useState(initialEvents);
  const configured = hasSupabaseConfig();

  useEffect(() => {
    let active = true;
    const refreshLiveEvents = async () => {
      const nextEvents = await fetchLiveMatchEvents(matchId);
      if (active && nextEvents) setLiveEvents(nextEvents);
    };
    const timeout = window.setTimeout(refreshLiveEvents, 0);
    const interval = window.setInterval(refreshLiveEvents, 15000);
    const supabase = configured ? createBrowserSupabaseClient() : null;

    if (!supabase) {
      return () => {
        active = false;
        window.clearTimeout(timeout);
        window.clearInterval(interval);
      };
    }

    const channelName = `match-events-${matchId}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "match_events",
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            const deletedEvent = payload.old as Partial<SupabaseMatchEventPayload>;
            if (deletedEvent.id) {
              setLiveEvents((current) =>
                current.filter((event) => event.id !== deletedEvent.id),
              );
            }
            return;
          }

          setLiveEvents((current) =>
            upsertEvent(current, mapPayloadEvent(payload.new as SupabaseMatchEventPayload)),
          );
        },
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [configured, matchId]);

  return liveEvents;
}

export function useLiveCompetitionData(initialData: CompetitionData) {
  const [liveData, setLiveData] = useState(initialData);
  const configured = hasSupabaseConfig();

  useEffect(() => {
    let active = true;
    let refreshTimeout: number | undefined;

    const refreshLiveData = async () => {
      try {
        const nextData = await fetchCompetitionData();
        if (active && nextData) setLiveData(nextData);
      } catch {
        // Keep the current snapshot if a background refresh misses.
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimeout !== undefined) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(refreshLiveData, 150);
    };

    const timeout = window.setTimeout(refreshLiveData, 0);
    const interval = window.setInterval(refreshLiveData, 15000);
    const supabase = configured ? createBrowserSupabaseClient() : null;

    if (!supabase) {
      return () => {
        active = false;
        window.clearTimeout(timeout);
        window.clearInterval(interval);
        if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      };
    }

    const channelName = `competition-data-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "match_events" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "penalty_shootout_events" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teams" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "players" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      window.clearInterval(interval);
      if (refreshTimeout !== undefined) window.clearTimeout(refreshTimeout);
      supabase.removeChannel(channel);
    };
  }, [configured]);

  return liveData;
}
