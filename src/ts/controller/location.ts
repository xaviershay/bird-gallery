import { Env } from "../index";
import { Observation, Location } from "../types";
import { Filter } from "../model/filter";
import { LocationView } from "../jsx/location.tsx";
import { Layout } from "../jsx/layout.tsx";
import { renderToString } from "react-dom/server";
import { respondWith, corsHeaders } from "./base";

export async function handleLocation(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const locationId = parseInt(url.pathname.split('/').pop() ?? '');
  
  if (!locationId) {
    return respondWith(400, { error: "Missing location ID" }, corsHeaders);
  }
  
  const filter = Filter.fromQueryString(url.searchParams);
  const location = await fetchLocation(env, locationId);
  
  if (!location) {
    return respondWith(404, { error: "Location not found" }, corsHeaders);
  }
  
  const observations = await fetchLocationObservations(env, locationId, filter);

  if (url.pathname.endsWith(".json")) {
    return respondWith(200, { location, observations }, corsHeaders);
  } else {
    const content = LocationView({ location, observations, filter });
    const html = Layout({ content });
    return new Response(`<!DOCTYPE html>${renderToString(html)}`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}

async function fetchLocation(
  env: Env,
  locationId: number
): Promise<Location | null> {
  try {
    const query = `
      SELECT 
        id,
        name,
        lat,
        lng
      FROM location
      WHERE id = ?
      LIMIT 1;
    `;
    
    const statement = env.DB.prepare(query);
    const result = await statement.bind(locationId).first<any>();
    
    if (!result) {
      return null;
    }
    
    return {
      id: result.id,
      name: result.name,
      lat: result.lat,
      lng: result.lng
    };
  } catch (error) {
    console.error("Error fetching location:", error);
    return null;
  }
}

async function fetchLocationObservations(
  env: Env,
  locationId: number,
  filter: Filter
): Promise<Observation[]> {
  const periodCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : "";
  
  let query = '';
  const params: (number | string)[] = [];
  
  if (filter.blah == "firsts") {
    // Only birds first seen at this location
    query = `
      SELECT
        id,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
        lat,
        lng,
        seen_at as seenAt,
        seen_at as lastSeenAt -- TODO
      FROM (
        SELECT *, ROW_NUMBER() OVER (PARTITION BY species_id ORDER BY seen_at ASC) AS row_num
        FROM observation_wide
        WHERE 1=1
          ${periodCondition}
      ) AS ranked
      WHERE row_num = 1
        AND location_id = ?
      ORDER BY seen_at DESC;
    `;
    if (filter.period) {
      params.push(filter.period);
    }
    params.push(locationId)
  } else {
    // All birds seen at this location with first and last observation
    query = `
      SELECT
        o1.id,
        o1.species_id as speciesId,
        o1.common_name as name,
        o1.location_id as locationId,
        o1.lat,
        o1.lng,
        o1.seen_at as seenAt,
        (SELECT MAX(seen_at) FROM observation_wide o2 
         WHERE o2.species_id = o1.species_id 
         AND o2.location_id = o1.location_id
         ${periodCondition}
        ) as lastSeenAt
      FROM observation_wide o1
      WHERE o1.location_id = ?
        ${periodCondition}
      GROUP BY o1.species_id
      ORDER BY o1.seen_at DESC;
    `;
  
    if (filter.period) {
      params.push(filter.period);
    }
    params.push(locationId)
    if (filter.period) {
      params.push(filter.period);
    }
  }
  
  console.log(params);
  const statement = env.DB.prepare(query);
  const result = await statement.bind(...params).all<any>();
  
  return result.results.map((row: any) => ({
    ...row,
    seenAt: new Date(row.seenAt),
    lastSeenAt: new Date(row.lastSeenAt)
  }));
}