import { GalleryView } from "../view/gallery";
import { fetchAllPhotos } from "../model/photo";
import { renderPageWithLayout } from "./helpers";

export async function handleGallery(
  request: Request,
  env: Env
): Promise<Response> {
  const photos = await fetchAllPhotos(env);

  const content = GalleryView({ photos });
  const title = "All Photos - Xavier's Bird Lists";

  return renderPageWithLayout(content, title, env);
}
