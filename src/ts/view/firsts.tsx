import { Filter } from "../model/filter";
import { Observation, Photo } from "../types";
import { ObsType } from "../types";
import speciesLink from "../helpers/species_link";
import { formatDate } from "../helpers/format_date";
import formatLocationName from "../helpers/format_location_name";
import { ThumbnailStrip } from "./thumbnail_strip";
import { navLinkBuilder } from "../helpers/nav_link_builder";
import { MapView } from "./components/map";
import { REGIONS } from "../config/constants";

interface FirstsViewProps {
  filter: Filter; // TODO: should probably be "data source" or something better
  filterCounts: Record<string, number>;
  observations: Observation[];
  photos: Photo[];
}

export const FirstsView = (data: FirstsViewProps) => {
  const { filter, filterCounts, photos } = data;
  const navLink = navLinkBuilder(data.filter, filterCounts);

  // Group observations by location
  const observationsByLocation = new Map<string, Observation[]>();
  for (const obs of data.observations) {
    const locationKey = `${obs.location.id}`;
    if (!observationsByLocation.has(locationKey)) {
      observationsByLocation.set(locationKey, []);
    }
    observationsByLocation.get(locationKey)!.push(obs);
  }

  // Sort locations by the earliest observation date at each location
  const sortedLocations = Array.from(observationsByLocation.entries()).sort((a, b) => {
    const earliestA = Math.min(...a[1].map(o => o.seenAt.getTime()));
    const earliestB = Math.min(...b[1].map(o => o.seenAt.getTime()));
    return earliestB - earliestA; // Most recent first
  });

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
              <th colSpan={2}>{REGIONS.COUNTY.label}</th>
              <th colSpan={2}>{REGIONS.STATE.label}</th>
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
                  county: REGIONS.COUNTY.id,
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  county: REGIONS.COUNTY.id,
                  region: null,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: REGIONS.STATE.id,
                  period: null,
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: REGIONS.STATE.id,
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
                  county: REGIONS.COUNTY.id,
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  county: REGIONS.COUNTY.id,
                  region: null,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Photo,
                  region: REGIONS.STATE.id,
                  period: "2025",
                })}
              </td>
              <td>
                {navLink({
                  type: ObsType.Sighting,
                  region: REGIONS.STATE.id,
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
              {!filter.region && !filter.period && filter.type == ObsType.Sighting && <th>Comment</th>}
            </tr>
          </thead>
          <tbody>
            {sortedLocations.flatMap(([locationId, observations]) => {
              const location = observations[0].location;
              const rows = [];

              // Add location header row
              rows.push(
                <tr key={`location-${locationId}`} className="group-row">
                  <td colSpan={!filter.region && !filter.period && filter.type == ObsType.Sighting ? 4 : 3}>
                    <a href={`/location/${location.id}`}>
                      {formatLocationName(location.name)}
                    </a>
                  </td>
                </tr>
              );

              // Add observation rows
              observations.forEach((o) => {
                rows.push(
                  <tr key={o.id}>
                    <td>{data.observations.length - data.observations.indexOf(o)}</td>
                    <td>{speciesLink(o)}</td>
                    <td>
                      <a href={`https://ebird.org/checklist/S${o.checklistId}`}>
                        {formatDate(o.seenAt)}
                      </a>
                    </td>
                    {!filter.region && !filter.period && filter.type == ObsType.Sighting && <td>{o.comment}</td>}
                  </tr>
                );
              });

              return rows;
            })}
          </tbody>
        </table>
      </section>
    </>
  );
};
