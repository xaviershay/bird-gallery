import { fetchPhoto } from "../model/photo";
import { Env } from "../routes";
import { corsHeaders, respondWith } from "./base";
import { getPhotoUrl } from "../config/environment";

export async function handleOEmbed(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');
  const formatParam = url.searchParams.get('format');

  if (!targetUrl) {
    return respondWith(400, { error: "Missing url parameter" }, corsHeaders);
  }

  if (formatParam && formatParam !== 'json') {
    return respondWith(501, { error: "Only JSON format is supported" }, corsHeaders);
  }

  // Extract photo ID from the target URL
  const targetPath = new URL(targetUrl);
  const photoId = targetPath.pathname.split('/').pop();

  if (!photoId || !targetPath.pathname.startsWith('/photo/')) {
    return respondWith(400, { error: "Invalid photo URL" }, corsHeaders);
  }

  const result = await fetchPhoto(env, photoId);

  if (!result) {
    return respondWith(404, { error: "Photo not found" }, corsHeaders);
  }

  const oembedResponse = {
    version: "1.0",
    type: "photo",
    title: result.observation.name + " Photo - Xavier's Bird Lists",
    author_name: "Xavier Shay",
    author_url: "https://xaviershay.com",
    provider_name: "Xavier's Bird Lists",
    provider_url: targetPath.origin,
    url: getPhotoUrl(result.photo.fileName, 'card'),
    width: 1200,
    height: Math.round(1200 * (result.photo.height / result.photo.width))
  };

  return new Response(JSON.stringify(oembedResponse), {
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders
    }
  });
}
