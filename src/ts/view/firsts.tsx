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

  // Show comment column only for sightings with no region, county, or period filters
  const showComment = !filter.region && !filter.county && !filter.period && filter.type === ObsType.Sighting;

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
              <th className="date">First {filter.type === ObsType.Photo ? "Photo" : "Seen"}</th>
              {showComment && <th>Comment</th>}
            </tr>
          </thead>
          <tbody>
            {data.observations.flatMap((o, index) => {
              const location = o.location;
              const rows = [];
              
              // Add location header row if this is a new location (or first observation)
              const prevLocation = index > 0 ? data.observations[index - 1].location : null;
              if (!prevLocation || prevLocation.id !== location.id) {
                rows.push(
                  <tr key={`location-${location.id}-${index}`} className="group-row">
                    <td colSpan={showComment ? 4 : 3}>
                      <a href={`/location/${location.id}`}>
                        {formatLocationName(location.name)}
                      </a>
                    </td>
                  </tr>
                );
              }
              
              // Add observation row
              rows.push(
                <tr key={o.id}>
                  <td>{data.observations.length - index}</td>
                  <td>{speciesLink(o)}</td>
                  <td className='date'>
                    <a href={`https://ebird.org/checklist/S${o.checklistId}`}>
                      {formatDate(o.seenAt)}
                    </a>
                  </td>
                  {showComment && <td>{o.comment}</td>}
                </tr>
              );
              
              return rows;
            })}
          </tbody>
        </table>
      </section>
    </>
  );
};
