import { ObsType } from "../types";

export interface FilterOptions {
  type: ObsType;
  region?: string | null;
  county?: string | null;
  period?: string | null;
  view?: string | null;
}

export interface Filter {
  type: ObsType;
  region: string | null;
  county: string | null;
  period: string | null;
  view: string | null;
  toQueryString(): string; // Added method declaration
}

export class Filter {
  private constructor(
    public type: ObsType,
    public region: string | null,
    public county: string | null = null,
    public period: string | null,
    public view: string | null = null
  ) {}

  static create(options: FilterOptions): Filter {
    return new Filter(
      options.type,
      options.region ?? null,
      options.county ?? null,
      options.period ?? null,
      options.view ?? null
    );
  }

  static fromQueryString(params: URLSearchParams) {
    return new Filter(
      params.get("type") === "photo" ? ObsType.Photo : ObsType.Sighting,
      params.has("region") ? params.get("region") : null,
      params.has("county") ? params.get("county") : null,
      params.has("period") ? params.get("period") : null,
      params.has("view") ? params.get("view") : null
    );
  }

  toJsonObject(): any {
    return {
      type: this.type == ObsType.Sighting ? "sighting" : "photo",
      region: this.region,
      county: this.county,
      period: this.period,
      view: this.view
    }
  }

  toQueryString(): string {
    const parts: Record<string, string> = {};

    switch (this.type) {
      case ObsType.Sighting:
        parts.type = "sighting";
        break;
      case ObsType.Photo:
        parts.type = "photo";
        break;
      default:
        throw new Error("Unsupported type: " + this.type);
    }

    if (this.region) parts.region = this.region;
    if (this.county) parts.county = this.county;
    if (this.period) parts.period = this.period;
    if (this.view) parts.view = this.view;

    return new URLSearchParams(parts).toString();
  }
}
