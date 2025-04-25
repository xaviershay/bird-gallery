import { Filter } from "../model/filter";
import { Observation } from "../types";
import { ObservationType } from "../types";
import speciesLink from "./helpers/species_link";

interface PageList {
  filter: Filter; // TODO: should probably be "data source" or something better
  observations: Array<Observation>;
}

type PartialFilter = {
  type?: ObservationType;
  region?: string | null;
  period?: string | null;
};

export const List = (data: PageList) => {
  const scriptContent = `
    initMap("/firsts.json?${data.filter.toQueryString()}");
  `;

  // Utility function for shallow equality checking
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

  const navLink = (
    text: string,
    filterChange: PartialFilter
  ): React.ReactNode => {
    const newFilter = new Filter(
      filterChange.type ?? data.filter.type,
      'region' in filterChange ? filterChange.region ?? null : data.filter.region,
      'period' in filterChange ? filterChange.period ?? null : data.filter.period,
      data.filter.blah
    );
    if (objectEqual(newFilter, data.filter)) {
      return <span>{text}</span>;
    } else {
      const queryString = newFilter.toQueryString();
      const url = `?${queryString}`;
      return <a href={url}>{text}</a>;
    }
  };

  return (
    <>
      <nav>
        <section>
          <strong>List</strong>
          <ul>
            <li>{navLink("Seen", { type: ObservationType.Sighting })}</li>
            <li>{navLink("Photoed", { type: ObservationType.Photo })}</li>
          </ul>
        </section>

        <section>
          <strong>Region</strong>
          <ul>
            <li>{navLink("World", { region: null })}</li>
            <li>{navLink("Victora", { region: "au-vic" })}</li>
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
      <div id="map"></div>
      <table className="bird-list">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>First Seen</th>
          </tr>
        </thead>
        <tbody>
          {data.observations.map((o, index) => (
            <tr key={o.id}>
              <td>{data.observations.length - index}</td>
              <td>{speciesLink(o)}</td>
              <td>{o.seenAt.toISOString().split("T")[0]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
