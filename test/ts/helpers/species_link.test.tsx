import speciesLink, { speciesUrl } from '../../../src/ts/helpers/species_link';
import { Observation, Species, ObsType } from '../../../src/ts/types';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('speciesUrl', () => {
  it('generates basic URL for species', () => {
    expect(speciesUrl('railor5')).toBe('/species/railor5');
  });

  it('generates URL with JSON format', () => {
    expect(speciesUrl('railor5', { format: 'json' })).toBe('/species/railor5.json');
  });

  it('generates URL with GeoJSON format', () => {
    expect(speciesUrl('railor5', { format: 'geojson' })).toBe('/species/railor5.geojson');
  });

  it('handles different species IDs', () => {
    expect(speciesUrl('baleag')).toBe('/species/baleag');
    expect(speciesUrl('houspa')).toBe('/species/houspa');
  });

  it('handles empty options object', () => {
    expect(speciesUrl('railor5', {})).toBe('/species/railor5');
  });
});

describe('speciesLink', () => {
  it('generates link from Observation object', () => {
    const observation: Observation = {
      id: '219171569-railor5',
      speciesId: 'railor5',
      name: 'Rainbow Lorikeet',
      locationId: '2552179',
      location: {
        id: 2552179,
        name: 'Royal Park',
        lat: -37.7892413,
        lng: 144.9508023
      },
      seenAt: new Date('2025-03-18T17:11:00'),
      lat: -37.7892413,
      lng: 144.9508023,
      hasPhoto: false
    };

    const result = renderToString(speciesLink(observation) as React.ReactElement);
    expect(result).toContain('href="/species/railor5"');
    expect(result).toContain('Rainbow Lorikeet');
  });

  it('generates link from Species object', () => {
    const species: Species = {
      id: 'railor5',
      name: 'Rainbow Lorikeet',
      photos: []
    };

    const result = renderToString(speciesLink(species) as React.ReactElement);
    expect(result).toContain('href="/species/railor5"');
    expect(result).toContain('Rainbow Lorikeet');
  });

  it('uses correct species ID from Observation', () => {
    const observation: Observation = {
      id: '123-houspa',
      speciesId: 'houspa',
      name: 'House Sparrow',
      locationId: '1234',
      location: {
        id: 1234,
        name: 'Test Location',
        lat: 0,
        lng: 0
      },
      seenAt: new Date(),
      lat: 0,
      lng: 0,
      hasPhoto: true
    };

    const result = renderToString(speciesLink(observation) as React.ReactElement);
    expect(result).toContain('href="/species/houspa"');
    expect(result).toContain('House Sparrow');
  });

  it('uses correct species ID from Species', () => {
    const species: Species = {
      id: 'baleag',
      name: 'Bald Eagle',
      photos: []
    };

    const result = renderToString(speciesLink(species) as React.ReactElement);
    expect(result).toContain('href="/species/baleag"');
    expect(result).toContain('Bald Eagle');
  });
});
