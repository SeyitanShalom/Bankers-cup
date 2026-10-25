import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateStandings,
  formatKickoff,
  getKnockoutSeedSlots,
  getQuarterFinalMatchesBySeed,
} from "../src/lib/tournament.ts";

const team = (id, name = id) => ({ id, name, logoUrl: null });
const match = (id, homeTeamId, awayTeamId, overrides = {}) => ({
  id,
  homeTeamId,
  awayTeamId,
  stage: "group",
  status: "completed",
  homeScore: 0,
  awayScore: 0,
  kickoff: "2026-10-25T14:00:00Z",
  venue: "Test ground",
  ...overrides,
});
const card = (id, matchId, teamId, type = "yellow_card", overrides = {}) => ({
  id,
  matchId,
  teamId,
  type,
  recipientType: "player",
  playerId: `${teamId}-player`,
  half: 1,
  minute: 10,
  addedTime: 0,
  ...overrides,
});

test("fair play separates tied teams using their player and coach cards", () => {
  const teams = [team("p", "Providus-Unity Bank FC"), team("w", "Wema Bank FC")];
  const matches = [match("league", "p", "w")];
  const events = [
    ...Array.from({ length: 6 }, (_, i) =>
      card(`p-yellow-${i}`, "league", "p", "yellow_card", i < 2
        ? { recipientType: "coach", playerId: null }
        : {}),
    ),
    card("p-red", "league", "p", "red_card"),
    card("w-yellow", "league", "w"),
    card("w-red", "league", "w", "red_card"),
  ];
  const originalInputs = JSON.stringify({ teams, matches, events });
  const rows = calculateStandings(teams, matches, events);

  assert.deepEqual(rows.map((row) => [row.team.id, row.rank, row.yellowCards, row.redCards, row.fairPlayPoints]), [
    ["w", 1, 1, 1, 2],
    ["p", 2, 6, 1, 7],
  ]);
  assert.equal(JSON.stringify({ teams, matches, events }), originalInputs);
});

test("one red carries the same penalty as one yellow", () => {
  const teams = [team("a", "Alpha"), team("z", "Zulu")];
  const matches = [match("league", "a", "z")];
  const rows = calculateStandings(teams, matches, [
    card("yellow-1", "league", "a"),
    card("yellow-2", "league", "a"),
    card("red", "league", "z", "red_card"),
  ]);

  assert.deepEqual(rows.map((row) => [row.team.id, row.fairPlayPoints]), [["z", 1], ["a", 2]]);
});

for (const [criterion, scores] of [
  ["points", [[1, 0], [0, 0]]],
  ["goal difference", [[3, 0], [1, 0]]],
  ["goals scored", [[3, 2], [2, 1]]],
]) {
  test(`${criterion} takes priority over fair play`, () => {
    const teams = [team("a", "Alpha"), team("z", "Zulu"), team("c"), team("d")];
    const matches = [
      match("alpha", "a", "c", { homeScore: scores[0][0], awayScore: scores[0][1] }),
      match("zulu", "z", "d", { homeScore: scores[1][0], awayScore: scores[1][1] }),
    ];
    const events = Array.from({ length: 10 }, (_, i) => card(`card-${i}`, "alpha", "a"));
    const rows = calculateStandings(teams, matches, events);

    assert.equal(rows[0].team.id, "a");
    assert.equal(rows[0].fairPlayPoints, 10);
  });
}

test("only participating teams' cards in completed, scored league matches count", () => {
  const teams = [team("a", "Alpha"), team("z", "Zulu"), team("other")];
  const matches = [
    match("league", "a", "z"),
    ...["live", "scheduled", "postponed", "cancelled"].map((status) =>
      match(status, "a", "z", { status }),
    ),
    ...["quarter_final", "semi_final", "final", "third_place"].map((stage) =>
      match(stage, "a", "z", { stage }),
    ),
    match("missing-score", "a", "z", { homeScore: null }),
  ];
  const events = [
    card("counted-yellow", "league", "a"),
    card("counted-coach-red", "league", "a", "red_card", { recipientType: "coach", playerId: null }),
    ...matches.slice(1).map((fixture) => card(`ignored-${fixture.id}`, fixture.id, "a")),
    card("missing-match", "unknown", "a"),
    card("unrelated-team", "league", "other"),
    card("unknown-team", "league", "unknown"),
    card("goal", "league", "a", "goal"),
  ];
  const rows = calculateStandings(teams, matches, events);
  const alpha = rows.find((row) => row.team.id === "a");
  const unrelated = rows.find((row) => row.team.id === "other");

  assert.deepEqual([alpha.played, alpha.yellowCards, alpha.redCards, alpha.fairPlayPoints], [1, 1, 1, 2]);
  assert.equal(unrelated.fairPlayPoints, 0);
});

test("card edits recalculate rankings and equal fair play retains the name fallback", () => {
  const teams = [team("a", "Alpha"), team("z", "Zulu")];
  const matches = [match("league", "a", "z")];
  const alphaCard = card("alpha-card", "league", "a");
  const zuluCard = card("zulu-card", "league", "z");

  assert.equal(calculateStandings(teams, matches, [alphaCard])[0].team.id, "z");
  assert.equal(calculateStandings(teams, matches, [zuluCard])[0].team.id, "a");
  assert.equal(calculateStandings(teams, matches, [alphaCard, zuluCard])[0].team.id, "a");
  assert.equal(calculateStandings(teams, matches, [])[0].team.id, "a");
});

test("confirmed knockout seeds follow the fair-play standings", () => {
  const teams = [
    team("p", "Providus-Unity Bank FC"), team("w", "Wema Bank FC"),
    ...Array.from({ length: 6 }, (_, i) => team(`t-${i}`, `Team ${i}`)),
  ];
  const rotation = teams.map((entry) => entry.id);
  const matches = [];
  for (let round = 0; round < 4; round += 1) {
    for (let i = 0; i < rotation.length / 2; i += 1) {
      matches.push(match(`${round}-${i}`, rotation[i], rotation[rotation.length - 1 - i]));
    }
    rotation.splice(1, 0, rotation.pop());
  }
  const events = teams.filter((entry) => entry.id !== "w").map((entry) =>
    card(`card-${entry.id}`, matches.find((fixture) =>
      fixture.homeTeamId === entry.id || fixture.awayTeamId === entry.id,
    ).id, entry.id),
  );
  const seeds = getKnockoutSeedSlots(calculateStandings(teams, matches, events), matches);

  assert.equal(seeds[0].row.team.id, "w");
  assert.equal(seeds[1].row.team.id, "p");
  assert.ok(seeds.every((seed) => seed.status === "confirmed"));
});

function quarterFinalSetup() {
  const teams = Array.from({ length: 8 }, (_, i) => team(`t${i + 1}`, `Team ${i + 1}`));
  const slots = calculateStandings(teams, [], []).map((row) => ({
    seed: row.rank,
    row,
    status: "confirmed",
  }));
  const fixtures = [
    match("qf-1", "t1", "t8", { stage: "quarter_final", kickoff: "2026-11-01T12:00:00Z" }),
    match("qf-2", "t4", "t5", { stage: "quarter_final", kickoff: "2026-10-31T08:00:00Z" }),
    match("qf-3", "t2", "t7", { stage: "quarter_final", kickoff: "2026-11-01T13:30:00Z" }),
    match("qf-4", "t3", "t6", { stage: "quarter_final", kickoff: "2026-10-31T09:30:00Z" }),
  ];
  return { slots, fixtures };
}

test("quarter-final fixtures follow seed pairings when kickoff order differs", () => {
  const { slots, fixtures } = quarterFinalSetup();
  const chronological = [fixtures[1], fixtures[3], fixtures[0], fixtures[2]];
  const original = JSON.stringify(chronological);
  const ordered = getQuarterFinalMatchesBySeed(slots, chronological);

  assert.deepEqual(ordered.map((fixture) => fixture.id), ["qf-1", "qf-2", "qf-3", "qf-4"]);
  assert.equal(ordered[0].kickoff, "2026-11-01T12:00:00Z");
  assert.equal(ordered[1].kickoff, "2026-10-31T08:00:00Z");
  assert.equal(JSON.stringify(chronological), original);

  const rescheduled = chronological.map((fixture) => ({
    ...fixture,
    kickoff: fixture.id === "qf-1" ? "2026-10-30T09:00:00Z" : fixture.kickoff,
  }));
  assert.deepEqual(getQuarterFinalMatchesBySeed(slots, rescheduled).map((fixture) => fixture.id),
    ["qf-1", "qf-2", "qf-3", "qf-4"]);
});

test("missing or unlocked quarter-final pairings do not borrow another fixture's date", () => {
  const { slots, fixtures } = quarterFinalSetup();
  const leagueFixture = { ...fixtures[0], id: "league", stage: "group" };
  assert.deepEqual(getQuarterFinalMatchesBySeed(slots, [fixtures[2], leagueFixture]),
    [undefined, undefined, fixtures[2], undefined]);

  const pending = slots.map((slot) => slot.seed === 7 ? { ...slot, row: null, status: "pending" } : slot);
  assert.deepEqual(getQuarterFinalMatchesBySeed(pending, fixtures),
    [fixtures[0], fixtures[1], undefined, fixtures[3]]);
});

test("reversing the fixture's home and away teams preserves its bracket slot and score", () => {
  const { slots, fixtures } = quarterFinalSetup();
  const reversed = {
    ...fixtures[0],
    homeTeamId: fixtures[0].awayTeamId,
    awayTeamId: fixtures[0].homeTeamId,
    homeScore: 3,
    awayScore: 2,
  };
  const ordered = getQuarterFinalMatchesBySeed(slots, [reversed, ...fixtures.slice(1)]);

  assert.equal(ordered[0], reversed);
  assert.deepEqual([ordered[0].homeTeamId, ordered[0].awayTeamId, ordered[0].homeScore, ordered[0].awayScore],
    ["t8", "t1", 3, 2]);
});

test("kickoff dates and times consistently use WAT, including across midnight", () => {
  assert.equal(formatKickoff("2026-10-31T08:00:00+00:00"), "31 Oct 2026, 09:00 WAT");
  assert.equal(formatKickoff("2026-10-31T23:30:00Z"), "1 Nov 2026, 00:30 WAT");
});
