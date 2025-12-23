import { TripReport, TripReportStats, Observation, Photo } from "../types";
import { parseDbDate } from "../helpers/date_utils";

export async function fetchAllTripReports(env: Env): Promise<TripReport[]> {
  const query = `
    SELECT
      id,
      title,
      description,
      start_date as startDate,
      end_date as endDate,
      created_at as createdAt
    FROM trip_report
    ORDER BY start_date DESC;
  `;
  const result = await env.DB.prepare(query).all<any>();
  return result.results.map((row) => ({
    ...row,
    startDate: parseDbDate(row.startDate),
    endDate: parseDbDate(row.endDate),
    createdAt: parseDbDate(row.createdAt),
  }));
}

export async function fetchTripReportById(env: Env, id: string): Promise<TripReport | null> {
  const query = `
    SELECT
      id,
      title,
      description,
      start_date as startDate,
      end_date as endDate,
      created_at as createdAt
    FROM trip_report
    WHERE id = ?;
  `;
  const result = await env.DB.prepare(query).bind(id).first<any>();
  if (!result) return null;

  return {
    ...result,
    startDate: parseDbDate(result.startDate),
    endDate: parseDbDate(result.endDate),
    createdAt: parseDbDate(result.createdAt),
  };
}

export async function fetchTripReportStats(env: Env, id: string): Promise<TripReportStats> {
  const statsQuery = `
    SELECT
      COUNT(DISTINCT species_id) as totalSpecies,
      COUNT(DISTINCT observation.id) as totalObservations,
      COUNT(DISTINCT trc.checklist_id) as totalChecklists,
      COUNT(DISTINCT location_id) as totalLocations
    FROM trip_report_checklist trc
    INNER JOIN observation ON trc.checklist_id = observation.checklist_id
    WHERE trc.trip_report_id = ?;
  `;
  const statsResult = await env.DB.prepare(statsQuery).bind(id).first<any>();

  // Calculate firsts seen
  const firstsSeenQuery = `
    SELECT COUNT(*) as count
    FROM (
      SELECT species_id, MIN(seen_at) as first_seen
      FROM observation
      GROUP BY species_id
    ) all_firsts
    INNER JOIN trip_report_observation tro
      ON all_firsts.species_id = tro.species_id
      AND all_firsts.first_seen = tro.seen_at
    WHERE tro.trip_report_id = ?;
  `;
  const firstsSeenResult = await env.DB.prepare(firstsSeenQuery).bind(id).first<any>();

  // Calculate firsts photographed
  const firstsPhotographedQuery = `
    SELECT COUNT(*) as count
    FROM (
      SELECT species_id, MIN(seen_at) as first_photo
      FROM observation_wide
      WHERE has_photo = 1
      GROUP BY species_id
    ) all_first_photos
    INNER JOIN trip_report_observation tro
      ON all_first_photos.species_id = tro.species_id
      AND all_first_photos.first_photo = tro.seen_at
    WHERE tro.trip_report_id = ?
      AND tro.has_photo = 1;
  `;
  const firstsPhotographedResult = await env.DB.prepare(firstsPhotographedQuery).bind(id).first<any>();

  return {
    totalSpecies: statsResult?.totalSpecies || 0,
    totalObservations: statsResult?.totalObservations || 0,
    totalChecklists: statsResult?.totalChecklists || 0,
    totalLocations: statsResult?.totalLocations || 0,
    firstsSeen: firstsSeenResult?.count || 0,
    firstsPhotographed: firstsPhotographedResult?.count || 0,
  };
}

export async function fetchTripReportObservations(env: Env, id: string): Promise<Observation[]> {
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
    FROM trip_report_observation
    WHERE trip_report_id = ?
    ORDER BY seen_at DESC, common_name ASC;
  `;
  const result = await env.DB.prepare(query).bind(id).all<any>();
  return result.results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
      lat: record.lat,
      lng: record.lng,
    },
    hasPhoto: record.hasPhoto == 1,
    seenAt: parseDbDate(record.seenAt),
  }));
}

export async function fetchTripReportPhotos(env: Env, id: string): Promise<Photo[]> {
  const query = `
    SELECT
      photo.file_name as fileName,
      tro.common_name as commonName,
      photo.taken_at as takenAt,
      photo.height,
      photo.width,
      photo.rating,
      photo.iso,
      photo.fnumber as fNumber,
      photo.exposure,
      photo.zoom,
      photo.tags,
      photo.camera,
      photo.lens
    FROM trip_report_observation tro
    INNER JOIN photo ON tro.id = photo.observation_id
    WHERE tro.trip_report_id = ?
    ORDER BY photo.rating DESC, photo.taken_at DESC;
  `;
  const result = await env.DB.prepare(query).bind(id).all<any>();
  return result.results.map((record) => ({
    ...record,
    takenAt: parseDbDate(record.takenAt),
  }));
}
