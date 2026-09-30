import { describe, expect, it } from 'vitest';
import { formatMillimes, formatTnd, packMillimes, parseMillimes, toMillimes } from './money';

describe('TND millime arithmetic', () => {
  it.each([
    [0.12, 100, '12,000 TND', '12.000 TND'],
    [0.09, 250, '22,500 TND', '22.500 TND'],
    [0.125, 50, '6,250 TND', '6.250 TND'],
    [0.333, 100, '33,300 TND', '33.300 TND'],
  ])('%s × %s is exact', (unit, pack, fr, en) => {
    // 0.333 * 100 in floating point is 33.300000000000004; in millimes it is 33300.
    expect(packMillimes(unit, pack)).toBe(Math.round(unit * 1000) * pack);
    expect(formatMillimes(packMillimes(unit, pack), 'fr')).toBe(fr);
    expect(formatMillimes(packMillimes(unit, pack), 'en')).toBe(en);
  });

  it('parses what an administrator types without binary fractions', () => {
    expect(parseMillimes('0,120')).toBe(120);
    expect(parseMillimes('0.12')).toBe(120);
    expect(parseMillimes('7')).toBe(7000);
    expect(parseMillimes(' 12,5 ')).toBe(12500);
    for (const invalid of ['', '-1', '0,1234', 'abc', '1,2,3'])
      expect(parseMillimes(invalid)).toBeNull();
  });

  it('always shows three decimals', () => {
    expect(formatTnd(12, 'fr')).toBe('12,000 TND');
    expect(formatTnd(0.12, 'en')).toBe('0.120 TND');
    expect(formatTnd(447.5, 'fr')).toBe('447,500 TND');
    expect(toMillimes(0.1 + 0.2)).toBe(300);
  });
});
