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
