import { Filter } from "../model/filter";
import { Observation, Location, ObservationType } from "../types";
import speciesLink from "./helpers/species_link";

interface LocationViewProps {
  filter: Filter;
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
  const { filter, observations, location } = data;

  const navLink = (
    text: string,
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
    if (objectEqual(newFilter, filter)) {
      return <span>{text}</span>;
    } else {
      const queryString = newFilter.toQueryString();
      const url = `?${queryString}`;
      return <a href={url}>{text}</a>;
    }
  };

  const observationCount = observations.length;
  const locationName = location.name
    .replace(/\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/g, "")
    .replace(/--/g, ": ")
    .trim();

  return (
    <>
      <h3>{locationName}</h3>
      <nav>
        <section>
          <strong>List</strong>
          <ul>
            <li>{navLink("Seen", { type: ObservationType.Sighting })}</li>
            <li>{navLink("Photoed", { type: ObservationType.Photo })}</li>
          </ul>
        </section>

        <section>
          <strong>Birds</strong>
          <ul>
            <li>{navLink("All", { blah: null })}</li>
            <li>{navLink("Firsts", { blah: "firsts" })}</li>
          </ul>
        </section>

        <section>
          <strong>Time Period</strong>
          <ul>
            <li>{navLink("Life", { period: null })}</li>
            <li>{navLink("2025", { period: "2025" })}</li>
          </ul>
        </section>
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
              <td>{o.seenAt.toISOString().split("T")[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};
