import { ListType } from "../types";

export interface Filter {
  type: ListType,
  region: string | null,
  period: string | null,
  toQueryString(): string; // Added method declaration
}

export class Filter {
  constructor(
    public type: ListType,
    public region: string | null,
    public period: string | null
  ) {}

  static fromQueryString(params : URLSearchParams) {
    return new Filter(
      params.get('type') === 'list' ? ListType.List : ListType.Photos,
      params.get('region') === 'world' ? null : params.get('region'),
      params.get('period') === 'life' ? null : params.get('period')
    );
  }

  toQueryString(): string {
    const parts: Record<string, string> = {};

    switch (this.type) {
      case ListType.List:
        parts.type = "list";
        break;
      case ListType.Photos:
        parts.type = "photos";
        break;
      default:
        throw new Error("Unsupported type: " + this.type);
    }

    parts.region = this.region ?? "world";
    parts.period = this.period ?? "life";

    return new URLSearchParams(parts).toString();
  }
}