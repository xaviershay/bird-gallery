import { Filter } from "../model/filter";
import { ObsType } from "../types";

interface PartialFilter {
  type: ObsType;
  region?: string | null;
  county?: string | null;
  period: string | null;
  view?: string | null;
}

export const navLinkBuilder = (
  currentFilter: Filter,
  filterCounts: Record<string, number>
) => {
  const currentQuery = currentFilter.toQueryString();
  return (filterChange: PartialFilter): React.ReactNode => {
    const newFilter = Filter.create({
      type: filterChange.type,
      region: filterChange.region ?? null,
      county: filterChange.county ?? null,
      period: filterChange.period,
      view: filterChange.view ?? null
    });
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
