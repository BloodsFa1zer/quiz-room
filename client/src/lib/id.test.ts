import { describe, expect, it } from 'vitest';
import { createId } from './id';

describe('createId', () => {
  it('gives 1000 different ids for 1000 calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) ids.add(createId());
    expect(ids.size).toBe(1000);
  });

  it('returns a non-empty string', () => {
    expect(createId().length).toBeGreaterThan(8);
  });
});
