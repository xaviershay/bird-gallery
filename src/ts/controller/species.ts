import { Observation, Photo, Species } from "../types";
import { SpeciesView } from "../view/species";
import { LayoutView } from "../view/layout";
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name";
import { fetchHeaderStats } from "../model/header_stats";
import { prerender } from "react-dom/static";

export async function handleSpecies(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const pathSegment = url.pathname.split("/").pop() || "";
  const speciesId = pathSegment.includes(".")
    ? pathSegment.substring(0, pathSegment.lastIndexOf("."))
    : pathSegment;

  if (!speciesId) {
    return respondWith(400, { error: "Missing species ID" }, corsHeaders);
  }

  const species = await fetchSpecies(env, speciesId);

  if (!species) {
    return respondWith(404, { error: "Species not found" }, corsHeaders);
  }

  const observations = await fetchSpeciesObservations(env, speciesId);

  if (url.pathname.endsWith(".geojson")) {
    // Group records by locationId
    const grouped = observations.reduce((acc, record) => {
      if (!acc[record.locationId]) {
        acc[record.locationId] = [];
      }
      acc[record.locationId].push(record);
      return acc;
    }, {} as Record<string, Observation[]>);

    var jsonData = {
      type: "FeatureCollection",
      features: Object.entries(grouped).map(([locationId, os]) => {
        const obs = os[0];
        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [obs.lng, obs.lat],
          },
          properties: {
            locationId: locationId,
            name: formatLocationName(obs.location.name),
            count: os.length,
          },
        };
      }),
    };

    return respondWith(200, jsonData, corsHeaders);
  } else {
    const header = await fetchHeaderStats(env);
    const title = species.name + " - Xavier's Bird Lists";
    const content = SpeciesView({ species, observations });
    const html = LayoutView({ title, content, header });
    const htmlStream = await prerender(html);
    return new Response(htmlStream.prelude, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}

async function fetchSpecies(
  env: Env,
  speciesId: string
): Promise<Species | null> {
  try {
    var query = `
      SELECT 
        id,
        common_name as name
      FROM species
      WHERE id = ?
      LIMIT 1;
    `;

    var statement = env.DB.prepare(query);
    var result = await statement.bind(speciesId).first<any>();

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

async function fetchSpeciesObservations(
  env: Env,
  speciesId: string
): Promise<Observation[]> {
  let query = "";
  const params: (number | string)[] = [];

  query = `
      SELECT
        id,
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
      ORDER BY seen_at DESC;
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
    seenAt: new Date(row.seenAt),
  }));
}
