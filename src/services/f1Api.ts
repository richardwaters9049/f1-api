import type { Constructor, Driver } from "../types/f1.ts";

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
  url?: string;
}

interface F1ApiDriversResponse {
  drivers: F1ApiDriver[];
}

interface F1ApiTeamsResponse {
  teams: F1ApiTeam[];
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
