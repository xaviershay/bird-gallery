import { Filter } from "../model/filter";
import { Observation, Photo } from "../types";
import { ObsType } from "../types";
import { ThumbnailStrip } from "./thumbnail_strip";
import { navLinkBuilder } from "../helpers/nav_link_builder";
import { MapView } from "./components/map";
import { REGIONS, YEARS } from "../config/constants";
import { FirstsTable } from "./components/firsts_table";

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
            {YEARS.map(year => (
              <tr key={year}>
                <th className="period">{year}</th>
                <td>
                  {navLink({
                    type: ObsType.Photo,
                    county: REGIONS.COUNTY.id,
                    region: null,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Sighting,
                    county: REGIONS.COUNTY.id,
                    region: null,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Photo,
                    region: REGIONS.STATE.id,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Sighting,
                    region: REGIONS.STATE.id,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Photo,
                    region: null,
                    period: String(year),
                  })}
                </td>
                <td>
                  {navLink({
                    type: ObsType.Sighting,
                    region: null,
                    period: String(year),
                  })}
                </td>
              </tr>
            ))}
          </table>
        </nav>
        <ThumbnailStrip photos={photos} />
        <MapView
          dataUrl={`/firsts.geojson?${data.filter.toQueryString()}`}
          urlBuilder={`(id) => ("/location/" + id + "?view=firsts&${data.filter.toQueryString()}")`}
        />
        <FirstsTable
          observations={data.observations}
          showComment={showComment}
          totalCount={data.observations.length}
          firstDateLabel={`First ${filter.type === ObsType.Photo ? "Photo" : "Seen"}`}
        />
      </section>
    </>
  );
};
