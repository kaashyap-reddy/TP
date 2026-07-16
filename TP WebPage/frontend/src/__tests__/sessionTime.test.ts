import { describe, expect, it } from 'vitest';
import { formatTimeRange, minutesToLabel, parseTimeRange } from '../utils/sessionTime';

describe('minutesToLabel', () => {
  it('formats the curriculum slot boundaries', () => {
    expect(minutesToLabel(14 * 60 + 30)).toBe('2:30 PM');
    expect(minutesToLabel(16 * 60 + 30)).toBe('4:30 PM');
  });

  it('handles midnight and noon', () => {
    expect(minutesToLabel(0)).toBe('12:00 AM');
    expect(minutesToLabel(12 * 60)).toBe('12:00 PM');
  });
});

describe('parseTimeRange / formatTimeRange', () => {
  it('round-trips the standard session slot', () => {
    const { start, end } = parseTimeRange('2:30 PM - 4:30 PM');
    expect(start).toBe(870);
    expect(end).toBe(990);
    expect(formatTimeRange(start, end)).toBe('2:30 PM - 4:30 PM');
  });

  it('falls back sanely on unparseable input', () => {
    const { start, end } = parseTimeRange('whenever');
    expect(start).toBe(9 * 60);
    expect(end).toBe(10 * 60);
  });
});
