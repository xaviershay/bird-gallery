import { Filter } from "../model/filter";
import { Observation } from "../types";
import { ObservationType } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";

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
    urlF = (id) => ("/location/" + id + "?blah=firsts");
    initMap("/firsts.json?${data.filter.toQueryString()}", urlF);
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
      "region" in filterChange
        ? filterChange.region ?? null
        : data.filter.region,
      "period" in filterChange
        ? filterChange.period ?? null
        : data.filter.period,
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
      <section>
        <h2>
          <i className="fa-solid fa-trophy"></i> Firsts
        </h2>
        <nav>
          <table>
            <tr>
              <th></th>
              <th colSpan={2}>Victoria, AU</th>
              <th colSpan={2}>World</th>
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
                {navLink("0", {
                  type: ObservationType.Photo,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Sighting,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Photo,
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Sighting,
                  region: null,
                  period: null,
                })}
              </td>
            </tr>
            <tr>
              <th className="period">2025</th>
              <td>
                {navLink("0", {
                  type: ObservationType.Photo,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Sighting,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Photo,
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink("0", {
                  type: ObservationType.Sighting,
                  region: null,
                  period: "2025",
                })}
              </td>
            </tr>
          </table>
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
                <td>{formatDate(o.seenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
