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
    0 as photoCount
  FROM observation_wide
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();
  
  return result ?? {seenCount: 0, photoCount: 0};
}