/**
 * Birding Opportunities Report (Client-Side)
 * 
 * Finds birds recently seen in AU-VIC-MEL that you haven't photographed/seen yet.
 * 
 * Flow:
 * 1. Check for eBird API key in localStorage, prompt if missing
 * 2. Fetch exclude list from server (species already seen/photographed)
 * 3. Fetch recent observations from eBird API
 * 4. Filter to find "target" species (not in exclude list)
 * 5. For each target species, fetch detailed location observations
 * 6. Display results on map and in table
 */

const REGION_CODE = "AU-VIC-MEL";
const DAYS_BACK = 7;

// State
let excludeList = [];
let targetSpecies = [];
let allObservations = [];
let isLoading = false;

/**
 * Format a date string with ordinal suffix and time in AM/PM format
 * @param {string} dateStr - Date string from eBird API (e.g., "2024-11-10 14:30")
 * @returns {string} Formatted date with HTML (e.g., "10<sup>th</sup> November 2024, 2:30 PM")
 */
function formatDateTime(dateStr) {
  const date = new Date(dateStr);
  const day = date.getDate();
  const month = date.toLocaleString("default", { month: "long" });
  const year = date.getFullYear();
  
  const suffix =
    day === 1 || day === 21 || day === 31
      ? "st"
      : day === 2 || day === 22
      ? "nd"
      : day === 3 || day === 23
      ? "rd"
      : "th";
  
  // Format time in AM/PM
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 should be 12
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `${hours}:${minutesStr} ${ampm}`;
  
  return `${day}<sup>${suffix}</sup> ${month} ${year}, ${timeStr}`;
}

/**
 * Initialize the report
 */
async function initBirdingOpportunities() {
  const excludeMode = getExcludeMode();
  console.log('[Birding Opportunities] Initializing with exclude mode:', excludeMode);
  
  try {
    showStatus("Loading...");
    
    // Check for API key
    let apiKey = getEBirdApiKey();
    if (!apiKey) {
      console.log('[Birding Opportunities] No API key found in localStorage');
      showStatus("eBird API key required. Please enter your API key.");
      apiKey = promptForApiKey();
      if (!apiKey) {
        console.error('[Birding Opportunities] User cancelled API key prompt');
        showError("eBird API key is required to fetch birding opportunities.");
        return;
      }
      console.log('[Birding Opportunities] API key entered and saved');
    } else {
      console.log('[Birding Opportunities] Using existing API key from localStorage');
    }
    
    // Fetch exclude list from server
    showStatus("Loading your bird list...");
    console.log('[Birding Opportunities] Fetching exclude list from server...');
    excludeList = await fetchExcludeList(excludeMode);
    console.log(`[Birding Opportunities] Exclude list loaded: ${excludeList.length} species`, excludeList);
    
    // Fetch recent observations from eBird
    showStatus(`Fetching recent observations in ${REGION_CODE}...`);
    console.log(`[Birding Opportunities] Fetching recent observations from eBird API for ${REGION_CODE}, last ${DAYS_BACK} days...`);
    const recentObs = await getRecentObservations(REGION_CODE, apiKey, DAYS_BACK);
    console.log(`[Birding Opportunities] Received ${recentObs.length} recent observations from eBird`, recentObs);
    
    // Find target species (not in exclude list)
    const excludeCodes = new Set(excludeList.map(s => s.id));
    console.log('[Birding Opportunities] Exclude codes set:', Array.from(excludeCodes));
    const uniqueSpecies = new Map();
    
    recentObs.forEach(obs => {
      const speciesCode = obs.speciesCode;
        if (!excludeCodes.has(speciesCode) && speciesCode !== 'rocpig' && !uniqueSpecies.has(speciesCode)) {
        uniqueSpecies.set(speciesCode, {
          code: speciesCode,
          name: obs.comName,
          scientificName: obs.sciName
        });
      }
    });
    
    targetSpecies = Array.from(uniqueSpecies.values());
    console.log(`[Birding Opportunities] Found ${targetSpecies.length} target species (not in exclude list):`, targetSpecies);
    
    if (targetSpecies.length === 0) {
      console.log('[Birding Opportunities] No new birds to chase!');
      showStatus("No new birds found! You've seen everything recently reported in this region.");
      renderResults([], excludeMode);
      return;
    }
    
    showStatus(`Found ${targetSpecies.length} target species. Fetching locations...`);
    console.log(`[Birding Opportunities] Fetching detailed observations for ${targetSpecies.length} species...`);
    
    // Fetch detailed observations for each target species
    const observationPromises = targetSpecies.map(async (species, index) => {
      try {
        // Check if data is cached before adding delay
        const isCached = isSpeciesObservationsCached(REGION_CODE, species.code, DAYS_BACK);
        
        // Only add delay for uncached requests to avoid rate limiting
        if (!isCached) {
          await new Promise(resolve => setTimeout(resolve, index * 100));
        }
        
        console.log(`[Birding Opportunities] Fetching observations for ${species.name} (${species.code})...`);
        const obs = await getSpeciesObservations(REGION_CODE, species.code, apiKey, DAYS_BACK);
        console.log(`[Birding Opportunities] Received ${obs.length} observations for ${species.name}`);
        return obs.map(o => ({
          ...o,
          commonName: species.name,
          scientificName: species.scientificName,
          speciesCode: species.code
        }));
      } catch (error) {
        console.error(`[Birding Opportunities] Failed to fetch observations for ${species.name}:`, error);
        return [];
      }
    });
    
    const observationArrays = await Promise.all(observationPromises);
    allObservations = observationArrays.flat();
    console.log(`[Birding Opportunities] Total observations collected: ${allObservations.length}`, allObservations);
    
    showStatus(`Found ${allObservations.length} observations of ${targetSpecies.length} species`);
    
    // Render results
    console.log('[Birding Opportunities] Rendering results...');
    renderResults(allObservations, excludeMode);
    console.log('[Birding Opportunities] Rendering map...');
    renderMap(allObservations);
    console.log('[Birding Opportunities] Initialization complete!');
    
  } catch (error) {
    console.error("[Birding Opportunities] Error during initialization:", error);
    showError(`Error: ${error.message}`);
  }
}

/**
 * Get the exclude mode from URL parameter
 */
function getExcludeMode() {
  const params = new URLSearchParams(window.location.search);
  return params.get('exclude') || 'photos';
}

/**
 * Fetch the exclude list from the server
 */
async function fetchExcludeList(mode) {
  const url = `/report/opportunities.json?exclude=${mode}`;
  console.log('[Birding Opportunities] Fetching exclude list from:', url);
  const response = await fetch(url);
  if (!response.ok) {
    console.error('[Birding Opportunities] Failed to fetch exclude list:', response.status, response.statusText);
    throw new Error('Failed to fetch exclude list from server');
  }
  const data = await response.json();
  console.log('[Birding Opportunities] Exclude list fetched successfully:', data);
  return data;
}


/**
 * Show status message
 */
function showStatus(message) {
  const elem = document.getElementById('status');
  if (elem) {
    elem.textContent = message;
    elem.className = 'status';
  }
}

/**
 * Show error message
 */
function showError(message) {
  const elem = document.getElementById('status');
  if (elem) {
    elem.textContent = message;
    elem.className = 'status error';
  }
}

/**
 * Render results table
 */
function renderResults(observations, excludeMode) {
  console.log(`[Birding Opportunities] Rendering results table with ${observations.length} observations`);
  const tbody = document.getElementById('results-tbody');
  if (!tbody) return;

  // Group by location (use locId for stable grouping, keep name)
  const byLocation = new Map();
  observations.forEach(obs => {
    const key = obs.locId || obs.locName;
    if (!byLocation.has(key)) {
      byLocation.set(key, {
        id: obs.locId || null,
        name: obs.locName || 'Unknown location',
        observations: []
      });
    }
    byLocation.get(key).observations.push(obs);
  });

  // Sort locations by name
  const locations = Array.from(byLocation.values()).sort((a, b) => a.name.localeCompare(b.name));
  console.log(`[Birding Opportunities] Rendering ${locations.length} locations in table`);

  tbody.innerHTML = '';

  locations.forEach((loc) => {
    // Group header row for the location
    const locHeader = document.createElement('tr');
    locHeader.className = 'group-row';
  const headerCell = document.createElement('td');
  headerCell.colSpan = 2; // Two columns: species, date (linked)
    // Location name links to eBird location page if locId exists
    if (loc.id) {
      const locLink = document.createElement('a');
      locLink.href = `https://ebird.org/hotspot/${loc.id}`;
      locLink.textContent = loc.name;
      locLink.target = '_blank';
      headerCell.appendChild(locLink);
    } else {
      headerCell.textContent = loc.name;
    }
    locHeader.appendChild(headerCell);
    tbody.appendChild(locHeader);








      // Instead of aggregating, output one row per sighting
      loc.observations.forEach(obs => {
    const sightingRow = document.createElement('tr');
    const speciesCell = document.createElement('td');
    // Species name links to eBird species page
    const speciesLink = document.createElement('a');
    speciesLink.href = `https://ebird.org/species/${obs.speciesCode}`;
    speciesLink.textContent = obs.commonName || obs.comName;
    speciesLink.target = '_blank';
    speciesCell.appendChild(speciesLink);
    sightingRow.appendChild(speciesCell);
    const dateCell = document.createElement('td');
    const checklistLink = document.createElement('a');
    checklistLink.href = `https://ebird.org/checklist/${obs.subId}`;
    checklistLink.innerHTML = formatDateTime(obs.obsDt);
    checklistLink.target = '_blank';
    dateCell.appendChild(checklistLink);
    sightingRow.appendChild(dateCell);
    tbody.appendChild(sightingRow);
      });
  });

  // Update species count (unique across all observations)
  const countElem = document.getElementById('species-count');
  if (countElem) {
    const uniqueSpeciesCount = new Set(observations.map(o => o.speciesCode)).size;
    countElem.textContent = uniqueSpeciesCount;
  }
}

/**
 * Render map with observations
 */
function renderMap(observations) {
  console.log(`[Birding Opportunities] Rendering map with ${observations.length} observations`);
  if (!window.mapboxgl) {
    console.error("[Birding Opportunities] Mapbox GL not loaded");
    return;
  }
  
  // Convert observations to GeoJSON
  const features = observations.map(obs => ({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [obs.lng, obs.lat]
    },
    properties: {
      name: obs.locName,
      commonName: obs.commonName || obs.comName,
      speciesCode: obs.speciesCode,
      date: obs.obsDt,
      locationId: obs.locId
    }
  }));
  
  const geojson = {
    type: "FeatureCollection",
    features: features
  };
  
  console.log('[Birding Opportunities] GeoJSON created with', features.length, 'features');
  
  // Initialize map
  mapboxgl.accessToken = "pk.eyJ1IjoieGF2aWVyc2hheSIsImEiOiJjbWE3c2w3NzIxNmRsMmpxNDkybHp1YmdmIn0.1sPPFdMJ0-6DrZN5B9-0Dg";
  
  console.log('[Birding Opportunities] Initializing Mapbox map...');
  const map = new mapboxgl.Map({
    container: "map",
    center: [144.9631, -37.8136], // Melbourne
    style: "mapbox://styles/xaviershay/cm9pb3a92004h01spbg7442q3",
    zoom: 9
  });
  
  map.on("load", () => {
    console.log('[Birding Opportunities] Map loaded, adding data source and layers...');
    map.addSource("birds", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterRadius: 50
    });
    
    // Clusters
    map.addLayer({
      id: "clusters",
      type: "circle",
      source: "birds",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": [
          "step",
          ["get", "point_count"],
          "#51bbd6",
          10,
          "#f1f075",
          30,
          "#f28cb1"
        ],
        "circle-radius": [
          "step",
          ["get", "point_count"],
          20,
          10,
          30,
          30,
          40
        ]
      }
    });
    
    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: "birds",
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count"],
        "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
        "text-size": 12
      }
    });
    
    // Individual points
    map.addLayer({
      id: "unclustered-point",
      type: "circle",
      source: "birds",
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": "#c7e466",
        "circle-radius": 15,
        "circle-stroke-width": 0
      }
    });
    
    // Click cluster to zoom
    map.on("click", "clusters", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ["clusters"]
      });
      const clusterId = features[0].properties.cluster_id;
      map.getSource("birds").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        map.easeTo({
          center: features[0].geometry.coordinates,
          zoom: zoom
        });
      });
    });
    
    // Show popup on hover
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });
    
    map.on("mouseenter", "unclustered-point", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      const html = `<strong>${props.commonName}</strong><br>${props.name}<br>${props.date}`;
      popup.setLngLat(coordinates).setHTML(html).addTo(map);
    });
    
    map.on("mouseleave", "unclustered-point", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    
    map.on("mouseenter", "clusters", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    
    map.on("mouseleave", "clusters", () => {
      map.getCanvas().style.cursor = "";
    });
    
    console.log('[Birding Opportunities] Map setup complete with all layers and event handlers');
  });
}

/**
 * Handle exclude mode change
 */
function changeExcludeMode(mode) {
  const url = new URL(window.location);
  url.searchParams.set('exclude', mode);
  window.location = url.toString();
}

/**
 * Handle API key change
 */
function changeApiKey() {
  promptForApiKey();
  location.reload();
}

/**
 * Wire up event handlers
 */
function setupEventHandlers() {
  const excludeSelect = document.getElementById('exclude-mode');
  if (excludeSelect) {
    excludeSelect.addEventListener('change', (e) => {
      changeExcludeMode(e.target.value);
    });
  }
  
  const apiKeyButton = document.getElementById('api-key-button');
  if (apiKeyButton) {
    apiKeyButton.addEventListener('click', changeApiKey);
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    initBirdingOpportunities();
  });
} else {
  setupEventHandlers();
  initBirdingOpportunities();
}
