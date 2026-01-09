/**
 * Species Sightings Report (Client-Side)
 * 
 * Displays all observations of a specific bird within a distance from a location
 * in the last 7 days.
 * 
 * Flow:
 * 1. Check for eBird API key in localStorage, prompt if missing
 * 2. Parse URL parameters (locationId, speciesId, distance)
 * 3. Get location details from eBird API
 * 4. Get species details from eBird API
 * 5. Fetch recent observations near location
 * 6. Display results on map and in table
 */

const DAYS_BACK = 7;

// State
let observations = [];

/**
 * Format a date string with ordinal suffix and time in AM/PM format
 * @param {string} dateStr - Date string from eBird API (e.g., "2024-11-10 14:30")
 * @returns {string} Formatted date with HTML (e.g., "10<sup>th</sup> November 2024, 2:30 PM")
 */
function formatDateTime(dateStr) {
  if (!dateStr) return 'Unknown';
  
  const date = new Date(dateStr);
  if (isNaN(date)) return dateStr;
  
  const day = date.getDate();
  const suffix = ['th', 'st', 'nd', 'rd'][
    (day % 10 > 3) ? 0 : (((day % 100) - (day % 10) != 10) * (day % 10))
  ];
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  
  return `${day}<sup>${suffix}</sup> ${monthNames[date.getMonth()]} ${date.getFullYear()}, ${hours12}:${minutesStr} ${ampm}`;
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
 * Get location information from eBird API
 * @param {string} locationId - The eBird location ID (e.g., "L123456")
 * @param {string} apiKey - The eBird API key
 * @returns {Promise<Object>} Location information
 */
async function getLocationInfo(locationId, apiKey) {
  console.log('[Species Sightings] Fetching location info for:', locationId);
  const endpoint = `https://api.ebird.org/v2/ref/hotspot/info/${locationId}`;
  const response = await fetch(endpoint, {
    headers: {
      'X-eBirdApiToken': apiKey
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch location info: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[Species Sightings] Location info:', data);
  return data;
}

/**
 * Get species information from eBird taxonomy
 * @param {string} speciesCode - The eBird species code
 * @param {string} apiKey - The eBird API key
 * @returns {Promise<Object>} Species information
 */
async function getSpeciesInfo(speciesCode, apiKey) {
  console.log('[Species Sightings] Fetching species info for:', speciesCode);
  // Use taxonomy endpoint to get species details
  const endpoint = `https://api.ebird.org/v2/ref/taxonomy/ebird?species=${speciesCode}&fmt=json`;
  const response = await fetch(endpoint, {
    headers: {
      'X-eBirdApiToken': apiKey
    }
  });
  
  if (!response.ok) {
    console.error('[Species Sightings] Failed to fetch species info, will use observations instead');
    // Return a placeholder, we'll get the name from observations
    return { comName: speciesCode, sciName: '' };
  }
  
  const data = await response.json();
  console.log('[Species Sightings] Species info:', data);
  return data[0]; // Returns array with one element
}

/**
 * Fetch recent observations of a species near a location
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {string} speciesCode - The eBird species code
 * @param {number} distance - Distance in kilometers
 * @param {string} apiKey - The eBird API key
 * @returns {Promise<Array>} Array of observation objects
 */
async function getNearbyObservations(lat, lng, speciesCode, distance, apiKey) {
  console.log('[Species Sightings] Fetching nearby observations:', { lat, lng, speciesCode, distance });
  const endpoint = `https://api.ebird.org/v2/data/nearest/geo/recent/${speciesCode}?lat=${lat}&lng=${lng}&dist=${distance}&back=${DAYS_BACK}`;
  const response = await fetch(endpoint, {
    headers: {
      'X-eBirdApiToken': apiKey
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch observations: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[Species Sightings] Observations:', data);
  return data;
}

/**
 * Render results table
 */
function renderResults(observations) {
  console.log(`[Species Sightings] Rendering results table with ${observations.length} observations`);
  const tbody = document.getElementById('results-tbody');
  if (!tbody) return;

  if (observations.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #666;">No sightings found in the last 7 days.</td></tr>';
    return;
  }

  tbody.innerHTML = '';

  observations.forEach(obs => {
    const row = document.createElement('tr');
    
    // Location cell
    const locationCell = document.createElement('td');
    const locationLink = document.createElement('a');
    locationLink.href = `https://ebird.org/hotspot/${obs.locId}`;
    locationLink.textContent = obs.locName;
    locationLink.target = '_blank';
    locationCell.appendChild(locationLink);
    row.appendChild(locationCell);
    
    // Date cell
    const dateCell = document.createElement('td');
    const checklistLink = document.createElement('a');
    checklistLink.href = `https://ebird.org/checklist/${obs.subId}`;
    checklistLink.innerHTML = formatDateTime(obs.obsDt);
    checklistLink.target = '_blank';
    dateCell.appendChild(checklistLink);
    row.appendChild(dateCell);
    
    // Count cell
    const countCell = document.createElement('td');
    countCell.textContent = obs.howMany || 'X';
    row.appendChild(countCell);
    
    tbody.appendChild(row);
  });
}

/**
 * Render map with observations
 */
function renderMap(observations, centerLat, centerLng) {
  console.log(`[Species Sightings] Rendering map with ${observations.length} observations`);
  if (!window.mapboxgl) {
    console.error("[Species Sightings] Mapbox GL not loaded");
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
      date: obs.obsDt,
      count: obs.howMany || 'X',
      locationId: obs.locId,
      subId: obs.subId
    }
  }));
  
  const geojson = {
    type: "FeatureCollection",
    features: features
  };
  
  console.log('[Species Sightings] GeoJSON created with', features.length, 'features');
  
  // Initialize map
  mapboxgl.accessToken = "pk.eyJ1IjoieGF2aWVyc2hheSIsImEiOiJjbWE3c2w3NzIxNmRsMmpxNDkybHp1YmdmIn0.1sPPFdMJ0-6DrZN5B9-0Dg";
  
  console.log('[Species Sightings] Initializing Mapbox map...');
  const map = new mapboxgl.Map({
    container: "map",
    center: [centerLng, centerLat],
    style: "mapbox://styles/xaviershay/cm9pb3a92004h01spbg7442q3",
    zoom: 10
  });
  
  map.on("load", () => {
    console.log('[Species Sightings] Map loaded, adding data source and layers...');
    map.addSource("sightings", {
      type: "geojson",
      data: geojson
    });
    
    // Individual points
    map.addLayer({
      id: "sightings-points",
      type: "circle",
      source: "sightings",
      paint: {
        "circle-color": "#f28cb1",
        "circle-radius": 8,
        "circle-stroke-width": 2,
        "circle-stroke-color": "#fff"
      }
    });
    
    // Create popup
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });
    
    // Show popup on hover
    map.on("mouseenter", "sightings-points", (e) => {
      map.getCanvas().style.cursor = "pointer";
      
      const coordinates = e.features[0].geometry.coordinates.slice();
      const props = e.features[0].properties;
      
      const html = `
        <strong>${props.name}</strong><br/>
        ${props.date}<br/>
        Count: ${props.count}
      `;
      
      popup.setLngLat(coordinates).setHTML(html).addTo(map);
    });
    
    map.on("mouseleave", "sightings-points", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    
    // Click to open eBird checklist
    map.on("click", "sightings-points", (e) => {
      const props = e.features[0].properties;
      window.open(`https://ebird.org/checklist/${props.subId}`, '_blank');
    });
    
    console.log('[Species Sightings] Map setup complete');
  });
}

/**
 * Initialize the report
 */
async function initSpeciesSightings() {
  console.log('[Species Sightings] Initializing...');
  
  try {
    // Get configuration from global variable
    const config = window.SIGHTINGS_CONFIG;
    if (!config) {
      throw new Error("Configuration not found");
    }
    
    let { locationId, speciesId, distance } = config;
    // Add "L" prefix to locationId if not already present
    if (locationId && !locationId.startsWith('L')) {
      locationId = 'L' + locationId;
    }
    console.log('[Species Sightings] Config:', { locationId, speciesId, distance });
    
    // If species is not provided, show prompt and return
    if (!speciesId) {
      const descElem = document.getElementById('report-description');
      if (descElem) {
        descElem.textContent = 'Enter species code to see sightings.';
      }
      showStatus('Enter species code and click Search');
      return;
    }
    
    showStatus("Loading...");
    
    // Check for API key
    let apiKey = getEBirdApiKey();
    if (!apiKey) {
      console.log('[Species Sightings] No API key found in localStorage');
      showStatus("eBird API key required. Please enter your API key.");
      apiKey = promptForApiKey();
      if (!apiKey) {
        console.error('[Species Sightings] User cancelled API key prompt');
        showError("eBird API key is required to fetch sightings.");
        return;
      }
      console.log('[Species Sightings] API key entered and saved');
    } else {
      console.log('[Species Sightings] Using existing API key from localStorage');
    }
    
    // Fetch location info
    showStatus("Loading location information...");
    const location = await getLocationInfo(locationId, apiKey);
    
    // Fetch observations first to get species name
    showStatus(`Searching for observations near ${location.name}...`);
    observations = await getNearbyObservations(
      location.lat,
      location.lng,
      speciesId,
      distance,
      apiKey
    );
    
    console.log(`[Species Sightings] Found ${observations.length} observations`);
    
    // Get species name from observations if available, otherwise try API
    let speciesName = speciesId;
    if (observations.length > 0 && observations[0].comName) {
      speciesName = observations[0].comName;
    } else {
      // Try to fetch species info as fallback
      try {
        const species = await getSpeciesInfo(speciesId, apiKey);
        speciesName = species.comName;
      } catch (error) {
        console.warn('[Species Sightings] Could not fetch species name:', error);
      }
    }
    
    // Update page description
    const descElem = document.getElementById('report-description');
    if (descElem) {
      descElem.textContent = `Showing all sightings of ${speciesName} within ${distance}km of ${location.name} in the last ${DAYS_BACK} days.`;
    }
    
    showStatus(`Found ${observations.length} sighting${observations.length === 1 ? '' : 's'}`);
    
    // Render results
    console.log('[Species Sightings] Rendering results...');
    renderResults(observations);
    console.log('[Species Sightings] Rendering map...');
    renderMap(observations, location.lat, location.lng);
    console.log('[Species Sightings] Initialization complete!');
    
  } catch (error) {
    console.error("[Species Sightings] Error during initialization:", error);
    showError(`Error: ${error.message}`);
  }
}

/**
 * Wire up event handlers
 */
function setupEventHandlers() {
  const refreshButton = document.getElementById('refresh-button');
  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      const locationId = document.getElementById('location-input').value;
      const speciesId = document.getElementById('species-input').value;
      const distance = document.getElementById('distance-input').value;
      
      if (!locationId) {
        showError('Location ID is required');
        return;
      }
      
      // Navigate to new URL with updated parameters
      const url = new URL(window.location);
      url.searchParams.set('location', locationId);
      if (speciesId) {
        url.searchParams.set('species', speciesId);
      } else {
        url.searchParams.delete('species');
      }
      url.searchParams.set('distance', distance);
      window.location.href = url.toString();
    });
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupEventHandlers();
    initSpeciesSightings();
  });
} else {
  setupEventHandlers();
  initSpeciesSightings();
}
