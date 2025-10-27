import { SpeciesView } from "../view/species";
import { LayoutView } from "../view/layout";
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchSpecies, fetchSpeciesObservations } from "../model/species";
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
    }, {} as Record<string, any[]>);

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
