import { respondWith, corsHeaders } from "./base";
import { fetchSpeciesMissingPhotos, fetchLocationsSummary, fetchUniqueSpeciesByLocationObservations, fetchBirdingOpportunitiesTags } from "../model/report";
import { MissingPhotosView } from "../view/missing_photos";
import { LocationsView } from "../view/locations";
import { BirdingOpportunitiesView } from "../view/birding_opportunities";
import { SpeciesSightingsView } from "../view/species_sightings";
import { TechnicalDetailsView } from "../view/technical_details";
import { renderPageWithLayout, parseStringPathId, geoJsonResponse, jsonResponse } from "./helpers";

export async function handleReport(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const reportId = parseStringPathId(url);

  if (!reportId) {
    return respondWith(400, { error: "Missing report ID" }, corsHeaders);
  }

  switch (reportId) {
    case "nophotos":
      const region = url.searchParams.get("region") || null;
      const county = url.searchParams.get("county") || null;
      const species = await fetchSpeciesMissingPhotos(env, region, county);
      let regionCount: Record<string, number> = {};
      const regions = ['', 'au-vic', 'melbourne'];
      // TODO: this is a hack to get the counts for the regions, better would be
      // to use COUNT in SQL. But so few records, and the page is cached anyway
      // ... it's fine.
      const counts = await Promise.all(regions.map(async regionOrCounty => {
        const isCounty = regionOrCounty === 'melbourne';
        const local = await fetchSpeciesMissingPhotos(
          env,
          isCounty ? null : regionOrCounty,
          isCounty ? regionOrCounty : null
        );
        return ['' + regionOrCounty, local.length] as const;
      }));

      regionCount = Object.fromEntries(counts);

      const content = MissingPhotosView({ species, region, county, stats: { regionCount } });
      return renderPageWithLayout(content, "Missing Photos - Xavier's Bird Lists", env);
    case "locations":
      // Map data endpoint
      if (url.pathname.endsWith('.geojson')) {
        const observations = await fetchUniqueSpeciesByLocationObservations(env);
        return geoJsonResponse(observations);
      }

      // HTML page
      const locations = await fetchLocationsSummary(env);
      return renderPageWithLayout(
        LocationsView({ locations }),
        "Locations - Xavier's Bird Lists",
        env
      );
    case "opportunities":
      // Get region/location from URL params
      const oppRegion = url.searchParams.get('region') || 'AU-VIC-MEL';
      const oppLocation = url.searchParams.get('location') || null;
      
      // JSON endpoint for bird tags (lifer status)
      if (url.pathname.endsWith('.json')) {
        const birdTags = await fetchBirdingOpportunitiesTags(env, oppRegion, oppLocation);
        return jsonResponse(birdTags);
      }

      // HTML page
      return renderPageWithLayout(
        BirdingOpportunitiesView({ region: oppRegion, location: oppLocation }),
        "Birding Opportunities - Xavier's Bird Lists",
        env
      );
    case "sightings":
      // Get URL parameters for location, species, and distance
      const locationId = url.searchParams.get('location');
      const speciesId = url.searchParams.get('species') || '';
      const distanceParam = url.searchParams.get('distance');
      
      if (!locationId) {
        return respondWith(400, { error: "Missing required parameter: location" }, corsHeaders);
      }
      
      const distance = distanceParam ? parseInt(distanceParam, 10) : 50; // Default 50km
      
      return renderPageWithLayout(
        SpeciesSightingsView({ locationId, speciesId, distance }),
        "Recent Sightings - Xavier's Bird Lists",
        env
      );
    case "technical":
      return renderPageWithLayout(
        TechnicalDetailsView(),
        "Technical Details - Xavier's Bird Lists",
        env
      );
  }
  return respondWith(200, { message: "Report" }, corsHeaders);
}