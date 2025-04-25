import { Env } from "../index";
import { Observation } from "../types";
import { Filter } from "../model/filter";
import { List } from "../jsx/list.tsx";
import { Layout } from "../jsx/layout.tsx";
import { renderToString } from "react-dom/server";
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name.ts";

export async function handleFirsts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const filter = Filter.fromQueryString(url.searchParams);
  const firsts = await fetchFirsts(env, filter);

  if (url.pathname.endsWith(".json")) {
    // Group records by locationId
    const grouped = firsts.reduce((acc, record) => {
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
    const list = List({ observations: firsts, filter: filter });
    const html = Layout({ content: list });
    return new Response(`<!DOCTYPE html>${renderToString(html)}`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}

async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
  const yearCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : "";
  const regionCondition = filter.region
    ? `AND LOWER(state) LIKE LOWER(?) || '%'`
    : "";
  const query = `
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
          ${yearCondition}
          ${regionCondition}
      ) AS ranked
      WHERE row_num = 1
      ORDER BY seen_at DESC;
    `;
  var statement = env.DB.prepare(query);
  const params: (string | null)[] = [];
  if (filter.period) {
    params.push(filter.period);
  }
  if (filter.region) {
    params.push(filter.region);
  }
  statement = statement.bind(...params);
  const { results } = await statement.all<any>();
  return results.map((record) => ({
    ...record,
    location: {
      id: record.locationId,
      name: record.locationName,
    },
    seenAt: new Date(record.seenAt + "Z"), // Treat seenAt as UTC by appending "Z"
  }));
}
