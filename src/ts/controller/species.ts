import { SpeciesView } from "../view/species";
import { respondWith, corsHeaders } from "./base";
import { fetchSpecies, fetchSpeciesObservations } from "../model/species";
import { parseStringPathId, renderPageWithLayout, geoJsonResponse } from "./helpers";

export async function handleSpecies(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const speciesId = parseStringPathId(url);

  if (!speciesId) {
    return respondWith(400, { error: "Missing species ID" }, corsHeaders);
  }

  const species = await fetchSpecies(env, speciesId);

  if (!species) {
    return respondWith(404, { error: "Species not found" }, corsHeaders);
  }

  const observations = await fetchSpeciesObservations(env, speciesId);

  if (url.pathname.endsWith(".geojson")) {
    return geoJsonResponse(observations);
  }

  const content = SpeciesView({ species, observations });
  return renderPageWithLayout(content, species.name + " - Xavier's Bird Lists", env);
}
