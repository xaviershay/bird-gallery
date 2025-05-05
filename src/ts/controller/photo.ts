import { fetchHeaderStats } from "../model/header_stats";
import { fetchPhoto } from "../model/photo";
import { Env } from "../routes";
import { corsHeaders, respondWith } from "./base";
import { LayoutView } from "../view/layout";
import { PhotoView } from "../view/photo";
import { prerender } from "react-dom/static";

export async function handlePhoto(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const photoId = url.pathname.split('/').pop();
  
  if (!photoId) {
    return respondWith(400, { error: "Missing photo ID" }, corsHeaders);
  }
  
  const photo = await fetchPhoto(env, photoId);
  
  if (!photo) {
    return respondWith(404, { error: "Photo not found" }, corsHeaders);
  }

  const header = await fetchHeaderStats(env);

  const content = PhotoView(photo);
  const title = photo.observation.name + " Photo - Xavier's Bird Lists";
  const html = LayoutView({ title, content, header });
  const htmlStream = await prerender(html);
  return new Response(htmlStream.prelude, {
    headers: {
      "Content-Type": "text/html",
    },
  });
}