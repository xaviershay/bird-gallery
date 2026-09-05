export type HeaderStats = {
  seenCount: number,
  photoCount: number
}

export async function fetchHeaderStats(
  env: Env,
): Promise<HeaderStats> {
  const query = `
  SELECT
    COALESCE(MAX(CASE WHEN id = 'header_seen_count' THEN CAST(value AS INTEGER) END), 0) as seenCount,
    COALESCE(MAX(CASE WHEN id = 'header_photo_count' THEN CAST(value AS INTEGER) END), 0) as photoCount
  FROM metadata
  WHERE id IN ('header_seen_count', 'header_photo_count')
  `;

  const statement = env.DB.prepare(query);
  const result = await statement.first<HeaderStats>();

  return result ?? {seenCount: 0, photoCount: 0};
}