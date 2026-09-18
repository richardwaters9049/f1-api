import type {
  Circuit,
  Constructor,
  ConstructorStanding,
  ConstructorWinner,
  Driver,
  DriverStanding,
  Race,
  RaceResult,
  RaceResults,
  RaceSchedule,
  RaceScheduleSession,
  RaceWinner,
} from "../types/f1.ts";
import { F1_PROVIDER_BASE_URL, UPSTREAM_TIMEOUT_MS } from "../config.ts";

const CACHE_TTL = {
  drivers: 30 * 60 * 1000,
  constructors: 30 * 60 * 1000,
  races: 5 * 60 * 1000,
  race: 10 * 60 * 1000,
  standings: 60 * 1000,
  results: 10 * 60 * 1000,
} as const;

interface F1ApiResponse<T> {
  api: string;
  url: string;
  limit: number;
  offset: number;
  total: number;
  data: T;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

interface F1ApiDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string | null;
  number: number | string | null;
  shortName: string | null;
  url: string | null;
}

interface F1ApiDriversResponse {
  drivers: F1ApiDriver[];
}

interface F1ApiTeam {
  teamId: string;
  teamName: string;
  country: string;
  firstAppareance: number | string | null;
  constructorsChampionships: number | string | null;
  driversChampionships: number | string | null;
  url: string | null;
}

interface F1ApiTeamsResponse {
  teams: F1ApiTeam[];
}

interface F1ApiCircuit {
  circuitId: string;
  circuitName?: string;
  name?: string;
  country: string;
  city: string;
  length?: number | string | null;
  circuitLength?: number | string | null;
  lapRecord: string | null;
  firstParticipationYear: number | string | null;
  corners: number | string | null;
  fastestLapDriverId: string | null;
  fastestLapTeamId: string | null;
  fastestLapYear: number | string | null;
  url: string | null;
}

interface F1ApiRaceScheduleSession {
  date: string | null;
  time: string | null;
}

interface F1ApiRaceSchedule {
  race?: F1ApiRaceScheduleSession | null;
  qualy?: F1ApiRaceScheduleSession | null;
  fp1?: F1ApiRaceScheduleSession | null;
  fp2?: F1ApiRaceScheduleSession | null;
  fp3?: F1ApiRaceScheduleSession | null;
  sprintQualy?: F1ApiRaceScheduleSession | null;
  sprintRace?: F1ApiRaceScheduleSession | null;
}

interface F1ApiRaceWinner {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string | null;
  number: number | string | null;
  shortName: string | null;
  url: string | null;
}

interface F1ApiConstructorWinner {
  teamId: string;
  teamName: string;
  country: string;
  firstAppareance: number | string | null;
  constructorsChampionships: number | string | null;
  driversChampionships: number | string | null;
  url: string | null;
}

interface F1ApiFastestLap {
  time: string | null;
  driverId: string | null;
  constructorId: string | null;
}

interface F1ApiProviderFastestLap {
  fast_lap: string | null;
  fast_lap_driver_id: string | null;
  fast_lap_team_id: string | null;
}

interface F1ApiRace {
  raceId: string;
  championshipId: string;
  raceName: string;
  season?: number | string;
  round: number | string;
  url: string | null;
  schedule?: F1ApiRaceSchedule | null;
  laps: number | string | null;
  circuit: F1ApiCircuit;
  fastestLap?: F1ApiFastestLap | null;
  fast_lap?: F1ApiProviderFastestLap;
  winner: F1ApiRaceWinner | null;
  constructorWinner?: F1ApiConstructorWinner | null;
  teamWinner?: F1ApiConstructorWinner | null;
}

interface F1ApiRacesResponse {
  season: number | string;
  race?: F1ApiRace[];
  races?: F1ApiRace[];
}

interface F1ApiRaceResponse {
  season?: number | string;
  race?: F1ApiRace[];
  races?: F1ApiRace | F1ApiRace[];
}

interface F1ApiDriverStanding {
  classificationId: number | string;
  position: number | string | null;
  points: number | string;
  wins: number | string;
  driverId: string;
  teamId: string;
  driver: F1ApiDriver;
  team: F1ApiTeam;
}

interface F1ApiDriverStandingsResponse {
  season: number | string;
  championshipId: string;
  drivers_championship: F1ApiDriverStanding[];
}

interface F1ApiConstructorStanding {
  classificationId: number | string;
  position: number | string | null;
  points: number | string;
  wins: number | string;
  teamId: string;
  team: F1ApiTeam;
}

interface F1ApiConstructorStandingsResponse {
  season: number | string;
  championshipId: string;
  constructors_championship: F1ApiConstructorStanding[];
}

interface F1ApiRaceResultDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string | null;
  number: number | string | null;
  shortName: string | null;
  url: string | null;
}

interface F1ApiRaceResultTeam {
  teamId: string;
  teamName: string;
  country: string;
  firstAppareance: number | string | null;
  constructorsChampionships: number | string | null;
  driversChampionships: number | string | null;
  url: string | null;
}

interface F1ApiRaceResult {
  position: number | string | null;
  points: number | string;
  grid: number | string | null;
  time: string | null;
  fastLap: string | null;
  retired: string | null;
  driver: F1ApiRaceResultDriver;
  team: F1ApiRaceResultTeam;
}

interface F1ApiRaceResultsRace {
  raceId: string;
  raceName: string;
  round: number | string;
  date: string | null;
  time: string | null;
  url: string | null;
  circuit: F1ApiCircuit | F1ApiCircuit[];
  results: F1ApiRaceResult[];
}

interface F1ApiRaceResultsResponse {
  season: number | string;
  race?: F1ApiRaceResultsRace[];
  races?: F1ApiRaceResultsRace | F1ApiRaceResultsRace[];
}

export class F1ApiError extends Error {
  readonly status: number | null;
  readonly path: string;

  constructor(message: string, path: string, status: number | null = null) {
    super(message);
    this.name = "F1ApiError";
    this.status = status;
    this.path = path;
  }
}

function toNumber(value: number | string | null | undefined): number | null {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value.trim() === "")
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredNumber(value: number | string): number {
  if (typeof value === "string" && value.trim() === "") {
    throw new Error("Expected numeric value but received an empty string");
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected numeric value but received: ${value}`);
  }

  return parsed;
}

function toStringOrNull(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const normalised = String(value).trim();

  return normalised === "" ? null : normalised;
}

function pruneExpiredCache(now: number): void {
  for (const [key, entry] of cache.entries()) {
    if (entry.expiresAt <= now) {
      cache.delete(key);
    }
  }
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value as T;
}

function setCached<T>(key: string, value: T, ttl: number): void {
  const now = Date.now();

  pruneExpiredCache(now);

  cache.set(key, {
    value,
    expiresAt: now + ttl,
  });
}

export function clearCache(): void {
  cache.clear();
  inFlightRequests.clear();
}

async function f1ApiFetch<T>(path: string): Promise<T> {
  const url = `${F1_PROVIDER_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new F1ApiError(
        `F1 API request timed out after ${UPSTREAM_TIMEOUT_MS}ms`,
        path,
      );
    }

    const message =
      error instanceof Error ? error.message : "Unknown upstream error";

    throw new F1ApiError(`F1 API request failed: ${message}`, path);
  }

  if (!response.ok) {
    throw new F1ApiError(
      `F1 API returned HTTP ${response.status}`,
      path,
      response.status,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown JSON parsing error";

    throw new F1ApiError(
      `F1 API returned invalid JSON: ${message}`,
      path,
      response.status,
    );
  }

  if (typeof payload === "object" && payload !== null && "data" in payload) {
    return (payload as F1ApiResponse<T>).data;
  }

  return payload as T;
}

async function getCachedOrFetch<T>(
  key: string,
  path: string,
  ttl: number,
): Promise<T> {
  const cached = getCached<T>(key);

  if (cached !== null) {
    return cached;
  }

  const inFlight = inFlightRequests.get(key) as Promise<T> | undefined;

  if (inFlight) {
    return inFlight;
  }

  const request = f1ApiFetch<T>(path).then((value) => {
    setCached(key, value, ttl);
    return value;
  });

  inFlightRequests.set(key, request);

  try {
    return await request;
  } finally {
    if (inFlightRequests.get(key) === request) {
      inFlightRequests.delete(key);
    }
  }
}

function normaliseDriver(driver: F1ApiDriver): Driver {
  const number = toNumber(driver.number);

  return {
    driverId: driver.driverId,
    number: number === null ? null : String(number),
    code: driver.shortName,
    firstName: driver.name,
    lastName: driver.surname,
    fullName: `${driver.name} ${driver.surname}`,
    nationality: driver.nationality,
    dateOfBirth: driver.birthday,
    permanentNumber: number === null ? null : String(number),
    url: driver.url,
  };
}

function normaliseConstructor(team: F1ApiTeam): Constructor {
  return {
    constructorId: team.teamId,
    name: team.teamName,
    nationality: team.country,
    firstAppearance: toNumber(team.firstAppareance),
    constructorsChampionships: toNumber(team.constructorsChampionships),
    driversChampionships: toNumber(team.driversChampionships),
    url: team.url,
  };
}

function normaliseCircuit(circuit: F1ApiCircuit): Circuit {
  const circuitName = circuit.circuitName ?? circuit.name;

  if (!circuitName) {
    throw new Error(`F1 API circuit ${circuit.circuitId} has no circuit name`);
  }

  return {
    circuitId: circuit.circuitId,
    name: circuitName,
    country: circuit.country,
    city: circuit.city,
    length: toStringOrNull(circuit.length ?? circuit.circuitLength),
    lapRecord: circuit.lapRecord,
    firstParticipationYear: toNumber(circuit.firstParticipationYear),
    corners: toNumber(circuit.corners),
    fastestLapDriverId: circuit.fastestLapDriverId,
    fastestLapTeamId: circuit.fastestLapTeamId,
    fastestLapYear: toNumber(circuit.fastestLapYear),
    url: circuit.url,
  };
}

function normaliseResultCircuit(
  circuit: F1ApiCircuit | F1ApiCircuit[],
): Circuit {
  const resolvedCircuit = Array.isArray(circuit) ? circuit[0] : circuit;

  if (!resolvedCircuit) {
    throw new Error("F1 API race results contained no circuit data");
  }

  return normaliseCircuit(resolvedCircuit);
}

function normaliseScheduleSession(
  session: F1ApiRaceScheduleSession | null | undefined,
): RaceScheduleSession {
  return {
    date: session?.date ?? null,
    time: session?.time ?? null,
  };
}

function normaliseRaceSchedule(
  schedule: F1ApiRaceSchedule | null | undefined,
): RaceSchedule {
  return {
    race: normaliseScheduleSession(schedule?.race),
    qualy: normaliseScheduleSession(schedule?.qualy),
    fp1: normaliseScheduleSession(schedule?.fp1),
    fp2: normaliseScheduleSession(schedule?.fp2),
    fp3: normaliseScheduleSession(schedule?.fp3),
    sprintQualy: normaliseScheduleSession(schedule?.sprintQualy),
    sprintRace: normaliseScheduleSession(schedule?.sprintRace),
  };
}

function normaliseRaceWinner(
  winner: F1ApiRaceWinner | null,
): RaceWinner | null {
  if (!winner) {
    return null;
  }

  return {
    driverId: winner.driverId,
    firstName: winner.name,
    lastName: winner.surname,
    fullName: `${winner.name} ${winner.surname}`,
    nationality: winner.nationality,
    number: toNumber(winner.number),
    code: winner.shortName,
    dateOfBirth: winner.birthday,
    url: winner.url,
  };
}

function normaliseConstructorWinner(
  winner: F1ApiConstructorWinner | null,
): ConstructorWinner | null {
  if (!winner) {
    return null;
  }

  return {
    constructorId: winner.teamId,
    name: winner.teamName,
    nationality: winner.country,
    firstAppearance: toNumber(winner.firstAppareance),
    constructorsChampionships: toNumber(winner.constructorsChampionships),
    driversChampionships: toNumber(winner.driversChampionships),
    url: winner.url,
  };
}

function normaliseFastestLap(race: F1ApiRace): Race["fastestLap"] {
  if (race.fastestLap !== undefined) {
    return race.fastestLap;
  }

  if (!race.fast_lap) {
    return null;
  }

  return {
    time: race.fast_lap.fast_lap,
    driverId: race.fast_lap.fast_lap_driver_id,
    constructorId: race.fast_lap.fast_lap_team_id,
  };
}

function normaliseRace(race: F1ApiRace, season: number): Race {
  return {
    raceId: race.raceId,
    championshipId: race.championshipId,
    raceName: race.raceName,
    season,
    round: toRequiredNumber(race.round),
    url: race.url,
    schedule: normaliseRaceSchedule(race.schedule),
    laps: toNumber(race.laps),
    circuit: normaliseCircuit(race.circuit),
    fastestLap: normaliseFastestLap(race),
    winner: normaliseRaceWinner(race.winner),
    constructorWinner: normaliseConstructorWinner(
      race.constructorWinner ?? race.teamWinner ?? null,
    ),
  };
}

/**
 * Corrects malformed upstream race identity.
 *
 * Example:
 *
 * Formula 1 Gulf Air Bahrain Grand Prix in Malaysia 2026
 *
 * The circuit country is authoritative. The malformed
 * location/name supplied by the upstream provider is ignored.
 */
function normaliseRaceIdentity(race: Race): Race {
  const match = race.raceName.match(
    /^(.*\s)([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]+)\s+Grand Prix in\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]+?)(\s+\d{4})$/i,
  );

  if (
    !match ||
    match[1] === undefined ||
    match[2] === undefined ||
    match[3] === undefined ||
    match[4] === undefined
  ) {
    return race;
  }

  const prefix = match[1].trim();
  const namedLocation = match[2].trim();
  const statedCountry = match[3].trim();
  const year = match[4].trim();

  const circuitCountry = race.circuit.country.trim();

  const statedCountryMatchesCircuit =
    statedCountry.toLowerCase() === circuitCountry.toLowerCase();

  const namedLocationMatchesCircuit =
    namedLocation.toLowerCase() === circuitCountry.toLowerCase();

  if (!statedCountryMatchesCircuit || namedLocationMatchesCircuit) {
    return race;
  }

  const normalisedCountry = circuitCountry
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const normalisedRaceId = `${normalisedCountry}_${race.season}`;
  const normalisedRaceName = `${prefix} ${circuitCountry} Grand Prix ${year}`;

  return {
    ...race,
    raceId: normalisedRaceId,
    raceName: normalisedRaceName,
  };
}

function normaliseDriverStanding(
  standing: F1ApiDriverStanding,
): DriverStanding {
  return {
    classificationId: toRequiredNumber(standing.classificationId),
    position: toNumber(standing.position),
    points: toRequiredNumber(standing.points),
    wins: toRequiredNumber(standing.wins),
    driverId: standing.driverId,
    teamId: standing.teamId,
    driver: {
      driverId: standing.driver.driverId,
      firstName: standing.driver.name,
      lastName: standing.driver.surname,
      fullName: `${standing.driver.name} ${standing.driver.surname}`,
      nationality: standing.driver.nationality,
      number: toNumber(standing.driver.number),
      code: standing.driver.shortName,
      dateOfBirth: standing.driver.birthday,
      url: standing.driver.url,
    },
    team: {
      teamId: standing.team.teamId,
      name: standing.team.teamName,
      nationality: standing.team.country,
      firstAppearance: toNumber(standing.team.firstAppareance),
      constructorsChampionships: toNumber(
        standing.team.constructorsChampionships,
      ),
      driversChampionships: toNumber(standing.team.driversChampionships),
      url: standing.team.url,
    },
  };
}

function normaliseConstructorStanding(
  standing: F1ApiConstructorStanding,
): ConstructorStanding {
  return {
    classificationId: toRequiredNumber(standing.classificationId),
    position: toNumber(standing.position),
    points: toRequiredNumber(standing.points),
    wins: toRequiredNumber(standing.wins),
    teamId: standing.teamId,
    team: {
      name: standing.team.teamName,
      nationality: standing.team.country,
      firstAppearance: toNumber(standing.team.firstAppareance),
      constructorsChampionships: toNumber(
        standing.team.constructorsChampionships,
      ),
      driversChampionships: toNumber(standing.team.driversChampionships),
      url: standing.team.url,
    },
  };
}

function normaliseRaceResult(result: F1ApiRaceResult): RaceResult {
  return {
    position: toNumber(result.position),
    points: toRequiredNumber(result.points),
    grid: toNumber(result.grid),
    time: result.time,
    fastestLap: result.fastLap,
    retired: result.retired,
    driver: {
      driverId: result.driver.driverId,
      firstName: result.driver.name,
      lastName: result.driver.surname,
      fullName: `${result.driver.name} ${result.driver.surname}`,
      nationality: result.driver.nationality,
      number: toNumber(result.driver.number),
      code: result.driver.shortName,
      dateOfBirth: result.driver.birthday,
      url: result.driver.url,
    },
    constructor: {
      constructorId: result.team.teamId,
      name: result.team.teamName,
      nationality: result.team.country,
      firstAppearance: toNumber(result.team.firstAppareance),
      constructorsChampionships: toNumber(
        result.team.constructorsChampionships,
      ),
      driversChampionships: toNumber(result.team.driversChampionships),
      url: result.team.url,
    },
  };
}

function getCalendarRaces(data: F1ApiRacesResponse): F1ApiRace[] {
  if (Array.isArray(data.race)) {
    return data.race;
  }

  if (Array.isArray(data.races)) {
    return data.races;
  }

  return [];
}

function getDetailRace(data: F1ApiRaceResponse): F1ApiRace {
  if (Array.isArray(data.race) && data.race.length > 0) {
    const race = data.race[0];

    if (race) {
      return race;
    }
  }

  if (Array.isArray(data.races) && data.races.length > 0) {
    const race = data.races[0];

    if (race) {
      return race;
    }
  }

  if (data.races && !Array.isArray(data.races)) {
    return data.races;
  }

  throw new F1ApiError("F1 API returned no race data", "normalisation", 404);
}

function getRaceResultsRace(
  data: F1ApiRaceResultsResponse,
): F1ApiRaceResultsRace {
  if (Array.isArray(data.race) && data.race.length > 0) {
    const race = data.race[0];

    if (race) {
      return race;
    }
  }

  if (Array.isArray(data.races) && data.races.length > 0) {
    const race = data.races[0];

    if (race) {
      return race;
    }
  }

  if (data.races && !Array.isArray(data.races)) {
    return data.races;
  }

  throw new F1ApiError("F1 API returned no race results", "normalisation", 404);
}

function mergeRaceWithCalendarIdentity(
  detailRace: Race,
  calendarRace: Race,
): Race {
  return {
    ...detailRace,
    raceId: calendarRace.raceId,
    championshipId: calendarRace.championshipId,
    raceName: calendarRace.raceName,
    season: calendarRace.season,
    round: calendarRace.round,
    url: calendarRace.url,
  };
}

export async function getCurrentSeason(): Promise<number> {
  const data = await getCachedOrFetch<F1ApiRacesResponse>(
    "races:current",
    "/current?limit=100",
    CACHE_TTL.races,
  );

  return toRequiredNumber(data.season);
}

export async function getCurrentSeasonDrivers(): Promise<Driver[]> {
  const data = await getCachedOrFetch<F1ApiDriversResponse>(
    "drivers:current",
    "/current/drivers?limit=100",
    CACHE_TTL.drivers,
  );

  return data.drivers.map(normaliseDriver);
}

export async function getCurrentSeasonConstructors(): Promise<Constructor[]> {
  const season = await getCurrentSeason();

  const data = await getCachedOrFetch<F1ApiTeamsResponse>(
    `constructors:${season}`,
    `/${season}/teams?limit=100`,
    CACHE_TTL.constructors,
  );

  return data.teams.map(normaliseConstructor);
}

export async function getCurrentSeasonRaces(): Promise<Race[]> {
  const data = await getCachedOrFetch<F1ApiRacesResponse>(
    "races:current",
    "/current?limit=100",
    CACHE_TTL.races,
  );

  const season = toRequiredNumber(data.season);

  return getCalendarRaces(data).map((race) =>
    normaliseRaceIdentity(normaliseRace(race, season)),
  );
}

export async function getRaceByRound(
  season: number,
  round: number,
): Promise<Race> {
  const path = `/${season}/${round}`;

  const data = await getCachedOrFetch<F1ApiRaceResponse>(
    `race:${season}:${round}`,
    path,
    CACHE_TTL.race,
  );

  let detailRace: Race;

  try {
    const resolvedSeason =
      data.season === undefined ? season : toRequiredNumber(data.season);

    detailRace = normaliseRaceIdentity(
      normaliseRace(getDetailRace(data), resolvedSeason),
    );
  } catch (error) {
    if (error instanceof F1ApiError) {
      throw error;
    }

    const message =
      error instanceof Error
        ? error.message
        : "Unknown race normalisation error";

    throw new F1ApiError(`F1 API returned invalid race data: ${message}`, path);
  }

  const calendarData = getCached<F1ApiRacesResponse>("races:current");

  if (!calendarData || toRequiredNumber(calendarData.season) !== season) {
    return detailRace;
  }

  const calendarRaces = getCalendarRaces(calendarData).map((race) =>
    normaliseRaceIdentity(normaliseRace(race, season)),
  );

  const calendarRace = calendarRaces.find((race) => race.round === round);

  return calendarRace
    ? mergeRaceWithCalendarIdentity(detailRace, calendarRace)
    : detailRace;
}

export async function getCurrentDriverStandings(): Promise<{
  season: number;
  championshipId: string;
  standings: DriverStanding[];
}> {
  const data = await getCachedOrFetch<F1ApiDriverStandingsResponse>(
    "standings:drivers",
    "/current/drivers-championship?limit=100",
    CACHE_TTL.standings,
  );

  return {
    season: toRequiredNumber(data.season),
    championshipId: data.championshipId,
    standings: data.drivers_championship.map(normaliseDriverStanding),
  };
}

export async function getCurrentConstructorStandings(): Promise<{
  season: number;
  championshipId: string;
  standings: ConstructorStanding[];
}> {
  const data = await getCachedOrFetch<F1ApiConstructorStandingsResponse>(
    "standings:constructors",
    "/current/constructors-championship?limit=100",
    CACHE_TTL.standings,
  );

  return {
    season: toRequiredNumber(data.season),
    championshipId: data.championshipId,
    standings: data.constructors_championship.map(normaliseConstructorStanding),
  };
}

export async function getCurrentRaceResults(): Promise<RaceResults> {
  const races = await getCurrentSeasonRaces();

  const now = Date.now();

  const completedRaces = races
    .filter((race) => {
      const raceDate = race.schedule.race.date;

      if (!raceDate) {
        return false;
      }

      return new Date(`${raceDate}T23:59:59Z`).getTime() < now;
    })
    .sort((a, b) => b.round - a.round);

  if (completedRaces.length === 0) {
    throw new F1ApiError(
      "No completed race results are available",
      "/current/results",
      404,
    );
  }

  let lastError: F1ApiError | null = null;

  for (const race of completedRaces) {
    try {
      return await getRaceResults(race.season, race.round);
    } catch (error) {
      if (error instanceof F1ApiError && error.status === 404) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  if (lastError !== null) {
    throw lastError;
  }

  throw new F1ApiError(
    "No completed race results are available",
    "/current/results",
    404,
  );
}

export async function getRaceResults(
  season: number,
  round: number,
): Promise<RaceResults> {
  const path = `/${season}/${round}/race`;

  const data = await getCachedOrFetch<F1ApiRaceResultsResponse>(
    `results:${season}:${round}`,
    path,
    CACHE_TTL.results,
  );

  const race = getRaceResultsRace(data);

  return {
    raceId: race.raceId,
    raceName: race.raceName,
    season: toRequiredNumber(data.season),
    round: toRequiredNumber(race.round),
    date: race.date,
    time: race.time,
    url: race.url,
    circuit: normaliseResultCircuit(race.circuit),
    results: race.results.map(normaliseRaceResult),
  };
}
