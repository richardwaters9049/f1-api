export interface Driver {
  driverId: string;
  number: string | null;
  code: string | null;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  dateOfBirth: string | null;
  permanentNumber: string | null;
  url: string | null;
}

export interface Constructor {
  constructorId: string;
  name: string;
  nationality: string;
  url: string | null;
}

export interface RaceScheduleSession {
  date: string | null;
  time: string | null;
}

export interface RaceSchedule {
  race: RaceScheduleSession;
  qualy: RaceScheduleSession;
  fp1: RaceScheduleSession;
  fp2: RaceScheduleSession;
  fp3: RaceScheduleSession;
  sprintQualy: RaceScheduleSession;
  sprintRace: RaceScheduleSession;
}

export interface Circuit {
  circuitId: string;
  name: string;
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

export interface RaceWinner {
  driverId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  nationality: string;
  number: number | null;
  code: string | null;
  dateOfBirth: string | null;
  url: string | null;
}

export interface ConstructorWinner {
  constructorId: string;
  name: string;
  nationality: string;
  firstAppearance: number | null;
  constructorsChampionships: number | null;
  driversChampionships: number | null;
  url: string | null;
}

export interface Race {
  raceId: string;
  championshipId: string;
  raceName: string;
  season: number;
  round: number;
  url: string | null;
  schedule: RaceSchedule;
  laps: number | null;
  circuit: Circuit;
  fastestLap: {
    time: string | null;
    driverId: string | null;
    constructorId: string | null;
  } | null;
  winner: RaceWinner | null;
  constructorWinner: ConstructorWinner | null;
}
