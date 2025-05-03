import { Filter } from "../model/filter";
import { ObsType } from "../types";

interface PartialFilter {
  type: ObsType;
  region?: string | null;
  period: string | null;
  blah?: string | null;
}

export const navLinkBuilder = (
  currentFilter: Filter,
  filterCounts: Record<string, number>
) => {
  const currentQuery = currentFilter.toQueryString();
  return (filterChange: PartialFilter): React.ReactNode => {
    const newFilter = new Filter(
      filterChange.type,
      filterChange.region ?? null,
      filterChange.period,
      filterChange.blah ?? null
    );
    const text = filterCounts[newFilter.toQueryString()] || 0;
    const url = `?${newFilter.toQueryString()}`;
    return (
      <a
        className={newFilter.toQueryString() === currentQuery ? "active" : ""}
        href={url}
      >
        {text}
      </a>
    );
  };
};
