// Type definitions for the application

import React from "react";

export interface Observation {
  id: number,
  slug: string,
  name: string,
  locationId: string,
  createdAt: Date,
  lat: number,
  lng: number
}

export const enum ListType {
  List,
  Photos
}

export interface Filter {
  type: ListType,
  region: string | null,
  period: string | null
}

export interface PageLayout {
  content: React.ReactNode,
  filter: Filter
}

export interface PageListData {
  observations: Array<Observation>,
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string | null;
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
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
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