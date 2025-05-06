import { ObsType } from "../types";

export interface Filter {
  type: ObsType;
  region: string | null;
  period: string | null;
  blah: string | null;
  toQueryString(): string; // Added method declaration
}

export class Filter {
  constructor(
    public type: ObsType,
    public region: string | null,
    public period: string | null,
    public blah: string | null
  ) {}

  static fromQueryString(params: URLSearchParams) {
    return new Filter(
      params.get("type") === "photo" ? ObsType.Photo : ObsType.Sighting,
      params.has("region") ? params.get("region") : null,
      params.has("period") ? params.get("period") : null,
      params.has("blah") ? params.get("blah") : null
    );
  }

  toJsonObject(): any {
    return {
      type: this.type == ObsType.Sighting ? "sighting" : "photo",
      region: this.region,
      period: this.period,
      blah: this.blah
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
    if (this.period) parts.period = this.period;
    if (this.blah) parts.blah = this.blah;

    return new URLSearchParams(parts).toString();
  }
}
