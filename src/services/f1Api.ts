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

interface F1ApiResponse<T> {
  api: string;
  url: string;
  limit: number;
  offset: number;
  total: number;
  data: T;
}

interface F1ApiDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string | null;
  number: number | null;
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
  firstAppareance: number | null;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
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
  length: string | null;
  lapRecord: string | null;
  firstParticipationYear: number | null;
  corners: number | null;
  fastestLapDriverId: string | null;
  fastestLapTeamId: string | null;
  fastestLapYear: number | null;
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
  number: number | null;
  shortName: string | null;
  url: string | null;
}

interface F1ApiConstructorWinner {
  teamId: string;
  teamName: string;
  country: string;
  firstAppareance: number | null;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
  url: string | null;
}

interface F1ApiRace {
  raceId: string;
  championshipId: string;
  raceName: string;
  season?: number;
  round: number;
  url: string | null;
  schedule: F1ApiRaceSchedule;
  laps: number | null;
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
  season: number;
  races: F1ApiRace[];
}

interface F1ApiRaceResponse {
  season?: number;
  races: F1ApiRace;
}

interface F1ApiDriverStanding {
  classificationId: number;
  driverId: string;
  teamId: string;
  points: number;
  position: number | null;
  wins: number;
  driver: F1ApiDriver;
  team: F1ApiTeam;
}

interface F1ApiDriverStandingsResponse {
  season: number;
  championshipId: string;
  drivers_championship: F1ApiDriverStanding[];
}

interface F1ApiConstructorStanding {
  classificationId: number;
  teamId: string;
  points: number;
  position: number | null;
  wins: number;
  team: F1ApiTeam;
}

interface F1ApiConstructorStandingsResponse {
  season: number;
  championshipId: string;
  constructors_championship: F1ApiConstructorStanding[];
}

interface F1ApiRaceResultDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday: string | null;
  number: number | null;
  shortName: string | null;
  url: string | null;
}

interface F1ApiRaceResultTeam {
  teamId: string;
  teamName: string;
  country: string;
  firstAppareance: number | null;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
  url: string | null;
}

interface F1ApiRaceResult {
  position: number | null;
  points: number;
  grid: number | null;
  time: string | null;
  fastLap: string | null;
  retired: string | null;
  driver: F1ApiRaceResultDriver;
  team: F1ApiRaceResultTeam;
}

interface F1ApiRaceResultsRace {
  raceId: string;
  raceName: string;
  round: number;
  date: string | null;
  time: string | null;
  url: string | null;
  circuit: F1ApiCircuit;
  results: F1ApiRaceResult[];
}

interface F1ApiRaceResultsResponse {
  season: number;
  races: F1ApiRaceResultsRace;
}

async function f1ApiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${F1_API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(
      `F1 API request failed with status ${response.status}: ${path}`,
    );
  }

  const payload = (await response.json()) as T | F1ApiResponse<T>;

  if (payload && typeof payload === "object" && "data" in payload) {
    return payload.data;
  }

  return payload as T;
}

function normaliseDriver(driver: F1ApiDriver): Driver {
  return {
    driverId: driver.driverId,
    number: driver.number === null ? null : String(driver.number),
    code: driver.shortName,
    firstName: driver.name,
    lastName: driver.surname,
    fullName: `${driver.name} ${driver.surname}`,
    nationality: driver.nationality,
    dateOfBirth: driver.birthday,
    permanentNumber: driver.number === null ? null : String(driver.number),
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
    length: circuit.length,
    lapRecord: circuit.lapRecord,
    firstParticipationYear: circuit.firstParticipationYear,
    corners: circuit.corners,
    fastestLapDriverId: circuit.fastestLapDriverId,
    fastestLapTeamId: circuit.fastestLapTeamId,
    fastestLapYear: circuit.fastestLapYear,
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
    number: winner.number,
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
    firstAppearance: winner.firstAppareance,
    constructorsChampionships: winner.constructorsChampionships,
    driversChampionships: winner.driversChampionships,
    url: winner.url,
  };
}

function normaliseRace(race: F1ApiRace, season: number): Race {
  return {
    raceId: race.raceId,
    championshipId: race.championshipId,
    raceName: race.raceName,
    season,
    round: race.round,
    url: race.url,
    schedule: normaliseRaceSchedule(race.schedule),
    laps: race.laps,
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
    classificationId: standing.classificationId,
    position: standing.position,
    points: standing.points,
    wins: standing.wins,
    driverId: standing.driverId,
    teamId: standing.teamId,
    driver: {
      firstName: standing.driver.name,
      lastName: standing.driver.surname,
      fullName: `${standing.driver.name} ${standing.driver.surname}`,
      nationality: standing.driver.nationality,
      number: standing.driver.number,
      code: standing.driver.shortName,
      dateOfBirth: standing.driver.birthday,
      url: standing.driver.url,
    },
    team: {
      teamId: standing.team.teamId,
      name: standing.team.teamName,
      nationality: standing.team.country,
      firstAppearance: standing.team.firstAppareance,
      constructorsChampionships: standing.team.constructorsChampionships,
      driversChampionships: standing.team.driversChampionships,
      url: standing.team.url,
    },
  };
}

function normaliseConstructorStanding(
  standing: F1ApiConstructorStanding,
): ConstructorStanding {
  return {
    classificationId: standing.classificationId,
    position: standing.position,
    points: standing.points,
    wins: standing.wins,
    teamId: standing.teamId,
    team: {
      name: standing.team.teamName,
      nationality: standing.team.country,
      firstAppearance: standing.team.firstAppareance,
      constructorsChampionships: standing.team.constructorsChampionships,
      driversChampionships: standing.team.driversChampionships,
      url: standing.team.url,
    },
  };
}

function normaliseRaceResult(result: F1ApiRaceResult): RaceResult {
  return {
    position: result.position,
    points: result.points,
    grid: result.grid,
    time: result.time,
    fastestLap: result.fastLap,
    retired: result.retired,
    driver: {
      driverId: result.driver.driverId,
      firstName: result.driver.name,
      lastName: result.driver.surname,
      fullName: `${result.driver.name} ${result.driver.surname}`,
      nationality: result.driver.nationality,
      number: result.driver.number,
      code: result.driver.shortName,
      dateOfBirth: result.driver.birthday,
      url: result.driver.url,
    },
    constructor: {
      constructorId: result.team.teamId,
      name: result.team.teamName,
      nationality: result.team.country,
      firstAppearance: result.team.firstAppareance,
      constructorsChampionships: result.team.constructorsChampionships,
      driversChampionships: result.team.driversChampionships,
      url: result.team.url,
    },
  };
}

function normaliseRaceResults(data: F1ApiRaceResultsResponse): RaceResults {
  return {
    raceId: data.races.raceId,
    raceName: data.races.raceName,
    season: data.season,
    round: data.races.round,
    date: data.races.date,
    time: data.races.time,
    url: data.races.url,
    circuit: normaliseCircuit(data.races.circuit),
    results: data.races.results.map(normaliseRaceResult),
  };
}

export async function getCurrentSeasonDrivers(): Promise<Driver[]> {
  const data = await f1ApiFetch<F1ApiDriversResponse>(
    "/current/drivers?limit=100",
  );

  return data.drivers.map(normaliseDriver);
}

export async function getCurrentSeasonConstructors(): Promise<Constructor[]> {
  const data = await f1ApiFetch<F1ApiTeamsResponse>("/current/teams?limit=100");

  return data.teams.map(normaliseConstructor);
}

export async function getDrivers(): Promise<Driver[]> {
  return getCurrentSeasonDrivers();
}

export async function getConstructors(): Promise<Constructor[]> {
  return getCurrentSeasonConstructors();
}

export async function getCurrentSeasonRaces(): Promise<Race[]> {
  const data = await f1ApiFetch<F1ApiRacesResponse>("/current?limit=100");

  return data.races.map((race) => normaliseRace(race, data.season));
}

export async function getRaceByRound(
  season: number,
  round: number,
): Promise<Race> {
  const data = await f1ApiFetch<F1ApiRaceResponse>(`/${season}/${round}`);

  return normaliseRace(data.races, data.season ?? season);
}

export async function getCurrentDriverStandings(): Promise<{
  season: number;
  championshipId: string;
  standings: DriverStanding[];
}> {
  const data = await f1ApiFetch<F1ApiDriverStandingsResponse>(
    "/current/drivers-championship?limit=100",
  );

  return {
    season: data.season,
    championshipId: data.championshipId,
    standings: data.drivers_championship.map(normaliseDriverStanding),
  };
}

export async function getCurrentConstructorStandings(): Promise<{
  season: number;
  championshipId: string;
  standings: ConstructorStanding[];
}> {
  const data = await f1ApiFetch<F1ApiConstructorStandingsResponse>(
    "/current/constructors-championship?limit=100",
  );

  return {
    season: data.season,
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

      return new Date(raceDate).getTime() <= now;
    })
    .sort((a, b) => b.round - a.round);

  if (completedRaces.length === 0) {
    throw new Error("No completed races are available for the current season");
  }

  for (const race of completedRaces) {
    try {
      return await getRaceResults(race.season, race.round);
    } catch (error) {
      if (error instanceof Error && error.message.includes("status 404")) {
        continue;
      }

      throw error;
    }
  }

  throw new Error(
    "No race results are available for the completed races in the current season",
  );
}

export async function getRaceResults(
  season: number,
  round: number,
): Promise<RaceResults> {
  const data = await f1ApiFetch<F1ApiRaceResultsResponse>(
    `/${season}/${round}/race`,
  );

  return normaliseRaceResults(data);
}
