import { Observation, ObsType } from "../types";
import { Filter } from "../model/filter";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  if (!filter.period && !filter.region && !filter.county) {
    return fetchFirstsUnfiltered(env, filter.type);
  }
  if (filter.period && !filter.region && !filter.county) {
    return fetchFirstsYearFiltered(env, filter.type, filter.period);
  }
  return fetchFirstsFiltered(env, filter);
}

async function fetchFirstsUnfiltered(env: Env, type: ObsType): Promise<Observation[]> {
  const query = type === ObsType.Photo
    ? `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        1 as hasPhoto,
        o.comment
      FROM species_first_photo sfp
      INNER JOIN observation o ON o.id = sfp.first_photo_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `
    : `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        EXISTS(SELECT 1 FROM photo p WHERE p.observation_id = o.id) as hasPhoto,
        o.comment
      FROM species_first_seen sfs
      INNER JOIN observation o ON o.id = sfs.first_seen_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `;
  const statement = env.DB.prepare(query);
  const { results } = await statement.all<any>();
  return results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
    },
    hasPhoto: record.hasPhoto == 1,
    seenAt: parseDbDate(record.seenAt),
  }));
}

async function fetchFirstsYearFiltered(env: Env, type: ObsType, year: string): Promise<Observation[]> {
  const query = type === ObsType.Photo
    ? `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        1 as hasPhoto,
        o.comment
      FROM species_year_first_photo syfp
      INNER JOIN observation o ON o.id = syfp.first_photo_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE syfp.year = ?
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `
    : `
      SELECT
        o.id,
        o.checklist_id as checklistId,
        o.species_id as speciesId,
        sp.common_name as name,
        o.location_id as locationId,
        l.name as locationName,
        l.lat,
        l.lng,
        o.seen_at as seenAt,
        EXISTS(SELECT 1 FROM photo p WHERE p.observation_id = o.id) as hasPhoto,
        o.comment
      FROM species_year_first_seen syfs
      INNER JOIN observation o ON o.id = syfs.first_seen_observation_id
      INNER JOIN species sp ON sp.id = o.species_id
      INNER JOIN location l ON l.id = o.location_id
      WHERE syfs.year = ?
      ORDER BY o.seen_at DESC, sp.common_name ASC;
    `;
  const statement = env.DB.prepare(query).bind(year);
  const { results } = await statement.all<any>();
  return results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
    },
    hasPhoto: record.hasPhoto == 1,
    seenAt: parseDbDate(record.seenAt),
  }));
}

async function fetchFirstsFiltered(env: Env, filter: Filter): Promise<Observation[]> {
  const yearCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : "";
  const regionCondition = filter.region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'
    `
    : "";
  const countyCondition = filter.county ? `AND LOWER(county) = LOWER(?)` : "";
  const photoCondition = filter.type == ObsType.Photo ? "AND has_photo" : "";
  const query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt,
        has_photo as hasPhoto,
        comment
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${yearCondition}
          ${regionCondition}
          ${countyCondition}
          ${photoCondition}
      ) AS ranked
      WHERE row_num = 1
      ORDER BY seen_at DESC, name ASC;
    `;
  let statement = env.DB.prepare(query);
  const params: (string | null)[] = [];
  if (filter.period) {
    params.push(filter.period);
  }
  if (filter.region) {
    params.push(filter.region);
  }
  if (filter.county) {
    params.push(filter.county);
  }
  statement = statement.bind(...params);
  const { results } = await statement.all<any>();
  return results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
    },
    hasPhoto: record.hasPhoto == 1,
    seenAt: parseDbDate(record.seenAt),
  }));
}