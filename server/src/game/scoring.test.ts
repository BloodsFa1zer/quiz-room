import { describe, expect, it } from 'vitest';
import { calcPoints } from './scoring';

describe('calcPoints', () => {
  it('follows the formula from §6.6', () => {
    expect(calcPoints(0, 20_000)).toBe(1000);
    expect(calcPoints(10_000, 20_000)).toBe(750);
    expect(calcPoints(20_000, 20_000)).toBe(500);
  });

  it('clamps answers outside the time window', () => {
    expect(calcPoints(30_000, 20_000)).toBe(500);
    expect(calcPoints(-5, 20_000)).toBe(1000);
  });

  it('always returns an integer', () => {
    for (const elapsed of [1, 333, 1234, 7777, 12_345, 19_999]) {
      expect(Number.isInteger(calcPoints(elapsed, 20_000))).toBe(true);
      expect(Number.isInteger(calcPoints(elapsed, 7_000))).toBe(true);
    }
  });
});
