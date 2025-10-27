/**
 * Date Utilities
 *
 * Timezone Assumptions:
 * - Database stores dates in local time (without timezone information)
 * - Dates should be treated as UTC for consistency
 * - When parsing from the database, we append "Z" to treat the string as UTC
 * - This prevents timezone conversion issues when displaying dates
 *
 * Storage: Local time (e.g., "2024-01-15 14:30:00")
 * Display: UTC interpretation (parsed as 2024-01-15T14:30:00Z)
 */

/**
 * Parses a date string from the database and treats it as UTC
 *
 * @param dateString - Date string from database (YYYY-MM-DD HH:MM:SS format or ISO 8601)
 * @returns Date object with the time interpreted as UTC
 *
 * @example
 * parseDbDate("2024-01-15 14:30:00") // Returns Date representing 2024-01-15T14:30:00Z
 * parseDbDate("2024-01-15T14:30:00.000Z") // Returns Date (already has timezone)
 */
export function parseDbDate(dateString: string | null | undefined): Date {
  if (!dateString) {
    throw new Error("Cannot parse null or undefined date string");
  }

  // Validate basic date format
  if (typeof dateString !== 'string' || dateString.trim().length === 0) {
    throw new Error(`Invalid date string: ${dateString}`);
  }

  // If the string already has a timezone indicator (Z or +/-HH:MM), parse directly
  // Otherwise append "Z" to treat as UTC
  if (dateString.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }

  // Append "Z" to treat as UTC
  return new Date(dateString + "Z");
}

/**
 * Parses a date string without timezone interpretation
 * Use this for dates that are already in the correct timezone or don't need UTC treatment
 *
 * @param dateString - Date string to parse
 * @returns Date object
 */
export function parseDate(dateString: string): Date {
  if (!dateString) {
    throw new Error("Cannot parse null or undefined date string");
  }

  return new Date(dateString);
}
