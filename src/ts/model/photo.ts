import { Env } from "../routes";
import { Observation, Photo, Species } from "../types";
import { parseDbDate } from "../helpers/date_utils";


export async function fetchPhoto(
  env: Env,
  photoId: string
): Promise<{photo: Photo, observation: Observation} | null> {
  const query = `
    SELECT
      photo.file_name,
      photo.width,
      photo.height,
      photo.taken_at,
      photo.rating,
      photo.iso,
      photo.fnumber,
      photo.exposure,
      photo.zoom,
      photo.tags,
      photo.camera,
      photo.lens,
      observation_wide.id AS observation_id,
      observation_wide.species_id,
      observation_wide.common_name,
      observation_wide.location_id,
      observation_wide.location_name,
      observation_wide.lat,
      observation_wide.lng,
      observation_wide.seen_at
    FROM
      photo INNER JOIN observation_wide ON observation_id = observation_wide.id 
    WHERE
      file_name = ?
  `

  let statement = env.DB.prepare(query);
  let result = await statement.bind(photoId + '.jpg').first<any>();
  if (!result) {
    return null
  }
  return {
    photo: {
      fileName: result.file_name,
      width: result.width,
      height: result.height,
      commonName: result.common_name,
      takenAt: parseDbDate(result.taken_at),
      rating: result.rating,
      iso: result.iso,
      fNumber: result.fnumber,
      exposure: result.exposure,
      zoom: result.zoom,
      tags: result.tags,
      camera: result.camera,
      lens: result.lens
    },
    observation: {
      id: result.observation_id,
      speciesId: result.species_id,
      name: result.common_name,
      locationId: result.location_id,
      location: {
        id: result.location_id,
        name: result.location_name,
        lat: result.lat,
        lng: result.lng
      },
      seenAt: result.seen_at,
      lat: result.lat,
      lng: result.lng,
      hasPhoto: true
    }
  }
}
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
        height,
        common_name as commonName
      FROM photo
      INNER JOIN observation_wide ON observation_id = observation_wide.id
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
        height,
        common_name as commonName
      FROM (
        SELECT 
          file_name,
          width,
          height,
          species_id,
          taken_at,
          common_name,
          ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY taken_at DESC) as row_num
        FROM photo
        INNER JOIN observation_wide ON observation_id = observation_wide.id
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
        height,
        common_name as commonName
      FROM photo
      INNER JOIN observation_wide ON observation_id = observation_wide.id
      WHERE rating >= 3
      ORDER BY taken_at DESC
      LIMIT 20
    `;
    let statement = env.DB.prepare(query);
    let results = await statement.all<any>();
    return results.results;
}

export async function fetchAllPhotos(env: Env): Promise<Photo[]> {
    const query = `
      SELECT
        file_name as fileName,
        width,
        height,
        common_name as commonName,
        rating
      FROM photo
      INNER JOIN observation_wide ON observation_id = observation_wide.id
      ORDER BY taken_at DESC
    `;
    let statement = env.DB.prepare(query);
    let results = await statement.all<any>();
    return results.results;
}