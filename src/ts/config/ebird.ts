/**
 * eBird API Configuration
 * 
 * Configuration constants for interacting with the eBird API v2
 * API Documentation: https://documenter.getpostman.com/view/664302/S1ENwy59
 */

/**
 * Base URL for eBird API v2
 */
export const EBIRD_API_BASE_URL = "https://api.ebird.org/v2";

/**
 * Region code for Melbourne, Victoria, Australia
 * Format: AU-VIC-MEL
 */
export const MELBOURNE_REGION_CODE = "AU-VIC-MEL";

/**
 * Default number of days to look back for recent observations
 */
export const DEFAULT_DAYS_BACK = 7;

/**
 * Local storage key for storing the eBird API key
 */
export const EBIRD_API_KEY_STORAGE_KEY = "ebird_api_key";

/**
 * eBird API endpoints
 */
export const EBIRD_ENDPOINTS = {
  /**
   * Get recent notable observations for a region
   * Returns observations of rare species
   */
  RECENT_NOTABLE: (regionCode: string) => 
    `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent/notable`,
  
  /**
   * Get recent observations for a region
   * Returns all recent observations
   */
  RECENT_OBSERVATIONS: (regionCode: string) => 
    `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent`,
  
  /**
   * Get recent observations of a species in a region
   * Returns detailed location data for a specific species
   */
  SPECIES_OBSERVATIONS: (regionCode: string, speciesCode: string) => 
    `${EBIRD_API_BASE_URL}/data/obs/${regionCode}/recent/${speciesCode}`,
} as const;
