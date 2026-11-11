import { describe, expect, it } from 'vitest';
import { getRemainingMs } from './time';

describe('getRemainingMs', () => {
  it('returns the time left before the deadline', () => {
    expect(getRemainingMs(20_000, 0, 5_000)).toBe(15_000);
  });

  it('takes the clock offset into account', () => {
    // The local clock is 2 s behind the server: less time is left than it seems locally.
    expect(getRemainingMs(20_000, 2_000, 5_000)).toBe(13_000);
    // The local clock is 2 s ahead of the server: more time is left.
    expect(getRemainingMs(20_000, -2_000, 5_000)).toBe(17_000);
  });

  it('returns 0 after the deadline, never a negative number', () => {
    expect(getRemainingMs(20_000, 0, 20_000)).toBe(0);
    expect(getRemainingMs(20_000, 0, 25_000)).toBe(0);
    expect(getRemainingMs(20_000, 3_000, 19_000)).toBe(0);
  });

  it('returns 0 when there is no deadline', () => {
    expect(getRemainingMs(null, 0, 5_000)).toBe(0);
    expect(getRemainingMs(null, 2_000, 5_000)).toBe(0);
  });
});
