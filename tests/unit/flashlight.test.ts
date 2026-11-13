import { describe, expect, it } from 'vitest';
import { flickerFactor } from '../../src/player/Flashlight';

describe('flickerFactor', () => {
  it('is deterministic for a given time', () => {
    expect(flickerFactor(12.345)).toBe(flickerFactor(12.345));
  });

  it('stays in [0, 1]', () => {
    for (let t = 0; t < 10; t += 0.0137) {
      const f = flickerFactor(t);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
    }
  });

  it('actually goes dark and bright within 0.6 s (reads as a flicker)', () => {
    const samples = Array.from({ length: 36 }, (_, i) => flickerFactor(3 + i / 60));
    expect(Math.min(...samples)).toBeLessThan(0.15);
    expect(Math.max(...samples)).toBeGreaterThan(0.85);
  });
});
