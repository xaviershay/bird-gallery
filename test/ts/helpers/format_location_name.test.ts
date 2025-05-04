import formatLocationName from '../../../src/ts/helpers/format_location_name';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

describe('formatLocationName', () => {
  it('removes GPS coordinates', () => {
    expect(formatLocationName('Central Park (40.7812, -73.9665)')).toBe('Central Park');
  });

  it('replaces double dashes with colons', () => {
    expect(formatLocationName('California--Los Angeles')).toBe('California: Los Angeles');
    expect(formatLocationName('USA--NY--Manhattan')).toBe('USA: NY: Manhattan');
  });

  it('removes instructions', () => {
    expect(formatLocationName("Park (don't list emu)")).toBe('Park');
    expect(formatLocationName("Park (Northside)")).toBe('Park (Northside)');
  });

  it('handles coordinates and double dashes together', () => {
    expect(formatLocationName('Arizona--Phoenix (33.4484, -112.0740)')).toBe('Arizona: Phoenix');
  });

  it('trims whitespace', () => {
    expect(formatLocationName('  Mountain View  ')).toBe('Mountain View');
    expect(formatLocationName(' Forest (12.345, -67.890) ')).toBe('Forest');
  });

  it('handles empty strings', () => {
    expect(formatLocationName('')).toBe('');
  });

  it('returns original string when no replacements needed', () => {
    expect(formatLocationName('Simple Location')).toBe('Simple Location');
  });
});
