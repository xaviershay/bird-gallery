import { handleFirsts } from "./controller/firsts";
import { respondWith, corsHeaders } from "./controller/base";

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
      // Route handling
      if (path[0] === "firsts" || path[0] === "firsts.json") {
        return handleFirsts(request, env); // Simplified call
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
