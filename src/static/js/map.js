mapboxgl.accessToken =
  "pk.eyJ1IjoieGF2aWVyc2hheSIsImEiOiJjbWE3c2w3NzIxNmRsMmpxNDkybHp1YmdmIn0.1sPPFdMJ0-6DrZN5B9-0Dg";

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
        // Hide the built-in cluster sum label to avoid confusion –
        // we render our own computed unique-species labels in a separate layer.
        "visibility": "none",
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12,
      },
    });

    // Function to compute unique species count for visible clusters
    async function updateClusterSpeciesCounts() {
      const features = map.querySourceFeatures("birds", {
        filter: ["has", "point_count"],
      });

      for (const feature of features) {
        const clusterId = feature.properties.cluster_id;
        if (clusterId === undefined) continue;

        try {
          // Get all leaves in this cluster
          const leaves = await new Promise((resolve, reject) => {
            const allLeaves = [];
            const pageSize = 100;
            
            function getPage(offset) {
              map.getSource("birds").getClusterLeaves(
                clusterId,
                pageSize,
                offset,
                (err, page) => {
                  if (err) {
                    reject(err);
                    return;
                  }
                  allLeaves.push(...page);
                  if (page.length === pageSize) {
                    // Might be more pages
                    getPage(offset + pageSize);
                  } else {
                    resolve(allLeaves);
                  }
                }
              );
            }
            getPage(0);
          });

          // Collect all unique species from all leaves
          const allSpeciesIds = new Set();
          for (const leaf of leaves) {
            const speciesIds = leaf.properties.speciesIds;
            if (Array.isArray(speciesIds)) {
              speciesIds.forEach(id => allSpeciesIds.add(id));
            }
          }

          // Update feature state with the unique count
          map.setFeatureState(
            { source: "birds", id: clusterId },
            { uniqueSpecies: allSpeciesIds.size }
          );
        } catch (err) {
          console.error("Error computing cluster species count:", err);
        }
      }
    }

    // Update on initial load and whenever the map moves
    updateClusterSpeciesCounts();
    map.on("moveend", updateClusterSpeciesCounts);
    map.on("zoom", updateClusterSpeciesCounts);

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

      // A separate GeoJSON source + symbol layer will hold computed cluster labels
      // (the true unique species count). We compute these on the client by
      // unioning the `speciesIds` arrays from each leaf (location) inside the
      // cluster. This avoids using feature-state inside layout expressions
      // (which isn't supported in some runtime configs).
      map.addSource("cluster-labels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: [],
        },
      });

      map.addLayer({
        id: "cluster-labels",
        type: "symbol",
        source: "cluster-labels",
        layout: {
          "text-field": ["get", "label"],
          "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
          "text-size": 12,
        },
        paint: {
          "text-color": "#000",
        },
      });

      // Cache computed labels per cluster id for the current view to avoid
      // recomputing while panning/zooming.
      let clusterLabelCache = new Map();
      let clusterComputeTimer = null;

      async function getAllClusterLeaves(clusterId, pointCount) {
        // Mapbox getClusterLeaves supports pagination via limit/offset
        const leaves = [];
        const limit = 1000;
        for (let offset = 0; offset < pointCount; offset += limit) {
          // Promisify the callback-based API
          const batch = await new Promise((resolve, reject) => {
            map.getSource("birds").getClusterLeaves(clusterId, limit, offset, (err, _leaves) => {
              if (err) return reject(err);
              resolve(_leaves || []);
            });
          });
          leaves.push(...batch);
        }
        return leaves;
      }

      async function computeLabelsForVisibleClusters() {
        const clusters = map.queryRenderedFeatures({ layers: ["clusters"] }) || [];

        const features = await Promise.all(clusters.map(async (clusterFeature) => {
          try {
            const clusterId = clusterFeature.properties.cluster_id;
            const pointCount = clusterFeature.properties.point_count || 0;

            // If we cached this label for the current map transform, use it
            const cacheKey = `${clusterId}-${map.getZoom()}-${clusterFeature.geometry.coordinates[0]}-${clusterFeature.geometry.coordinates[1]}`;
            if (clusterLabelCache.has(cacheKey)) {
              return {
                type: "Feature",
                geometry: clusterFeature.geometry,
                properties: { label: String(clusterLabelCache.get(cacheKey)) },
              };
            }

            const leaves = await getAllClusterLeaves(clusterId, pointCount);

            // Union speciesIds from leaves
            const uniq = new Set();
            leaves.forEach((leaf) => {
              const s = leaf.properties && leaf.properties.speciesIds;
              if (!s) return;
              if (typeof s === "string") {
                // Some runtimes stringify arrays; try parse
                try {
                  const parsed = JSON.parse(s);
                  if (Array.isArray(parsed)) parsed.forEach((id) => uniq.add(id));
                } catch (e) {
                  // fallback: comma-separated
                  s.split(",").forEach((id) => id && uniq.add(id.trim()));
                }
              } else if (Array.isArray(s)) {
                s.forEach((id) => uniq.add(id));
              }
            });

            const label = String(uniq.size || 0);
            clusterLabelCache.set(cacheKey, label);
            return {
              type: "Feature",
              geometry: clusterFeature.geometry,
              properties: { label },
            };
          } catch (err) {
            console.error("Error computing label for cluster", err);
            return {
              type: "Feature",
              geometry: clusterFeature.geometry,
              properties: { label: String(clusterFeature.properties.sum || 0) },
            };
          }
        }));

        const fc = { type: "FeatureCollection", features };
        const src = map.getSource("cluster-labels");
        if (src && src.setData) src.setData(fc);
      }

      function scheduleComputeLabels() {
        if (clusterComputeTimer) clearTimeout(clusterComputeTimer);
        clusterComputeTimer = setTimeout(() => {
          computeLabelsForVisibleClusters();
        }, 200);
      }

      // Recompute labels after pans and when data changes
      map.on("moveend", scheduleComputeLabels);

      // On zoom start: immediately hide old labels and clear cache/data
      map.on("zoomstart", () => {
        clusterLabelCache.clear();
        try { map.setLayoutProperty("cluster-labels", "visibility", "none"); } catch (_) {}
        const src = map.getSource("cluster-labels");
        if (src && src.setData) src.setData({ type: "FeatureCollection", features: [] });
      });

      // On zoom end: compute fresh labels, then show them
      map.on("zoomend", async () => {
        await computeLabelsForVisibleClusters();
        try { map.setLayoutProperty("cluster-labels", "visibility", "visible"); } catch (_) {}
      });
      map.on("sourcedata", (e) => {
        if (e.sourceId === "birds" && e.isSourceLoaded) {
          // New source data arrived
          clusterLabelCache.clear();
          scheduleComputeLabels();
        }
      });

      // Initial compute on first load: compute immediately once the 'birds' source is ready
      (function computeOnceWhenBirdsReady() {
        const run = () => computeLabelsForVisibleClusters();
        try {
          if (map.isSourceLoaded && map.isSourceLoaded("birds")) {
            run();
          } else {
            const handler = (e) => {
              if (e.sourceId === "birds" && e.isSourceLoaded) {
                map.off("sourcedata", handler);
                run();
              }
            };
            map.on("sourcedata", handler);
          }
        } catch (_) {
          // Fallback: schedule shortly if APIs are not available in this environment
          setTimeout(run, 0);
        }
      })();
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
