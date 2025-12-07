import { Observation, ObsType } from "../types";
import { Filter } from "../model/filter";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
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