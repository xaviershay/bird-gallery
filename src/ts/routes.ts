import { handleFirsts } from "./controller/firsts";
import { handleLocation } from "./controller/location";
import { handleSpecies } from "./controller/species";
import { respondWith, corsHeaders } from "./controller/base";
import { handleHome } from "./controller/home";
import { handlePhoto } from "./controller/photo";

export interface Env {
  DB: D1Database;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.split("/").filter(Boolean);
    const method = request.method;

    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    try {
      if (path[0] == null) {
        return handleHome(request, env);
      }

      if (path[0] === "firsts" || path[0] === "firsts.json") {
        return handleFirsts(request, env);
      }
      
      if (path[0] === "location") {
        return handleLocation(request, env);
      }

      if (path[0] === "species") {
        return handleSpecies(request, env);
      }

      if (path[0] === "photo") {
        return handlePhoto(request, env);
      }

      // If we get here, the route was not found
      return respondWith(404, { error: "Not found" }, corsHeaders);
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
  },
};

