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
    WHERE l.hotspot = 1
    GROUP BY l.id
    ORDER BY lastSeenAt DESC, speciesCount DESC
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

/**
 * Result type for birding opportunities with lifer tags
 */
export interface SpeciesWithTags {
  id: string;
  name: string;
  isLifer: boolean;        // Never seen anywhere
  isPhotoLifer: boolean;   // Seen but not photographed
  isYearLifer: boolean;    // Not seen this year
  isLocationLifer: boolean; // Not seen at this region/location
}

/**
 * Fetch species with lifer tags for birding opportunities report.
 * Returns all species in the database with their lifer status tags.
 * The client will filter to only show species with at least one tag.
 * 
 * @param env - Cloudflare environment
 * @param region - Region filter (e.g., 'AU-VIC-MEL') - used to determine location lifers
 * @param location - Hotspot ID (e.g., 'L919153') - if provided, takes precedence over region
 * @returns List of species with their lifer tags
 */
export async function fetchBirdingOpportunitiesTags(
  env: Env,
  region: string,
  location: string | null
): Promise<SpeciesWithTags[]> {
  // Parse region into state/county for location matching
  // Region format: "AU-VIC" or "AU-VIC-MEL" (country-state or country-state-county)
  const regionParts = region.toUpperCase().split('-');
  const stateCode = regionParts.length >= 2 ? `${regionParts[0]}-${regionParts[1]}` : region;
  const countyName = regionParts.length >= 3 ? regionParts.slice(2).join('-') : null;

  // Build the location condition for "location lifer" check
  // If a specific hotspot location is provided, match by location ID
  // Otherwise, match by region (state and optionally county)
  let locationCondition: string;
  const bindings: (string | number)[] = [];
  
  if (location) {
    // Match by hotspot ID (location ID in our DB is numeric, but eBird uses L-prefixed)
    // We need to strip the 'L' prefix if present
    const locationId = location.startsWith('L') ? location.substring(1) : location;
    locationCondition = `o.location_id = ?`;
    bindings.push(parseInt(locationId, 10));
  } else if (countyName) {
    // Match by state and county (use LIKE for county since eBird uses abbreviations like "MEL" for "Melbourne")
    locationCondition = `UPPER(l.state) = ? AND UPPER(l.county) LIKE ? || '%'`;
    bindings.push(stateCode, countyName);
  } else {
    // Match by state only
    locationCondition = `UPPER(l.state) LIKE ? || '%'`;
    bindings.push(stateCode);
  }
  
  const currentYear = new Date().getFullYear().toString();

  // Query all species with their lifer status
  // We compute the tags directly in SQL for efficiency
  const query = `
    SELECT 
      s.id,
      s.common_name as name,
      -- isLifer: no observations anywhere
      (SELECT COUNT(*) FROM observation WHERE species_id = s.id) = 0 as isLifer,
      -- isPhotoLifer: has observations but no photos
      (SELECT COUNT(*) FROM observation WHERE species_id = s.id) > 0 
        AND (SELECT COUNT(*) FROM observation o2 
             INNER JOIN photo ON o2.id = photo.observation_id 
             WHERE o2.species_id = s.id) = 0 as isPhotoLifer,
      -- isYearLifer: no observations this year
      (SELECT COUNT(*) FROM observation 
       WHERE species_id = s.id 
       AND strftime('%Y', seen_at) = ?) = 0 as isYearLifer,
      -- isLocationLifer: no observations at this location/region
      (SELECT COUNT(*) FROM observation o
       INNER JOIN location l ON o.location_id = l.id
       WHERE o.species_id = s.id 
       AND ${locationCondition}) = 0 as isLocationLifer
    FROM species s
    ORDER BY s.common_name
  `;

  const statement = env.DB.prepare(query).bind(currentYear, ...bindings);
  const result = await statement.all<any>();
  
  return result.results.map((r: any) => ({
    id: r.id,
    name: r.name,
    isLifer: Boolean(r.isLifer),
    isPhotoLifer: Boolean(r.isPhotoLifer),
    isYearLifer: Boolean(r.isYearLifer),
    isLocationLifer: Boolean(r.isLocationLifer),
  }));
}