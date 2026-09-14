import type {
  Circuit,
  Constructor,
  ConstructorWinner,
  Driver,
  Race,
  RaceSchedule,
  RaceScheduleSession,
  RaceWinner,
} from "../types/f1.ts";

const F1_API_BASE = "https://f1api.dev/api";

interface F1ApiDriver {
  driverId: string;
  name: string;
  surname: string;
  nationality: string;
  birthday?: string;
  number?: number | null;
  shortName?: string;
  url?: string;
}

interface F1ApiTeam {
  teamId: string;
  teamName: string;
  teamNationality: string;
  firstAppareance?: number | null;
  constructorsChampionships?: number | null;
  driversChampionships?: number | null;
  url?: string;
}

interface F1ApiDriversResponse {
  drivers: F1ApiDriver[];
}

interface F1ApiTeamsResponse {
  teams: F1ApiTeam[];
}

interface F1ApiScheduleSession {
  date?: string | null;
  time?: string | null;
}

interface F1ApiSchedule {
  race?: F1ApiScheduleSession;
  qualy?: F1ApiScheduleSession;
  fp1?: F1ApiScheduleSession;
  fp2?: F1ApiScheduleSession;
  fp3?: F1ApiScheduleSession;
  sprintQualy?: F1ApiScheduleSession;
  sprintRace?: F1ApiScheduleSession;
}

interface F1ApiCircuit {
  circuitId: string;
  circuitName: string;
  country: string;
  city: string;
  circuitLength?: string | null;
  lapRecord?: string | null;
  firstParticipationYear?: number | null;
  corners?: number | null;
  fastestLapDriverId?: string | null;
  fastestLapTeamId?: string | null;
  fastestLapYear?: number | null;
  url?: string;
}

interface F1ApiWinner {
  driverId: string;
  name: string;
  surname: string;
  country: string;
  birthday?: string | null;
  number?: number | null;
  shortName?: string | null;
  url?: string;
}

interface F1ApiTeamWinner {
  teamId: string;
  teamName: string;
  country: string;
  firstAppearance?: number | null;
  constructorsChampionships?: number | null;
  driversChampionships?: number | null;
  url?: string;
}

interface F1ApiFastestLap {
  fast_lap?: string | null;
  fast_lap_driver_id?: string | null;
  fast_lap_team_id?: string | null;
}

interface F1ApiRace {
  raceId: string;
  championshipId: string;
  raceName: string;
  schedule: F1ApiSchedule;
  laps?: number | null;
  round: number;
  url?: string;
  fast_lap?: F1ApiFastestLap | null;
  circuit: F1ApiCircuit;
  winner?: F1ApiWinner | null;
  teamWinner?: F1ApiTeamWinner | null;
}

interface F1ApiCurrentSeasonResponse {
  season: number;
  total: number;
  races: F1ApiRace[];
}

interface F1ApiRaceDetailResponse {
  season: string | number;
  round: string | number;
  total: number;
  race: F1ApiRace[];
}

async function f1ApiFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${F1_API_BASE}${endpoint}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `F1 API returned ${response.status} ${response.statusText}`,
    );
  }

  return response.json() as Promise<T>;
}

function normaliseScheduleSession(
  session: F1ApiScheduleSession | undefined,
): RaceScheduleSession {
  return {
    date: session?.date ?? null,
    time: session?.time ?? null,
  };
}

function normaliseSchedule(schedule: F1ApiSchedule): RaceSchedule {
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

function normaliseCircuit(circuit: F1ApiCircuit): Circuit {
  return {
    circuitId: circuit.circuitId,
    name: circuit.circuitName,
    country: circuit.country,
    city: circuit.city,
    length: circuit.circuitLength ?? null,
    lapRecord: circuit.lapRecord ?? null,
    firstParticipationYear: circuit.firstParticipationYear ?? null,
    corners: circuit.corners ?? null,
    fastestLapDriverId: circuit.fastestLapDriverId ?? null,
    fastestLapTeamId: circuit.fastestLapTeamId ?? null,
    fastestLapYear: circuit.fastestLapYear ?? null,
    url: circuit.url ?? null,
  };
}

function normaliseWinner(
  winner: F1ApiWinner | null | undefined,
): RaceWinner | null {
  if (!winner) {
    return null;
  }

  const fullName = `${winner.name} ${winner.surname}`.trim();

  return {
    driverId: winner.driverId,
    firstName: winner.name,
    lastName: winner.surname,
    fullName,
    nationality: winner.country,
    number: winner.number ?? null,
    code: winner.shortName ?? null,
    dateOfBirth: winner.birthday ?? null,
    url: winner.url ?? null,
  };
}

function normaliseConstructorWinner(
  team: F1ApiTeamWinner | null | undefined,
): ConstructorWinner | null {
  if (!team) {
    return null;
  }

  return {
    constructorId: team.teamId,
    name: team.teamName,
    nationality: team.country,
    firstAppearance: team.firstAppearance ?? null,
    constructorsChampionships: team.constructorsChampionships ?? null,
    driversChampionships: team.driversChampionships ?? null,
    url: team.url ?? null,
  };
}

function normaliseRace(race: F1ApiRace, season: number): Race {
  return {
    raceId: race.raceId,
    championshipId: race.championshipId,
    raceName: race.raceName,
    season,
    round: race.round,
    url: race.url ?? null,
    schedule: normaliseSchedule(race.schedule),
    laps: race.laps ?? null,
    circuit: normaliseCircuit(race.circuit),
    fastestLap: race.fast_lap
      ? {
          time: race.fast_lap.fast_lap ?? null,
          driverId: race.fast_lap.fast_lap_driver_id ?? null,
          constructorId: race.fast_lap.fast_lap_team_id ?? null,
        }
      : null,
    winner: normaliseWinner(race.winner),
    constructorWinner: normaliseConstructorWinner(race.teamWinner),
  };
}

export async function getCurrentSeasonDrivers(): Promise<Driver[]> {
  const data = await f1ApiFetch<F1ApiDriversResponse>(
    "/current/drivers?limit=100",
  );

  return data.drivers.map((driver) => {
    const fullName = `${driver.name} ${driver.surname}`.trim();

    return {
      driverId: driver.driverId,
      number:
        driver.number !== undefined && driver.number !== null
          ? String(driver.number)
          : null,
      code: driver.shortName ?? null,
      firstName: driver.name,
      lastName: driver.surname,
      fullName,
      nationality: driver.nationality,
      dateOfBirth: driver.birthday ?? null,
      permanentNumber:
        driver.number !== undefined && driver.number !== null
          ? String(driver.number)
          : null,
      url: driver.url ?? null,
    };
  });
}

export async function getCurrentSeasonConstructors(): Promise<Constructor[]> {
  const data = await f1ApiFetch<F1ApiTeamsResponse>("/current/teams?limit=100");

  return data.teams.map((team) => ({
    constructorId: team.teamId,
    name: team.teamName,
    nationality: team.teamNationality,
    url: team.url ?? null,
  }));
}

export async function getCurrentSeasonRaces(): Promise<Race[]> {
  const data =
    await f1ApiFetch<F1ApiCurrentSeasonResponse>("/current?limit=100");

  return data.races.map((race) => normaliseRace(race, data.season));
}

export async function getRaceByRound(
  season: number,
  round: number,
): Promise<Race | null> {
  const data = await f1ApiFetch<F1ApiRaceDetailResponse>(`/${season}/${round}`);

  const race = data.race[0];

  if (!race) {
    return null;
  }

  return normaliseRace(race, Number(data.season));
}
