import { ObsType } from "../types";
import { Filter } from "./filter";

/**
 * Helper function to process year-grouped results and populate counts
 */
function processYearGroupedResults(
  results: any[],
  obsType: ObsType,
  counts: Record<string, number>,
  additionalFilters: { view?: string } = {}
) {
  results.forEach((result) => {
    const sightingsKey = Filter.create({
      type: obsType,
      period: result.year,
      ...additionalFilters
    }).toQueryString();

    if (obsType === ObsType.Sighting) {
      counts[sightingsKey] = result.allSightings;
      if (additionalFilters.view === "firsts") {
        counts[sightingsKey] = result.allFirstSightings;
      }
    } else {
      counts[sightingsKey] = result.allPhotos;
      if (additionalFilters.view === "firsts") {
        counts[sightingsKey] = result.allFirstPhotos;
      }
    }
  });
}

/**
 * Fetches filter counts for the global "firsts" page
 * Includes region, county, and period breakdowns
 */
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

/**
 * Fetches filter counts for a specific location page
 * Includes period breakdowns and "firsts" vs regular view counts
 */
export async function fetchLocationFilterCounts(
  locationId: number,
  env: Env
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  // Query 1: Overall counts (all time) for sightings and photos
  let query = `
      SELECT
        COUNT(DISTINCT species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN has_photo THEN species_id END) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstSightings,
        COUNT(CASE WHEN has_photo AND row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
      )
      WHERE location_id = ?
    `;

  let statement = env.DB.prepare(query);
  let result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Sighting }).toQueryString()] =
    result.allSightings;
  counts[Filter.create({ type: ObsType.Sighting, view: "firsts" }).toQueryString()] =
    result.allFirstSightings;

  // Query 2: Photo-only overall counts
  query = `
      SELECT
        COUNT(DISTINCT species_id) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE has_photo
      )
      WHERE
        location_id = ?
    `;

  statement = env.DB.prepare(query);
  result = await statement.bind(locationId).first<any>();

  counts[Filter.create({ type: ObsType.Photo }).toQueryString()] =
    result.allPhotos;
  counts[Filter.create({ type: ObsType.Photo, view: "firsts" }).toQueryString()] =
    result.allFirstPhotos;

  // Query 3: Year-grouped sightings counts
  query = `
      SELECT
        STRFTIME("%Y", seen_at) as year,
        COUNT(DISTINCT species_id) as allSightings,
        COUNT(DISTINCT CASE WHEN has_photo THEN species_id END) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstSightings,
        COUNT(CASE WHEN has_photo AND row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME("%Y", seen_at) ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
      )
      WHERE location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  let results = await statement.bind(locationId).all<any>();

  results.results.forEach((result : any) => {
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year }).toQueryString()
    ] = result.allSightings;
    counts[
      Filter.create({ type: ObsType.Sighting, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstSightings;
  });

  // Query 4: Year-grouped photo counts
  query = `
      SELECT
        STRFTIME("%Y", seen_at) as year,
        COUNT(DISTINCT species_id) as allPhotos,
        COUNT(CASE WHEN row_num = 1 THEN 1 END) as allFirstPhotos
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id, STRFTIME("%Y", seen_at) ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE has_photo
      )
      WHERE location_id = ?
      GROUP BY 1
    `;
  statement = env.DB.prepare(query);
  results = await statement.bind(locationId).all<any>();

  results.results.forEach((result : any) => {
    counts[Filter.create({ type: ObsType.Photo, period: result.year }).toQueryString()] =
      result.allPhotos;
    counts[
      Filter.create({ type: ObsType.Photo, period: result.year, view: "firsts" }).toQueryString()
    ] = result.allFirstPhotos;
  });

  return counts;
}
