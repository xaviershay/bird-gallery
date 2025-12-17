import { Observation, Location, ObsType } from "../types";
import { Filter } from "./filter";
import { parseDbDate } from "../helpers/date_utils";

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
        checklist_id as checklistId,
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
        o1.checklist_id as checklistId,
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
    seenAt: parseDbDate(row.seenAt),
    lastSeenAt: row.lastSeenAt ? parseDbDate(row.lastSeenAt) : null,
  }));
}
