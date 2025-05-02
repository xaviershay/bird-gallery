import { renderToString } from "react-dom/server";
import { Env } from "../routes";
import { LayoutView } from "../view/layout";
import { HomeView } from "../view/home";
import { fetchHeaderStats } from "../model/header_stats";
import { fetchRecentGoodPhotos } from "../model/photo";

export async function handleHome(
  request: Request,
  env: Env
): Promise<Response> {
    const photos = await fetchRecentGoodPhotos(env);
    const home = HomeView({ photos });
    const header = await fetchHeaderStats(env);
    const title = "Xavier's Bird Lists";
    const html = LayoutView({ title, content: home, header });
    return new Response(`<!DOCTYPE html>${renderToString(html)}`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
}
