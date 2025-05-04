/**
 * Formats location names by removing coordinates, replacing double dashes, 
 * removing instructions, and trimming whitespace
 */
export default function formatLocationName(location: string): string {
  // Remove GPS coordinates like (40.7812, -73.9665)
  let formatted = location.replace(/\s*\(\s*-?\d+(\.\d+)?(\s*,\s*-?\d+(\.\d+)?)+\s*\)\s*$/g, '');
  
  // Replace double dashes with colons
  formatted = formatted.replace(/--/g, ': ');
  
  // Remove instructions in parentheses
  formatted = formatted.replace(/\s*\(do[^)]*\)\s*$/ig, '');
  
  // Trim whitespace
  formatted = formatted.trim();
  
  return formatted;
}