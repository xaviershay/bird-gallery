/**
 * MapView Component
 *
 * Encapsulates the Mapbox GL map initialization and rendering.
 * This component generates the necessary div and script tags to initialize
 * a map with GeoJSON data.
 *
 * The actual map initialization happens client-side via the map.js script,
 * which is loaded globally and provides the initMap() function.
 */

interface MapViewProps {
  /**
   * URL to the GeoJSON data source for the map
   * @example "/firsts.geojson?type=photo"
   * @example "/species/railor5.geojson"
   */
  dataUrl: string;

  /**
   * Function (as string) that builds URLs from locationId
   * This is injected as JavaScript code into the page
   * @example "(id) => ('/location/' + id)"
   * @example "(id) => ('/location/' + id + '?view=firsts&type=photo')"
   */
  urlBuilder: string;

  /**
   * Optional height for the map container
   * If not specified, CSS will determine the height
   */
  height?: string;
}

/**
 * Renders a Mapbox GL map with GeoJSON data
 *
 * This component renders:
 * 1. A div container for the map
 * 2. The map.js script (if not already loaded)
 * 3. An initialization script that calls initMap()
 *
 * @param props - MapView configuration
 * @returns JSX elements for map rendering
 */
export const MapView = ({ dataUrl, urlBuilder, height }: MapViewProps) => {
  const scriptContent = `
    urlF = ${urlBuilder};
    initMap("${dataUrl}", urlF);
  `;

  const mapStyle = height ? { height } : undefined;

  return (
    <>
      <div id="map" style={mapStyle}></div>
      <script src="/js/map.js"></script>
      <script dangerouslySetInnerHTML={{ __html: scriptContent }}></script>
    </>
  );
};
