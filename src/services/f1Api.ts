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

const F1_API_BASE_URL = "https://f1api.dev/api";

const REQUEST_TIMEOUT_MS = 10_000;

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
  circuitName: string;
  country: string;
  city: string;
  length: number | string | null;
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
  race: F1ApiRaceScheduleSession;
  qualy: F1ApiRaceScheduleSession;
  fp1: F1ApiRaceScheduleSession;
  fp2: F1ApiRaceScheduleSession;
  fp3: F1ApiRaceScheduleSession;
  sprintQualy: F1ApiRaceScheduleSession;
  sprintRace: F1ApiRaceScheduleSession;
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

interface F1ApiRace {
  raceId: string;
  championshipId: string;
  raceName: string;
  season?: number | string;
  round: number | string;
  url: string | null;
  schedule: F1ApiRaceSchedule;
  laps: number | string | null;
  circuit: F1ApiCircuit;
  fastestLap: {
    time: string | null;
    driverId: string | null;
    constructorId: string | null;
  } | null;
  winner: F1ApiRaceWinner | null;
  constructorWinner: F1ApiConstructorWinner | null;
}

interface F1ApiRacesResponse {
  season: number | string;
  races: F1ApiRace[];
}

/**
 * The provider's `/season/round` endpoint returns a single race object
 * under the key `races` (plural). The key name is misleading but is the
 * provider's actual contract. Do not rename this field without verifying
 * against a live provider response.
 */
interface F1ApiRaceResponse {
  season?: number | string;
  races: F1ApiRace;
}

interface F1ApiDriverStanding {
  classificationId: number | string;
  driverId: string;
  teamId: string;
  points: number | string;
  position: number | string | null;
  wins: number | string;
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
  teamId: string;
  points: number | string;
  position: number | string | null;
  wins: number | string;
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
  circuit: F1ApiCircuit;
  results: F1ApiRaceResult[];
}

interface F1ApiRaceResultsResponse {
  season: number | string;
  races: F1ApiRaceResultsRace;
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
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function toRequiredNumber(value: number | string): number {
  const parsed = toNumber(value);

  if (parsed === null) {
    throw new F1ApiError(
      `F1 API returned an invalid numeric value: ${String(value)}`,
      "normalisation",
    );
  }

  return parsed;
}

function toStringOrNull(
  value: string | number | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function pruneExpiredCache(now: number): void {
  for (const [key, entry] of cache) {
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

  cache.set(key, {
    value,
    expiresAt: now + ttl,
  });

  pruneExpiredCache(now);
}

/**
 * Clear the in-memory cache.
 *
 * Exposed for tests, which need a clean cache between cases. In normal
 * operation the cache expires on its own TTL schedule and this is never
 * called.
 */
export function clearCache(): void {
  cache.clear();
}

async function f1ApiFetch<T>(path: string): Promise<T> {
  const url = `${F1_API_BASE_URL}${path}`;

  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "TimeoutError") {
      throw new F1ApiError(
        `F1 API request timed out after ${REQUEST_TIMEOUT_MS}ms: ${path}`,
        path,
      );
    }

    if (error instanceof Error) {
      throw new F1ApiError(`F1 API request failed: ${error.message}`, path);
    }

    throw new F1ApiError(`F1 API request failed: ${path}`, path);
  }

  if (!response.ok) {
    throw new F1ApiError(
      `F1 API request failed with status ${response.status}: ${path}`,
      path,
      response.status,
    );
  }

  let payload: T | F1ApiResponse<T>;

  try {
    payload = (await response.json()) as T | F1ApiResponse<T>;
  } catch {
    throw new F1ApiError(
      `F1 API returned invalid JSON: ${path}`,
      path,
      response.status,
    );
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
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

  const value = await f1ApiFetch<T>(path);

  setCached(key, value, ttl);

  return value;
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
    url: team.url,
  };
}

function normaliseCircuit(circuit: F1ApiCircuit): Circuit {
  return {
    circuitId: circuit.circuitId,
    name: circuit.circuitName,
    country: circuit.country,
    city: circuit.city,
    length: toStringOrNull(circuit.length),
    lapRecord: circuit.lapRecord,
    firstParticipationYear: toNumber(circuit.firstParticipationYear),
    corners: toNumber(circuit.corners),
    fastestLapDriverId: circuit.fastestLapDriverId,
    fastestLapTeamId: circuit.fastestLapTeamId,
    fastestLapYear: toNumber(circuit.fastestLapYear),
    url: circuit.url,
  };
}

function normaliseScheduleSession(
  session: F1ApiRaceScheduleSession,
): RaceScheduleSession {
  return {
    date: session.date,
    time: session.time,
  };
}

function normaliseRaceSchedule(schedule: F1ApiRaceSchedule): RaceSchedule {
  return {
    race: normaliseScheduleSession(schedule.race),
    qualy: normaliseScheduleSession(schedule.qualy),
    fp1: normaliseScheduleSession(schedule.fp1),
    fp2: normaliseScheduleSession(schedule.fp2),
    fp3: normaliseScheduleSession(schedule.fp3),
    sprintQualy: normaliseScheduleSession(schedule.sprintQualy),
    sprintRace: normaliseScheduleSession(schedule.sprintRace),
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
    fastestLap: race.fastestLap,
    winner: normaliseRaceWinner(race.winner),
    constructorWinner: normaliseConstructorWinner(race.constructorWinner),
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

function normaliseRaceResults(data: F1ApiRaceResultsResponse): RaceResults {
  return {
    raceId: data.races.raceId,
    raceName: data.races.raceName,
    season: toRequiredNumber(data.season),
    round: toRequiredNumber(data.races.round),
    date: data.races.date,
    time: data.races.time,
    url: data.races.url,
    circuit: normaliseCircuit(data.races.circuit),
    results: data.races.results.map(normaliseRaceResult),
  };
}

/**
 * Resolve the current Formula 1 season from the provider.
 *
 * The provider's `/current` endpoint returns the season it considers
 * current. We cache the resolved season using the same TTL as the race
 * calendar, so this is effectively free after the first call.
 *
 * Routes must use this rather than `new Date().getFullYear()`, because
 * the provider's notion of "current season" can lag the calendar year
 * around the off-season.
 */
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
  const data = await getCachedOrFetch<F1ApiTeamsResponse>(
    "constructors:current",
    "/current/teams?limit=100",
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

  return data.races.map((race) => normaliseRace(race, season));
}

export async function getRaceByRound(
  season: number,
  round: number,
): Promise<Race> {
  const data = await getCachedOrFetch<F1ApiRaceResponse>(
    `race:${season}:${round}`,
    `/${season}/${round}`,
    CACHE_TTL.race,
  );

  const resolvedSeason =
    data.season === undefined ? season : toRequiredNumber(data.season);

  return normaliseRace(data.races, resolvedSeason);
}

export async function getCurrentDriverStandings(): Promise<{
  season: number;
  championshipId: string;
  standings: DriverStanding[];
}> {
  const data = await getCachedOrFetch<F1ApiDriverStandingsResponse>(
    "standings:drivers:current",
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
    "standings:constructors:current",
    "/current/constructors-championship?limit=100",
    CACHE_TTL.standings,
  );

  return {
    season: toRequiredNumber(data.season),
    championshipId: data.championshipId,
    standings: data.constructors_championship.map(normaliseConstructorStanding),
  };
}

/**
 * Return results for the most recent completed race for which the provider
 * actually has results.
 *
 * The provider can publish a race in the calendar before results are
 * available. Walking backwards through completed races and trying each one
 * lets us return the newest real data without fabricating anything.
 *
 * Any F1ApiError (404, 502, timeout) on a given race means "try the next
 * completed race". Only non-F1ApiError failures abort the search, because
 * those indicate a programming error rather than a provider state.
 */
export async function getCurrentRaceResults(): Promise<RaceResults> {
  const races = await getCurrentSeasonRaces();

  const now = Date.now();

  const completedRaces = races
    .filter((race) => {
      const raceDate = race.schedule.race.date;

      if (!raceDate) {
        return false;
      }

      const time = new Date(raceDate).getTime();

      return Number.isFinite(time) && time <= now;
    })
    .sort((a, b) => b.round - a.round);

  if (completedRaces.length === 0) {
    throw new F1ApiError(
      "No completed races are available for the current season",
      "/current",
    );
  }

  let lastError: F1ApiError | null = null;

  for (const race of completedRaces) {
    try {
      return await getRaceResults(race.season, race.round);
    } catch (error) {
      if (error instanceof F1ApiError) {
        lastError = error;
        continue;
      }

      throw error;
    }
  }

  throw (
    lastError ??
    new F1ApiError(
      "No race results are available for the completed races in the current season",
      "/current",
    )
  );
}

export async function getRaceResults(
  season: number,
  round: number,
): Promise<RaceResults> {
  const data = await getCachedOrFetch<F1ApiRaceResultsResponse>(
    `results:${season}:${round}`,
    `/${season}/${round}/race`,
    CACHE_TTL.results,
  );

  return normaliseRaceResults(data);
}
