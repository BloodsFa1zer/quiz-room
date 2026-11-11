import { describe, expect, it } from 'vitest';
import { formatScore, plural } from './format';

const FORMS = ['гравець', 'гравці', 'гравців'] as const;

describe('plural', () => {
  it.each([
    [0, 'гравців'],
    [1, 'гравець'],
    [2, 'гравці'],
    [4, 'гравці'],
    [5, 'гравців'],
    [11, 'гравців'],
    [12, 'гравців'],
    [14, 'гравців'],
    [21, 'гравець'],
    [22, 'гравці'],
    [25, 'гравців'],
    [101, 'гравець'],
    [111, 'гравців'],
  ])('%i → %s', (n, expected) => {
    expect(plural(n, FORMS)).toBe(expected);
  });
});

describe('formatScore', () => {
  it('leaves small numbers as is', () => {
    expect(formatScore(0)).toBe('0');
    expect(formatScore(999)).toBe('999');
  });

  it('separates thousands with a non-breaking space', () => {
    expect(formatScore(1250)).toBe('1 250');
    expect(formatScore(12500)).toBe('12 500');
    expect(formatScore(1000000)).toBe('1 000 000');
  });
});
