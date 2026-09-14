import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import type { Race } from "../types/f1.ts";
import { clearCache } from "./f1Api.ts";

function makeRace(
  input: { season: number; round: number } & Partial<Race>,
): Race {
  const { season, round, ...overrides } = input;

  return {
    raceId: `race-${season}-${round}`,
    championshipId: "f1",
    raceName: `Round ${round}`,
    season,
    round,
    url: null,
    schedule: {
      race: { date: "2026-01-01", time: "12:00:00Z" },
      qualy: { date: null, time: null },
      fp1: { date: null, time: null },
      fp2: { date: null, time: null },
      fp3: { date: null, time: null },
      sprintQualy: { date: null, time: null },
      sprintRace: { date: null, time: null },
    },
    laps: null,
    circuit: {
      circuitId: "c",
      name: "Circuit",
      country: "Country",
      city: "City",
      length: null,
      lapRecord: null,
      firstParticipationYear: null,
      corners: null,
      fastestLapDriverId: null,
      fastestLapTeamId: null,
      fastestLapYear: null,
      url: null,
    },
    fastestLap: null,
    winner: null,
    constructorWinner: null,
    ...overrides,
  };
}

beforeEach((): void => {
  clearCache();
});

describe("normalisation", () => {
  test("accepts numeric strings from the provider", async (): Promise<void> => {
    const { getRaceByRound } = await import("./f1Api.ts");

    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: "2026",
            races: {
              raceId: "r1",
              championshipId: "f1",
              raceName: "Test",
              round: "1",
              url: null,
              schedule: {
                race: { date: null, time: null },
                qualy: { date: null, time: null },
                fp1: { date: null, time: null },
                fp2: { date: null, time: null },
                fp3: { date: null, time: null },
                sprintQualy: { date: null, time: null },
                sprintRace: { date: null, time: null },
              },
              laps: "57",
              circuit: {
                circuitId: "c",
                circuitName: "Circuit",
                country: "Country",
                city: "City",
                length: "5.412",
                lapRecord: null,
                firstParticipationYear: "1950",
                corners: "16",
                fastestLapDriverId: null,
                fastestLapTeamId: null,
                fastestLapYear: "2024",
                url: null,
              },
              fastestLap: null,
              winner: null,
              constructorWinner: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    try {
      const race = await getRaceByRound(2026, 1);

      expect(race.season).toBe(2026);
      expect(race.round).toBe(1);
      expect(race.laps).toBe(57);
      expect(race.circuit.length).toBe("5.412");
      expect(race.circuit.corners).toBe(16);
      expect(race.circuit.firstParticipationYear).toBe(1950);
      expect(race.circuit.fastestLapYear).toBe(2024);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("preserves null for missing numeric values", async (): Promise<void> => {
    const { getRaceByRound } = await import("./f1Api.ts");

    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: "2026",
            races: {
              raceId: "r1",
              championshipId: "f1",
              raceName: "Test",
              round: "1",
              url: null,
              schedule: {
                race: { date: null, time: null },
                qualy: { date: null, time: null },
                fp1: { date: null, time: null },
                fp2: { date: null, time: null },
                fp3: { date: null, time: null },
                sprintQualy: { date: null, time: null },
                sprintRace: { date: null, time: null },
              },
              laps: null,
              circuit: {
                circuitId: "c",
                circuitName: "Circuit",
                country: "Country",
                city: "City",
                length: null,
                lapRecord: null,
                firstParticipationYear: null,
                corners: null,
                fastestLapDriverId: null,
                fastestLapTeamId: null,
                fastestLapYear: null,
                url: null,
              },
              fastestLap: null,
              winner: null,
              constructorWinner: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    try {
      const race = await getRaceByRound(2026, 1);

      expect(race.laps).toBeNull();
      expect(race.circuit.corners).toBeNull();
      expect(race.circuit.firstParticipationYear).toBeNull();
      expect(race.circuit.fastestLapYear).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("rejects non-numeric values rather than fabricating a number", async (): Promise<void> => {
    const { getRaceByRound, F1ApiError } = await import("./f1Api.ts");

    const originalFetch = globalThis.fetch;

    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: "2026",
            races: {
              raceId: "r1",
              championshipId: "f1",
              raceName: "Test",
              round: "not-a-number",
              url: null,
              schedule: {
                race: { date: null, time: null },
                qualy: { date: null, time: null },
                fp1: { date: null, time: null },
                fp2: { date: null, time: null },
                fp3: { date: null, time: null },
                sprintQualy: { date: null, time: null },
                sprintRace: { date: null, time: null },
              },
              laps: null,
              circuit: {
                circuitId: "c",
                circuitName: "Circuit",
                country: "Country",
                city: "City",
                length: null,
                lapRecord: null,
                firstParticipationYear: null,
                corners: null,
                fastestLapDriverId: null,
                fastestLapTeamId: null,
                fastestLapYear: null,
                url: null,
              },
              fastestLap: null,
              winner: null,
              constructorWinner: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    try {
      await expect(getRaceByRound(2026, 1)).rejects.toBeInstanceOf(F1ApiError);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("getCurrentRaceResults", () => {
  const originalFetch = globalThis.fetch;

  afterEach((): void => {
    globalThis.fetch = originalFetch;
    mock.restore();
  });

  test("falls back to an earlier completed race when the newest has no results", async (): Promise<void> => {
    const { getCurrentRaceResults } = await import("./f1Api.ts");

    const calls: string[] = [];

    globalThis.fetch = mock(
      async (input: string | URL | Request): Promise<Response> => {
        const url = typeof input === "string" ? input : input.toString();
        calls.push(url);

        if (url.endsWith("/current?limit=100")) {
          const races = [
            makeRace({ season: 2026, round: 1 }),
            makeRace({ season: 2026, round: 2 }),
            makeRace({ season: 2026, round: 3 }),
          ];

          return new Response(
            JSON.stringify({
              season: 2026,
              races: races.map((race) => ({
                raceId: race.raceId,
                championshipId: race.championshipId,
                raceName: race.raceName,
                round: String(race.round),
                url: null,
                schedule: race.schedule,
                laps: null,
                circuit: {
                  circuitId: race.circuit.circuitId,
                  circuitName: race.circuit.name,
                  country: race.circuit.country,
                  city: race.circuit.city,
                  length: null,
                  lapRecord: null,
                  firstParticipationYear: null,
                  corners: null,
                  fastestLapDriverId: null,
                  fastestLapTeamId: null,
                  fastestLapYear: null,
                  url: null,
                },
                fastestLap: null,
                winner: null,
                constructorWinner: null,
              })),
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        if (url.endsWith("/2026/3/race")) {
          return new Response("not found", { status: 404 });
        }

        if (url.endsWith("/2026/2/race")) {
          return new Response(
            JSON.stringify({
              season: "2026",
              races: {
                raceId: "race-2026-2",
                raceName: "Round 2",
                round: "2",
                date: "2026-01-01",
                time: "12:00:00Z",
                url: null,
                circuit: {
                  circuitId: "c",
                  circuitName: "Circuit",
                  country: "Country",
                  city: "City",
                  length: null,
                  lapRecord: null,
                  firstParticipationYear: null,
                  corners: null,
                  fastestLapDriverId: null,
                  fastestLapTeamId: null,
                  fastestLapYear: null,
                  url: null,
                },
                results: [],
              },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }

        return new Response("unexpected", { status: 500 });
      },
    ) as unknown as typeof fetch;

    const results = await getCurrentRaceResults();

    expect(results.round).toBe(2);
    expect(calls.some((call) => call.endsWith("/2026/3/race"))).toBe(true);
    expect(calls.some((call) => call.endsWith("/2026/2/race"))).toBe(true);
  });

  test("throws when no completed races exist for the current season", async (): Promise<void> => {
    const { getCurrentRaceResults, F1ApiError } = await import("./f1Api.ts");

    globalThis.fetch = mock(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            season: 2026,
            races: [],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    ) as unknown as typeof fetch;

    await expect(getCurrentRaceResults()).rejects.toBeInstanceOf(F1ApiError);
  });
});
