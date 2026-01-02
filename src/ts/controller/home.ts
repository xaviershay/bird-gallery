import { HomeView } from "../view/home";
import { fetchRecentGoodPhotos } from "../model/photo";
import { fetchFirsts } from "../model/observation";
import { fetchAllTripReports, fetchTripReportStats } from "../model/trip_report";
import { renderPageWithLayout } from "./helpers";
import { Filter } from "../model/filter";
import { ObsType } from "../types";

export async function handleHome(
  request: Request,
  env: Env
): Promise<Response> {
    const [photos, ticks, tripReports] = await Promise.all([
      fetchRecentGoodPhotos(env),
      (async () => {
        const firsts = await fetchFirsts(env, Filter.create({ type: ObsType.Sighting }));
        return {
          ticks: firsts.slice(0, 5),
          total: firsts.length,
        };
      })(),
      fetchAllTripReports(env),
    ]);

    const recentTrips = await Promise.all(
      tripReports.slice(0, 3).map(async (tripReport) => {
        const stats = await fetchTripReportStats(env, tripReport.id);
        return { tripReport, stats };
      })
    );

    const content = HomeView({
      photos,
      ticks: ticks.ticks,
      ticksTotal: ticks.total,
      recentTrips,
    });
    return renderPageWithLayout(content, "Xavier's Bird Lists", env);
}
