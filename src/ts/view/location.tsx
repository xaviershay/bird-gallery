import { Filter } from "../model/filter";
import { Observation, Location, ObservationType } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";

interface LocationViewProps {
  filter: Filter;
  filterCounts: Record<string, number>;
  observations: Array<Observation>;
  location: Location;
}
type PartialFilter = {
  type?: ObservationType;
  period?: string | null;
  blah?: string | null;
};

const objectEqual = (
  obj1: Record<string, any>,
  obj2: Record<string, any>
): boolean => {
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  if (keys1.length !== keys2.length) return false;
  return keys1.every(
    (key) => obj2.hasOwnProperty(key) && obj1[key] === obj2[key]
  );
};
export const LocationView = (data: LocationViewProps) => {
  const { filter, filterCounts, observations, location } = data;

  console.log(filterCounts);
  const navLink = (
    filterChange: PartialFilter
  ): React.ReactNode => {
    const newFilter = new Filter(
      filterChange.type ?? filter.type,
      filter.region,
      "period" in filterChange
        ? filterChange.period ?? null
        : data.filter.period,
      "blah" in filterChange ? filterChange.blah ?? null : data.filter.blah
    );
    console.log(newFilter.toQueryString());
    const text = filterCounts[newFilter.toQueryString()] ?? 0;
    const queryString = newFilter.toQueryString();
    const url = `?${queryString}`;
    return <a className={objectEqual(newFilter, data.filter) ? "active" : ""} href={url}>{text}</a>;
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
          {locationName}</h2>
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
              <th className='period'>Life</th>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  blah: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  blah: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  blah: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  blah: null,
                  period: null,
                })}
              </td>
            </tr>
            <tr>
              <th className="period">2025</th>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  blah: "firsts",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  blah: "firsts",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  blah: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  blah: null,
                  period: "2025",
                })}
              </td>
            </tr>
          </table>
        </nav>

        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>First Seen</th>
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
