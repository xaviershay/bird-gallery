import { ObsType } from "../types";
import { Filter } from "./filter";

export async function fetchGlobalFilterCounts(env: Env): Promise<Record<string, number>> {
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
  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] = 0;
  results.results.forEach((result) => {
    counts[
      Filter.create({
        type: ObsType.Sighting,
        region: result.state,
        period: result.year
      }).toQueryString()
    ] = result.allRegionFirstSightings;
    counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] +=
      result.allFirstSightings;
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year }).toQueryString()
    ] ||= 0;
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year }).toQueryString()
    ] += result.allFirstSightings;
    counts[
      Filter.create({ type: ObsType.Sighting, region: result.state }).toQueryString()
    ] ||= 0;
    counts[
      Filter.create({ type: ObsType.Sighting, region: result.state }).toQueryString()
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

  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] = 0;
  results.results.forEach((result) => {
    counts[
      Filter.create({ type: ObsType.Photo, region: result.state, period: result.year }).toQueryString()
    ] = result.allRegionFirstPhotos;
    counts[Filter.create({ type: ObsType.Photo }).toQueryString()] +=
      result.allFirstPhotos;
    counts[
      Filter.create({ type: ObsType.Photo, period: result.year }).toQueryString()
    ] ||= 0;
    counts[
      Filter.create({ type: ObsType.Photo, period: result.year }).toQueryString()
    ] += result.allFirstPhotos;
    counts[
      Filter.create({ type: ObsType.Photo, region: result.state }).toQueryString()
    ] ||= 0;
    counts[
      Filter.create({ type: ObsType.Photo, region: result.state }).toQueryString()
    ] += result.allRegionFirstPhotos;
  });

  // County = Melbourne (sightings)
  query = `
      SELECT
        year,
        COUNT(*) as allSightings,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allCountyFirstSightings
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY species_id, year ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE LOWER(county) = 'melbourne'
      )
      GROUP BY year
    `;
  statement = env.DB.prepare(query);
  results = await statement.bind().all<any>();

  // Seed zero for overall melbourne counts
  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] ||= 0;
  let melbourneSightingsTotal = 0;
  results.results.forEach((result) => {
    counts[
      Filter.create({ type: ObsType.Sighting, county: "melbourne", period: result.year }).toQueryString()
    ] = result.allCountyFirstSightings;
    melbourneSightingsTotal += result.allCountyFirstSightings;
  });
  counts[
    Filter.create({ type: ObsType.Sighting, county: "melbourne" }).toQueryString()
  ] = melbourneSightingsTotal;

  // County = Melbourne (photos)
  query = `
      SELECT
        year,
        COUNT(*) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allCountyFirstPhotos
      FROM (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY species_id, year ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE has_photo AND LOWER(county) = 'melbourne'
      )
      GROUP BY year
    `;
  statement = env.DB.prepare(query);
  results = await statement.bind().all<any>();

  let melbournePhotosTotal = 0;
  results.results.forEach((result) => {
    counts[
      Filter.create({ type: ObsType.Photo, county: "melbourne", period: result.year }).toQueryString()
    ] = result.allCountyFirstPhotos;
    melbournePhotosTotal += result.allCountyFirstPhotos;
  });
  counts[
    Filter.create({ type: ObsType.Photo, county: "melbourne" }).toQueryString()
  ] = melbournePhotosTotal;

  return counts;
}
