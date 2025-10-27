import { Filter } from "../model/filter";
import { LocationView } from "../view/location";
import { LayoutView } from "../view/layout";
import { respondWith, corsHeaders } from "./base";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchPhotos } from "../model/photo";
import { fetchLocation, fetchLocationObservations, fetchLocationFilterCounts } from "../model/location";
import { prerender } from "react-dom/static";

export async function handleLocation(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const locationId = parseInt(url.pathname.split("/").pop() ?? "");

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
  const header = await fetchHeaderStats(env);

  if (url.pathname.endsWith(".json")) {
    return respondWith(200, { location, observations }, corsHeaders);
  } else {
    const content = LocationView({
      location,
      observations,
      photos,
      filter,
      filterCounts,
    });
    const title = location.name + " - Xavier's Bird Lists";
    const html = LayoutView({ title, content, header });
    const htmlStream = await prerender(html);
    return new Response(htmlStream.prelude, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}
