import { LayoutView } from "../view/layout";
import { fetchHeaderStats } from "../model/header_stats";
import { prerender } from "react-dom/static";
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name";
import { Observation } from "../types";

/**
 * Renders a page with the standard layout (header, title, content)
 * Handles fetching header stats and prerendering
 *
 * @param content - The JSX content to render in the page
 * @param title - Page title
 * @param env - Cloudflare environment
 * @returns Response with rendered HTML
 */
export async function renderPageWithLayout(
  content: JSX.Element,
  title: string,
  env: Env
): Promise<Response> {
  const header = await fetchHeaderStats(env);
  const html = LayoutView({ title, content, header });
  const htmlStream = await prerender(html);
  return new Response(htmlStream.prelude, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}

/**
 * Parses a numeric ID from the last segment of a URL path
 * Handles extensions (e.g., /location/123.json -> 123)
 *
 * @param url - The URL object
 * @returns Parsed number, or NaN if invalid
 */
export function parseNumericPathId(url: URL): number {
  const pathSegment = url.pathname.split("/").pop() || "";
  const idStr = pathSegment.includes(".")
    ? pathSegment.substring(0, pathSegment.lastIndexOf("."))
    : pathSegment;
  return parseInt(idStr);
}

/**
 * Parses a string ID from the last segment of a URL path
 * Handles extensions (e.g., /species/abc123.json -> abc123)
 *
 * @param url - The URL object
 * @returns String ID without extension
 */
export function parseStringPathId(url: URL): string {
  const pathSegment = url.pathname.split("/").pop() || "";
  return pathSegment.includes(".")
    ? pathSegment.substring(0, pathSegment.lastIndexOf("."))
    : pathSegment;
}

/**
 * Converts observations to a GeoJSON FeatureCollection
 * Groups observations by location and creates a feature for each unique location
 *
 * @param observations - Array of observations to convert
 * @returns GeoJSON FeatureCollection object
 */
export function observationsToGeoJSON(observations: Observation[]): any {
  // Group records by locationId
  const grouped = observations.reduce((acc, record) => {
    if (!acc[record.locationId]) {
      acc[record.locationId] = [];
    }
    acc[record.locationId].push(record);
    return acc;
  }, {} as Record<string, Observation[]>);

  return {
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
}

/**
 * Returns a JSON response with CORS headers
 *
 * @param data - Data to return as JSON
 * @returns Response with JSON data
 */
export function jsonResponse(data: any): Response {
  return respondWith(200, data, corsHeaders);
}

/**
 * Returns a GeoJSON response with CORS headers
 *
 * @param observations - Observations to convert to GeoJSON
 * @returns Response with GeoJSON data
 */
export function geoJsonResponse(observations: Observation[]): Response {
  return jsonResponse(observationsToGeoJSON(observations));
}
