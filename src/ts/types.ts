export interface Observation {
  id: string;
  checklistId: number;
  speciesId: string;
  name: string;
  locationId: string;
  location: Location;
  seenAt: Date;
  lat: number;
  lng: number;
  hasPhoto: boolean;
  comment?: string;
}

export interface Photo {
  fileName: string;
  commonName: string;
  takenAt: Date;
  height: number;
  width: number;
  rating: number;
  iso: string;
  fNumber: string;
  exposure: number;
  zoom: string;
  tags: string;
  camera: string;
  lens: string | null;
}

export interface Species {
  id: string;
  name: string;
  photos: Photo[];
}

export interface Location {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface TripReport {
  id: string;
  title: string;
  description: string;
  startDate: Date;
  endDate: Date;
  createdAt: Date;
}

export interface TripReportStats {
  totalSpecies: number;
  totalObservations: number;
  totalChecklists: number;
  totalLocations: number;
  firstsSeen: number;
  firstsPhotographed: number;
}

export const enum ObsType {
  Sighting,
  Photo,
}

// D1 result types
export interface D1Result<T> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    changes?: number;
    last_row_id?: number;
  };
}

// Extend the global D1Database interface
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(
      statements: D1PreparedStatement[]
    ): Promise<D1Result<T>[]>;
    exec<T = unknown>(query: string): Promise<D1Result<T>>;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run<T = unknown>(): Promise<D1Result<T>>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }
}
