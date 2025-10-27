import { Filter } from "../model/filter";
import { Observation, Photo } from "../types";
import { ObsType } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";
import { ThumbnailStrip } from "./thumbnail_strip";
import { navLinkBuilder } from "../helpers/nav_link_builder";
import { MapView } from "./components/map";

interface FirstsViewProps {
  filter: Filter; // TODO: should probably be "data source" or something better
  filterCounts: Record<string, number>;
  observations: Observation[];
  photos: Photo[];
}

export const FirstsView = (data: FirstsViewProps) => {
  const { filter, filterCounts, photos } = data;
  const navLink = navLinkBuilder(data.filter, filterCounts);

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
              <th colSpan={2}>Melbourne</th>
              <th colSpan={2}>Victoria, AU</th>
              <th colSpan={2}>World</th>
            </tr>
            <tr>
              <th></th>
              <th>Photo</th>
              <th>Seen</th>
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
                  county: "melbourne",
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  county: "melbourne",
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: "au-vic",
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: null,
                  period: null,
                })}
              </td>
            </tr>
            <tr>
              <th className="period">2025</th>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  county: "melbourne",
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  county: "melbourne",
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: "au-vic",
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: null,
                  period: "2025",
                })}
              </td>
            </tr>
          </table>
        </nav>
        <ThumbnailStrip photos={photos} />
        <MapView
          dataUrl={`/firsts.geojson?${data.filter.toQueryString()}`}
          urlBuilder={`(id) => ("/location/" + id + "?view=firsts&${data.filter.toQueryString()}")`}
        />
        <table className="bird-list">
          <thead>
            <tr>
              <th>#</th>
              <th>Name</th>
              <th>First {filter.type === ObsType.Photo ? "Photo" : "Seen"}</th>
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
    </>
  );
};
