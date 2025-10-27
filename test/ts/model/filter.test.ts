import { Filter } from '../../../src/ts/model/filter';
import { ObsType } from '../../../src/ts/types';
import { describe, it, expect } from 'vitest';

describe('Filter', () => {
  describe('create', () => {
    it('creates filter with all options', () => {
      const filter = Filter.create({
        type: ObsType.Photo,
        region: 'us',
        county: 'Los Angeles',
        period: '2025',
        view: 'firsts'
      });

      expect(filter.type).toBe(ObsType.Photo);
      expect(filter.region).toBe('us');
      expect(filter.county).toBe('Los Angeles');
      expect(filter.period).toBe('2025');
      expect(filter.view).toBe('firsts');
    });

    it('creates filter with minimal options', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: null
      });

      expect(filter.type).toBe(ObsType.Sighting);
      expect(filter.region).toBeNull();
      expect(filter.county).toBeNull();
      expect(filter.period).toBeNull();
      expect(filter.view).toBeNull();
    });

    it('converts undefined to null', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        region: undefined,
        period: null
      });

      expect(filter.region).toBeNull();
    });
  });

  describe('fromQueryString', () => {
    it('parses basic sighting type', () => {
      const params = new URLSearchParams('type=sighting');
      const filter = Filter.fromQueryString(params);

      expect(filter.type).toBe(ObsType.Sighting);
      expect(filter.region).toBeNull();
      expect(filter.county).toBeNull();
      expect(filter.period).toBeNull();
    });

    it('parses photo type', () => {
      const params = new URLSearchParams('type=photo');
      const filter = Filter.fromQueryString(params);

      expect(filter.type).toBe(ObsType.Photo);
    });

    it('defaults to sighting when type is missing', () => {
      const params = new URLSearchParams('');
      const filter = Filter.fromQueryString(params);

      expect(filter.type).toBe(ObsType.Sighting);
    });

    it('defaults to sighting when type is invalid', () => {
      const params = new URLSearchParams('type=invalid');
      const filter = Filter.fromQueryString(params);

      expect(filter.type).toBe(ObsType.Sighting);
    });

    it('parses region parameter', () => {
      const params = new URLSearchParams('type=sighting&region=us');
      const filter = Filter.fromQueryString(params);

      expect(filter.region).toBe('us');
    });

    it('parses county parameter', () => {
      const params = new URLSearchParams('type=sighting&county=Melbourne');
      const filter = Filter.fromQueryString(params);

      expect(filter.county).toBe('Melbourne');
    });

    it('parses period parameter', () => {
      const params = new URLSearchParams('type=sighting&period=2025');
      const filter = Filter.fromQueryString(params);

      expect(filter.period).toBe('2025');
    });

    it('parses view parameter', () => {
      const params = new URLSearchParams('type=sighting&view=firsts');
      const filter = Filter.fromQueryString(params);

      expect(filter.view).toBe('firsts');
    });

    it('parses all parameters together', () => {
      const params = new URLSearchParams('type=photo&region=au-vic&county=Melbourne&period=2024&view=firsts');
      const filter = Filter.fromQueryString(params);

      expect(filter.type).toBe(ObsType.Photo);
      expect(filter.region).toBe('au-vic');
      expect(filter.county).toBe('Melbourne');
      expect(filter.period).toBe('2024');
      expect(filter.view).toBe('firsts');
    });
  });

  describe('toQueryString', () => {
    it('generates query string for sighting type', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: null
      });

      expect(filter.toQueryString()).toBe('type=sighting');
    });

    it('generates query string for photo type', () => {
      const filter = Filter.create({
        type: ObsType.Photo,
        period: null
      });

      expect(filter.toQueryString()).toBe('type=photo');
    });

    it('includes region in query string', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        region: 'us',
        period: null
      });

      expect(filter.toQueryString()).toBe('type=sighting&region=us');
    });

    it('includes county in query string', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        county: 'Los Angeles',
        period: null
      });

      expect(filter.toQueryString()).toBe('type=sighting&county=Los+Angeles');
    });

    it('includes period in query string', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: '2025'
      });

      expect(filter.toQueryString()).toBe('type=sighting&period=2025');
    });

    it('includes view in query string', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        view: 'firsts',
        period: null
      });

      expect(filter.toQueryString()).toBe('type=sighting&view=firsts');
    });

    it('includes all parameters in query string', () => {
      const filter = Filter.create({
        type: ObsType.Photo,
        region: 'au-vic',
        county: 'Melbourne',
        period: '2024',
        view: 'firsts'
      });

      const queryString = filter.toQueryString();
      expect(queryString).toContain('type=photo');
      expect(queryString).toContain('region=au-vic');
      expect(queryString).toContain('county=Melbourne');
      expect(queryString).toContain('period=2024');
      expect(queryString).toContain('view=firsts');
    });

    it('omits null parameters', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        region: null,
        county: null,
        period: null,
        view: null
      });

      expect(filter.toQueryString()).toBe('type=sighting');
    });
  });

  describe('toJsonObject', () => {
    it('converts sighting filter to JSON object', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: null
      });

      const json = filter.toJsonObject();
      expect(json.type).toBe('sighting');
      expect(json.region).toBeNull();
      expect(json.county).toBeNull();
      expect(json.period).toBeNull();
      expect(json.view).toBeNull();
    });

    it('converts photo filter to JSON object', () => {
      const filter = Filter.create({
        type: ObsType.Photo,
        period: null
      });

      const json = filter.toJsonObject();
      expect(json.type).toBe('photo');
    });

    it('includes all parameters in JSON object', () => {
      const filter = Filter.create({
        type: ObsType.Photo,
        region: 'us',
        county: 'Los Angeles',
        period: '2025',
        view: 'firsts'
      });

      const json = filter.toJsonObject();
      expect(json.type).toBe('photo');
      expect(json.region).toBe('us');
      expect(json.county).toBe('Los Angeles');
      expect(json.period).toBe('2025');
      expect(json.view).toBe('firsts');
    });
  });

  describe('round-trip conversion', () => {
    it('preserves filter through query string round-trip', () => {
      const original = Filter.create({
        type: ObsType.Photo,
        region: 'au-vic',
        county: 'Melbourne',
        period: '2024',
        view: 'firsts'
      });

      const queryString = original.toQueryString();
      const params = new URLSearchParams(queryString);
      const restored = Filter.fromQueryString(params);

      expect(restored.type).toBe(original.type);
      expect(restored.region).toBe(original.region);
      expect(restored.county).toBe(original.county);
      expect(restored.period).toBe(original.period);
      expect(restored.view).toBe(original.view);
    });

    it('preserves minimal filter through round-trip', () => {
      const original = Filter.create({
        type: ObsType.Sighting,
        period: null
      });

      const queryString = original.toQueryString();
      const params = new URLSearchParams(queryString);
      const restored = Filter.fromQueryString(params);

      expect(restored.type).toBe(original.type);
      expect(restored.region).toBeNull();
      expect(restored.county).toBeNull();
      expect(restored.period).toBeNull();
    });
  });

  describe('edge cases', () => {
    it('handles special characters in county names', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        county: 'Saint-Martin',
        period: null
      });

      const queryString = filter.toQueryString();
      expect(queryString).toContain('county=Saint-Martin');

      const params = new URLSearchParams(queryString);
      const restored = Filter.fromQueryString(params);
      expect(restored.county).toBe('Saint-Martin');
    });

    it('handles spaces in region names', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        region: 'some region',
        period: null
      });

      const queryString = filter.toQueryString();
      const params = new URLSearchParams(queryString);
      const restored = Filter.fromQueryString(params);
      expect(restored.region).toBe('some region');
    });

    it('handles year periods', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: '2025'
      });

      expect(filter.toQueryString()).toContain('period=2025');
    });

    it('handles month periods', () => {
      const filter = Filter.create({
        type: ObsType.Sighting,
        period: '2025-03'
      });

      expect(filter.toQueryString()).toContain('period=2025-03');
    });
  });
});
