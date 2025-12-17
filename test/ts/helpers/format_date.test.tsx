import { formatDate } from '../../../src/ts/helpers/format_date';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';

describe('formatDate', () => {
  it('formats 1st with correct suffix', () => {
    const date = new Date('2025-03-01');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('1<sup>st</sup>');
    expect(result).toContain('Mar');
    expect(result).toContain('2025');
  });

  it('formats 2nd with correct suffix', () => {
    const date = new Date('2025-03-02');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('2<sup>nd</sup>');
    expect(result).toContain('Mar');
  });

  it('formats 3rd with correct suffix', () => {
    const date = new Date('2025-03-03');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('3<sup>rd</sup>');
    expect(result).toContain('Mar');
  });

  it('formats 4th-20th with "th" suffix', () => {
    const date4 = new Date('2025-03-04');
    expect(renderToString(formatDate(date4) as React.ReactElement)).toContain('4<sup>th</sup>');
    
    const date10 = new Date('2025-03-10');
    expect(renderToString(formatDate(date10) as React.ReactElement)).toContain('10<sup>th</sup>');
    
    const date20 = new Date('2025-03-20');
    expect(renderToString(formatDate(date20) as React.ReactElement)).toContain('20<sup>th</sup>');
  });

  it('formats 21st with correct suffix', () => {
    const date = new Date('2025-03-21');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('21<sup>st</sup>');
    expect(result).toContain('Mar');
  });

  it('formats 22nd with correct suffix', () => {
    const date = new Date('2025-03-22');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('22<sup>nd</sup>');
  });

  it('formats 23rd with correct suffix', () => {
    const date = new Date('2025-03-23');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('23<sup>rd</sup>');
  });

  it('formats 24th-30th with "th" suffix', () => {
    const date24 = new Date('2025-03-24');
    expect(renderToString(formatDate(date24) as React.ReactElement)).toContain('24<sup>th</sup>');
    
    const date30 = new Date('2025-03-30');
    expect(renderToString(formatDate(date30) as React.ReactElement)).toContain('30<sup>th</sup>');
  });

  it('formats 31st with correct suffix', () => {
    const date = new Date('2025-03-31');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('31<sup>st</sup>');
  });

  it('formats different months correctly', () => {
    const january = new Date('2025-01-15');
    expect(renderToString(formatDate(january) as React.ReactElement)).toContain('Jan');

    const december = new Date('2025-12-25');
    expect(renderToString(formatDate(december) as React.ReactElement)).toContain('Dec');
  });

  it('formats different years correctly', () => {
    const date2024 = new Date('2024-06-15');
    expect(renderToString(formatDate(date2024) as React.ReactElement)).toContain('2024');
    
    const date2026 = new Date('2026-06-15');
    expect(renderToString(formatDate(date2026) as React.ReactElement)).toContain('2026');
  });

  it('formats complete date example', () => {
    const date = new Date('2025-05-03');
    const result = renderToString(formatDate(date) as React.ReactElement);
    expect(result).toContain('3<sup>rd</sup> <!-- -->May 2025');
  });
});
