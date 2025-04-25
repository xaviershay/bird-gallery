import { renderToString } from "react-dom/server";
import { Env } from "../routes";
import { Layout } from "../view/layout";
import { HomeView } from "../view/home";

export async function handleHome(
  request: Request,
  env: Env
): Promise<Response> {
    const home = HomeView({
        seenCount: 141,
        photoCount: 90
     });
    const html = Layout({ content: home });
    return new Response(`<!DOCTYPE html>${renderToString(html)}`, {
      headers: {
        "Content-Type": "text/html",
      },
    });
}