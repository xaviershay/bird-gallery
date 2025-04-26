import { renderToString } from "react-dom/server";
import { Env } from "../routes";
import { LayoutView } from "../view/layout";
import { HomeView } from "../view/home";
import { fetchHeaderStats } from "../model/header_stats";

export async function handleHome(
  request: Request,
  env: Env
): Promise<Response> {
    const home = HomeView({
        seenCount: 141,
        photoCount: 90
     });
    const header = await fetchHeaderStats(env);
    const html = LayoutView({ content: home, header });
    return new Response(`<!DOCTYPE html>${renderToString(html)}`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
}
