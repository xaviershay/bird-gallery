import { ListType } from "../types";

export class Filter {
  constructor(
    public type: ListType,
    public region: string | null,
    public period: string | null
  ) {}

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
