import { respondWith, corsHeaders } from "./base";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchSpeciesMissingPhotos } from "../model/report";
import { MissingPhotosView } from "../view/missing_photos";
import { LayoutView } from "../view/layout";
import { prerender } from "react-dom/static";

export async function handleReport(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const pathSegment = url.pathname.split("/").pop() || "";
  const reportId = pathSegment.includes(".")
    ? pathSegment.substring(0, pathSegment.lastIndexOf("."))
    : pathSegment;

  if (!reportId) {
    return respondWith(400, { error: "Missing report ID" }, corsHeaders);
  }

  switch (reportId) {
    case "nophotos":
      const region = url.searchParams.get("region") || null;
      const county = url.searchParams.get("county") || null;
      const header = await fetchHeaderStats(env);
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

      const title = "Missing Photos - Xavier's Bird Lists";
      const content = MissingPhotosView({ species, region, county, stats: { regionCount } });
      const html = LayoutView({ title, content, header });
      const htmlStream = await prerender(html);
      return new Response(htmlStream.prelude, {
        headers: {
          "Content-Type": "text/html",
        },
      });
  }
  return respondWith(200, { message: "Report" }, corsHeaders);
}