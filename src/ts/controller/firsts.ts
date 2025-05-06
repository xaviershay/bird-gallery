import { Env } from "../routes";
import { Observation, ObsType } from "../types";
import { Filter } from "../model/filter";
import { FirstsView } from "../view/firsts";
import { LayoutView } from "../view/layout";
import { prerender } from 'react-dom/static';
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchDistinctPhotos } from "../model/photo";
import { fetchFirsts } from "../model/observation";

export async function handleFirsts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const filter = Filter.fromQueryString(url.searchParams);
  const firsts = await fetchFirsts(env, filter);

  if (url.pathname.endsWith(".geojson")) {
    // Group records by locationId
    const grouped = firsts.reduce((acc, record) => {
      if (!acc[record.locationId]) {
        acc[record.locationId] = [];
      }
      acc[record.locationId].push(record);
      return acc;
    }, {} as Record<string, Observation[]>);

    var jsonData = {
      type: "FeatureCollection",
      features: Object.entries(grouped).map(([locationId, os]) => {
        const obs = os[0];
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [obs.lng, obs.lat],
          },
          properties: {
            locationId: locationId,
            name: formatLocationName(obs.location.name),
            count: os.length,
          },
        };
      }),
    };

    return respondWith(200, jsonData, corsHeaders);
  } else {
    const title = "Firsts - Xavier's Bird Lists";
    const header = await fetchHeaderStats(env);
    const filterCounts = await fetchFilterCounts(env);
    const photos = await fetchDistinctPhotos(
      env,
      filter.type == ObsType.Photo
        ? firsts.slice(0, 30).map((obs) => obs.id)
        : []
    );
    const content = FirstsView({
      observations: firsts,
      filter,
      filterCounts,
      photos,
    });
    const html = LayoutView({ title, content, header });
    const htmlStream = await prerender(html)
    return new Response(htmlStream.prelude, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}

async function fetchFilterCounts(env: Env): Promise<Record<string, number>> {
  let query = `
      SELECT
        year,
        LOWER(state) as state,
        COUNT(*) as allSightings,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstSightings,
        COUNT(CASE WHEN region_row_num = 1 THEN 1 END) as allRegionFirstSightings
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY species_id, year ORDER BY seen_at ASC) AS row_num,
          ROW_NUMBER() OVER (PARTITION BY species_id, year, state ORDER BY seen_at ASC) AS region_row_num
        FROM observation_wide
      )
      GROUP BY year, state
    `;

  let statement = env.DB.prepare(query);
  let results = await statement.bind().all<any>();

  let counts: Record<string, number> = {};
  counts[new Filter(ObsType.Sighting, null, null, null).toQueryString()] = 0;
  results.results.forEach((result) => {
    counts[
      new Filter(
        ObsType.Sighting,
        result.state,
        result.year,
        null
      ).toQueryString()
    ] = result.allRegionFirstSightings;
    counts[new Filter(ObsType.Sighting, null, null, null).toQueryString()] +=
      result.allFirstSightings;
    counts[
      new Filter(ObsType.Sighting, null, result.year, null).toQueryString()
    ] ||= 0;
    counts[
      new Filter(ObsType.Sighting, null, result.year, null).toQueryString()
    ] += result.allFirstSightings;
    counts[
      new Filter(ObsType.Sighting, result.state, null, null).toQueryString()
    ] ||= 0;
    counts[
      new Filter(ObsType.Sighting, result.state, null, null).toQueryString()
    ] += result.allRegionFirstSightings;
  });

  query = `
      SELECT
        year,
        LOWER(state) as state,
        COUNT(*) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstPhotos,
        COUNT(CASE WHEN region_row_num = 1 THEN 1 END) as allRegionFirstPhotos
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY species_id, year ORDER BY seen_at ASC) AS row_num,
          ROW_NUMBER() OVER (PARTITION BY species_id, year, state ORDER BY seen_at ASC) AS region_row_num
        FROM observation_wide
        WHERE has_photo
      )
      GROUP BY year, state
    `;

  statement = env.DB.prepare(query);
  results = await statement.bind().all<any>();

  counts[new Filter(ObsType.Photo, null, null, null).toQueryString()] = 0;
  results.results.forEach((result) => {
    counts[
      new Filter(ObsType.Photo, result.state, result.year, null).toQueryString()
    ] = result.allRegionFirstPhotos;
    counts[new Filter(ObsType.Photo, null, null, null).toQueryString()] +=
      result.allFirstPhotos;
    counts[
      new Filter(ObsType.Photo, null, result.year, null).toQueryString()
    ] ||= 0;
    counts[
      new Filter(ObsType.Photo, null, result.year, null).toQueryString()
    ] += result.allFirstPhotos;
    counts[
      new Filter(ObsType.Photo, result.state, null, null).toQueryString()
    ] ||= 0;
    counts[
      new Filter(ObsType.Photo, result.state, null, null).toQueryString()
    ] += result.allRegionFirstPhotos;
  });

  return counts;
}
