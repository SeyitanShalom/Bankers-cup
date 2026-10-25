import assert from "node:assert/strict";
import test from "node:test";
import { calculateStandings, getKnockoutSeedSlots } from "../src/lib/tournament.ts";

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
