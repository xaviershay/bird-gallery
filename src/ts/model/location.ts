import { Observation, Location, ObsType } from "../types";
import { Filter } from "./filter";

export async function fetchLocation(
  env: Env,
  locationId: number
): Promise<Location | null> {
  try {
    const query = `
      SELECT
        id,
        name,
        lat,
        lng
      FROM location
      WHERE id = ?
      LIMIT 1;
    `;

    const statement = env.DB.prepare(query);
    const result = await statement.bind(locationId).first<any>();

    if (!result) {
      return null;
    }

    return {
      id: result.id,
      name: result.name,
      lat: result.lat,
      lng: result.lng,
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    return null;
  }
}

export async function fetchLocationObservations(
  env: Env,
  locationId: number,
  filter: Filter
): Promise<Observation[]> {
  const periodCondition = filter.period
    ? `AND strftime('%Y', seen_at) = ?`
    : "";

  let query = "";
  const params: (number | string)[] = [];

  if (filter.view == "firsts") {
    // Only birds first seen at this location
    query = `
      SELECT
        id,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        lat,
        lng,
        seen_at as seenAt,
        seen_at as lastSeenAt -- TODO
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${periodCondition}
          ${filter.type === ObsType.Photo ? "AND has_photo" : ""}
      ) AS ranked
      WHERE row_num = 1
        AND location_id = ?
      ORDER BY seen_at DESC, name ASC;
    `;
    if (filter.period) {
      params.push(filter.period);
    }
    params.push(locationId);
  } else {
    // All birds seen at this location
    query = `
      SELECT
        o1.id,
        o1.species_id as speciesId,
        o1.common_name as name,
        o1.location_id as locationId,
        o1.lat,
        o1.lng,
        o1.seen_at as seenAt
      FROM observation_wide o1
      WHERE o1.location_id = ?
        ${periodCondition}
        ${filter.type === ObsType.Photo ? "AND o1.has_photo" : ""}
      GROUP BY o1.species_id
      ORDER BY o1.seen_at DESC, o1.common_name ASC;
    `;
    params.push(locationId);
    if (filter.period) {
      params.push(filter.period);
    }
  }

  const statement = env.DB.prepare(query);
  const result = await statement.bind(...params).all<any>();

  return result.results.map((row: any) => ({
    ...row,
    seenAt: new Date(row.seenAt),
    lastSeenAt: new Date(row.lastSeenAt),
  }));
}

export async function fetchLocationFilterCounts(
  locationId: number,
  env: Env
): Promise<Record<string, number>> {
  let counts: Record<string, number> = {};
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
