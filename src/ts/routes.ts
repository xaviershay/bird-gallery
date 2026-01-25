import { handleFirsts } from "./controller/firsts";
import { handleLocation } from "./controller/location";
import { handleSpecies } from "./controller/species";
import { respondWith, corsHeaders } from "./controller/base";
import { handleHome } from "./controller/home";
import { handlePhoto } from "./controller/photo";
import { handleReport } from "./controller/report";
import { handleTripReportIndex, handleTripReportShow } from "./controller/trip_report";
import { handleOEmbed } from "./controller/oembed";

// Responses are cached using the current version, which is bumped on every deploy.
// Cache headers are needed for storing in the cache (and in theory could be
// immutable), but need to be stripped before returning to the client because
// the client request doesn't include the version. In other words, from the
// client's perspective these pages aren't cacheable indefinitley because the
// client doesn't know the version, where as the server does.
export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (method !== "GET" && method !== "HEAD") {
      return respondWith(405, { error: "Method not allowed" }, corsHeaders);
    }

    const version = await fetchVersion(env);

    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set("version", version);
    // Create a GET request for caching, regardless of original method
    const cacheKey = new Request(cacheUrl.toString(), {
      ...request,
      method: 'GET'
    });
    const cache = caches.default;

    let response = await cache.match(cacheKey);

    if (response && env.CACHE) {
      // Create new response with original request method
      return createResponseWithoutCache(
        new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        }), 
        version
      );
    } else {
      try {
        response = await handleRequest(request, env);
        // Only cache if it's a GET or HEAD request
        if (method === 'GET' || method === 'HEAD') {
          response.headers.append("Cache-Control", "s-maxage=180");
          // Store the GET version in cache
          ctx.waitUntil(cache.put(cacheKey, response.clone()));
        }
        response.headers.append("Cf-Cache-Status", "MISS");
        return createResponseWithoutCache(response, version);
      } catch (error) {
        console.error("Error processing request:", error);
        return respondWith(
          500,
          {
            error: "Internal server error",
            message: error instanceof Error ? error.message : "Unknown error",
          },
          corsHeaders
        );
      }
    }
  },
};

function createResponseWithoutCache (resp: Response, version: string) {
  const headers = new Headers(resp.headers);
  headers.delete('Cache-Control');
  headers.delete('cache-control');
  headers.append('X-Version', version)
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers
  });
};

async function fetchVersion(env: Env): Promise<string> {
  try {
    const result : any = await env.DB.prepare("SELECT value FROM metadata WHERE id = 'version'").first();
    
    if (result && result.value) {
      return result.value as string;
    } else {
      console.warn("No version found in metadata table");
      return "";
    }
  } catch (error) {
    console.error("Error fetching version:", error);
    return "";
  }
}

async function handleRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.split("/").filter(Boolean);
  if (!path[0]) return handleHome(request, env);

  switch (path[0]) {
    case "firsts":
    case "firsts.json":
    case "firsts.geojson":
      return handleFirsts(request, env);
    case "location":
      return handleLocation(request, env);
    case "species":
      return handleSpecies(request, env);
    case "report":
      return handleReport(request, env);
    case "photo":
      return handlePhoto(request, env);
    case "oembed":
      return handleOEmbed(request, env);
    case "trip-report":
      if (path.length === 1) {
        return handleTripReportIndex(request, env);
      } else {
        return handleTripReportShow(request, env);
      }
    default:
      return respondWith(404, { error: "Not found" }, corsHeaders);
  }
}
