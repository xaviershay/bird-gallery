import { navLinkBuilder } from '../../../src/ts/helpers/nav_link_builder';
import { Filter } from '../../../src/ts/model/filter';
import { ObsType } from '../../../src/ts/types';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('navLinkBuilder', () => {
  it('generates link with count from filterCounts', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      period: null
    });
    
    const filterCounts = {
      'type=sighting': 100,
      'type=photo': 50
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Photo,
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=photo"');
    expect(result).toContain('>50<');
  });

  it('marks current filter as active', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      period: null
    });
    
    const filterCounts = {
      'type=sighting': 100
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Sighting,
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('class="active"');
  });

  it('does not mark different filter as active', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      period: null
    });
    
    const filterCounts = {
      'type=photo': 50
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Photo,
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).not.toContain('class="active"');
  });

  it('handles filters with region', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      region: 'us',
      period: null
    });
    
    const filterCounts = {
      'type=sighting&region=us': 75,
      'type=sighting&region=au-vic': 25
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Sighting,
      region: 'au-vic',
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=sighting&amp;region=au-vic"');
    expect(result).toContain('>25<');
  });

  it('handles filters with county', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      county: 'Melbourne',
      period: null
    });
    
    const filterCounts = {
      'type=sighting&county=Melbourne': 30
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Sighting,
      county: 'Melbourne',
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=sighting&amp;county=Melbourne"');
    expect(result).toContain('>30<');
    expect(result).toContain('class="active"');
  });

  it('handles filters with period', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      period: '2025'
    });
    
    const filterCounts = {
      'type=sighting&period=2025': 40,
      'type=sighting&period=2024': 60
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Sighting,
      period: '2024'
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=sighting&amp;period=2024"');
    expect(result).toContain('>60<');
  });

  it('handles filters with view', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      view: 'firsts',
      period: null
    });
    
    const filterCounts = {
      'type=sighting&view=firsts': 20
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Sighting,
      view: 'firsts',
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=sighting&amp;view=firsts"');
    expect(result).toContain('>20<');
  });

  it('shows zero when filter count is not found', () => {
    const currentFilter = Filter.create({
      type: ObsType.Sighting,
      period: null
    });
    
    const filterCounts = {
      'type=sighting': 100
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Photo,
      period: null
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('>0<');
  });

  it('handles complex filter combinations', () => {
    const currentFilter = Filter.create({
      type: ObsType.Photo,
      region: 'us',
      period: '2025'
    });
    
    const filterCounts = {
      'type=photo&region=us&period=2025': 15
    };
    
    const linkBuilder = navLinkBuilder(currentFilter, filterCounts);
    const link = linkBuilder({
      type: ObsType.Photo,
      region: 'us',
      period: '2025'
    });
    
    const result = renderToString(link as React.ReactElement);
    expect(result).toContain('href="?type=photo&amp;region=us&amp;period=2025"');
    expect(result).toContain('>15<');
    expect(result).toContain('class="active"');
  });
});
