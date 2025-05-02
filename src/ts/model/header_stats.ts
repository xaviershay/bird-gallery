import { Env } from "../routes";

export type HeaderStats = {
  seenCount: number,
  photoCount: number
}

export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  let query = `
  SELECT
    COUNT(distinct species_id) as seenCount,
    COUNT(distinct CASE WHEN has_photo THEN species_id ELSE NULL END) as photoCount
  FROM observation_wide
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();
  
  return result ?? {seenCount: 0, photoCount: 0};
}