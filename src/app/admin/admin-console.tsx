"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CalendarPlus,
  CirclePlus,
  ClipboardList,
  Flag,
  LogIn,
  LogOut,
  Newspaper,
  Pause,
  Pencil,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Shirt,
  Trash2,
  Trophy,
  Upload,
  X,
} from "lucide-react";
import { MatchTimelineList } from "@/components/match-timeline-list";
import { TeamCrest } from "@/components/team-crest";
import { StatusPill } from "@/components/status-pill";
import { LiveMatchTimer } from "@/components/live-match-timer";
import {
  getTimerPatch,
  getTimerPhase,
  type TimerAction,
  type TimerPatch,
} from "@/lib/match-timer";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import type { Session } from "@supabase/supabase-js";
import {
  getMatchOutcomeFromEvents,
  type MatchOutcome,
  type MatchOutcomeOptions,
} from "@/lib/match-outcome";
import {
  calculateMatchScoreFromEvents,
  calculatePlayerStats,
  calculateStandings,
  formatKickoff,
  formatStage,
  getCleanSheetGoalkeeperId,
  getMatchEvents,
  getTeamGoalkeepers,
  HALF_DURATION_MINUTES,
  isCleanSheetSide,
  isKnockoutStage,
  MATCH_DURATION_MINUTES,
  type MatchSide,
} from "@/lib/tournament";
import type {
  CompetitionData,
  Match,
  MatchEvent,
  MatchEventType,
  MatchStage,
  NewsPost,
  Player,
  PlayerPosition,
  Team,
} from "@/lib/types";

type AdminConsoleProps = {
  initialData: CompetitionData;
};

type AuthStatus = "checking" | "signed_out" | "authorized" | "forbidden" | "unconfigured";

type Tab = "teams" | "players" | "matches" | "events" | "news";

const positions: PlayerPosition[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const stages: MatchStage[] = ["group", "quarter_final", "semi_final", "final", "third_place"];
const eventTypes: MatchEventType[] = ["goal", "own_goal", "yellow_card", "red_card"];

type SupabaseMatchEventRow = {
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

type LocalCompetitionMutation = {
  action: string;
  [key: string]: unknown;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function fetchCompetitionData() {
  const response = await fetch("/api/competition", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load competition data");
  }

  return (await response.json()) as CompetitionData;
}

async function saveLocalCompetitionMutation(mutation: LocalCompetitionMutation) {
  const response = await fetch("/api/competition", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mutation),
  });
  const body = (await response.json().catch(() => null)) as
    | (CompetitionData & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(body?.error ?? "Unable to update local data");
  }

  return body as CompetitionData;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read logo file"));
    };
    reader.onerror = () => reject(new Error("Unable to read logo file"));
    reader.readAsDataURL(file);
  });
}

function NumberInput({
  id,
  name,
  label,
  min = 0,
  max,
  required = true,
  defaultValue,
}: {
  id: string;
  name: string;
  label: string;
  min?: number;
  max?: number;
  required?: boolean;
  defaultValue?: number | "";
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor={id}>
      {label}
      <input
        id={id}
        name={name}
        type="number"
        min={min}
        max={max}
        required={required}
        defaultValue={defaultValue}
        className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

function isScoreEventType(type: MatchEventType) {
  return type === "goal" || type === "own_goal";
}

function mapSupabaseMatchEvent(row: SupabaseMatchEventRow): MatchEvent {
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
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

function toTimerDatabasePayload(patch: TimerPatch) {
  return {
    status: patch.status,
    timer_phase: patch.timerPhase,
    timer_started_at: patch.timerStartedAt,
    timer_elapsed_seconds: patch.timerElapsedSeconds,
  };
}

function getSanitizedCleanSheetMatchPatch(
  match: Pick<
    Match,
    | "status"
    | "homeScore"
    | "awayScore"
    | "homeCleanSheetGoalkeeperId"
    | "awayCleanSheetGoalkeeperId"
  >,
): Pick<Match, "homeCleanSheetGoalkeeperId" | "awayCleanSheetGoalkeeperId"> {
  return {
    homeCleanSheetGoalkeeperId: isCleanSheetSide(match, "home")
      ? match.homeCleanSheetGoalkeeperId ?? null
      : null,
    awayCleanSheetGoalkeeperId: isCleanSheetSide(match, "away")
      ? match.awayCleanSheetGoalkeeperId ?? null
      : null,
  };
}

function getSanitizedCleanSheetDatabasePatch(
  match: Pick<
    Match,
    | "status"
    | "homeScore"
    | "awayScore"
    | "homeCleanSheetGoalkeeperId"
    | "awayCleanSheetGoalkeeperId"
  >,
) {
  const patch = getSanitizedCleanSheetMatchPatch(match);

  return {
    home_clean_sheet_goalkeeper_id: patch.homeCleanSheetGoalkeeperId,
    away_clean_sheet_goalkeeper_id: patch.awayCleanSheetGoalkeeperId,
  };
}

function toOutcomeDatabasePayload(match: Match, outcome: MatchOutcome) {
  const nextMatch = { ...match, ...outcome };

  return {
    home_score: outcome.homeScore,
    away_score: outcome.awayScore,
    home_penalty_score: outcome.homePenaltyScore,
    away_penalty_score: outcome.awayPenaltyScore,
    winner_team_id: outcome.winnerTeamId,
    ...getSanitizedCleanSheetDatabasePatch(nextMatch),
  };
}

function getInitialSelectedMatchId(data: CompetitionData) {
  return (
    data.matches.find((match) => match.status === "live")?.id ??
    data.matches.find((match) => match.status === "scheduled")?.id ??
    data.matches[0]?.id ??
    ""
  );
}

function getInitialEventTeamId(data: CompetitionData) {
  const match = data.matches.find((item) => item.id === getInitialSelectedMatchId(data));

  return match?.homeTeamId ?? data.teams[0]?.id ?? "";
}

function getAdminScoreValue(match: Match) {
  const showScore =
    match.status === "live" ||
    match.status === "completed" ||
    match.homeScore !== null ||
    match.awayScore !== null;

  if (!showScore) {
    return "VS";
  }

  return `${match.homeScore ?? 0} - ${match.awayScore ?? 0}`;
}

function hasPenaltyScore(match: Match) {
  return (
    match.homePenaltyScore !== null &&
    match.homePenaltyScore !== undefined &&
    match.awayPenaltyScore !== null &&
    match.awayPenaltyScore !== undefined
  );
}

function parseOptionalNumber(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();

  if (!normalized) {
    return null;
  }

  return Number(normalized);
}

function isValidOptionalWholeNumber(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

function toDatetimeLocalValue(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

function matchHasRecordedActivity(data: CompetitionData, match: Match) {
  return (
    match.status !== "scheduled" ||
    match.homeScore !== null ||
    match.awayScore !== null ||
    match.homePenaltyScore !== null ||
    match.awayPenaltyScore !== null ||
    Boolean(match.winnerTeamId) ||
    data.events.some((event) => event.matchId === match.id) ||
    data.penalties.some((event) => event.matchId === match.id)
  );
}

function playerHasRecordedActivity(data: CompetitionData, playerId: string) {
  return (
    data.events.some(
      (event) => event.playerId === playerId || event.assistPlayerId === playerId,
    ) ||
    data.penalties.some((event) => event.playerId === playerId) ||
    data.matches.some(
      (match) =>
        match.homeCleanSheetGoalkeeperId === playerId ||
        match.awayCleanSheetGoalkeeperId === playerId,
    )
  );
}

function mergeMatchEvents(events: MatchEvent[], updatedEvents: MatchEvent[]) {
  const eventsById = new Map(events.map((event) => [event.id, event]));

  updatedEvents.forEach((event) => {
    eventsById.set(event.id, event);
  });

  return Array.from(eventsById.values());
}

function getAssistPlayerOptions(players: Player[], matchEvent: Pick<MatchEvent, "teamId" | "playerId" | "type">) {
  if (matchEvent.type !== "goal") {
    return [];
  }

  return players.filter(
    (player) => player.teamId === matchEvent.teamId && player.id !== matchEvent.playerId,
  );
}

function updateDataWithMatchOutcome(
  current: CompetitionData,
  matchId: string,
  outcome: MatchOutcome,
) {
  return {
    ...current,
    matches: current.matches.map((match) => {
      if (match.id !== matchId) {
        return match;
      }

      const nextMatch = { ...match, ...outcome };

      return {
        ...nextMatch,
        ...getSanitizedCleanSheetMatchPatch(nextMatch),
      };
    }),
  };
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

export function AdminConsole({ initialData }: AdminConsoleProps) {
  const configured = hasSupabaseConfig();
  const localMode = !configured;
  const [data, setData] = useState<CompetitionData>(initialData);
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    configured ? "checking" : "unconfigured",
  );
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const [message, setMessage] = useState(() =>
    localMode
      ? "Local mode active. Edits save to data/competition.json on this computer."
      : "Ready",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(() =>
    getInitialSelectedMatchId(initialData),
  );
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [editingNewsPostId, setEditingNewsPostId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTeamId, setEditingEventTeamId] = useState("");
  const [editingEventType, setEditingEventType] = useState<MatchEventType>("goal");
  const [editingEventPlayerId, setEditingEventPlayerId] = useState("");
  const [selectedEventTeamId, setSelectedEventTeamId] = useState(() =>
    getInitialEventTeamId(initialData),
  );
  const [selectedEventType, setSelectedEventType] = useState<MatchEventType>("goal");
  const [selectedEventPlayerId, setSelectedEventPlayerId] = useState("");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const standings = useMemo(() => calculateStandings(data.teams, data.matches), [data]);
  const playerStats = useMemo(() => calculatePlayerStats(data), [data]);
  const selectedMatch = data.matches.find((match) => match.id === selectedMatchId);
  const canWriteLive =
    localMode || Boolean(configured && authStatus === "authorized" && sessionEmail && supabase);
  const editBlocked = !canWriteLive;
  const editBlockedMessage =
    localMode
      ? "Local mode active. Edits save to data/competition.json on this computer."
      : authStatus === "checking"
      ? "Checking admin access..."
      : authStatus === "forbidden"
        ? "This account does not have admin access."
        : configured
          ? "Sign in with an admin account to continue."
          : "Add Supabase credentials to load and edit database data";
  const adminLocked = configured && !canWriteLive;
  const loginModalTitle =
    authStatus === "checking"
      ? "Checking Admin Access"
      : authStatus === "forbidden"
        ? "Admin Access Required"
        : "Admin Sign In";
  const showSignInForm =
    authStatus !== "checking" && (authStatus !== "forbidden" || !sessionEmail);
  const selectedMatchHome = selectedMatch
    ? data.teams.find((team) => team.id === selectedMatch.homeTeamId)
    : null;
  const selectedMatchAway = selectedMatch
    ? data.teams.find((team) => team.id === selectedMatch.awayTeamId)
    : null;
  const selectedEventTeamOptions = selectedMatch
    ? [selectedMatch.homeTeamId, selectedMatch.awayTeamId]
        .map((teamId) => data.teams.find((team) => team.id === teamId))
        .filter((team): team is Team => Boolean(team))
    : data.teams;
  const selectedEventTeamIdIsInMatch = selectedMatch
    ? selectedEventTeamId === selectedMatch.homeTeamId ||
      selectedEventTeamId === selectedMatch.awayTeamId
    : true;
  const activeEventTeamId = selectedEventTeamIdIsInMatch
    ? selectedEventTeamId
    : selectedEventTeamOptions[0]?.id ?? "";
  const eventTeamPlayers = data.players.filter((player) => player.teamId === activeEventTeamId);
  const activeEventPlayerId = eventTeamPlayers.some(
    (player) => player.id === selectedEventPlayerId,
  )
    ? selectedEventPlayerId
    : eventTeamPlayers[0]?.id ?? "";
  const assistPlayerOptions =
    selectedEventType === "goal"
      ? eventTeamPlayers.filter((player) => player.id !== activeEventPlayerId)
      : [];
  const selectedMatchEvents = selectedMatch ? getMatchEvents(data.events, selectedMatch.id) : [];
  const selectedTimerPhase = selectedMatch ? getTimerPhase(selectedMatch) : "not_started";
  const selectedMatchIsKnockout = selectedMatch ? isKnockoutStage(selectedMatch.stage) : false;
  const selectedCleanSheetSides =
    selectedMatch && selectedMatchHome && selectedMatchAway
      ? [
          { side: "home" as MatchSide, team: selectedMatchHome },
          { side: "away" as MatchSide, team: selectedMatchAway },
        ].filter((item) => isCleanSheetSide(selectedMatch, item.side))
      : [];

  function syncCompetitionData(nextData: CompetitionData) {
    setData(nextData);
    setSelectedMatchId((current) =>
      nextData.matches.some((match) => match.id === current)
        ? current
        : getInitialSelectedMatchId(nextData),
    );
    setSelectedEventTeamId((current) =>
      nextData.teams.some((team) => team.id === current)
        ? current
        : getInitialEventTeamId(nextData),
    );
    setEditingTeamId((current) =>
      current && nextData.teams.some((team) => team.id === current) ? current : null,
    );
    setEditingPlayerId((current) =>
      current && nextData.players.some((player) => player.id === current) ? current : null,
    );
    setEditingMatchId((current) =>
      current && nextData.matches.some((match) => match.id === current) ? current : null,
    );
    setEditingNewsPostId((current) =>
      current && nextData.newsPosts.some((post) => post.id === current) ? current : null,
    );
    setEditingEventId((current) =>
      current && nextData.events.some((event) => event.id === current) ? current : null,
    );
  }

  async function saveLocalAndSync(mutation: LocalCompetitionMutation, successMessage: string) {
    const nextData = await saveLocalCompetitionMutation(mutation);
    syncCompetitionData(nextData);
    setMessage(successMessage);
  }

  useEffect(() => {
    if (!configured || !supabase) {
      return undefined;
    }

    const client = supabase;
    let active = true;

    async function loadAdminSession(session: Session | null) {
      if (!active) return;

      if (!session) {
        setAuthStatus("signed_out");
        setSessionEmail(null);
        syncCompetitionData(initialData);
        setMessage("Sign in with an admin account to continue.");
        return;
      }

      setAuthStatus("checking");
      setSessionEmail(session.user.email ?? null);
      setMessage("Checking admin access...");

      const { data: isAdmin, error } = await client.rpc("is_admin");

      if (!active) return;

      if (error || !isAdmin) {
        setAuthStatus("forbidden");
        syncCompetitionData(initialData);
        setMessage(error?.message ?? "This account does not have admin access.");
        return;
      }

      setAuthStatus("authorized");

      try {
        setMessage("Loading database data...");
        const nextData = await fetchCompetitionData();

        if (!active) return;

        syncCompetitionData(nextData);
        setMessage("Database data loaded");
      } catch (loadError) {
        if (!active) return;
        setMessage(loadError instanceof Error ? loadError.message : "Unable to load competition data");
      }
    }

    client.auth.getSession().then(({ data: sessionData }) => {
      void loadAdminSession(sessionData.session);
    });

    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      void loadAdminSession(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [configured, initialData, supabase]);

  function getWritableSupabase() {
    if (!supabase || !configured) {
      setMessage("Add Supabase credentials to load and edit database data");
      return null;
    }

    if (authStatus !== "authorized" || !sessionEmail) {
      setMessage(editBlockedMessage);
      return null;
    }

    return supabase;
  }

  async function refreshData() {
    try {
      setMessage(localMode ? "Loading local data..." : "Loading database data...");
      const nextData = await fetchCompetitionData();
      syncCompetitionData(nextData);
      setMessage(localMode ? "Local data refreshed" : "Database data refreshed");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to refresh data");
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) return;

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(error.message);
      return;
    }

    setPassword("");
    setMessage("Checking admin access...");
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    setAuthStatus("signed_out");
    setSessionEmail(null);
    syncCompetitionData(initialData);
    setMessage("Signed out");
  }

  async function fetchLiveMatchEvents(matchId: string) {
    if (!supabase) {
      throw new Error("Live data connection unavailable");
    }

    const { data: rows, error } = await supabase
      .from("match_events")
      .select("*")
      .eq("match_id", matchId);

    if (error) throw error;

    return (rows ?? []).map((row) => mapSupabaseMatchEvent(row as SupabaseMatchEventRow));
  }

  async function saveLiveMatchOutcomeFromEvents(match: Match, options?: MatchOutcomeOptions) {
    if (!supabase) {
      throw new Error("Live data connection unavailable");
    }

    const events = await fetchLiveMatchEvents(match.id);
    const outcome = getMatchOutcomeFromEvents(match, events, options);
    const { error } = await supabase
      .from("matches")
      .update(toOutcomeDatabasePayload(match, outcome))
      .eq("id", match.id);

    if (error) throw error;

    return outcome;
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const logoFile = form.get("logo") instanceof File ? (form.get("logo") as File) : null;

    if (!name) {
      setMessage("Team name is required");
      return;
    }

    try {
      let logoUrl: string | null = null;

      if (localMode) {
        if (logoFile && logoFile.size > 0) {
          logoUrl = await readFileAsDataUrl(logoFile);
        }

        await saveLocalAndSync({ action: "addTeam", name, logoUrl }, `${name} added locally`);
        formElement.reset();
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      if (logoFile && logoFile.size > 0) {
        const extension = logoFile.name.split(".").pop() ?? "png";
        const originalName = slugify(logoFile.name.replace(/\.[^.]+$/, "")) || "logo";
        const path = `${slugify(name)}-${originalName}-${logoFile.size}-${logoFile.lastModified}.${extension}`;
        const upload = await db.storage.from("team-logos").upload(path, logoFile, {
          upsert: true,
        });

        if (upload.error) throw upload.error;

        const publicUrl = db.storage.from("team-logos").getPublicUrl(path);
        logoUrl = publicUrl.data.publicUrl;
      }

      const { error } = await db.from("teams").insert({ name, logo_url: logoUrl });
      if (error) throw error;
      await refreshData();

      formElement.reset();
      setMessage(`${name} added`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add team");
    }
  }

  async function updateTeam(event: FormEvent<HTMLFormElement>, team: Team) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const logoFile = form.get("logo") instanceof File ? (form.get("logo") as File) : null;

    if (!name) {
      setMessage("Team name is required");
      return;
    }

    if (
      data.teams.some(
        (item) => item.id !== team.id && item.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setMessage("That team already exists");
      return;
    }

    try {
      let logoUrl: string | null | undefined;

      if (localMode) {
        if (logoFile && logoFile.size > 0) {
          logoUrl = await readFileAsDataUrl(logoFile);
        }

        const mutation: LocalCompetitionMutation = {
          action: "updateTeam",
          teamId: team.id,
          name,
        };

        if (logoUrl !== undefined) {
          mutation.logoUrl = logoUrl;
        }

        await saveLocalAndSync(mutation, `${name} updated locally`);
        setEditingTeamId(null);
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      if (logoFile && logoFile.size > 0) {
        const extension = logoFile.name.split(".").pop() ?? "png";
        const path = `${slugify(name)}-${team.id}.${extension}`;
        const upload = await db.storage.from("team-logos").upload(path, logoFile, {
          upsert: true,
        });

        if (upload.error) throw upload.error;

        const publicUrl = db.storage.from("team-logos").getPublicUrl(path);
        logoUrl = publicUrl.data.publicUrl;
      }

      const patch: { name: string; logo_url?: string | null } = { name };

      if (logoUrl !== undefined) {
        patch.logo_url = logoUrl;
      }

      const { error } = await db.from("teams").update(patch).eq("id", team.id);
      if (error) throw error;

      await refreshData();
      setEditingTeamId(null);
      setMessage(`${name} updated`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update team");
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const name = String(form.get("name") ?? "").trim();
    const teamId = String(form.get("teamId") ?? "");
    const position = String(form.get("position") ?? "Midfielder") as PlayerPosition;
    const jerseyNumber = Number(form.get("jerseyNumber"));

    if (!name || !teamId || !Number.isFinite(jerseyNumber)) {
      setMessage("Player name, team, and jersey number are required");
      return;
    }

    const duplicateNumber = data.players.some(
      (player) => player.teamId === teamId && player.jerseyNumber === jerseyNumber,
    );

    if (duplicateNumber) {
      setMessage("That jersey number is already taken for this team");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "addPlayer",
            name,
            teamId,
            position,
            jerseyNumber,
          },
          `${name} added locally`,
        );
        formElement.reset();
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("players").insert({
        name,
        team_id: teamId,
        position,
        jersey_number: jerseyNumber,
      });
      if (error) throw error;
      await refreshData();

      formElement.reset();
      setMessage(`${name} added`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add player");
    }
  }

  async function updatePlayer(event: FormEvent<HTMLFormElement>, player: Player) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const teamId = String(form.get("teamId") ?? "");
    const position = String(form.get("position") ?? player.position) as PlayerPosition;
    const jerseyNumber = Number(form.get("jerseyNumber"));
    const hasRecordedActivity = playerHasRecordedActivity(data, player.id);

    if (!name || !teamId || !Number.isInteger(jerseyNumber)) {
      setMessage("Player name, team, and jersey number are required");
      return;
    }

    if (jerseyNumber < 1 || jerseyNumber > 99) {
      setMessage("Jersey number must be between 1 and 99");
      return;
    }

    if (hasRecordedActivity && teamId !== player.teamId) {
      setMessage("Only name, position, and jersey number can be edited after player activity");
      return;
    }

    const duplicateNumber = data.players.some(
      (item) =>
        item.id !== player.id &&
        item.teamId === teamId &&
        item.jerseyNumber === jerseyNumber,
    );

    if (duplicateNumber) {
      setMessage("That jersey number is already taken for this team");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updatePlayer",
            playerId: player.id,
            name,
            teamId,
            position,
            jerseyNumber,
          },
          `${name} updated locally`,
        );
        setEditingPlayerId(null);
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db
        .from("players")
        .update({
          name,
          team_id: teamId,
          position,
          jersey_number: jerseyNumber,
        })
        .eq("id", player.id);

      if (error) throw error;

      await refreshData();
      setEditingPlayerId(null);
      setMessage(`${name} updated`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update player");
    }
  }

  async function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const stage = String(form.get("stage") ?? "group") as MatchStage;
    const homeTeamId = String(form.get("homeTeamId") ?? "");
    const awayTeamId = String(form.get("awayTeamId") ?? "");
    const kickoff = String(form.get("kickoff") ?? "");
    const venue = String(form.get("venue") ?? "").trim();

    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId || !kickoff || !venue) {
      setMessage("Choose two different teams, kickoff time, and venue");
      return;
    }

    const kickoffIso = new Date(kickoff).toISOString();

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "addMatch",
            stage,
            homeTeamId,
            awayTeamId,
            kickoff: kickoffIso,
            venue,
          },
          "Fixture added locally",
        );
        formElement.reset();
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("matches").insert({
        stage,
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        kickoff: kickoffIso,
        venue,
        status: "scheduled",
      });
      if (error) throw error;
      await refreshData();

      formElement.reset();
      setMessage("Fixture added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add fixture");
    }
  }

  async function updateMatch(event: FormEvent<HTMLFormElement>, match: Match) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stage = String(form.get("stage") ?? match.stage) as MatchStage;
    const homeTeamId = String(form.get("homeTeamId") ?? match.homeTeamId);
    const awayTeamId = String(form.get("awayTeamId") ?? match.awayTeamId);
    const kickoff = String(form.get("kickoff") ?? "");
    const venue = String(form.get("venue") ?? "").trim();
    const hasRecordedActivity = matchHasRecordedActivity(data, match);

    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId || !kickoff || !venue) {
      setMessage("Choose two different teams, kickoff time, and venue");
      return;
    }

    if (
      hasRecordedActivity &&
      (stage !== match.stage || homeTeamId !== match.homeTeamId || awayTeamId !== match.awayTeamId)
    ) {
      setMessage("Only kickoff and venue can be edited after a fixture has match activity");
      return;
    }

    const kickoffIso = new Date(kickoff).toISOString();

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateMatch",
            matchId: match.id,
            stage,
            homeTeamId,
            awayTeamId,
            kickoff: kickoffIso,
            venue,
          },
          "Fixture updated locally",
        );
        setEditingMatchId(null);
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db
        .from("matches")
        .update({
          stage,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff: kickoffIso,
          venue,
        })
        .eq("id", match.id);

      if (error) throw error;

      await refreshData();
      setEditingMatchId(null);
      setMessage("Fixture updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update fixture");
    }
  }

  async function addNewsPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();

    if (!title || !body) {
      setMessage("News title and body are required");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "addNewsPost",
            title,
            body,
          },
          "News post added locally",
        );
        formElement.reset();
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("news_posts").insert({
        title,
        body,
        published_at: new Date().toISOString(),
      });
      if (error) throw error;

      await refreshData();

      formElement.reset();
      setMessage("News post added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add news post");
    }
  }

  async function updateNewsPost(event: FormEvent<HTMLFormElement>, post: NewsPost) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const body = String(form.get("body") ?? "").trim();
    const publishedAt = String(form.get("publishedAt") ?? "");

    if (!title || !body || !publishedAt) {
      setMessage("News title, body, and published time are required");
      return;
    }

    const publishedDate = new Date(publishedAt);

    if (Number.isNaN(publishedDate.getTime())) {
      setMessage("Published time is required");
      return;
    }

    const publishedAtIso = publishedDate.toISOString();

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateNewsPost",
            postId: post.id,
            title,
            body,
            publishedAt: publishedAtIso,
          },
          "News post updated locally",
        );
        setEditingNewsPostId(null);
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db
        .from("news_posts")
        .update({
          title,
          body,
          published_at: publishedAtIso,
        })
        .eq("id", post.id);

      if (error) throw error;

      await refreshData();
      setEditingNewsPostId(null);
      setMessage("News post updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update news post");
    }
  }

  async function updateTimer(action: TimerAction) {
    if (!selectedMatch) {
      setMessage("Select a match first");
      return;
    }

    const labels: Record<TimerAction, string> = {
      start_first_half: "First half started",
      half_time: "Half-time set",
      start_second_half: "Second half resumed",
      full_time: "Full-time set",
      penalties: "Penalty shootout started",
      reset: "Timer reset",
    };

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateTimer",
            matchId: selectedMatch.id,
            timerAction: action,
          },
          `${labels[action]} locally`,
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const patch = getTimerPatch(selectedMatch, action);
      const matchAfterTimer = applyTimerPatchToMatch(selectedMatch, patch);
      let outcome: MatchOutcome | null = null;

      if (action === "start_first_half") {
        outcome = {
          homeScore: 0,
          awayScore: 0,
          homePenaltyScore: null,
          awayPenaltyScore: null,
          winnerTeamId: null,
        };
      }

      if (action === "full_time" || action === "penalties") {
        const matchEvents = await fetchLiveMatchEvents(selectedMatch.id);
        outcome = getMatchOutcomeFromEvents(matchAfterTimer, matchEvents);
      }

      const { error } = await db
        .from("matches")
        .update({
          ...toTimerDatabasePayload(patch),
          ...(outcome
            ? toOutcomeDatabasePayload(matchAfterTimer, outcome)
            : getSanitizedCleanSheetDatabasePatch(matchAfterTimer)),
        })
        .eq("id", selectedMatch.id);

      if (error) throw error;

      await refreshData();

      setMessage(labels[action]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update match timer");
    }
  }

  async function updatePenaltyScore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matchId = String(form.get("matchId") ?? "");
    const homePenaltyScore = parseOptionalNumber(form.get("homePenaltyScore"));
    const awayPenaltyScore = parseOptionalNumber(form.get("awayPenaltyScore"));

    if (!matchId) {
      setMessage("Select a match");
      return;
    }

    const matchForPenalty = data.matches.find((match) => match.id === matchId);

    if (!matchForPenalty) {
      setMessage("Selected match was not found");
      return;
    }

    if (!isKnockoutStage(matchForPenalty.stage)) {
      setMessage("Penalty scores only apply to knockout matches");
      return;
    }

    if (
      !isValidOptionalWholeNumber(homePenaltyScore) ||
      !isValidOptionalWholeNumber(awayPenaltyScore)
    ) {
      setMessage("Penalty scores must be whole numbers");
      return;
    }

    const hasHomePenaltyScore = homePenaltyScore !== null;
    const hasAwayPenaltyScore = awayPenaltyScore !== null;
    const hasPenaltyScores = hasHomePenaltyScore && hasAwayPenaltyScore;

    if (hasHomePenaltyScore !== hasAwayPenaltyScore) {
      setMessage("Enter both penalty scores or leave both blank");
      return;
    }

    if (
      homePenaltyScore !== null &&
      awayPenaltyScore !== null &&
      homePenaltyScore === awayPenaltyScore
    ) {
      setMessage("Penalty score needs a winner");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updatePenaltyScore",
            matchId,
            homePenaltyScore,
            awayPenaltyScore,
          },
          hasPenaltyScores ? "Penalty score updated locally" : "Penalty scores cleared locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const matchEvents = await fetchLiveMatchEvents(matchId);
      const score = calculateMatchScoreFromEvents(matchForPenalty, matchEvents);

      if (hasPenaltyScores && score.homeScore !== score.awayScore) {
        setMessage("Penalty scores only apply when the knockout score is tied");
        return;
      }

      const outcome = getMatchOutcomeFromEvents(matchForPenalty, matchEvents, {
        penaltyScore: {
          homePenaltyScore,
          awayPenaltyScore,
        },
        resolveWinner: hasPenaltyScores,
      });

      const { error } = await db
        .from("matches")
        .update(toOutcomeDatabasePayload(matchForPenalty, outcome))
        .eq("id", matchId);

      if (error) throw error;

      await refreshData();

      setMessage(hasPenaltyScores ? "Penalty score updated" : "Penalty scores cleared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update penalty score");
    }
  }

  async function updateCleanSheetGoalkeeper(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matchId = String(form.get("matchId") ?? "");
    const side = String(form.get("side") ?? "") as MatchSide;
    const goalkeeperId = String(form.get("goalkeeperId") ?? "") || null;

    if (!matchId || (side !== "home" && side !== "away")) {
      setMessage("Select a clean sheet side");
      return;
    }

    const matchForCleanSheet = data.matches.find((match) => match.id === matchId);

    if (!matchForCleanSheet) {
      setMessage("Selected match was not found");
      return;
    }

    if (!isCleanSheetSide(matchForCleanSheet, side)) {
      setMessage("That team did not keep a clean sheet in this completed match");
      return;
    }

    const teamId = side === "home" ? matchForCleanSheet.homeTeamId : matchForCleanSheet.awayTeamId;

    if (
      goalkeeperId &&
      !getTeamGoalkeepers(data.players, teamId).some((player) => player.id === goalkeeperId)
    ) {
      setMessage("Choose a goalkeeper from the team that kept the clean sheet");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateCleanSheetGoalkeeper",
            matchId,
            side,
            goalkeeperId,
          },
          goalkeeperId ? "Clean sheet goalkeeper saved locally" : "Clean sheet goalkeeper cleared locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const field =
        side === "home"
          ? "home_clean_sheet_goalkeeper_id"
          : "away_clean_sheet_goalkeeper_id";

      const { error } = await db
        .from("matches")
        .update({ [field]: goalkeeperId })
        .eq("id", matchId);

      if (error) throw error;

      await refreshData();
      setMessage(goalkeeperId ? "Clean sheet goalkeeper saved" : "Clean sheet goalkeeper cleared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update clean sheet goalkeeper");
    }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const matchId = String(form.get("matchId") ?? "");
    const teamId = String(form.get("teamId") ?? "");
    const playerId = String(form.get("playerId") ?? "");
    const assistPlayerId = String(form.get("assistPlayerId") ?? "") || null;
    const type = String(form.get("type") ?? "goal") as MatchEventType;
    const half = Number(form.get("half")) as 1 | 2;
    const minute = Number(form.get("minute"));
    const addedTime = Number(form.get("addedTime") ?? 0);
    const isDisallowed = isScoreEventType(type) && form.get("isDisallowed") === "on";

    if (!matchId || !teamId || !playerId || !Number.isFinite(minute)) {
      setMessage("Select a match, team, player, and minute");
      return;
    }

    const matchForEvent = data.matches.find((match) => match.id === matchId);
    const assistPlayer = assistPlayerId
      ? data.players.find((player) => player.id === assistPlayerId)
      : null;

    if (!matchForEvent) {
      setMessage("Selected match was not found");
      return;
    }

    if (teamId !== matchForEvent.homeTeamId && teamId !== matchForEvent.awayTeamId) {
      setMessage("Choose one of the teams playing this match");
      return;
    }

    if (minute < 1 || minute > MATCH_DURATION_MINUTES) {
      setMessage("Event minute must be between 1 and 60");
      return;
    }

    if (type === "goal" && assistPlayerId === playerId) {
      setMessage("A player cannot assist their own goal");
      return;
    }

    if (type === "goal" && assistPlayerId && !assistPlayer) {
      setMessage("Selected assist player was not found");
      return;
    }

    if (type === "goal" && assistPlayer && assistPlayer.teamId !== teamId) {
      setMessage("Choose an assist from the selected team");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "addEvent",
            matchId,
            teamId,
            playerId,
            assistPlayerId,
            type,
            half,
            minute,
            addedTime,
            isDisallowed,
          },
          "Match event added locally",
        );
        formElement.reset();
        setSelectedEventType("goal");
        setSelectedEventPlayerId("");
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { data: insertedRow, error } = await db
        .from("match_events")
        .insert({
          match_id: matchId,
          team_id: teamId,
          player_id: playerId,
          assist_player_id: type === "goal" ? assistPlayerId : null,
          event_type: type,
          half,
          minute,
          added_time: addedTime,
          is_disallowed: isDisallowed,
        })
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!insertedRow) throw new Error("Match event was saved but not returned");

      const insertedEvent = mapSupabaseMatchEvent(insertedRow as SupabaseMatchEventRow);

      if (isScoreEventType(type)) {
        const outcome = await saveLiveMatchOutcomeFromEvents(matchForEvent);

        setData((current) => ({
          ...updateDataWithMatchOutcome(current, matchId, outcome),
          events: mergeMatchEvents(current.events, [insertedEvent]),
        }));
      } else {
        setData((current) => ({
          ...current,
          events: mergeMatchEvents(current.events, [insertedEvent]),
        }));
      }

      await refreshData();

      formElement.reset();
      setSelectedEventType("goal");
      setSelectedEventPlayerId("");
      setMessage("Match event added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add match event");
    }
  }

  function startEditingMatchEvent(matchEvent: MatchEvent) {
    setEditingEventId(matchEvent.id);
    setEditingEventTeamId(matchEvent.teamId);
    setEditingEventType(matchEvent.type);
    setEditingEventPlayerId(matchEvent.playerId);
  }

  async function updateMatchEvent(
    event: FormEvent<HTMLFormElement>,
    matchEvent: MatchEvent,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const teamId = String(form.get("teamId") ?? "");
    const playerId = String(form.get("playerId") ?? "");
    const assistPlayerId = String(form.get("assistPlayerId") ?? "") || null;
    const type = String(form.get("type") ?? matchEvent.type) as MatchEventType;
    const half = Number(form.get("half")) as 1 | 2;
    const minute = Number(form.get("minute"));
    const addedTime = Number(form.get("addedTime") ?? 0);
    const isDisallowed = isScoreEventType(type) && form.get("isDisallowed") === "on";
    const matchForEvent = data.matches.find((match) => match.id === matchEvent.matchId);
    const player = data.players.find((item) => item.id === playerId);
    const assistPlayer = assistPlayerId
      ? data.players.find((item) => item.id === assistPlayerId)
      : null;

    if (!eventTypes.includes(type)) {
      setMessage("Choose a valid match event type");
      return;
    }

    if (!matchForEvent) {
      setMessage("Selected match was not found");
      return;
    }

    if (!teamId || !playerId || !player || !Number.isInteger(minute)) {
      setMessage("Choose a team, player, and event minute");
      return;
    }

    if (teamId !== matchForEvent.homeTeamId && teamId !== matchForEvent.awayTeamId) {
      setMessage("Choose one of the teams playing this match");
      return;
    }

    if (player.teamId !== teamId) {
      setMessage("Choose a player from the selected team");
      return;
    }

    if (half !== 1 && half !== 2) {
      setMessage("Choose a valid match half");
      return;
    }

    if (minute < 1 || minute > MATCH_DURATION_MINUTES) {
      setMessage("Event minute must be between 1 and 60");
      return;
    }

    if (!Number.isInteger(addedTime) || addedTime < 0 || addedTime > 20) {
      setMessage("Added time must be between 0 and 20");
      return;
    }

    if (type === "goal" && assistPlayerId === playerId) {
      setMessage("A player cannot assist their own goal");
      return;
    }

    if (type === "goal" && assistPlayerId && !assistPlayer) {
      setMessage("Selected assist player was not found");
      return;
    }

    if (type === "goal" && assistPlayer && assistPlayer.teamId !== teamId) {
      setMessage("Choose an assist from the selected team");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateMatchEvent",
            eventId: matchEvent.id,
            teamId,
            playerId,
            assistPlayerId,
            type,
            half,
            minute,
            addedTime,
            isDisallowed,
          },
          "Match event updated locally",
        );
        setEditingEventId(null);
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { data: updatedRow, error } = await db
        .from("match_events")
        .update({
          team_id: teamId,
          player_id: playerId,
          assist_player_id: type === "goal" ? assistPlayerId : null,
          event_type: type,
          half,
          minute,
          added_time: addedTime,
          is_disallowed: isDisallowed,
        })
        .eq("id", matchEvent.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) throw new Error("Match event was updated but not returned");

      const updatedEvent = mapSupabaseMatchEvent(updatedRow as SupabaseMatchEventRow);

      if (isScoreEventType(matchEvent.type) || isScoreEventType(type)) {
        const outcome = await saveLiveMatchOutcomeFromEvents(matchForEvent);

        setData((current) => ({
          ...updateDataWithMatchOutcome(current, matchEvent.matchId, outcome),
          events: mergeMatchEvents(current.events, [updatedEvent]),
        }));
      } else {
        setData((current) => ({
          ...current,
          events: mergeMatchEvents(current.events, [updatedEvent]),
        }));
      }

      await refreshData();
      setEditingEventId(null);
      setMessage("Match event updated");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update match event");
    }
  }

  async function updateEventAssist(
    event: FormEvent<HTMLFormElement>,
    matchEvent: MatchEvent,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const assistPlayerId = String(form.get("assistPlayerId") ?? "") || null;

    if (matchEvent.type !== "goal") {
      setMessage("Assists can only be added to goal events");
      return;
    }

    const assistOptions = getAssistPlayerOptions(data.players, matchEvent);

    if (assistPlayerId && !assistOptions.some((player) => player.id === assistPlayerId)) {
      setMessage("Choose an assist from the selected team");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateEventAssist",
            eventId: matchEvent.id,
            assistPlayerId,
          },
          assistPlayerId ? "Assist updated locally" : "Assist cleared locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { data: updatedRow, error } = await db
        .from("match_events")
        .update({ assist_player_id: assistPlayerId })
        .eq("id", matchEvent.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) throw new Error("Match event was updated but not returned");

      const updatedEvent = mapSupabaseMatchEvent(updatedRow as SupabaseMatchEventRow);

      setData((current) => ({
        ...current,
        events: mergeMatchEvents(current.events, [updatedEvent]),
      }));

      await refreshData();
      setMessage(assistPlayerId ? "Assist updated" : "Assist cleared");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update assist");
    }
  }

  async function updateEventDisallowed(matchEvent: MatchEvent, isDisallowed: boolean) {
    if (!isScoreEventType(matchEvent.type)) {
      return;
    }

    const matchForEvent = data.matches.find((match) => match.id === matchEvent.matchId);

    if (!matchForEvent) {
      setMessage("Selected match was not found");
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "updateEventDisallowed",
            eventId: matchEvent.id,
            isDisallowed,
          },
          isDisallowed ? "Goal disallowed locally" : "Goal restored locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { data: updatedRow, error } = await db
        .from("match_events")
        .update({ is_disallowed: isDisallowed })
        .eq("id", matchEvent.id)
        .select("*")
        .maybeSingle();

      if (error) throw error;
      if (!updatedRow) throw new Error("Match event was updated but not returned");

      const updatedEvent = mapSupabaseMatchEvent(updatedRow as SupabaseMatchEventRow);
      const outcome = await saveLiveMatchOutcomeFromEvents(matchForEvent);

      setData((current) => ({
        ...updateDataWithMatchOutcome(current, matchEvent.matchId, outcome),
        events: mergeMatchEvents(current.events, [updatedEvent]),
      }));

      await refreshData();

      setMessage(isDisallowed ? "Goal disallowed" : "Goal restored");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update match event");
    }
  }

  async function deleteTeam(team: Team) {
    if (!window.confirm(`Delete ${team.name}?`)) {
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "deleteTeam",
            id: team.id,
          },
          `${team.name} deleted locally`,
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("teams").delete().eq("id", team.id);
      if (error) throw error;

      await refreshData();
      setMessage(`${team.name} deleted`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete team");
    }
  }

  async function deletePlayer(player: Player) {
    if (!window.confirm(`Delete ${player.name}?`)) {
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "deletePlayer",
            id: player.id,
          },
          `${player.name} deleted locally`,
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("players").delete().eq("id", player.id);
      if (error) throw error;

      await refreshData();
      setMessage(`${player.name} deleted`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete player");
    }
  }

  async function deleteMatch(match: Match) {
    const home = data.teams.find((team) => team.id === match.homeTeamId);
    const away = data.teams.find((team) => team.id === match.awayTeamId);
    const label = `${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`;

    if (!window.confirm(`Delete ${label}?`)) {
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "deleteMatch",
            id: match.id,
          },
          `${label} deleted locally`,
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("matches").delete().eq("id", match.id);
      if (error) throw error;

      await refreshData();
      setMessage(`${label} deleted`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete fixture");
    }
  }

  async function deleteMatchEvent(matchEvent: MatchEvent) {
    if (!window.confirm("Delete this match event?")) {
      return;
    }

    const matchForEvent = data.matches.find((match) => match.id === matchEvent.matchId);

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "deleteMatchEvent",
            id: matchEvent.id,
          },
          "Match event deleted locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("match_events").delete().eq("id", matchEvent.id);
      if (error) throw error;

      if (matchForEvent && isScoreEventType(matchEvent.type)) {
        await saveLiveMatchOutcomeFromEvents(matchForEvent);
      }

      await refreshData();
      setMessage("Match event deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete match event");
    }
  }

  async function deleteNewsPost(post: NewsPost) {
    if (!window.confirm(`Delete ${post.title}?`)) {
      return;
    }

    try {
      if (localMode) {
        await saveLocalAndSync(
          {
            action: "deleteNewsPost",
            id: post.id,
          },
          "News post deleted locally",
        );
        return;
      }

      const db = getWritableSupabase();
      if (!db) return;

      const { error } = await db.from("news_posts").delete().eq("id", post.id);
      if (error) throw error;

      await refreshData();
      setMessage("News post deleted");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete news post");
    }
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
              Competition control
            </p>
            <h1 className="text-4xl font-black text-zinc-950">Admin Dashboard</h1>
            <p className="mt-2 max-w-3xl text-sm font-semibold text-zinc-500">
              {localMode
                ? "Local mode is active. Edits save to data/competition.json on this computer."
                : canWriteLive
                ? `Signed in as ${sessionEmail}. Database writes are enabled.`
                : editBlockedMessage}
            </p>
          </div>

          {!adminLocked ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={refreshData}
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-bold text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                title="Refresh data"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Refresh
              </button>
              {sessionEmail ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-bold text-white transition hover:bg-red-700"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-2xl font-black text-zinc-950">{data.teams.length}</p>
            <p className="text-xs font-bold uppercase text-zinc-500">Teams</p>
          </div>
          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-2xl font-black text-zinc-950">{data.players.length}</p>
            <p className="text-xs font-bold uppercase text-zinc-500">Players</p>
          </div>
          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-2xl font-black text-zinc-950">{data.matches.length}</p>
            <p className="text-xs font-bold uppercase text-zinc-500">Matches</p>
          </div>
          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-2xl font-black text-zinc-950">{data.events.length}</p>
            <p className="text-xs font-bold uppercase text-zinc-500">Events</p>
          </div>
          <div className="rounded-md bg-zinc-50 p-4">
            <p className="text-2xl font-black text-zinc-950">{data.newsPosts.length}</p>
            <p className="text-xs font-bold uppercase text-zinc-500">News</p>
          </div>
        </div>
      </section>

      {adminLocked ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-zinc-950/60 px-4 py-8 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-login-title"
        >
          <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md bg-emerald-700 text-white">
                <Shield className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                  Competition control
                </p>
                <h2 id="admin-login-title" className="text-2xl font-black text-zinc-950">
                  {loginModalTitle}
                </h2>
              </div>
            </div>

            <p className="mt-4 rounded-md bg-zinc-50 p-3 text-sm font-semibold text-zinc-600">
              {message}
            </p>

            {authStatus === "checking" ? (
              <div className="mt-5 flex min-h-24 items-center justify-center gap-3 rounded-md border border-zinc-200 bg-white text-sm font-bold text-zinc-600">
                <RefreshCw className="h-4 w-4 animate-spin text-emerald-700" aria-hidden="true" />
                Checking your session
              </div>
            ) : null}

            {showSignInForm ? (
              <form className="mt-5 grid gap-4" onSubmit={signIn}>
                <label
                  className="grid gap-2 text-sm font-bold text-zinc-700"
                  htmlFor="admin-email"
                >
                  Email
                  <input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    required
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label
                  className="grid gap-2 text-sm font-bold text-zinc-700"
                  htmlFor="admin-password"
                >
                  Password
                  <input
                    id="admin-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <LogIn className="h-4 w-4" aria-hidden="true" />
                  Sign in
                </button>
              </form>
            ) : null}

            {authStatus === "forbidden" && sessionEmail ? (
              <div className="mt-5 grid gap-3">
                <p className="text-sm font-semibold text-zinc-600">
                  {sessionEmail} is signed in, but is not listed as an admin.
                </p>
                <button
                  type="button"
                  onClick={signOut}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-black text-white transition hover:bg-red-700"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {!adminLocked ? (
        <>
      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: "teams", label: "Teams", icon: Shield },
          { id: "players", label: "Players", icon: Shirt },
          { id: "matches", label: "Matches", icon: CalendarPlus },
          { id: "events", label: "Match Events", icon: ClipboardList },
          { id: "news", label: "News", icon: Newspaper },
        ].map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-md px-4 text-sm font-black transition ${
                activeTab === tab.id
                  ? "bg-zinc-950 text-white"
                  : "border border-zinc-300 bg-white text-zinc-700 hover:border-emerald-300 hover:text-emerald-800"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <p className="mt-4 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600 shadow-sm">
        {message}
      </p>

      {activeTab === "teams" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <form onSubmit={addTeam} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Add Team</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="team-name">
                Team name
                <input
                  id="team-name"
                  name="name"
                  required
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="team-logo">
                Team logo
                <input
                  id="team-logo"
                  name="logo"
                  type="file"
                  accept="image/*"
                  className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-3 text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Upload className="h-4 w-4" aria-hidden="true" />
                Add team
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Teams</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {data.teams.map((team) => {
                const isEditing = editingTeamId === team.id;

                return (
                  <div key={team.id} className="rounded-md bg-zinc-50 p-3">
                    {isEditing ? (
                      <form onSubmit={(event) => updateTeam(event, team)} className="grid gap-3">
                        <div className="flex items-center gap-3">
                          <TeamCrest team={team} size="md" />
                          <p className="min-w-0 flex-1 truncate font-extrabold text-zinc-950">
                            Edit team
                          </p>
                        </div>
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-team-name-${team.id}`}
                        >
                          Team name
                          <input
                            id={`edit-team-name-${team.id}`}
                            name="name"
                            defaultValue={team.name}
                            required
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-team-logo-${team.id}`}
                        >
                          Team logo
                          <input
                            id={`edit-team-logo-${team.id}`}
                            name="logo"
                            type="file"
                            accept="image/*"
                            className="rounded-md border border-dashed border-zinc-300 bg-white p-3 text-sm text-zinc-600 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-950 file:px-3 file:py-2 file:text-sm file:font-bold file:text-white"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={editBlocked}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save team
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingTeamId(null)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center gap-3">
                        <TeamCrest team={team} size="md" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-extrabold text-zinc-950">{team.name}</p>
                          <p className="text-xs font-semibold text-zinc-500">
                            {data.players.filter((player) => player.teamId === team.id).length} players
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingTeamId(team.id)}
                          disabled={editBlocked}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          title={`Edit ${team.name}`}
                          aria-label={`Edit ${team.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTeam(team)}
                          disabled={editBlocked}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                          title={`Delete ${team.name}`}
                          aria-label={`Delete ${team.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeTab === "players" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <form onSubmit={addPlayer} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Add Player</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="player-name">
                Player name
                <input
                  id="player-name"
                  name="name"
                  required
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="player-team">
                Team
                <select
                  id="player-team"
                  name="teamId"
                  required
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="position">
                  Position
                  <select
                    id="position"
                    name="position"
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    {positions.map((position) => (
                      <option key={position} value={position}>
                        {position}
                      </option>
                    ))}
                  </select>
                </label>
                <NumberInput id="jersey-number" name="jerseyNumber" label="Jersey number" min={1} max={99} />
              </div>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <CirclePlus className="h-4 w-4" aria-hidden="true" />
                Add player
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Squads</h2>
            <div className="mt-5 divide-y divide-zinc-100">
              {data.players.map((player) => {
                const team = data.teams.find((item) => item.id === player.teamId);
                const stats = playerStats.find((item) => item.player.id === player.id);
                const isEditing = editingPlayerId === player.id;
                const hasRecordedActivity = playerHasRecordedActivity(data, player.id);

                return (
                  <div key={player.id} className="py-3">
                    {isEditing ? (
                      <form
                        onSubmit={(event) => updatePlayer(event, player)}
                        className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/45 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center rounded-md bg-zinc-950 text-sm font-black text-white">
                            {player.jerseyNumber}
                          </span>
                          <div className="min-w-0">
                            <p className="font-extrabold text-zinc-950">Edit player</p>
                            {hasRecordedActivity ? (
                              <p className="mt-1 text-xs font-bold text-amber-800">
                                Team is locked because this player has match activity.
                              </p>
                            ) : null}
                          </div>
                        </div>
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-player-name-${player.id}`}
                        >
                          Player name
                          <input
                            id={`edit-player-name-${player.id}`}
                            name="name"
                            defaultValue={player.name}
                            required
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        {hasRecordedActivity ? (
                          <input type="hidden" name="teamId" value={player.teamId} />
                        ) : null}
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-player-team-${player.id}`}
                        >
                          Team
                          <select
                            id={`edit-player-team-${player.id}`}
                            name="teamId"
                            defaultValue={player.teamId}
                            disabled={hasRecordedActivity}
                            required
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                          >
                            {data.teams.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-player-position-${player.id}`}
                          >
                            Position
                            <select
                              id={`edit-player-position-${player.id}`}
                              name="position"
                              defaultValue={player.position}
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            >
                              {positions.map((position) => (
                                <option key={position} value={position}>
                                  {position}
                                </option>
                              ))}
                            </select>
                          </label>
                          <NumberInput
                            id={`edit-jersey-number-${player.id}`}
                            name="jerseyNumber"
                            label="Jersey number"
                            min={1}
                            max={99}
                            defaultValue={player.jerseyNumber}
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={editBlocked}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save player
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingPlayerId(null)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3">
                        <span className="grid h-9 w-9 place-items-center rounded-md bg-zinc-950 text-sm font-black text-white">
                          {player.jerseyNumber}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-zinc-950">{player.name}</p>
                          <p className="truncate text-sm font-semibold text-zinc-500">
                            {team?.name ?? "No team"} - {player.position}
                          </p>
                        </div>
                        <div className="text-right text-xs font-bold text-zinc-500">
                          <p>{stats?.goals ?? 0} G</p>
                          <p>{stats?.assists ?? 0} A</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setEditingPlayerId(player.id)}
                          disabled={editBlocked}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          title={`Edit ${player.name}`}
                          aria-label={`Edit ${player.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePlayer(player)}
                          disabled={editBlocked}
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                          title={`Delete ${player.name}`}
                          aria-label={`Delete ${player.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeTab === "matches" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <form onSubmit={addMatch} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <h2 className="text-2xl font-black text-zinc-950">Add Fixture</h2>
              <div className="mt-5 grid gap-4">
                <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="match-stage">
                  Stage
                  <select
                    id="match-stage"
                    name="stage"
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    {stages.map((stage) => (
                      <option key={stage} value={stage}>
                        {formatStage(stage)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="home-team">
                    Home team
                    <select
                      id="home-team"
                      name="homeTeamId"
                      required
                      className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    >
                      {data.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="away-team">
                    Away team
                    <select
                      id="away-team"
                      name="awayTeamId"
                      required
                      className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                    >
                      {data.teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="kickoff">
                  Kickoff
                  <input
                    id="kickoff"
                    name="kickoff"
                    type="datetime-local"
                    required
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="venue">
                  Venue
                  <input
                    id="venue"
                    name="venue"
                    required
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                  Add fixture
                </button>
              </div>
            </form>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Match List</h2>
            <div className="mt-5 divide-y divide-zinc-100">
              {data.matches.map((match) => {
                const home = data.teams.find((team) => team.id === match.homeTeamId);
                const away = data.teams.find((team) => team.id === match.awayTeamId);
                const isEditing = editingMatchId === match.id;
                const hasRecordedActivity = matchHasRecordedActivity(data, match);

                return (
                  <div key={match.id} className="py-3">
                    {isEditing ? (
                      <form
                        onSubmit={(event) => updateMatch(event, match)}
                        className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/45 p-3"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-extrabold text-zinc-950">Edit fixture</p>
                            {hasRecordedActivity ? (
                              <p className="mt-1 text-xs font-bold text-amber-800">
                                Teams and stage are locked because this fixture has match activity.
                              </p>
                            ) : null}
                          </div>
                          <StatusPill status={match.status} />
                        </div>

                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-match-stage-${match.id}`}
                        >
                          Stage
                          <select
                            id={`edit-match-stage-${match.id}`}
                            name="stage"
                            defaultValue={match.stage}
                            disabled={hasRecordedActivity}
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                          >
                            {stages.map((stage) => (
                              <option key={stage} value={stage}>
                                {formatStage(stage)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-home-team-${match.id}`}
                          >
                            Home team
                            <select
                              id={`edit-home-team-${match.id}`}
                              name="homeTeamId"
                              defaultValue={match.homeTeamId}
                              disabled={hasRecordedActivity}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                            >
                              {data.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-away-team-${match.id}`}
                          >
                            Away team
                            <select
                              id={`edit-away-team-${match.id}`}
                              name="awayTeamId"
                              defaultValue={match.awayTeamId}
                              disabled={hasRecordedActivity}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-500"
                            >
                              {data.teams.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-kickoff-${match.id}`}
                        >
                          Kickoff
                          <input
                            id={`edit-kickoff-${match.id}`}
                            name="kickoff"
                            type="datetime-local"
                            required
                            defaultValue={toDatetimeLocalValue(match.kickoff)}
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <label
                          className="grid gap-2 text-sm font-bold text-zinc-700"
                          htmlFor={`edit-venue-${match.id}`}
                        >
                          Venue
                          <input
                            id={`edit-venue-${match.id}`}
                            name="venue"
                            required
                            defaultValue={match.venue}
                            className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                          />
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={editBlocked}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save fixture
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingMatchId(null)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                        <div className="min-w-0">
                          <p className="truncate font-extrabold text-zinc-950">
                            {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                          </p>
                          <p className="text-sm font-semibold text-zinc-500">
                            {formatStage(match.stage)} - {formatKickoff(match.kickoff)} -{" "}
                            {match.venue}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusPill status={match.status} />
                          <button
                            type="button"
                            onClick={() => setEditingMatchId(match.id)}
                            disabled={editBlocked}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                            title={`Edit ${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
                            aria-label={`Edit ${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
                          >
                            <Pencil className="h-4 w-4" aria-hidden="true" />
                          </button>
                      <button
                        type="button"
                        onClick={() => deleteMatch(match)}
                            disabled={editBlocked}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700"
                        title={`Delete ${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
                        aria-label={`Delete ${home?.name ?? "Home"} vs ${away?.name ?? "Away"}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeTab === "news" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <form onSubmit={addNewsPost} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Add News</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="news-title">
                Title
                <input
                  id="news-title"
                  name="title"
                  required
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="news-body">
                Body
                <textarea
                  id="news-body"
                  name="body"
                  required
                  rows={8}
                  className="min-h-36 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Newspaper className="h-4 w-4" aria-hidden="true" />
                Publish news
              </button>
            </div>
          </form>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">News Posts</h2>
            <div className="mt-5 divide-y divide-zinc-100">
              {data.newsPosts.length > 0 ? (
                data.newsPosts.map((post) => {
                  const isEditing = editingNewsPostId === post.id;

                  return (
                    <article key={post.id} className="grid gap-3 py-4">
                      {isEditing ? (
                        <form
                          onSubmit={(event) => updateNewsPost(event, post)}
                          className="grid gap-3 rounded-md border border-emerald-200 bg-emerald-50/45 p-3"
                        >
                          <p className="font-extrabold text-zinc-950">Edit news post</p>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-news-title-${post.id}`}
                          >
                            Title
                            <input
                              id={`edit-news-title-${post.id}`}
                              name="title"
                              defaultValue={post.title}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            />
                          </label>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-news-published-${post.id}`}
                          >
                            Published
                            <input
                              id={`edit-news-published-${post.id}`}
                              name="publishedAt"
                              type="datetime-local"
                              defaultValue={toDatetimeLocalValue(post.publishedAt)}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            />
                          </label>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-news-body-${post.id}`}
                          >
                            Body
                            <textarea
                              id={`edit-news-body-${post.id}`}
                              name="body"
                              defaultValue={post.body}
                              required
                              rows={8}
                              className="min-h-36 rounded-md border border-zinc-300 bg-white px-3 py-2 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={editBlocked}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                            >
                              <Save className="h-4 w-4" aria-hidden="true" />
                              Save news
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNewsPostId(null)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                            >
                              <X className="h-4 w-4" aria-hidden="true" />
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-extrabold text-zinc-950">{post.title}</p>
                              <p className="text-xs font-bold uppercase text-zinc-500">
                                {formatKickoff(post.publishedAt)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingNewsPostId(post.id)}
                                disabled={editBlocked}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                                title={`Edit ${post.title}`}
                                aria-label={`Edit ${post.title}`}
                              >
                                <Pencil className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteNewsPost(post)}
                                disabled={editBlocked}
                                className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-red-200 bg-white text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                                title={`Delete ${post.title}`}
                                aria-label={`Delete ${post.title}`}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <p className="whitespace-pre-line text-sm font-medium leading-6 text-zinc-600">
                            {post.body}
                          </p>
                        </>
                      )}
                    </article>
                  );
                })
              ) : (
                <p className="py-4 text-sm font-semibold text-zinc-500">No news yet.</p>
              )}
            </div>
          </section>
        </section>
      )}

      {activeTab === "events" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                  Live control
                </p>
                <h2 className="text-2xl font-black text-zinc-950">Match Timer</h2>
              </div>
              {selectedMatch ? <StatusPill status={selectedMatch.status} /> : null}
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
              <div className="space-y-4">
                <label
                  className="grid gap-2 text-sm font-bold text-zinc-700"
                  htmlFor="timer-match"
                >
                  Controlled match
                  <select
                    id="timer-match"
                    value={selectedMatchId}
                    onChange={(event) => setSelectedMatchId(event.target.value)}
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    {data.matches.map((match) => {
                      const home = data.teams.find((team) => team.id === match.homeTeamId);
                      const away = data.teams.find((team) => team.id === match.awayTeamId);

                      return (
                        <option key={match.id} value={match.id}>
                          {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {selectedMatch && selectedMatchHome && selectedMatchAway ? (
                  <div className="rounded-md bg-zinc-50 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                      {formatStage(selectedMatch.stage)}
                    </p>
                    <p className="mt-2 font-extrabold text-zinc-950">
                      {selectedMatchHome.name} vs {selectedMatchAway.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">
                      {formatKickoff(selectedMatch.kickoff)}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-500">
                      {selectedMatch.venue}
                    </p>
                    <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-md border border-zinc-200 bg-white p-3">
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Home
                        </p>
                        <p className="truncate text-sm font-extrabold text-zinc-950">
                          {selectedMatchHome.name}
                        </p>
                      </div>
                      <div className="grid min-w-20 place-items-center rounded-md bg-zinc-950 px-4 py-2 text-white">
                        <p className="text-2xl font-black">{getAdminScoreValue(selectedMatch)}</p>
                        {hasPenaltyScore(selectedMatch) ? (
                          <p className="text-xs font-bold text-zinc-300">
                            Pens {selectedMatch.homePenaltyScore}-{selectedMatch.awayPenaltyScore}
                          </p>
                        ) : null}
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="text-xs font-black uppercase tracking-wide text-zinc-500">
                          Away
                        </p>
                        <p className="truncate text-sm font-extrabold text-zinc-950">
                          {selectedMatchAway.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-md bg-zinc-50 p-4 text-sm font-semibold text-zinc-500">
                    No match selected.
                  </p>
                )}
              </div>

              <div className="space-y-4">
                {selectedMatch ? (
                  <LiveMatchTimer
                    key={`${selectedMatch.id}-${selectedMatch.timerPhase}-${selectedMatch.timerStartedAt}`}
                    match={selectedMatch}
                    variant="large"
                  />
                ) : null}
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {[
                    {
                      action: "start_first_half" as TimerAction,
                      label: "Start 1st Half",
                      icon: Play,
                      disabled: selectedTimerPhase !== "not_started",
                    },
                    {
                      action: "half_time" as TimerAction,
                      label: "Half-time",
                      icon: Pause,
                      disabled: selectedTimerPhase !== "first_half",
                    },
                    {
                      action: "start_second_half" as TimerAction,
                      label: "Resume 2nd Half",
                      icon: Play,
                      disabled: selectedTimerPhase !== "half_time",
                    },
                    {
                      action: "full_time" as TimerAction,
                      label: "Full-time",
                      icon: Flag,
                      disabled:
                        selectedTimerPhase === "not_started" ||
                        selectedTimerPhase === "full_time",
                    },
                    {
                      action: "penalties" as TimerAction,
                      label: "Penalties",
                      icon: Trophy,
                      disabled:
                        !selectedMatch ||
                        !selectedMatchIsKnockout ||
                        selectedTimerPhase === "penalties",
                    },
                    {
                      action: "reset" as TimerAction,
                      label: "Reset",
                      icon: RotateCcw,
                      disabled: selectedTimerPhase === "not_started",
                    },
                  ].map((control) => {
                    const Icon = control.icon;

                    return (
                      <button
                        key={control.action}
                        type="button"
                        onClick={() => updateTimer(control.action)}
                        disabled={editBlocked || control.disabled}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {control.label}
                      </button>
                    );
                  })}
                </div>
                <p className="rounded-md bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
                  Start 1st Half moves the match live. Full-time completes it from the
                  event score, and knockout ties can move into penalties.
                </p>
              </div>
            </div>
          </section>

          {selectedMatch && selectedCleanSheetSides.length > 0 ? (
            <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                  Goalkeeper records
                </p>
                <h2 className="text-2xl font-black text-zinc-950">Clean Sheet Credits</h2>
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {selectedCleanSheetSides.map(({ side, team }) => {
                  const goalkeepers = getTeamGoalkeepers(data.players, team.id);
                  const currentGoalkeeperId = getCleanSheetGoalkeeperId(selectedMatch, side);

                  return (
                    <form
                      key={`${selectedMatch.id}-${side}-${currentGoalkeeperId ?? "none"}`}
                      onSubmit={updateCleanSheetGoalkeeper}
                      className="rounded-md bg-zinc-50 p-4"
                    >
                      <input type="hidden" name="matchId" value={selectedMatch.id} />
                      <input type="hidden" name="side" value={side} />
                      <label
                        className="grid gap-2 text-sm font-bold text-zinc-700"
                        htmlFor={`clean-sheet-${side}`}
                      >
                        {team.name}
                        <select
                          id={`clean-sheet-${side}`}
                          name="goalkeeperId"
                          defaultValue={currentGoalkeeperId ?? ""}
                          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                        >
                          <option value="">No goalkeeper selected</option>
                          {goalkeepers.map((player) => (
                            <option key={player.id} value={player.id}>
                              #{player.jerseyNumber} {player.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {goalkeepers.length === 0 ? (
                        <p className="mt-3 text-xs font-bold text-red-600">
                          Add a goalkeeper to this team first.
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={editBlocked || goalkeepers.length === 0}
                        className="mt-4 inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Shield className="h-4 w-4" aria-hidden="true" />
                        Save credit
                      </button>
                    </form>
                  );
                })}
              </div>
            </section>
          ) : null}

          <form
            onSubmit={addEvent}
            className={`rounded-lg border border-zinc-200 bg-white p-5 shadow-sm ${
              selectedMatchIsKnockout ? "" : "lg:col-span-2"
            }`}
          >
            <h2 className="text-2xl font-black text-zinc-950">Add Event</h2>
            <div className="mt-5 grid gap-4">
              <input type="hidden" name="matchId" value={selectedMatchId} />
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="event-type">
                Event
                <select
                  id="event-type"
                  name="type"
                  value={selectedEventType}
                  onChange={(event) => setSelectedEventType(event.target.value as MatchEventType)}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {eventTypes.map((type) => (
                    <option key={type} value={type}>
                      {type.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="event-team">
                Team
                <select
                  id="event-team"
                  name="teamId"
                  value={activeEventTeamId}
                  onChange={(event) => setSelectedEventTeamId(event.target.value)}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {selectedEventTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="event-player">
                Player
                <select
                  id="event-player"
                  name="playerId"
                  value={activeEventPlayerId}
                  onChange={(event) => setSelectedEventPlayerId(event.target.value)}
                  required
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {eventTeamPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      #{player.jerseyNumber} {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="assist-player">
                Assist
                <select
                  id="assist-player"
                  name="assistPlayerId"
                  disabled={selectedEventType !== "goal" || assistPlayerOptions.length === 0}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                >
                  <option value="">No assist</option>
                  {assistPlayerOptions.map((player) => (
                    <option key={player.id} value={player.id}>
                      #{player.jerseyNumber} {player.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="event-half">
                  Half
                  <select
                    id="event-half"
                    name="half"
                    className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="1">1st half</option>
                    <option value="2">2nd half</option>
                  </select>
                </label>
                <NumberInput
                  id="event-minute"
                  name="minute"
                  label="Minute"
                  min={1}
                  max={MATCH_DURATION_MINUTES}
                />
                <NumberInput id="added-time" name="addedTime" label="Added" min={0} max={20} required={false} />
              </div>
              <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-300 bg-white px-3 text-sm font-bold text-zinc-700">
                <input
                  type="checkbox"
                  name="isDisallowed"
                  className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500"
                />
                Disallowed
              </label>
              <p className="rounded-md bg-zinc-50 p-3 text-xs font-bold text-zinc-500">
                Match timing: {HALF_DURATION_MINUTES}+ added time each half, {MATCH_DURATION_MINUTES} minutes total.
              </p>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Trophy className="h-4 w-4" aria-hidden="true" />
                Add event
              </button>
            </div>
          </form>

          {selectedMatchIsKnockout && selectedMatch && selectedMatchHome && selectedMatchAway ? (
            <form
              key={`penalties-${selectedMatchId}-${selectedMatch.homePenaltyScore ?? "none"}-${selectedMatch.awayPenaltyScore ?? "none"}`}
              onSubmit={updatePenaltyScore}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                    Knockout
                  </p>
                  <h2 className="text-2xl font-black text-zinc-950">Penalty Score</h2>
                </div>
                {hasPenaltyScore(selectedMatch) ? (
                  <p className="rounded-md bg-zinc-950 px-3 py-2 text-sm font-black text-white">
                    {selectedMatch.homePenaltyScore}-{selectedMatch.awayPenaltyScore}
                  </p>
                ) : null}
              </div>
              <div className="mt-5 grid gap-4">
                <input type="hidden" name="matchId" value={selectedMatchId} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <NumberInput
                    id="event-home-penalty-score"
                    name="homePenaltyScore"
                    label={`${selectedMatchHome.name} penalties`}
                    required={false}
                    defaultValue={selectedMatch.homePenaltyScore ?? ""}
                  />
                  <NumberInput
                    id="event-away-penalty-score"
                    name="awayPenaltyScore"
                    label={`${selectedMatchAway.name} penalties`}
                    required={false}
                    defaultValue={selectedMatch.awayPenaltyScore ?? ""}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
                >
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                  Update penalties
                </button>
              </div>
            </form>
          ) : null}

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700">
                  Selected fixture
                </p>
                <h2 className="text-2xl font-black text-zinc-950">Match Timeline</h2>
              </div>
              {selectedMatch ? <StatusPill status={selectedMatch.status} /> : null}
            </div>
            <div className="mt-5">
              <MatchTimelineList
                events={selectedMatchEvents}
                teams={data.teams}
                players={data.players}
                renderActions={(matchEvent) => {
                  const assistOptions = getAssistPlayerOptions(data.players, matchEvent);
                  const isEditing = editingEventId === matchEvent.id;
                  const eventMatch = data.matches.find((match) => match.id === matchEvent.matchId);
                  const editEventTeamOptions = eventMatch
                    ? [eventMatch.homeTeamId, eventMatch.awayTeamId]
                        .map((teamId) => data.teams.find((team) => team.id === teamId))
                        .filter((team): team is Team => Boolean(team))
                    : data.teams;
                  const activeEditingEventTeamId = editEventTeamOptions.some(
                    (team) => team.id === editingEventTeamId,
                  )
                    ? editingEventTeamId
                    : editEventTeamOptions.some((team) => team.id === matchEvent.teamId)
                      ? matchEvent.teamId
                      : editEventTeamOptions[0]?.id ?? "";
                  const editingEventPlayers = data.players.filter(
                    (player) => player.teamId === activeEditingEventTeamId,
                  );
                  const activeEditingEventPlayerId = editingEventPlayers.some(
                    (player) => player.id === editingEventPlayerId,
                  )
                    ? editingEventPlayerId
                    : editingEventPlayers.some((player) => player.id === matchEvent.playerId)
                      ? matchEvent.playerId
                      : editingEventPlayers[0]?.id ?? "";
                  const editingAssistOptions =
                    editingEventType === "goal"
                      ? editingEventPlayers.filter(
                          (player) => player.id !== activeEditingEventPlayerId,
                        )
                      : [];
                  const activeEditingAssistPlayerId =
                    editingAssistOptions.some(
                      (player) => player.id === matchEvent.assistPlayerId,
                    )
                      ? matchEvent.assistPlayerId ?? ""
                      : "";

                  if (isEditing) {
                    return (
                      <form
                        onSubmit={(event) => updateMatchEvent(event, matchEvent)}
                        className="grid gap-3 rounded-md border border-emerald-200 bg-white p-3"
                      >
                        <p className="font-extrabold text-zinc-950">Edit match event</p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-event-type-${matchEvent.id}`}
                          >
                            Event
                            <select
                              id={`edit-event-type-${matchEvent.id}`}
                              name="type"
                              value={editingEventType}
                              onChange={(event) =>
                                setEditingEventType(event.target.value as MatchEventType)
                              }
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            >
                              {eventTypes.map((type) => (
                                <option key={type} value={type}>
                                  {type.replace("_", " ")}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-event-team-${matchEvent.id}`}
                          >
                            Team
                            <select
                              id={`edit-event-team-${matchEvent.id}`}
                              name="teamId"
                              value={activeEditingEventTeamId}
                              onChange={(event) => {
                                setEditingEventTeamId(event.target.value);
                                setEditingEventPlayerId("");
                              }}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            >
                              {editEventTeamOptions.map((team) => (
                                <option key={team.id} value={team.id}>
                                  {team.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-event-player-${matchEvent.id}`}
                          >
                            Player
                            <select
                              id={`edit-event-player-${matchEvent.id}`}
                              name="playerId"
                              value={activeEditingEventPlayerId}
                              onChange={(event) => setEditingEventPlayerId(event.target.value)}
                              required
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            >
                              {editingEventPlayers.length > 0 ? (
                                editingEventPlayers.map((player) => (
                                  <option key={player.id} value={player.id}>
                                    #{player.jerseyNumber} {player.name}
                                  </option>
                                ))
                              ) : (
                                <option value="">No players</option>
                              )}
                            </select>
                          </label>
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-assist-player-${matchEvent.id}`}
                          >
                            Assist
                            <select
                              key={`${matchEvent.id}-${activeEditingEventTeamId}-${activeEditingEventPlayerId}-${editingEventType}`}
                              id={`edit-assist-player-${matchEvent.id}`}
                              name="assistPlayerId"
                              defaultValue={activeEditingAssistPlayerId}
                              disabled={
                                editingEventType !== "goal" || editingAssistOptions.length === 0
                              }
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                            >
                              <option value="">No assist</option>
                              {editingAssistOptions.map((player) => (
                                <option key={player.id} value={player.id}>
                                  #{player.jerseyNumber} {player.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <label
                            className="grid gap-2 text-sm font-bold text-zinc-700"
                            htmlFor={`edit-event-half-${matchEvent.id}`}
                          >
                            Half
                            <select
                              id={`edit-event-half-${matchEvent.id}`}
                              name="half"
                              defaultValue={matchEvent.half}
                              className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                            >
                              <option value="1">1st half</option>
                              <option value="2">2nd half</option>
                            </select>
                          </label>
                          <NumberInput
                            id={`edit-event-minute-${matchEvent.id}`}
                            name="minute"
                            label="Minute"
                            min={1}
                            max={MATCH_DURATION_MINUTES}
                            defaultValue={matchEvent.minute}
                          />
                          <NumberInput
                            id={`edit-event-added-time-${matchEvent.id}`}
                            name="addedTime"
                            label="Added"
                            min={0}
                            max={20}
                            required={false}
                            defaultValue={matchEvent.addedTime}
                          />
                        </div>
                        <label className="flex min-h-11 items-center gap-3 rounded-md border border-zinc-300 bg-white px-3 text-sm font-bold text-zinc-700">
                          <input
                            type="checkbox"
                            name="isDisallowed"
                            defaultChecked={Boolean(matchEvent.isDisallowed)}
                            disabled={!isScoreEventType(editingEventType)}
                            className="h-4 w-4 rounded border-zinc-300 text-emerald-700 focus:ring-emerald-500 disabled:cursor-not-allowed"
                          />
                          Disallowed
                        </label>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={editBlocked || editingEventPlayers.length === 0}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Save className="h-4 w-4" aria-hidden="true" />
                            Save event
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingEventId(null)}
                            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800"
                          >
                            <X className="h-4 w-4" aria-hidden="true" />
                            Cancel
                          </button>
                        </div>
                      </form>
                    );
                  }

                  return (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => startEditingMatchEvent(matchEvent)}
                        disabled={editBlocked}
                        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        Edit
                      </button>
                      {matchEvent.type === "goal" ? (
                        <form
                          key={`assist-${matchEvent.id}-${matchEvent.assistPlayerId ?? "none"}`}
                          onSubmit={(event) => updateEventAssist(event, matchEvent)}
                          className="flex min-w-0 flex-wrap items-center gap-2"
                        >
                          <select
                            name="assistPlayerId"
                            defaultValue={matchEvent.assistPlayerId ?? ""}
                            disabled={editBlocked || assistOptions.length === 0}
                            aria-label="Assist player"
                            className="min-h-9 min-w-44 rounded-md border border-zinc-300 bg-white px-2 text-xs font-bold text-zinc-700 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400"
                          >
                            <option value="">No assist</option>
                            {assistOptions.map((player) => (
                              <option key={player.id} value={player.id}>
                                #{player.jerseyNumber} {player.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="submit"
                            disabled={editBlocked || assistOptions.length === 0}
                            className="inline-flex min-h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            <Save className="h-3.5 w-3.5" aria-hidden="true" />
                            Save assist
                          </button>
                        </form>
                      ) : null}
                      {isScoreEventType(matchEvent.type) ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateEventDisallowed(matchEvent, !matchEvent.isDisallowed)
                          }
                          disabled={editBlocked}
                          className="inline-flex min-h-9 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-xs font-black text-zinc-700 transition hover:border-emerald-300 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
                        >
                          {matchEvent.isDisallowed ? (
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                          ) : (
                            <Ban className="h-3.5 w-3.5" aria-hidden="true" />
                          )}
                          {matchEvent.isDisallowed ? "Restore goal" : "Disallow goal"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => deleteMatchEvent(matchEvent)}
                        disabled={editBlocked}
                        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-red-200 bg-white px-3 text-xs font-black text-red-600 transition hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  );
                }}
              />
            </div>
          </section>

          <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-2xl font-black text-zinc-950">Qualification Snapshot</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {standings.slice(0, 8).map((row) => (
                <div key={row.team.id} className="flex items-center gap-3 rounded-md bg-emerald-50 p-3">
                  <span className="text-sm font-black text-emerald-800">{row.rank}</span>
                  <TeamCrest team={row.team} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-zinc-950">{row.team.name}</p>
                    <p className="text-xs font-bold text-emerald-700">{row.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      )}
        </>
      ) : null}
    </main>
  );
}
