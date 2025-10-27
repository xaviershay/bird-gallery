import { fetchPhoto } from "../model/photo";
import { Env } from "../routes";
import { corsHeaders, respondWith } from "./base";
import { PhotoView } from "../view/photo";
import { renderPageWithLayout } from "./helpers";

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

  const content = PhotoView(photo);
  return renderPageWithLayout(content, photo.observation.name + " Photo - Xavier's Bird Lists", env);
}