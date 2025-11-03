import { Observation, Species } from "../types";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchSpeciesMissingPhotos(
  env: Env,
  region: string | null,
  county: string | null
): Promise<Species[]> {
  if (region === "all")
    region = null;

  const regionCondition = region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'`
    : "";
  const countyCondition = county
    ? `AND LOWER(county) = LOWER(?)`
    : "";
  let query = `
    SELECT DISTINCT
        species.id,
        species.common_name as name
    FROM species
    INNER JOIN observation_wide ON species.id = observation_wide.species_id
    ${regionCondition}
    ${countyCondition}
    WHERE NOT has_photo
    AND species.id NOT IN (
        SELECT DISTINCT species_id FROM photo INNER JOIN observation ON photo.observation_id = observation.id
    )
    ORDER BY name
  `;

  let statement = env.DB.prepare(query);
  if (region)
    statement = statement.bind(region);
  else if (county)
    statement = statement.bind(county);
  const result = await statement.all<Species>();
  
  return result.results;
}

export interface LocationSummary {
  id: number;
  name: string;
  lat: number;
  lng: number;
  speciesCount: number;
  lastSeenAt: Date;
}

/**
 * Fetch a summary of locations with the number of unique species seen
 * and the last time anything was seen there.
 */
export async function fetchLocationsSummary(env: Env): Promise<LocationSummary[]> {
  const query = `
    SELECT
      l.id AS id,
      l.name AS name,
      l.lat AS lat,
      l.lng AS lng,
      COUNT(DISTINCT o.species_id) AS speciesCount,
      MAX(o.seen_at) AS lastSeenAt
    FROM observation o
    INNER JOIN location l ON l.id = o.location_id
    GROUP BY l.id
    ORDER BY speciesCount DESC, lastSeenAt DESC
  `;

  const { results } = await env.DB.prepare(query).all<any>();
  return results.map((row: any) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    speciesCount: row.speciesCount,
    lastSeenAt: parseDbDate(row.lastSeenAt),
  }));
}

/**
 * Returns one Observation-like row per (location, species), suitable for
 * feeding into observationsToGeoJSON to produce one circle per location
 * with the count equal to unique species at that location.
 */
export async function fetchUniqueSpeciesByLocationObservations(env: Env): Promise<Observation[]> {
  const query = `
    SELECT
      MIN(o.id) AS id,
      o.species_id AS speciesId,
      s.common_name AS name,
      o.location_id AS locationId,
      l.name AS locationName,
      l.lat AS lat,
      l.lng AS lng,
      MAX(o.seen_at) AS seenAt
    FROM observation o
    INNER JOIN species s ON s.id = o.species_id
    INNER JOIN location l ON l.id = o.location_id
    GROUP BY o.location_id, o.species_id
  `;

  const { results } = await env.DB.prepare(query).all<any>();
  return results.map((r: any) => ({
    id: String(r.id ?? `${r.locationId}-${r.speciesId}`),
    speciesId: r.speciesId,
    name: r.name,
    locationId: String(r.locationId),
    location: { id: r.locationId, name: r.locationName, lat: r.lat, lng: r.lng },
    seenAt: parseDbDate(r.seenAt),
    lat: r.lat,
    lng: r.lng,
    hasPhoto: false,
  }));
}