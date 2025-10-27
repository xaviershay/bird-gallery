import { Filter } from "../model/filter";
import { LocationView } from "../view/location";
import { respondWith, corsHeaders } from "./base";
import { fetchPhotos } from "../model/photo";
import { fetchLocation, fetchLocationObservations } from "../model/location";
import { fetchLocationFilterCounts } from "../model/filter_counts";
import { parseNumericPathId, renderPageWithLayout, jsonResponse } from "./helpers";

export async function handleLocation(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const locationId = parseNumericPathId(url);

  if (!locationId) {
    return respondWith(400, { error: "Missing location ID" }, corsHeaders);
  }

  const filter = Filter.fromQueryString(url.searchParams);
  const location = await fetchLocation(env, locationId);

  if (!location) {
    return respondWith(404, { error: "Location not found" }, corsHeaders);
  }

  const filterCounts = await fetchLocationFilterCounts(location.id, env);
  const observations = await fetchLocationObservations(env, locationId, filter);
  const photos = await fetchPhotos(
    env,
    observations.map((obs) => obs.id)
  );
  if (url.pathname.endsWith(".json")) {
    return jsonResponse({ location, observations });
  }

  const content = LocationView({
    location,
    observations,
    photos,
    filter,
    filterCounts,
  });
  return renderPageWithLayout(content, location.name + " - Xavier's Bird Lists", env);
}
