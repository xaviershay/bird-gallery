import { Filter } from "../model/filter";
import { Observation, Location, ObsType, Photo } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";
import { objectShallowEqual } from "../helpers/object_shallow_equal";

interface LocationViewProps {
  filter: Filter;
  filterCounts: Record<string, number>;
  observations: Array<Observation>;
  photos: Array<Photo>;
  location: Location;
}

export const LocationView = (data: LocationViewProps) => {
  const { filter, filterCounts, observations, photos, location } = data;

  const navLink = (filterChange: Partial<Filter>): React.ReactNode => {
    const newFilter = new Filter(
      filterChange.type ?? filter.type,
      filter.region,
      "period" in filterChange
        ? filterChange.period ?? null
        : data.filter.period,
      "blah" in filterChange ? filterChange.blah ?? null : data.filter.blah
    );
    const text = filterCounts[newFilter.toQueryString()] ?? 0;
    const queryString = newFilter.toQueryString();
    const url = `?${queryString}`;
    return (
      <a
        className={objectShallowEqual(newFilter, data.filter) ? "active" : ""}
        href={url}
      >
        {text}
      </a>
    );
  };

  const observationCount = observations.length;
  const locationName = location.name
    .replace(/\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/g, "")
    .replace(/--/g, ": ")
    .trim();

  return (
    <>
      <section>
        <h2>
          <i className="fa-solid fa-location-dot"></i>
          {locationName}
        </h2>
        <nav>
          <table>
            <tr>
              <th></th>
              <th colSpan={2}>Firsts</th>
              <th colSpan={2}>All</th>
            </tr>
            <tr>
              <th></th>
              <th>Photo</th>
              <th>Seen</th>
              <th>Photo</th>
              <th>Seen</th>
            </tr>
            <tr>
              <th className="period">Life</th>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  blah: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  blah: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  blah: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  blah: null,
                  period: null,
                })}
              </td>
            </tr>
            <tr>
              <th className="period">2025</th>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  blah: "firsts",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  blah: "firsts",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  blah: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  blah: null,
                  period: "2025",
                })}
              </td>
            </tr>
          </table>
        </nav>
        <ThumbnailStrip photos={photos} />
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>First {filter.type === ObsType.Photo ? "Photo" : "Seen"}</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o, index) => (
              <tr key={o.id}>
                <td>{observationCount - index}</td>
                <td>{speciesLink(o)}</td>
                <td>{formatDate(o.seenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
};
