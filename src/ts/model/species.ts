import { Observation, Photo, Species } from "../types";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchSpecies(
  env: Env,
  speciesId: string
): Promise<Species | null> {
  try {
    let query = `
      SELECT
        id,
        common_name as name
      FROM species
      WHERE id = ?
      LIMIT 1;
    `;

    let statement = env.DB.prepare(query);
    const result = await statement.bind(speciesId).first<any>();

    if (!result) {
      return null;
    }

    query = `
      SELECT DISTINCT
        file_name as fileName,
        width,
        height,
        common_name as commonName
      FROM photo
      INNER JOIN observation_wide ON observation_id = observation_wide.id
      WHERE
        species_id = ?
      ORDER BY
        taken_at DESC
    `
    statement = env.DB.prepare(query);
    const photos = await statement.bind(speciesId).all<Photo>();

    return {
      id: result.id,
      name: result.name,
      photos: photos.results
    };
  } catch (error) {
    console.error("Error fetching species:", error);
    return null;
  }
}

export async function fetchSpeciesObservations(
  env: Env,
  speciesId: string
): Promise<Observation[]> {
  let query = "";
  const params: (number | string)[] = [];

  query = `
      SELECT
        id,
        checklist_id as checklistId,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        location_name as locationName,
        lat,
        lng,
        seen_at as seenAt
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
      ) AS ranked
      WHERE 1=1
        AND species_id = ?
      ORDER BY seen_at DESC, name ASC;
    `;
  params.push(speciesId);

  const statement = env.DB.prepare(query);
  const result = await statement.bind(...params).all<any>();

  return result.results.map((row: any) => ({
    ...row,
    location: {
      id: row.locationId,
      name: row.locationName,
    },
    seenAt: parseDbDate(row.seenAt),
  }));
}
