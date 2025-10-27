/**
 * Environment Configuration
 *
 * This file contains environment-specific configuration values.
 *
 * Note: In Cloudflare Workers, environment variables are passed through the Env
 * object in the worker context, not through process.env. If you need to make
 * PHOTO_BASE_URL configurable, add it to wrangler.toml and pass it through
 * the Env object to this function.
 */

/**
 * Base URL for the photo storage service (Cloudflare R2)
 * This points to the public URL where photos are accessible
 */
export const PHOTO_BASE_URL = "https://bird-gallery.xaviershay.com";

/**
 * Get the full URL for a photo file
 * @param fileName - The photo filename (e.g., "bird123.jpg")
 * @param thumbnail - Whether to get thumbnail or full-size photo
 * @returns Full URL to the photo
 */
export function getPhotoUrl(fileName: string, thumbnail: boolean = true): string {
  const directory = thumbnail ? "thumbnails" : "photos";
  return `${PHOTO_BASE_URL}/${directory}/${fileName}`;
}
