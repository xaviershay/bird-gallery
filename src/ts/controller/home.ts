import { HomeView } from "../view/home";
import { fetchRecentGoodPhotos } from "../model/photo";
import { renderPageWithLayout } from "./helpers";

export async function handleHome(
  request: Request,
  env: Env
): Promise<Response> {
    const photos = await fetchRecentGoodPhotos(env);
    const content = HomeView({ photos });
    return renderPageWithLayout(content, "Xavier's Bird Lists", env);
}
