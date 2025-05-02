import { Env } from "../routes";
import { Photo } from "../types";

export async function fetchPhotos(
  env: Env,
  observationIds: string[]
) : Promise<Photo[]> {
    observationIds = Array.from(new Set(observationIds));

    if (observationIds.length === 0) {
        return [];
    }

    if (observationIds.length > 100) {
        observationIds = observationIds.slice(0, 100);
    }

    const placeholders = observationIds.map(() => '?').join(', ');
    let query = `
      SELECT DISTINCT
        file_name as fileName,
        width,
        height
      FROM photo
      INNER JOIN observation ON observation_id = observation.id
      WHERE 
        observation_id IN (${placeholders})
      ORDER BY
        seen_at DESC
    `;
    let statement = env.DB.prepare(query);
    let results = await statement.bind(...observationIds).all<any>();
    return results.results;
}

export async function fetchDistinctPhotos(
  env: Env,
  observationIds: string[]
) : Promise<Photo[]> {
    observationIds = Array.from(new Set(observationIds));

    if (observationIds.length === 0) {
        return [];
    }

    if (observationIds.length > 100) {
        observationIds = observationIds.slice(0, 100);
    }

    const placeholders = observationIds.map(() => '?').join(', ');
    let query = `
      SELECT 
        file_name as fileName,
        width,
        height
      FROM (
        SELECT 
          file_name,
          width,
          height,
          species_id,
          taken_at,
          ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY taken_at DESC) as row_num
        FROM photo
        INNER JOIN observation ON observation_id = observation.id
        WHERE observation_id IN (${placeholders})
      ) ranked_photos
      WHERE row_num = 1
      ORDER BY taken_at DESC
    `;
    let statement = env.DB.prepare(query);
    let results = await statement.bind(...observationIds).all<any>();
    return results.results;
}

export async function fetchRecentGoodPhotos(env: Env): Promise<Photo[]> {
    const query = `
      SELECT 
        file_name as fileName,
        width,
        height
      FROM photo
      WHERE rating >= 4
      ORDER BY taken_at DESC
      LIMIT 20
    `;
    let statement = env.DB.prepare(query);
    let results = await statement.all<any>();
    return results.results;
}