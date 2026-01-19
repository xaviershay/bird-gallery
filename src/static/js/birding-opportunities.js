/**
 * Birding Opportunities Report (Client-Side)
 * 
 * Finds birds recently seen in a region/location that would be lifers or photo lifers.
 * 
 * Flow:
 * 1. Check for eBird API key in localStorage, prompt if missing
 * 2. Fetch species tags from server (lifer status for each species)
 * 3. Fetch recent observations from eBird API
 * 4. Filter to find "target" species (ones with at least one lifer tag)
 * 5. For each target species, fetch detailed location observations
 * 6. Display results on map and in table with tags
 */

const DAYS_BACK = 7;
const DEFAULT_REGION = "AU-VIC-MEL";
const DEFAULT_MAP_CENTER = [144.9631, -37.8136]; // Melbourne
const DEFAULT_ZOOM = 9;

// State
let speciesTags = {};  // Map of speciesCode -> tag info
let targetSpecies = [];
let allObservations = [];
let tagFilters = {
  'lifer': true,
  'photo-lifer': true,
  'year-lifer': true,
  'location-lifer': true
};
let mapInstance = null;  // Persistent map instance

/**
 * Get region and location from URL parameters
 */
function getLocationParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    region: params.get('region') || DEFAULT_REGION,
    location: params.get('location') || null
  };
}

/**
 * Get the region code or location to use for eBird API
 */
function getEBirdRegionOrLocation() {
  const { region, location } = getLocationParams();
  // If location is provided, use it (for hotspot-specific queries)
  // Otherwise use the region
  return location || region;
}

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
 * Get the display tags for a species.
 * When a tag implies others, we only show the most significant one:
 * - "Lifer" implies all others
 * - "Year Lifer" implies "Location Lifer"
 */
function getDisplayTags(tags) {
  if (!tags) return [];
  
  const result = [];
  
  if (tags.isLifer) {
    // Lifer implies everything else, so just show Lifer
    result.push({ class: 'tag-lifer', icon: '🏆', title: 'Lifer' });
  } else {
    // Not a lifer, so check photo lifer
    if (tags.isPhotoLifer) {
      result.push({ class: 'tag-photo-lifer', icon: '📸', title: 'Photo Lifer' });
    }
    
    // Year lifer implies location lifer, so only show year lifer if true
    if (tags.isYearLifer) {
      result.push({ class: 'tag-year-lifer', icon: '🎉', title: 'Year Lifer' });
    } else if (tags.isLocationLifer) {
      result.push({ class: 'tag-location-lifer', icon: '📍', title: 'Location Lifer' });
    }
  }
  
  return result;
}

/**
 * Check if a species has at least one relevant tag
 */
function hasAnyTag(tags) {
  if (!tags) return false;
  return tags.isLifer || tags.isPhotoLifer || tags.isYearLifer || tags.isLocationLifer;
}

/**
 * Initialize the report
 */
async function initBirdingOpportunities() {
  const { region, location } = getLocationParams();
  const regionOrLocation = location || region;
  console.log('[Birding Opportunities] Initializing with region/location:', regionOrLocation);
  
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
    
    // Fetch species tags from server
    showStatus("Loading your bird list...");
    console.log('[Birding Opportunities] Fetching species tags from server...');
    const tagsArray = await fetchSpeciesTags(region, location);
    
    // Convert to map for quick lookup
    speciesTags = {};
    tagsArray.forEach(s => {
      speciesTags[s.id] = s;
    });
    console.log(`[Birding Opportunities] Species tags loaded: ${tagsArray.length} species`);
    
    // Fetch recent observations from eBird
    showStatus(`Fetching recent observations in ${regionOrLocation}...`);
    console.log(`[Birding Opportunities] Fetching recent observations from eBird API for ${regionOrLocation}, last ${DAYS_BACK} days...`);
    const recentObs = await getRecentObservations(regionOrLocation, apiKey, DAYS_BACK);
    console.log(`[Birding Opportunities] Received ${recentObs.length} recent observations from eBird`, recentObs);
    
    // Find target species (ones with at least one tag)
    const uniqueSpecies = new Map();
    
    recentObs.forEach(obs => {
      const speciesCode = obs.speciesCode;
      const tags = speciesTags[speciesCode];
      
      // Only include if it has at least one tag and isn't Rock Pigeon
      if (hasAnyTag(tags) && speciesCode !== 'rocpig' && !uniqueSpecies.has(speciesCode)) {
        uniqueSpecies.set(speciesCode, {
          code: speciesCode,
          name: obs.comName,
          scientificName: obs.sciName,
          tags: tags
        });
      }
    });
    
    targetSpecies = Array.from(uniqueSpecies.values());
    console.log(`[Birding Opportunities] Found ${targetSpecies.length} target species with tags:`, targetSpecies);
    
    if (targetSpecies.length === 0) {
      console.log('[Birding Opportunities] No target birds found!');
      showStatus("No target birds found! Nothing recently reported matches your lifer criteria.");
      renderResults([]);
      return;
    }
    
    showStatus(`Found ${targetSpecies.length} target species. Fetching locations...`);
    console.log(`[Birding Opportunities] Fetching detailed observations for ${targetSpecies.length} species...`);
    
    // Fetch detailed observations for each target species
    const observationPromises = targetSpecies.map(async (species, index) => {
      try {
        // Check if data is cached before adding delay
        const isCached = isSpeciesObservationsCached(regionOrLocation, species.code, DAYS_BACK);
        
        // Only add delay for uncached requests to avoid rate limiting
        if (!isCached) {
          await new Promise(resolve => setTimeout(resolve, index * 100));
        }
        
        console.log(`[Birding Opportunities] Fetching observations for ${species.name} (${species.code})...`);
        const obs = await getSpeciesObservations(regionOrLocation, species.code, apiKey, DAYS_BACK);
        console.log(`[Birding Opportunities] Received ${obs.length} observations for ${species.name}`);
        return obs.map(o => ({
          ...o,
          commonName: species.name,
          scientificName: species.scientificName,
          speciesCode: species.code,
          tags: species.tags
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
    renderResults(allObservations);
    console.log('[Birding Opportunities] Rendering map...');
    renderMap(allObservations);
    console.log('[Birding Opportunities] Initialization complete!');
    
  } catch (error) {
    console.error("[Birding Opportunities] Error during initialization:", error);
    showError(`Error: ${error.message}`);
  }
}

/**
 * Fetch the species tags from the server
 */
async function fetchSpeciesTags(region, location) {
  let url = `/report/opportunities.json?region=${encodeURIComponent(region)}`;
  if (location) {
    url += `&location=${encodeURIComponent(location)}`;
  }
  console.log('[Birding Opportunities] Fetching species tags from:', url);
  const response = await fetch(url);
  if (!response.ok) {
    console.error('[Birding Opportunities] Failed to fetch species tags:', response.status, response.statusText);
    throw new Error('Failed to fetch species tags from server');
  }
  const data = await response.json();
  console.log('[Birding Opportunities] Species tags fetched successfully:', data.length, 'species');
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
 * Render results table with tags
 */
function renderResults(observations) {
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
    headerCell.colSpan = 2;
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

    // Output one row per sighting with tags
    loc.observations.forEach(obs => {
      const sightingRow = document.createElement('tr');
      const speciesCell = document.createElement('td');
      
      // Species name links to eBird species page
      const speciesLink = document.createElement('a');
      speciesLink.href = `https://ebird.org/species/${obs.speciesCode}`;
      speciesLink.textContent = obs.commonName || obs.comName;
      speciesLink.target = '_blank';
      speciesCell.appendChild(speciesLink);
      
      // Add tags inline after species name
      const displayTags = getDisplayTags(obs.tags);
      if (displayTags.length > 0) {
        displayTags.forEach(tag => {
          const tagSpan = document.createElement('span');
          tagSpan.className = `tag tag-icon ${tag.class}`;
          tagSpan.textContent = tag.icon;
          tagSpan.title = tag.title;
          speciesCell.appendChild(tagSpan);
        });
      }
      
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
  
  // If map already exists, just update the data source
  if (mapInstance) {
    const source = mapInstance.getSource("birds");
    if (source) {
      source.setData(geojson);
      console.log('[Birding Opportunities] Updated existing map data source');
      return;
    }
  }
  
  // Initialize map for the first time
  mapboxgl.accessToken = "pk.eyJ1IjoieGF2aWVyc2hheSIsImEiOiJjbWE3c2w3NzIxNmRsMmpxNDkybHp1YmdmIn0.1sPPFdMJ0-6DrZN5B9-0Dg";
  
  console.log('[Birding Opportunities] Initializing Mapbox map centered at', DEFAULT_MAP_CENTER);
  mapInstance = new mapboxgl.Map({
    container: "map",
    center: DEFAULT_MAP_CENTER,
    style: "mapbox://styles/xaviershay/cm9pb3a92004h01spbg7442q3",
    zoom: DEFAULT_ZOOM
  });
  
  mapInstance.on("load", () => {
    console.log('[Birding Opportunities] Map loaded, adding data source and layers...');
    mapInstance.addSource("birds", {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterRadius: 50
    });
    
    // Clusters
    mapInstance.addLayer({
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
    
    mapInstance.addLayer({
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
    mapInstance.addLayer({
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
    mapInstance.on("click", "clusters", (e) => {
      const features = mapInstance.queryRenderedFeatures(e.point, {
        layers: ["clusters"]
      });
      const clusterId = features[0].properties.cluster_id;
      mapInstance.getSource("birds").getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        mapInstance.easeTo({
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
    
    mapInstance.on("mouseenter", "unclustered-point", (e) => {
      mapInstance.getCanvas().style.cursor = "pointer";
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      const html = `<strong>${props.commonName}</strong><br>${props.name}<br>${props.date}`;
      popup.setLngLat(coordinates).setHTML(html).addTo(mapInstance);
    });
    
    mapInstance.on("mouseleave", "unclustered-point", () => {
      mapInstance.getCanvas().style.cursor = "";
      popup.remove();
    });
    
    mapInstance.on("mouseenter", "clusters", () => {
      mapInstance.getCanvas().style.cursor = "pointer";
    });
    
    mapInstance.on("mouseleave", "clusters", () => {
      mapInstance.getCanvas().style.cursor = "";
    });
    
    // Fit bounds on initial load if we have observations
    if (features.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      features.forEach(f => bounds.extend(f.geometry.coordinates));
      mapInstance.fitBounds(bounds, { padding: 50 });
    }
    
    console.log('[Birding Opportunities] Map setup complete with all layers and event handlers');
  });
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
  const apiKeyButton = document.getElementById('api-key-button');
  if (apiKeyButton) {
    apiKeyButton.addEventListener('click', changeApiKey);
  }
  
  // Tag filter legend click handlers
  const tagFilterElements = document.querySelectorAll('.tag-filter');
  tagFilterElements.forEach(el => {
    el.addEventListener('click', () => {
      const tag = el.dataset.tag;
      tagFilters[tag] = !tagFilters[tag];
      el.classList.toggle('active', tagFilters[tag]);
      applyTagFilters();
    });
  });
}

/**
 * Apply tag filters to the observations and re-render
 */
function applyTagFilters() {
  // Filter observations based on active tag filters
  const filtered = allObservations.filter(obs => {
    const tags = obs.tags;
    if (!tags) return false;
    
    // Check if observation has any enabled tag
    if (tags.isLifer && tagFilters['lifer']) return true;
    if (tags.isPhotoLifer && !tags.isLifer && tagFilters['photo-lifer']) return true;
    if (tags.isYearLifer && !tags.isLifer && tagFilters['year-lifer']) return true;
    if (tags.isLocationLifer && !tags.isLifer && !tags.isYearLifer && tagFilters['location-lifer']) return true;
    
    return false;
  });
  
  renderResults(filtered);
  renderMap(filtered);
  
  // Update status
  const uniqueSpeciesCount = new Set(filtered.map(o => o.speciesCode)).size;
  showStatus(`Showing ${filtered.length} observations of ${uniqueSpeciesCount} species`);
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
