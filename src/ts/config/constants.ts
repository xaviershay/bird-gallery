/**
 * Application Constants
 *
 * This file contains hardcoded application constants that don't change
 * between environments or deployments.
 */

/**
 * Known region identifiers used in filtering
 */
export const REGIONS = {
  VICTORIA_AU: "au-vic",
  MELBOURNE: "melbourne",
} as const;

/**
 * The date when bird observation tracking started
 */
export const TRACKING_START_DATE = "26th January 2025";

/**
 * Application title and branding
 */
export const APP_TITLE = "Xavier's Bird Lists";

/**
 * External service URLs
 */
export const EXTERNAL_SERVICES = {
  SIMPLE_CSS: "https://cdn.simplecss.org/simple.min.css",
  FONT_AWESOME: "https://kit.fontawesome.com/c9d2c1b382.js",
  GOOGLE_FONTS: "https://fonts.googleapis.com/css2?family=Merriweather:wght@700&family=Inter&display=swap",
  MAPBOX_CSS: "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.css",
  MAPBOX_JS: "https://api.mapbox.com/mapbox-gl-js/v3.11.0/mapbox-gl.js",
} as const;
