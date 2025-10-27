import { formatExposure } from '../../../src/ts/helpers/format_exposure';
import { describe, it, expect } from 'vitest';

describe('formatExposure', () => {
  it('formats normal exposure times', () => {
    expect(formatExposure(0.004)).toBe('1/250');
    expect(formatExposure(0.002)).toBe('1/500');
    expect(formatExposure(0.001)).toBe('1/1000');
  });

  it('formats fast exposures', () => {
    expect(formatExposure(0.0005)).toBe('1/2000');
    expect(formatExposure(0.00025)).toBe('1/4000');
    expect(formatExposure(0.000125)).toBe('1/8000');
  });

  it('formats slow exposures', () => {
    expect(formatExposure(0.1)).toBe('1/10');
    expect(formatExposure(0.5)).toBe('1/2');
  });

  it('rounds to nearest integer denominator', () => {
    expect(formatExposure(0.003)).toBe('1/333'); // 1/0.003 = 333.333...
    expect(formatExposure(0.007)).toBe('1/143'); // 1/0.007 = 142.857...
  });

  it('throws error for zero exposure', () => {
    expect(() => formatExposure(0)).toThrow('Exposure must be a positive number.');
  });

  it('throws error for negative exposure', () => {
    expect(() => formatExposure(-0.004)).toThrow('Exposure must be a positive number.');
  });

  it('handles very small exposures', () => {
    expect(formatExposure(0.00001)).toBe('1/100000');
  });

  it('handles edge case of 1 second', () => {
    expect(formatExposure(1.0)).toBe('1/1');
  });
});
