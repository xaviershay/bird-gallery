import { Filter } from "../model/filter";
import { TripReportIndexView } from "../view/trip_report_index";
import { TripReportShowView } from "../view/trip_report_show";
import {
  fetchAllTripReports,
  fetchTripReportById,
  fetchTripReportStats,
  fetchTripReportObservations,
  fetchTripReportPhotos
} from "../model/trip_report";
import {
  renderPageWithLayout,
  parseStringPathId,
  geoJsonResponse,
  jsonResponse
} from "./helpers";
import { respondWith } from "./base";

export async function handleTripReportIndex(
  request: Request,
  env: Env
): Promise<Response> {
  const tripReports = await fetchAllTripReports(env);

  // Get stats for each trip report
  const tripReportsWithStats = await Promise.all(
    tripReports.map(async (tripReport) => {
      const stats = await fetchTripReportStats(env, tripReport.id);
      return { tripReport, stats };
    })
  );

  const content = TripReportIndexView({ tripReports: tripReportsWithStats });
  return renderPageWithLayout(content, "Trip Reports - Xavier's Bird Lists", env);
}

export async function handleTripReportShow(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const id = parseStringPathId(url);

  const tripReport = await fetchTripReportById(env, id);
  if (!tripReport) {
    return respondWith(404, { error: "Trip report not found" });
  }

  const observations = await fetchTripReportObservations(env, id);

  if (url.pathname.endsWith(".geojson")) {
    return geoJsonResponse(observations);
  }

  if (url.pathname.endsWith(".json")) {
    return jsonResponse({
      tripReport: {
        id: tripReport.id,
        title: tripReport.title,
        description: tripReport.description,
        startDate: tripReport.startDate.toISOString(),
        endDate: tripReport.endDate.toISOString(),
      },
      observations: observations.map((obs) => ({
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

  const stats = await fetchTripReportStats(env, id);
  const photos = await fetchTripReportPhotos(env, id);
  const content = TripReportShowView({
    tripReport,
    observations,
    stats,
    photos,
  });

  return renderPageWithLayout(content, `${tripReport.title} - Xavier's Bird Lists`, env);
}
