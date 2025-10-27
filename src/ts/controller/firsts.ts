import { ObsType } from "../types";
import { Filter } from "../model/filter";
import { FirstsView } from "../view/firsts";
import { LayoutView } from "../view/layout";
import { prerender } from 'react-dom/static';
import { respondWith, corsHeaders } from "./base";
import formatLocationName from "../helpers/format_location_name";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchDistinctPhotos } from "../model/photo";
import { fetchFirsts } from "../model/observation";
import { fetchGlobalFilterCounts } from "../model/filter_counts";

export async function handleFirsts(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const filter = Filter.fromQueryString(url.searchParams);
  const firsts = await fetchFirsts(env, filter);

  if (url.pathname.endsWith(".geojson")) {
    // Group records by locationId
    const grouped = firsts.reduce((acc, record) => {
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
  } else if (url.pathname.endsWith(".json")) {
    const jsonData = {
      filter: filter.toJsonObject(),
      data: firsts.map((obs) => ({
        id: obs.id,
        commonName: obs.name,
        speciesId: obs.speciesId,
        locationId: obs.locationId,
        hasPhoto: obs.hasPhoto,
        seenAt: obs.seenAt
      }))
    }
    return respondWith(200, jsonData, corsHeaders);
  } else {
    const title = "Firsts - Xavier's Bird Lists";
    const header = await fetchHeaderStats(env);
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
    const html = LayoutView({ title, content, header });
    const htmlStream = await prerender(html)
    return new Response(htmlStream.prelude, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  }
}
