import { ListType, Observation } from './types';
import { Filter } from './model/filter'
import {List} from './jsx/list.tsx';
import {Layout} from './jsx/layout.tsx';
import { renderToString } from "react-dom/server";

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split('/').filter(Boolean);
    const method = request.method;

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle OPTIONS requests for CORS
    if (method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      // Route handling
      if (path.length === 0) {
        const queryParams = url.searchParams;
        const filter = new Filter(
          queryParams.get('type') === 'list' ? ListType.List : ListType.Photos,
          queryParams.get('region') === 'world' ? null : queryParams.get('region'),
          queryParams.get('period') === 'life' ? null : queryParams.get('period')
        );

        var records = await fetchFirsts(env, filter);
        var data = {
          filter: filter,
          observations: records
          /*
          observations: [
            {id: 123, slug: 'robin', name: 'Robin', locationId: 'L123', lat: 0, lng: 0, createdAt: new Date("2025-04-20")},
            {id: 1235, slug: 'starling', name: 'Starling', locationId: 'L123', lat: 0, lng: 0, createdAt: new Date("2025-04-18")},
          ],
          */
        };
        const layoutPage = {
          content: List(data),
          filter: filter,
        };

        var output = renderToString(Layout(layoutPage));

        return new Response(output, {
          status: 200,
          headers: {
            'Content-Type': 'text/html',
            ...corsHeaders,
          },
        });
      }

      if (path[0] === 'firsts.json') {
        const queryParams = url.searchParams;
        const filter = new Filter(
          queryParams.get('type') === 'list' ? ListType.List : ListType.Photos,
          queryParams.get('region') === 'world' ? null : queryParams.get('region'),
          queryParams.get('period') === 'life' ? null : queryParams.get('period')
        );

        var records = await fetchFirsts(env, filter);

        // Group records by locationId
        const grouped = records.reduce((acc, record) => {
          if (!acc[record.locationId]) {
            acc[record.locationId] = [];
          }
          acc[record.locationId].push(record);
          return acc;
        }, {} as Record<string, Observation[]>);

        var jsonData = {
          "type": "FeatureCollection",
          "features": Object.entries(grouped).map(([location, os]) => {
            const obs = os[0];
            return {
              "type": "Feature",
              "geometry": {
                "type": "Point",
                "coordinates": [obs.lng, obs.lat]
              },
              "properties": {
                "locationId": obs.locationId,
                "name": location
                  .replace(/\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/g, '')
                  .replace(/--/g, ': ')
                  .trim(),
                "count": os.length
              }
            };
          })
        };

        return respondWith(200, jsonData, corsHeaders);
      }

      /*
      if (path[0] === 'items') {
        if (path.length === 1) {
          // /items endpoint
          switch (method) {
            case 'GET':
              return fetchAllItems(env);
            case 'POST':
              return createItem(request, env);
            default:
              return respondWith(405, { error: 'Method not allowed' }, corsHeaders);
          }
        } else if (path.length === 2) {
          // /items/:id endpoint
          const itemId = path[1];
          switch (method) {
            case 'GET':
              return fetchItem(itemId, env);
            default:
              return respondWith(405, { error: 'Method not allowed' }, corsHeaders);
          }
        }
      }
      */

      // If we get here, the route was not found
      return respondWith(404, { error: 'Not found' }, corsHeaders);

    } catch (error) {
      console.error('Error processing request:', error);
      return respondWith(
        500,
        { error: 'Internal server error', message: error instanceof Error ? error.message : 'Unknown error' },
        corsHeaders
      );
    }
  },
};

// Helper function to create a JSON response
function respondWith(status: number, body: object, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// Fetch all items from the database
async function fetchFirsts(env: Env, filter: Filter): Promise<Observation[]> {
    const yearCondition = filter.period ? `AND strftime('%Y', seen_at) = ?` : '';
    const regionCondition = filter.region ? `AND LOWER(state) LIKE LOWER(?) || '%'` : '';
    const query = `
      SELECT
        id,
        species_id as speciesId,
        common_name as name,
        location_id as locationId,
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
    const { results } = await statement.all<Observation>();
    return results.map(record => ({
        ...record,
        seenAt: new Date(record.seenAt + 'Z'), // Treat seenAt as UTC by appending "Z"
    }));
}