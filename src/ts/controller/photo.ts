import { fetchPhoto } from "../model/photo";
import { Env } from "../routes";
import { corsHeaders, respondWith } from "./base";
import { PhotoView } from "../view/photo";
import { renderPageWithLayout } from "./helpers";
import { getPhotoUrl } from "../config/environment";
import { format } from "date-fns";

export async function handlePhoto(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const photoId = url.pathname.split('/').pop();

  if (!photoId) {
    return respondWith(400, { error: "Missing photo ID" }, corsHeaders);
  }

  const result = await fetchPhoto(env, photoId);

  if (!result) {
    return respondWith(404, { error: "Photo not found" }, corsHeaders);
  }

  const content = PhotoView(result);
  const title = result.observation.name + " Photo - Xavier's Bird Lists";
  
  const ogMetadata = {
    title: title,
    description: `A photo of ${result.photo.commonName} taken on ${format(result.photo.takenAt, 'yyyy-MM-dd')}`,
    image: getPhotoUrl(result.photo.fileName, false),
    url: request.url,
    type: "photo"
  };
  
  return renderPageWithLayout(content, title, env, ogMetadata);
}