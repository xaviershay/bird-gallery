// Replace with your Mapbox access token
mapboxgl.accessToken =
  "pk.eyJ1IjoieGF2aWVyc2hheSIsImEiOiJja3dpZHdyOGwxN2UwMzBxamtsNnBtNGdxIn0.LkAum8hHR9WLzJTjzxCHrA";

const map = new mapboxgl.Map({
  container: "map", // container ID
  // Temp center/zoom for world map. Maybe do this by bounding box, or hard code for each of three regions.
  center: [154.07106855728526, 7.98531274796334],
  style: "mapbox://styles/xaviershay/cm9pb3a92004h01spbg7442q3",
  zoom: 0.4923743020003648,
  //zoom: 8.353029480083169,
  //center: [-116.29728753751925, 33.99100948411403],
  //zoom: 9, // starting zoom
});

function initMap(sourceJson, urlF) {
  // Add markers to the map
  map.on("load", async () => {
    map.addSource("birds", {
      type: "geojson",
      data: sourceJson,
      cluster: true,
      clusterRadius: 50,
      clusterProperties: {
        sum: ["+", ["get", "count"]],
      },
    });
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "birds",
      filter: ["has", "point_count"],
      paint: {
        // Use step expressions (https://docs.mapbox.com/style-spec/reference/expressions/#step)
        // with three steps to implement three types of circles:
        //   * Blue, 20px circles when point count is less than 100
        //   * Yellow, 30px circles when point count is between 100 and 750
        //   * Pink, 40px circles when point count is greater than or equal to 750
        "circle-color": [
          "step",
          ["get", "sum"],
          "#51bbd6",
          20,
          "#f1f075",
          50,
          "#f28cb1",
        ],
        "circle-radius": ["step", ["get", "sum"], 20, 100, 30, 750, 40],
      },
    });
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "birds",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "sum"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    });
    const markerRadius = 15;
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "birds",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#c7e466",
        "circle-radius": markerRadius,
        "circle-stroke-width": 0,
        "circle-stroke-color": "grey",
      },
    });
    map.addLayer({
      id: "unclustered-point-label",
      type: "symbol",
      source: "birds",
      filter: ["!", ["has", "point_count"]],
      layout: {
        "text-field": ["get", "count"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    });
    // inspect a cluster on click
    map.on("click", "clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"],
      });
      const clusterId = features[0].properties.cluster_id;
      map.getSource("birds").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;

        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom,
        });
      });
    });
    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });
    const popupOffset = markerRadius + 2;
    const popupOffsets = {
      top: [0, popupOffset],
      "top-left": [popupOffset, popupOffset],
      "top-right": [-popupOffset, popupOffset],
      "bottom-left": [popupOffset, -popupOffset],
      "bottom-right": [-popupOffset, -popupOffset],
      bottom: [0, -popupOffset],
      left: [popupOffset, 0],
      right: [-popupOffset, 0],
    };
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: popupOffsets,
    });
    map.on("mouseenter", "unclustered-point", (e) => {
      // Change the cursor style as a UI indicator.
      map.getCanvas().style.cursor = "pointer";

      // Copy coordinates array.
      const coordinates = e.features[0].geometry.coordinates.slice();
      const description = e.features[0].properties.name;

      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      if (["mercator", "equirectangular"].includes(map.getProjection().name)) {
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
          coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }
      }

      // Populate the popup and set its coordinates
      // based on the feature found.
      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    });

    map.on("click", "unclustered-point", (e) => {
      window.location = urlF(e.features[0].properties.locationId);
    });

    map.on("mouseleave", "unclustered-point", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
  });
}
