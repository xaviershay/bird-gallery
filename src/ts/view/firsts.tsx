import { Filter } from "../model/filter";
import { Observation, Photo } from "../types";
import { ObservationType } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";
import { objectShallowEqual } from "../helpers/object_shallow_equal";

interface FirstsViewProps {
  filter: Filter; // TODO: should probably be "data source" or something better
  filterCounts: Record<string, number>;
  observations: Observation[];
  photos: Photo[];
}

export const FirstsView = (data: FirstsViewProps) => {
  const { filter, filterCounts, photos } = data;
  const scriptContent = `
    urlF = (id) => ("/location/" + id + "?blah=firsts");
    initMap("/firsts.json?${data.filter.toQueryString()}", urlF);
  `;

  const navLink = (
    filterChange: Partial<Filter>
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
    const text = filterCounts[newFilter.toQueryString()] ?? 0;
    const queryString = newFilter.toQueryString();
    const url = `?${queryString}`;
    return <a className={objectShallowEqual(newFilter, data.filter) ? "active" : ""} href={url}>{text}</a>;
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
                {navLink({
                  type: ObservationType.Photo,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  region: null,
                  period: null,
                })}
              </td>
            </tr>
            <tr>
              <th className="period">2025</th>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Photo,
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObservationType.Sighting,
                  region: null,
                  period: "2025",
                })}
              </td>
            </tr>
          </table>
        </nav>
        <ThumbnailStrip photos={photos} />
        <div id="map"></div>
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>First {filter.type === ObservationType.Photo ? "Photo" : "Seen"}</th>
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
