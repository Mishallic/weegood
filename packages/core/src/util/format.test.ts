import { describe, expect, it } from 'vitest';
import { formatCompactNumber, formatDuration, pluralize } from './format';

describe('formatDuration', () => {
  it('formats minutes and seconds', () => {
    expect(formatDuration(185_000)).toBe('3:05');
    expect(formatDuration(760_000)).toBe('12:40');
  });

  it('adds hours when needed', () => {
    expect(formatDuration(3_750_000)).toBe('1:02:30');
  });

  it('renders invalid input as zero', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(Number.NaN)).toBe('0:00');
  });
});

describe('formatCompactNumber', () => {
  it('abbreviates thousands and millions', () => {
    expect(formatCompactNumber(930)).toBe('930');
    expect(formatCompactNumber(48_200)).toBe('48.2K');
    expect(formatCompactNumber(1_000_000)).toBe('1M');
  });
});

describe('pluralize', () => {
  it('handles singular and plural', () => {
    expect(pluralize(1, 'track')).toBe('1 track');
    expect(pluralize(12, 'track')).toBe('12 tracks');
  });
});
