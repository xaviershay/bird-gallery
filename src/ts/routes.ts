import { handleFirsts } from "./controller/firsts";
import { handleLocation } from "./controller/location";
import { handleSpecies } from "./controller/species";
import { respondWith, corsHeaders } from "./controller/base";
import { handleHome } from "./controller/home";
import { handlePhoto } from "./controller/photo";

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

    const version = await fetchVersion(env);

    const cacheUrl = new URL(request.url);
    cacheUrl.searchParams.set("version", version);
    const cacheKey = new Request(cacheUrl.toString(), request);
    const cache = caches.default;

    let response = await cache.match(cacheKey);

    if (response && env.CACHE) {
      return createResponseWithoutCache(response);
    } else {
      try {
        response = await handleRequest(request, env);
        response.headers.append("Cache-Control", "s-maxage=180");
        ctx.waitUntil(cache.put(cacheKey, response.clone()));
        response.headers.append("Cf-Cache-Status", "MISS");
        return createResponseWithoutCache(response);
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

function createResponseWithoutCache (resp: Response) {
  const headers = new Headers(resp.headers);
  headers.delete('Cache-Control');
  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers
  });
};

async function fetchVersion(env: Env): Promise<string> {
  try {
    // Query for the version in the metadata table
    const result : any = await env.DB.prepare("SELECT value FROM metadata WHERE id = 'version'").first();
    
    // Check if result exists
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
    case "photo":
      return handlePhoto(request, env);
    default:
      return respondWith(404, { error: "Not found" }, corsHeaders);
  }
}
