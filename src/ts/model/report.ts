import { Species } from "../types";

export async function fetchSpeciesMissingPhotos(
  env: Env,
  region: string | null
): Promise<Species[]> {
  if (region === "all")
    region = null;

  const regionCondition = region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'`
    : "";
  let query = `
    SELECT DISTINCT
        species.id,
        species.common_name as name
    FROM species
    INNER JOIN observation_wide ON species.id = observation_wide.species_id
    ${regionCondition}
    WHERE NOT has_photo
    AND species.id NOT IN (
        SELECT DISTINCT species_id FROM photo INNER JOIN observation ON photo.observation_id = observation.id
    )
    ORDER BY name
  `;

  let statement = env.DB.prepare(query);
  if (region)
    statement = statement.bind(region);
  const result = await statement.all<Species>();
  
  return result.results;
}