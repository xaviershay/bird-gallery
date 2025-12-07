import { ObsType } from "../types";
import { Filter } from "../model/filter";
import { FirstsView } from "../view/firsts";
import { fetchDistinctPhotos } from "../model/photo";
import { fetchFirsts } from "../model/observation";
import { fetchGlobalFilterCounts } from "../model/filter_counts";
import { renderPageWithLayout, geoJsonResponse, jsonResponse } from "./helpers";

export async function handleFirsts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const filter = Filter.fromQueryString(url.searchParams);
  const firsts = await fetchFirsts(env, filter);

  if (url.pathname.endsWith(".geojson")) {
    return geoJsonResponse(firsts);
  }

  if (url.pathname.endsWith(".json")) {
    return jsonResponse({
      filter: filter.toJsonObject(),
      data: firsts.map((obs) => ({
        id: obs.id,
        commonName: obs.name,
        speciesId: obs.speciesId,
        locationId: obs.locationId,
        hasPhoto: obs.hasPhoto,
        seenAt: obs.seenAt,
        comment: obs.comment
      }))
    });
  }

  const filterCounts = await fetchGlobalFilterCounts(env);
  const photos = await fetchDistinctPhotos(
    env,
    filter.type == ObsType.Photo
      ? firsts.slice(0, 30).map((obs) => obs.id)
      : []
  );
  const content = FirstsView({
    observations: firsts,
    filter,
    filterCounts,
    photos,
  });
  return renderPageWithLayout(content, "Firsts - Xavier's Bird Lists", env);
}
