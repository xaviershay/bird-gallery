/**
 * eBird API Service (Client-Side)
 * 
 * Handles all interactions with the eBird API v2 from the browser.
 * Manages API key storage in localStorage.
 * 
 * API Documentation: https://documenter.getpostman.com/view/664302/S1ENwy59
 */

const EBIRD_API_BASE_URL = "https://api.ebird.org/v2";
const EBIRD_API_KEY_STORAGE_KEY = "ebird_api_key";
const EBIRD_CACHE_PREFIX = "ebird_cache_";
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get the eBird API key from localStorage
 * @returns {string|null} The API key or null if not set
 */
function getEBirdApiKey() {
  const key = localStorage.getItem(EBIRD_API_KEY_STORAGE_KEY);
  console.log('[eBird Service] Retrieved API key from localStorage:', key ? '(key exists)' : '(no key)');
  return key;
}

/**
 * Set the eBird API key in localStorage
 * @param {string} apiKey - The API key to store
 */
function setEBirdApiKey(apiKey) {
  console.log('[eBird Service] Saving API key to localStorage');
  localStorage.setItem(EBIRD_API_KEY_STORAGE_KEY, apiKey);
}

/**
 * Prompt user for eBird API key if not already set
 * @returns {string|null} The API key or null if user cancels
 */
function promptForApiKey() {
  const existingKey = getEBirdApiKey();
  
  const message = existingKey 
    ? "Enter your eBird API key (leave empty to keep existing):"
    : "Enter your eBird API key (get one from https://ebird.org/api/keygen):";
  
  console.log('[eBird Service] Prompting user for API key...');
  const apiKey = prompt(message, existingKey || "");
  
  if (apiKey && apiKey.trim()) {
    console.log('[eBird Service] User provided API key');
    setEBirdApiKey(apiKey.trim());
    return apiKey.trim();
  }
  
  console.log('[eBird Service] User cancelled or kept existing key');
  return existingKey;
}

/**
 * Generate a cache key for an endpoint
 * @param {string} endpoint - The API endpoint URL
 * @returns {string} The cache key
 */
function getCacheKey(endpoint) {
  // Create a simple hash of the endpoint for the cache key
  return EBIRD_CACHE_PREFIX + btoa(endpoint).replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Get cached data if available and not expired
 * @param {string} endpoint - The API endpoint URL
 * @returns {any|null} The cached data or null if not available/expired
 */
function getCachedData(endpoint) {
  try {
    const cacheKey = getCacheKey(endpoint);
    const cachedItem = localStorage.getItem(cacheKey);
    
    if (!cachedItem) {
      console.log('[eBird Service] No cached data found for:', endpoint);
      return null;
    }
    
    const { data, timestamp } = JSON.parse(cachedItem);
    const now = Date.now();
    
    if (now - timestamp > CACHE_DURATION_MS) {
      console.log('[eBird Service] Cache expired for:', endpoint);
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    console.log('[eBird Service] Using cached data for:', endpoint);
    return data;
  } catch (error) {
    console.error('[eBird Service] Error reading cache:', error);
    return null;
  }
}

/**
 * Store data in cache
 * @param {string} endpoint - The API endpoint URL
 * @param {any} data - The data to cache
 */
function setCachedData(endpoint, data) {
  try {
    const cacheKey = getCacheKey(endpoint);
    const cacheItem = {
      data: data,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheItem));
    console.log('[eBird Service] Cached data for:', endpoint);
  } catch (error) {
    console.error('[eBird Service] Error writing cache:', error);
    // If localStorage is full, try to clear old cache entries
    if (error.name === 'QuotaExceededError') {
      clearExpiredCache();
    }
  }
}

/**
 * Clear expired cache entries
 */
function clearExpiredCache() {
  console.log('[eBird Service] Clearing expired cache entries...');
  const now = Date.now();
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(EBIRD_CACHE_PREFIX)) {
      try {
        const item = JSON.parse(localStorage.getItem(key));
        if (now - item.timestamp > CACHE_DURATION_MS) {
          keysToRemove.push(key);
        }
      } catch (error) {
        // Invalid cache entry, remove it
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => localStorage.removeItem(key));
  console.log(`[eBird Service] Removed ${keysToRemove.length} expired cache entries`);
}

/**
 * Make a request to the eBird API with caching
 * @param {string} endpoint - The API endpoint URL
 * @param {string} apiKey - The API key to use
 * @returns {Promise<any>} The JSON response
 * @throws {Error} If the request fails
 */
async function ebirdApiFetch(endpoint, apiKey) {
  // Check cache first
  const cachedData = getCachedData(endpoint);
  if (cachedData !== null) {
    return cachedData;
  }
  
  console.log('[eBird Service] Making API request to:', endpoint);
  const response = await fetch(endpoint, {
    headers: {
      'X-eBirdApiToken': apiKey
    }
  });
  
  if (!response.ok) {
    console.error('[eBird Service] API request failed:', response.status, response.statusText);
    if (response.status === 401) {
      throw new Error('Invalid eBird API key. Please check your key and try again.');
    }
    throw new Error(`eBird API request failed: ${response.status} ${response.statusText}`);
  }
  
  const data = await response.json();
  console.log('[eBird Service] API request successful, received data:', data);
  
  // Cache the response
  setCachedData(endpoint, data);
  
  return data;
}

/**
 * Get recent observations for a region
 * @param {string} regionCode - The eBird region code (e.g., "AU-VIC-MEL")
 * @param {string} apiKey - The eBird API key
 * @param {number} back - Number of days back to search (default: 14)
 * @returns {Promise<Array>} Array of observation objects
 */
async function getRecentObservations(regionCode, apiKey, back = 14) {
  // Restrict to hotspots only
  const endpoint = `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent?back=${back}&hotspot=true`;
  return await ebirdApiFetch(endpoint, apiKey);
}

/**
 * Get recent observations of a specific species in a region
 * @param {string} regionCode - The eBird region code (e.g., "AU-VIC-MEL")
 * @param {string} speciesCode - The eBird species code (e.g., "railor5")
 * @param {string} apiKey - The eBird API key
 * @param {number} back - Number of days back to search (default: 7)
 * @returns {Promise<Array>} Array of observation objects with location details
 */
async function getSpeciesObservations(regionCode, speciesCode, apiKey, back = 7) {
  // Restrict to hotspots only
  const endpoint = `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent/${speciesCode}?back=${back}&hotspot=true`;
  return await ebirdApiFetch(endpoint, apiKey);
}

/**
 * Check if species observations are cached
 * @param {string} regionCode - The eBird region code (e.g., "AU-VIC-MEL")
 * @param {string} speciesCode - The eBird species code (e.g., "railor5")
 * @param {number} back - Number of days back to search (default: 7)
 * @returns {boolean} True if cached data exists and is not expired
 */
function isSpeciesObservationsCached(regionCode, speciesCode, back = 7) {
  const endpoint = `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent/${speciesCode}?back=${back}&hotspot=true`;
  return getCachedData(endpoint) !== null;
}
