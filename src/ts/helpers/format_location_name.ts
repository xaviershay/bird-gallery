/**
 * Formats a location name by removing coordinates and replacing double dashes with colons
 */
export default function formatLocationName(locationName: string): string {
  return locationName
    .replace(/\(\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*\)/g, "")
    .replace(/--/g, ": ")
    .trim();
}