"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  CalendarPlus,
  CirclePlus,
  ClipboardList,
  LogIn,
  LogOut,
  RefreshCw,
  Save,
  Shield,
  Shirt,
  Trophy,
  Upload,
} from "lucide-react";
import { TeamCrest } from "@/components/team-crest";
import { StatusPill } from "@/components/status-pill";
import { createBrowserSupabaseClient, hasSupabaseConfig } from "@/lib/supabase";
import {
  calculatePlayerStats,
  calculateStandings,
  formatKickoff,
  formatStage,
  HALF_DURATION_MINUTES,
  MATCH_DURATION_MINUTES,
} from "@/lib/tournament";
import type {
  CompetitionData,
  Match,
  MatchEventType,
  MatchStage,
  MatchStatus,
  PlayerPosition,
  Team,
} from "@/lib/types";

type AdminConsoleProps = {
  initialData: CompetitionData;
};

type Tab = "teams" | "players" | "matches" | "events";

const STORAGE_KEY = "bankers-cup-demo-admin-data";
const positions: PlayerPosition[] = ["Goalkeeper", "Defender", "Midfielder", "Forward"];
const stages: MatchStage[] = ["group", "quarter_final", "semi_final", "final", "third_place"];
const statuses: MatchStatus[] = ["scheduled", "live", "completed", "postponed", "cancelled"];
const eventTypes: MatchEventType[] = ["goal", "own_goal", "yellow_card", "red_card"];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fetchCompetitionData() {
  const response = await fetch("/api/competition", { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Unable to load competition data");
  }

  return (await response.json()) as CompetitionData;
}

function NumberInput({
  id,
  name,
  label,
  min = 0,
  max,
  required = true,
}: {
  id: string;
  name: string;
  label: string;
  min?: number;
  max?: number;
  required?: boolean;
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
        className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}

export function AdminConsole({ initialData }: AdminConsoleProps) {
  const configured = hasSupabaseConfig();
  const [data, setData] = useState<CompetitionData>(() => {
    if (typeof window === "undefined" || configured) {
      return initialData;
    }

    const saved = window.localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialData;
    }

    try {
      return JSON.parse(saved) as CompetitionData;
    } catch {
      return initialData;
    }
  });
  const [activeTab, setActiveTab] = useState<Tab>("teams");
  const [message, setMessage] = useState("Ready");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState(initialData.matches[0]?.id ?? "");
  const [selectedEventTeamId, setSelectedEventTeamId] = useState(initialData.teams[0]?.id ?? "");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const standings = useMemo(() => calculateStandings(data.teams, data.matches), [data]);
  const playerStats = useMemo(() => calculatePlayerStats(data), [data]);
  const selectedMatch = data.matches.find((match) => match.id === selectedMatchId);
  const eventTeamPlayers = data.players.filter((player) => player.teamId === selectedEventTeamId);
  const canWriteLive = Boolean(configured && sessionEmail && supabase);

  useEffect(() => {
    if (configured && supabase) {
      supabase.auth.getSession().then(({ data: sessionData }) => {
        setSessionEmail(sessionData.session?.user.email ?? null);
      });

      const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSessionEmail(session?.user.email ?? null);
      });

      return () => listener.subscription.unsubscribe();
    }

    return undefined;
  }, [configured, supabase]);

  useEffect(() => {
    if (!configured) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  }, [configured, data]);

  async function refreshData() {
    if (!configured) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setData(JSON.parse(saved) as CompetitionData);
      }
      setMessage("Demo data refreshed");
      return;
    }

    try {
      setMessage("Loading live data...");
      setData(await fetchCompetitionData());
      setMessage("Live data refreshed");
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
    setMessage("Signed in");
    await refreshData();
  }

  async function signOut() {
    if (!supabase) return;

    await supabase.auth.signOut();
    setSessionEmail(null);
    setMessage("Signed out");
  }

  async function addTeam(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const logoFile = form.get("logo") instanceof File ? (form.get("logo") as File) : null;

    if (!name) {
      setMessage("Team name is required");
      return;
    }

    try {
      let logoUrl: string | null = null;

      if (logoFile && logoFile.size > 0) {
        if (canWriteLive && supabase) {
          const extension = logoFile.name.split(".").pop() ?? "png";
          const path = `${slugify(name)}-${Date.now()}.${extension}`;
          const upload = await supabase.storage.from("team-logos").upload(path, logoFile, {
            upsert: true,
          });

          if (upload.error) throw upload.error;

          const publicUrl = supabase.storage.from("team-logos").getPublicUrl(path);
          logoUrl = publicUrl.data.publicUrl;
        } else {
          logoUrl = await fileToDataUrl(logoFile);
        }
      }

      if (canWriteLive && supabase) {
        const { error } = await supabase.from("teams").insert({ name, logo_url: logoUrl });
        if (error) throw error;
        await refreshData();
      } else {
        const newTeam: Team = {
          id: `${slugify(name)}-${Date.now()}`,
          name,
          logoUrl,
        };

        setData((current) => ({
          ...current,
          teams: [...current.teams, newTeam].sort((a, b) => a.name.localeCompare(b.name)),
          source: "demo",
        }));
      }

      event.currentTarget.reset();
      setMessage(`${name} added`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add team");
    }
  }

  async function addPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      if (canWriteLive && supabase) {
        const { error } = await supabase.from("players").insert({
          name,
          team_id: teamId,
          position,
          jersey_number: jerseyNumber,
        });
        if (error) throw error;
        await refreshData();
      } else {
        setData((current) => ({
          ...current,
          players: [
            ...current.players,
            {
              id: createId("player"),
              teamId,
              name,
              position,
              jerseyNumber,
            },
          ],
          source: "demo",
        }));
      }

      event.currentTarget.reset();
      setMessage(`${name} added`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add player");
    }
  }

  async function addMatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stage = String(form.get("stage") ?? "group") as MatchStage;
    const homeTeamId = String(form.get("homeTeamId") ?? "");
    const awayTeamId = String(form.get("awayTeamId") ?? "");
    const kickoff = String(form.get("kickoff") ?? "");
    const venue = String(form.get("venue") ?? "").trim();

    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId || !kickoff || !venue) {
      setMessage("Choose two different teams, kickoff time, and venue");
      return;
    }

    const match: Match = {
      id: createId("match"),
      stage,
      homeTeamId,
      awayTeamId,
      kickoff: new Date(kickoff).toISOString(),
      venue,
      status: "scheduled",
      homeScore: null,
      awayScore: null,
      homePenaltyScore: null,
      awayPenaltyScore: null,
      winnerTeamId: null,
    };

    try {
      if (canWriteLive && supabase) {
        const { error } = await supabase.from("matches").insert({
          stage,
          home_team_id: homeTeamId,
          away_team_id: awayTeamId,
          kickoff: match.kickoff,
          venue,
          status: "scheduled",
        });
        if (error) throw error;
        await refreshData();
      } else {
        setData((current) => ({
          ...current,
          matches: [...current.matches, match].sort(
            (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime(),
          ),
          source: "demo",
        }));
      }

      event.currentTarget.reset();
      setMessage("Fixture added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add fixture");
    }
  }

  async function updateResult(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matchId = String(form.get("matchId") ?? "");
    const status = String(form.get("status") ?? "scheduled") as MatchStatus;
    const homeScoreValue = String(form.get("homeScore") ?? "");
    const awayScoreValue = String(form.get("awayScore") ?? "");
    const homePenaltyValue = String(form.get("homePenaltyScore") ?? "");
    const awayPenaltyValue = String(form.get("awayPenaltyScore") ?? "");
    const winnerTeamId = String(form.get("winnerTeamId") ?? "") || null;
    const homeScore = homeScoreValue === "" ? null : Number(homeScoreValue);
    const awayScore = awayScoreValue === "" ? null : Number(awayScoreValue);
    const homePenaltyScore = homePenaltyValue === "" ? null : Number(homePenaltyValue);
    const awayPenaltyScore = awayPenaltyValue === "" ? null : Number(awayPenaltyValue);

    if (!matchId) {
      setMessage("Select a match");
      return;
    }

    try {
      if (canWriteLive && supabase) {
        const { error } = await supabase
          .from("matches")
          .update({
            status,
            home_score: homeScore,
            away_score: awayScore,
            home_penalty_score: homePenaltyScore,
            away_penalty_score: awayPenaltyScore,
            winner_team_id: winnerTeamId,
          })
          .eq("id", matchId);
        if (error) throw error;
        await refreshData();
      } else {
        setData((current) => ({
          ...current,
          matches: current.matches.map((match) =>
            match.id === matchId
              ? {
                  ...match,
                  status,
                  homeScore,
                  awayScore,
                  homePenaltyScore,
                  awayPenaltyScore,
                  winnerTeamId,
                }
              : match,
          ),
          source: "demo",
        }));
      }

      setMessage("Result saved");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save result");
    }
  }

  async function addEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const matchId = String(form.get("matchId") ?? "");
    const teamId = String(form.get("teamId") ?? "");
    const playerId = String(form.get("playerId") ?? "");
    const assistPlayerId = String(form.get("assistPlayerId") ?? "") || null;
    const type = String(form.get("type") ?? "goal") as MatchEventType;
    const half = Number(form.get("half")) as 1 | 2;
    const minute = Number(form.get("minute"));
    const addedTime = Number(form.get("addedTime") ?? 0);

    if (!matchId || !teamId || !playerId || !Number.isFinite(minute)) {
      setMessage("Select a match, team, player, and minute");
      return;
    }

    if (minute < 1 || minute > MATCH_DURATION_MINUTES) {
      setMessage("Event minute must be between 1 and 60");
      return;
    }

    try {
      if (canWriteLive && supabase) {
        const { error } = await supabase.from("match_events").insert({
          match_id: matchId,
          team_id: teamId,
          player_id: playerId,
          assist_player_id: type === "goal" ? assistPlayerId : null,
          event_type: type,
          half,
          minute,
          added_time: addedTime,
        });
        if (error) throw error;
        await refreshData();
      } else {
        setData((current) => ({
          ...current,
          events: [
            ...current.events,
            {
              id: createId("event"),
              matchId,
              teamId,
              playerId,
              assistPlayerId: type === "goal" ? assistPlayerId : null,
              type,
              half,
              minute,
              addedTime,
            },
          ],
          source: "demo",
        }));
      }

      event.currentTarget.reset();
      setMessage("Match event added");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add match event");
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
              {configured
                ? "Connected to Supabase configuration. Sign in with your admin account to write live data."
                : "Demo mode is active. Add Supabase credentials to switch this dashboard to live database and logo uploads."}
            </p>
          </div>

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
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
        </div>
      </section>

      {configured && !sessionEmail ? (
        <section className="mt-6 rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-black text-zinc-950">Admin Sign In</h2>
          <form className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={signIn}>
            <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="admin-email">
              Email
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="admin-password">
              Password
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <button
              type="submit"
              className="mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
              Sign in
            </button>
          </form>
        </section>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { id: "teams", label: "Teams", icon: Shield },
          { id: "players", label: "Players", icon: Shirt },
          { id: "matches", label: "Matches", icon: CalendarPlus },
          { id: "events", label: "Results & Events", icon: ClipboardList },
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
              {data.teams.map((team) => (
                <div key={team.id} className="flex items-center gap-3 rounded-md bg-zinc-50 p-3">
                  <TeamCrest team={team} size="md" />
                  <div className="min-w-0">
                    <p className="truncate font-extrabold text-zinc-950">{team.name}</p>
                    <p className="text-xs font-semibold text-zinc-500">
                      {data.players.filter((player) => player.teamId === team.id).length} players
                    </p>
                  </div>
                </div>
              ))}
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

                return (
                  <div key={player.id} className="grid grid-cols-[auto_1fr_auto] gap-3 py-3">
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

                return (
                  <div key={match.id} className="grid gap-3 py-3 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="truncate font-extrabold text-zinc-950">
                        {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                      </p>
                      <p className="text-sm font-semibold text-zinc-500">
                        {formatStage(match.stage)} - {formatKickoff(match.kickoff)} -{" "}
                        {match.venue}
                      </p>
                    </div>
                    <StatusPill status={match.status} />
                  </div>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeTab === "events" && (
        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <form onSubmit={updateResult} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Save Result</h2>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="result-match">
                Match
                <select
                  id="result-match"
                  name="matchId"
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
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="match-status">
                Status
                <select
                  id="match-status"
                  name="status"
                  defaultValue={selectedMatch?.status ?? "completed"}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberInput id="home-score" name="homeScore" label="Home score" required={false} />
                <NumberInput id="away-score" name="awayScore" label="Away score" required={false} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberInput
                  id="home-penalty-score"
                  name="homePenaltyScore"
                  label="Home penalties"
                  required={false}
                />
                <NumberInput
                  id="away-penalty-score"
                  name="awayPenaltyScore"
                  label="Away penalties"
                  required={false}
                />
              </div>
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="winner-team">
                Winner
                <select
                  id="winner-team"
                  name="winnerTeamId"
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">None</option>
                  {selectedMatch
                    ? [selectedMatch.homeTeamId, selectedMatch.awayTeamId].map((teamId) => {
                        const team = data.teams.find((item) => item.id === teamId);
                        return team ? (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ) : null;
                      })
                    : null}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-black text-white transition hover:bg-emerald-800"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                Save result
              </button>
            </div>
          </form>

          <form onSubmit={addEvent} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-2xl font-black text-zinc-950">Add Event</h2>
            <div className="mt-5 grid gap-4">
              <input type="hidden" name="matchId" value={selectedMatchId} />
              <label className="grid gap-2 text-sm font-bold text-zinc-700" htmlFor="event-type">
                Event
                <select
                  id="event-type"
                  name="type"
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
                  value={selectedEventTeamId}
                  onChange={(event) => setSelectedEventTeamId(event.target.value)}
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  {data.teams.map((team) => (
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
                  className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-zinc-950 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
                >
                  <option value="">No assist</option>
                  {eventTeamPlayers.map((player) => (
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
    </main>
  );
}
