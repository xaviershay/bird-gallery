export type HeaderStats = {
  seenCount: number,
  photoCount: number
}

export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  const query = `
  SELECT
    (SELECT COUNT(*) FROM species_first_seen) as seenCount,
    (SELECT COUNT(*) FROM species_first_photo) as photoCount
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();

  return result ?? {seenCount: 0, photoCount: 0};
}