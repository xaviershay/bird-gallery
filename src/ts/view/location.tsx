import { Filter } from "../model/filter";
import { Observation, Location, ObsType, Photo } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";
import { navLinkBuilder } from "../helpers/nav_link_builder";
import { YEARS } from "../config/constants";

interface LocationViewProps {
  filter: Filter;
  filterCounts: Record<string, number>;
  observations: Array<Observation>;
  photos: Array<Photo>;
  location: Location;
}

export const LocationView = (data: LocationViewProps) => {
  const { filter, filterCounts, observations, photos, location } = data;
  const navLink = navLinkBuilder(data.filter, filterCounts);

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
        <ul className="actions">
          <li>
            <a
              id="copy-location-id"
              href="#"
              data-copy={String(location.id)}
              title="Copy location ID to clipboard"
            >
              <i className="fa-solid fa-copy"></i> Copy location ID to clipboard
            </a>
          </li>
          <li>
            <a href={`/report/sightings?location=${location.id}`}>
              <i className="fa-solid fa-binoculars"></i> Recent sightings nearby
            </a>
          </li>
        </ul>
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
                  view: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  view: "firsts",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  view: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  view: null,
                  period: null,
                })}
              </td>
            </tr>
            {YEARS.map(year => (
              <tr key={year}>
                <th className="period">{year}</th>
                <td>
                  {navLink({
                    type: ObsType.Photo,
                    view: "firsts",
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Sighting,
                    view: "firsts",
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Photo,
                    view: null,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Sighting,
                    view: null,
                    period: String(year),
                  })}
                </td>
              </tr>
            ))}
          </table>
        </nav>
        <ThumbnailStrip photos={photos} />
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th className="date">First {filter.type === ObsType.Photo ? "Photo" : "Seen"}</th>
            </tr>
          </thead>
          <tbody>
            {observations.map((o, index) => (
              <tr key={o.id}>
                <td>{observationCount - index}</td>
                <td>{speciesLink(o)}</td>
                <td className="date">
                  <a href={`https://ebird.org/checklist/S${o.checklistId}`}>
                    {formatDate(o.seenAt)}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {/* Load copy to clipboard script */}
      <script src="/js/copy-to-clipboard.js"></script>
    </>
  );
};
